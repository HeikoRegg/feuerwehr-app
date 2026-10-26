// netlify/functions/person.js  (seit 2.28)
// Kleine Änderungen einer Person, die NICHT mehr als ganze Liste vom Handy überschrieben werden:
//  - Termine: Zusage/Absage, Gäste, Anmeldung (Teilnehmergrenze), Anwesenheit (nur mit Kalender-Recht)
//  - eigene Kachel-Reihenfolge (gilt auf allen Geräten)
//  - Push-Nachrichten aus/an (gilt auf allen Geräten; dringende Mitteilungen und Gerätemängel kommen trotzdem)
//  - (seit 2.29) Push-Anmeldung des Handys (Tabelle push_subscriptions ist nur noch über den Server erreichbar)
//  - (seit 2.29) G26-Foto im privaten Speicher "g26": hochladen, ansehen (nur selbst + Admins, Link 1 Stunde), entfernen
// Gespeichert wird „konfliktsicher“: frisch lesen, nur den einen Eintrag ändern und nur dann schreiben, wenn
// in der Zwischenzeit niemand anderes gespeichert hat (Vergleich über updated_at) – sonst neu versuchen.
// Damit gehen keine Zusagen mehr verloren, wenn viele gleichzeitig tippen.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const heuteBerlin = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const KACHEL_KEYS = /^[a-z0-9_-]{1,30}$/;
const G26_BUCKET = "g26";

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

// Liest einen kv-Eintrag, lässt ihn von `aendern` anpassen und schreibt nur, wenn sich updated_at seitdem nicht geändert hat.
// `aendern(wert)` gibt den neuen Wert zurück (oder wirft einen Fehler). Mehrere Versuche bei gleichzeitigen Änderungen.
export async function kvAendern(key, aendern, leer = null) {
  for (let versuch = 0; versuch < 8; versuch++) {
    const { data: row, error } = await db.from("kv_store").select("value,updated_at").eq("key", key).maybeSingle();
    if (error) throw error;
    const alt = row ? row.value : leer;
    const neu = aendern(JSON.parse(JSON.stringify(alt === undefined ? leer : alt)));
    const jetzt = new Date(Date.now() + versuch).toISOString();
    if (!row || !row.updated_at) {
      const { error: e2 } = await db.from("kv_store").upsert({ key, value: neu, updated_at: jetzt });
      if (e2) throw e2;
      return neu;
    }
    const { data: geschrieben, error: e3 } = await db.from("kv_store").update({ value: neu, updated_at: jetzt }).eq("key", key).eq("updated_at", row.updated_at).select("key");
    if (e3) throw e3;
    if (geschrieben && geschrieben.length) return neu;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw fehler(409, "Gerade speichern sehr viele gleichzeitig – bitte nochmal tippen.");
}

async function ladeLage(token) {
  const [usersRes, roster, config] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("config")]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const me = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const e = (me && (roster || []).find((r) => r && r.name === me.name)) || {};
  const admin = !!(me && me.is_admin);
  return { me: me && !e.gesperrt ? me : null, admin, eintrag: e, config: config || {}, kalenderRecht: (b) => admin || !!(((e.rechte || {})[b] || {}).calendar) };
}

// Einen Termin in der Liste „events“ ändern.
async function terminAendern(id, fn) {
  let ergebnis = null;
  await kvAendern("events", (liste) => {
    const arr = Array.isArray(liste) ? liste : [];
    const i = arr.findIndex((ev) => ev && ev.id === id);
    if (i < 0) throw fehler(404, "Diesen Termin gibt es nicht (mehr).");
    const neu = fn({ ...arr[i] });
    neu.updatedAt = Date.now();
    arr[i] = neu; ergebnis = neu;
    return arr;
  }, []);
  return ergebnis;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }
  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    const ich = lage.me.name;
    const { action } = body;
    const id = String(body.termin || "");

    if (action === "antwort") {
      const status = body.status === "zu" || body.status === "ab" ? body.status : null;
      if (!status) throw fehler(400, "Ungültige Antwort.");
      const termin = await terminAendern(id, (ev) => {
        if (ev.anmeldeschluss && heuteBerlin() > ev.anmeldeschluss) throw fehler(409, "Der Anmeldeschluss ist vorbei.");
        const responses = { ...(ev.responses || {}) };
        // Gleiches nochmal antippen = zurücknehmen (wie bisher)
        if (responses[ich] === status) delete responses[ich]; else responses[ich] = status;
        let guests = ev.guests;
        if (responses[ich] !== "zu" && guests && guests[ich] !== undefined) { guests = { ...guests }; delete guests[ich]; }
        return { ...ev, responses, guests };
      });
      return json(200, { ok: true, termin });
    }

    if (action === "gaeste") {
      const anzahl = Math.max(0, Math.min(20, parseInt(body.anzahl, 10) || 0));
      const termin = await terminAendern(id, (ev) => {
        if (ev.anmeldeschluss && heuteBerlin() > ev.anmeldeschluss) throw fehler(409, "Der Anmeldeschluss ist vorbei.");
        return { ...ev, guests: { ...(ev.guests || {}), [ich]: anzahl } };
      });
      return json(200, { ok: true, termin });
    }

    if (action === "anmeldung") {
      const termin = await terminAendern(id, (ev) => {
        const signups = { ...(ev.signups || {}) };
        if (signups[ich]) delete signups[ich];
        else {
          if (Object.keys(signups).length >= (ev.capacityNeeded || 0)) throw fehler(409, "Alle Plätze sind schon vergeben.");
          signups[ich] = true;
        }
        return { ...ev, signups };
      });
      return json(200, { ok: true, termin });
    }

    if (action === "anwesenheit") {
      const name = String(body.name || "").slice(0, 80);
      if (!name) throw fehler(400, "Name fehlt.");
      const termin = await terminAendern(id, (ev) => {
        if (!lage.kalenderRecht(ev.bereich)) throw fehler(403, "Anwesenheit dürfen nur Leute mit Kalender-Recht für diesen Bereich eintragen.");
        const anwesenheit = { ...(ev.anwesenheit || {}) };
        if (anwesenheit[name]) delete anwesenheit[name]; else anwesenheit[name] = true;
        return { ...ev, anwesenheit };
      });
      return json(200, { ok: true, termin });
    }

    if (action === "reihenfolge") {
      const keys = [...new Set((Array.isArray(body.kacheln) ? body.kacheln : []).map(String).filter((k) => KACHEL_KEYS.test(k)))].slice(0, 40);
      await kvAendern("kachelReihenfolge", (m) => ({ ...((m && typeof m === "object") ? m : {}), [ich]: keys }), {});
      return json(200, { ok: true, kacheln: keys });
    }

    // ---------- Push-Anmeldung dieses Handys ----------
    if (action === "pushAnmelden") {
      const sub = body.subscription && typeof body.subscription === "object" ? body.subscription : null;
      const endpoint = sub && typeof sub.endpoint === "string" ? sub.endpoint : "";
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) throw fehler(400, "Ungültige Push-Anmeldung.");
      const { data: alt } = await db.from("push_subscriptions").select("endpoint,name,badge_count").eq("endpoint", endpoint).maybeSingle();
      const { error } = await db.from("push_subscriptions").upsert({ endpoint, name: ich, subscription: { endpoint, keys: sub.keys || {}, expirationTime: sub.expirationTime ?? null }, badge_count: alt && alt.name === ich ? alt.badge_count || 0 : 0 });
      if (error) throw error;
      return json(200, { ok: true });
    }
    if (action === "pushZaehlerNull") {
      const endpoint = String(body.endpoint || "");
      if (endpoint) await db.from("push_subscriptions").update({ badge_count: 0 }).eq("endpoint", endpoint).eq("name", ich);
      return json(200, { ok: true });
    }

    // ---------- G26-Foto (privat) ----------
    if (action === "g26UploadUrl") {
      const pfad = `${crypto.randomBytes(8).toString("hex")}/${Date.now()}.jpg`;
      const { data, error } = await db.storage.from(G26_BUCKET).createSignedUploadUrl(pfad);
      if (error) throw fehler(500, "Der Speicher für G26-Fotos fehlt noch – bitte das SQL aus der Update-Anleitung ausführen.");
      return json(200, { path: pfad, uploadToken: data.token });
    }
    if (action === "g26FotoSetzen" || action === "g26FotoEntfernen") {
      const name = action === "g26FotoEntfernen" && body.name ? String(body.name) : ich;
      if (name !== ich && !lage.admin) throw fehler(403, "Das darfst du nur bei dir selbst.");
      const neu = action === "g26FotoSetzen" ? String(body.pfad || "") : "";
      if (neu && !/^[a-f0-9]{16}\/\d+\.jpg$/.test(neu)) throw fehler(400, "Ungültiges Foto.");
      let altPfad = "", g26 = null;
      await kvAendern("roster", (liste) => {
        const arr = Array.isArray(liste) ? liste : [];
        const i = arr.findIndex((r) => r && r.name === name);
        if (i < 0) throw fehler(404, "Mitglied nicht gefunden.");
        altPfad = ((arr[i].g26 || {}).fotoPfad) || "";
        g26 = { ...(arr[i].g26 || {}), fotoPfad: neu || null, photoUrl: null };
        arr[i] = { ...arr[i], g26 };
        return arr;
      }, []);
      if (altPfad && altPfad !== neu) { try { await db.storage.from(G26_BUCKET).remove([altPfad]); } catch (e) { /* egal */ } }
      return json(200, { ok: true, g26 });
    }
    if (action === "g26Foto") {
      const name = String(body.name || ich);
      if (name !== ich && !lage.admin) throw fehler(403, "G26-Fotos anderer sehen nur Admins.");
      const roster = (await getKv("roster")) || [];
      const pfad = ((roster.find((r) => r && r.name === name) || {}).g26 || {}).fotoPfad;
      if (!pfad) return json(200, { url: null });
      const { data } = await db.storage.from(G26_BUCKET).createSignedUrl(pfad, 60 * 60);
      return json(200, { url: data ? data.signedUrl : null });
    }

    if (action === "pushAus") {
      const aus = !!body.aus;
      await kvAendern("pushAus", (m) => {
        const n = { ...((m && typeof m === "object") ? m : {}) };
        if (aus) n[ich] = new Date().toISOString(); else delete n[ich];
        return n;
      }, {});
      return json(200, { ok: true, aus });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
