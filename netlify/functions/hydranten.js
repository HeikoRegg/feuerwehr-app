// netlify/functions/hydranten.js
// Hydranten-Verwaltung: Stammdaten, Standort (GPS), Kontrollen mit Verlauf und Foto.
//  - Hydranten mit Nummer, Lage, Kontrollgruppe, Ausführung, Standort und letztem Stand -> Tabelle hydranten
//  - Verlauf (Kontrollen, behobene Mängel, Standort-Änderungen)                     -> Tabelle hydranten_kontrollen
//  - Fotos im privaten Speicher "hydranten" (Zugriff über kurzlebige Links)
//
// Rechte (immer frisch aus der Mitgliederliste ermittelt):
//  - Ansehen, Kontrolle eintragen, Standort erfassen: Einsatzabteilung und alle Verwalter
//  - Verwalter (Hydranten anlegen, ändern, löschen, Mangel als behoben eintragen, Einträge löschen):
//    Admins, Kommandant, stellv. Kommandant und Mitglieder mit Haken "Hydranten-Verantwortlicher"
// Ist ein Hydrant nicht funktionsfähig oder hat er einen Mangel, bekommen alle Verwalter eine Push-Nachricht.
// Einen Prüfintervall gibt es bewusst nicht – gespeichert wird, wann zuletzt kontrolliert wurde.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "hydranten";
const TYPEN = ["unterflur", "ueberflur", "schieber", "sonstige"];

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const neueId = () => crypto.randomBytes(5).toString("hex");
const kurz = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const wahl = (v, erlaubt) => (erlaubt.includes(v) ? v : "");
const janein = (v) => (v === true || v === false ? v : null);
// Heutiges Datum in deutscher Zeit (der Server läuft in UTC).
const heute = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

async function ladeLage(token) {
  const [usersRes, roster, config] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("config")]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const me = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const liste = roster || [];
  const e = (me && liste.find((r) => r && r.name === me.name)) || {};
  const admin = !!(me && me.is_admin);
  const verwalter = admin || !!e.kommandant || !!e.stellvKommandant || !!e.hydrantenwart;
  const einsatz = (e.bereiche || []).includes("einsatzabteilung");
  return { me, users, roster: liste, config: config || {}, rechte: { verwalter, zugriff: verwalter || einsatz } };
}
// Admins, Kommandant, stellv. Kommandant und Hydranten-Verantwortliche (ohne Absender und gesperrte Mitglieder).
function verwalterNamen(lage, ausser) {
  const gesperrt = new Set([...lage.users.filter((u) => u.blocked).map((u) => u.name), ...lage.roster.filter((r) => r && r.gesperrt).map((r) => r.name)]);
  const namen = new Set([
    ...lage.users.filter((u) => u.is_admin).map((u) => u.name),
    ...lage.roster.filter((r) => r && (r.kommandant || r.stellvKommandant || r.hydrantenwart)).map((r) => r.name),
  ]);
  return [...namen].filter((n) => n && !gesperrt.has(n) && n !== ausser);
}
async function push(an, title, text, sender) {
  if (!an.length) return;
  try { await sendPush({ httpMethod: "POST", body: JSON.stringify({ an, title, text, sender }) }); } catch (e) { /* Push ist Zusatz – die Kontrolle ist gespeichert */ }
}
async function fotoUrl(path) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data ? data.signedUrl : null;
}
async function fotoLoeschen(pfade) {
  const p = (pfade || []).filter(Boolean);
  if (p.length) { try { await db.storage.from(BUCKET).remove(p); } catch (e) { /* egal */ } }
}

// Nummern: Großbuchstaben, ohne Leerzeichen. Fehlt eine Nummer, vergibt die App HY9001, HY9002 …
const saubereNr = (v) => kurz(v, 20).toUpperCase().replace(/\s+/g, "");
const freieNummer = (alle) => {
  const max = alle.reduce((m, h) => { const x = /^HY9(\d{3})$/.exec(h.nr || ""); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
  return `HY9${String(max + 1).padStart(3, "0")}`;
};
async function alleHydranten() {
  const { data, error } = await db.from("hydranten").select("*");
  if (error) throw error;
  return data || [];
}
async function hydrantLaden(id) {
  const { data } = await db.from("hydranten").select("*").eq("id", String(id || "")).maybeSingle();
  return data || null;
}
const alsHydrant = (row) => ({ ...(row.data || {}), id: row.id });

function saubereStammdaten(d) {
  const lage = kurz(d.lage, 120);
  if (!lage) throw fehler(400, "Bitte die Lage eingeben (Straße / Hausnummer).");
  const g = parseInt(d.gruppe, 10);
  return {
    nr: saubereNr(d.nr), lage,
    gruppe: g >= 1 && g <= 4 ? g : null,
    typ: wahl(d.typ, TYPEN) || "unterflur",
    art: wahl(d.art, ["BW", "BY"]), oeffnen: wahl(d.oeffnen, ["links", "rechts"]), standrohr: wahl(d.standrohr, ["kurz", "lang"]),
    bemerkung: kurz(d.bemerkung, 500),
  };
}
function sauberePosition(p) {
  const lat = Number(p && p.lat), lng = Number(p && p.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) throw fehler(400, "Der Standort ist ungültig.");
  const gen = Number(p.genauigkeit);
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, genauigkeit: isFinite(gen) && gen > 0 ? Math.round(gen) : null };
}

// Was bei einer Kontrolle nicht in Ordnung war (für Liste, Push und Verlauf).
function befunde(k) {
  const b = [];
  if (k.funktionsfaehig === false) b.push("nicht funktionsfähig");
  const s = k.schild || {};
  if (s.vorhanden === false) b.push("Schild fehlt");
  else {
    if (s.lesbar === false) b.push("Schild nicht lesbar");
    if (s.bemassung === false) b.push("Schild-Bemaßung falsch");
  }
  if (k.mangel) b.push(k.text ? k.text : "Mangel");
  return b;
}
const zustandAus = (k) => (k.funktionsfaehig === false ? "defekt" : befunde(k).length ? "mangel" : "ok");
// Neueste zuerst: nach Datum, dann Eintragszeit (bei gleicher Zeit gilt „behoben“ als später).
const neuerZuerst = (a, b) => String(b.datum || "").localeCompare(String(a.datum || "")) || String(b.ts || "").localeCompare(String(a.ts || "")) || (b.art === "behoben") - (a.art === "behoben");

// Letzten Stand aus dem Verlauf berechnen und am Hydranten speichern (für die schnelle Liste).
async function standAktualisieren(row) {
  const { data, error } = await db.from("hydranten_kontrollen").select("*").eq("hydrant", row.id);
  if (error) throw error;
  const eintraege = (data || []).slice().sort(neuerZuerst);
  const kontrollen = eintraege.filter((e) => e.art === "kontrolle");
  const letzte = kontrollen[0];
  const massgeblich = eintraege.find((e) => e.art === "kontrolle" || e.art === "behoben");
  const d = { ...(row.data || {}) };
  d.letzteKontrolle = letzte ? { datum: letzte.datum, von: letzte.von } : null;
  d.anzahlKontrollen = kontrollen.length;
  if (!massgeblich) { d.zustand = ""; d.zustandText = ""; }
  else if (massgeblich.art === "behoben") { d.zustand = "ok"; d.zustandText = ""; }
  else { const k = massgeblich.data || {}; d.zustand = zustandAus(k); d.zustandText = befunde(k).join(" · "); }
  const jetzt = new Date().toISOString();
  const { error: e2 } = await db.from("hydranten").upsert({ ...row, data: d, updated_at: jetzt });
  if (e2) throw e2;
  return d;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    // Für die Liste die Daten gleich mitladen (gleichzeitig mit der Anmeldung) – spart Wartezeit.
    const listeVorab = body.action === "list" ? db.from("hydranten").select("*").then((r) => r, (e) => ({ error: e })) : null;
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    {
      // Vom Hauptadmin für die ganze Feuerwehr gesperrte Kachel (Einstellungen → Kacheln verwalten).
      const aus = Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : [];
      if (aus.includes("hydranten")) return json(403, { error: "Diese Kachel ist derzeit für die ganze Feuerwehr gesperrt." });
    }
    if (!lage.rechte.zugriff) return json(403, { error: "Die Hydranten sind für die Einsatzabteilung." });
    const ich = lage.me.name;
    const { verwalter } = lage.rechte;
    const { action } = body;
    const nurVerwalter = () => { if (!verwalter) throw fehler(403, "Das dürfen nur Admins, Kommandant, Stellvertreter und Hydranten-Verantwortliche."); };

    if (action === "list") {
      const r = await listeVorab;
      if (r.error) throw r.error;
      const hydranten = (r.data || []).map(alsHydrant).sort((a, b) => String(a.nr).localeCompare(String(b.nr), "de", { numeric: true }));
      return json(200, { ich, rechte: lage.rechte, hydranten });
    }

    if (action === "get") {
      const row = await hydrantLaden(body.id);
      if (!row) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const { data, error } = await db.from("hydranten_kontrollen").select("*").eq("hydrant", row.id);
      if (error) throw error;
      const verlauf = await Promise.all((data || []).slice().sort(neuerZuerst).slice(0, 100).map(async (e) => ({
        ...(e.data || {}), ausfuehrung: (e.data || {}).art || "", id: e.id, art: e.art, datum: e.datum, ts: e.ts, von: e.von,
        befunde: e.art === "kontrolle" ? befunde(e.data || {}) : [],
        fotoUrl: await fotoUrl((e.data || {}).foto),
      })));
      return json(200, { hydrant: alsHydrant(row), verlauf, rechte: lage.rechte });
    }

    if (action === "save") {
      nurVerwalter();
      const h = body.hydrant || {};
      const d = saubereStammdaten(h);
      const alle = (await alleHydranten()).map(alsHydrant);
      const alt = h.id ? alle.find((x) => x.id === String(h.id)) : null;
      if (h.id && !alt) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const id = alt ? alt.id : neueId();
      if (!d.nr) d.nr = alt && alt.nr ? alt.nr : freieNummer(alle);
      if (alle.some((x) => x.id !== id && String(x.nr || "").toUpperCase() === d.nr)) return json(400, { error: `Die Nummer ${d.nr} gibt es schon.` });
      const jetzt = new Date().toISOString();
      const vorher = alt || {};
      // Ändert ein Verwalter Ausführung, Öffnen oder Standrohr, gilt der Wert als bestätigt.
      const vorbelegt = !!vorher.vorbelegt && d.art === (vorher.art || "") && d.oeffnen === (vorher.oeffnen || "") && d.standrohr === (vorher.standrohr || "");
      const { id: _x, ...rest } = vorher;
      const data = { ...rest, ...d, vorbelegt, angelegtVon: vorher.angelegtVon || ich, angelegtAm: vorher.angelegtAm || jetzt, geaendertVon: ich, geaendertAm: jetzt };
      const rowAlt = alt ? await hydrantLaden(id) : null;
      const { error } = await db.from("hydranten").upsert({ id, data, created_at: rowAlt ? rowAlt.created_at : jetzt, updated_at: jetzt });
      if (error) throw error;
      return json(200, { ok: true, id, nr: d.nr });
    }

    if (action === "delete") {
      nurVerwalter();
      const row = await hydrantLaden(body.id);
      if (!row) return json(200, { ok: true });
      const { data: eintraege } = await db.from("hydranten_kontrollen").select("*").eq("hydrant", row.id);
      await fotoLoeschen((eintraege || []).map((e) => (e.data || {}).foto));
      await db.from("hydranten_kontrollen").delete().eq("hydrant", row.id);
      await db.from("hydranten").delete().eq("id", row.id);
      return json(200, { ok: true });
    }

    if (action === "uploadUrl") {
      const safe = String(body.filename || "foto.jpg").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const path = `kontrolle/${neueId()}/${Date.now()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json(200, { path, uploadToken: data.token });
    }

    if (action === "kontrolle") {
      const row = await hydrantLaden(body.hydrant);
      if (!row) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const k = body.kontrolle || {};
      const datum = String(k.datum || "");
      if (!istDatum(datum)) return json(400, { error: "Bitte das Kontrolldatum eintragen." });
      if (datum > heute()) return json(400, { error: "Das Kontrolldatum liegt in der Zukunft." });
      if (datum < "2000-01-01") return json(400, { error: "Bitte das Kontrolldatum prüfen." });
      if (k.funktionsfaehig !== true && k.funktionsfaehig !== false) return json(400, { error: "Bitte angeben, ob der Hydrant funktionsfähig ist." });
      const vorhanden = janein(k.schild && k.schild.vorhanden);
      const schild = { vorhanden, lesbar: vorhanden === false ? null : janein(k.schild && k.schild.lesbar), bemassung: vorhanden === false ? null : janein(k.schild && k.schild.bemassung) };
      const zahl = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) && n >= 0 && n < 100 ? Math.round(n * 100) / 100 : null; };
      const abweichung = schild.bemassung === false ? { laengs: zahl(k.abweichung && k.abweichung.laengs), quer: zahl(k.abweichung && k.abweichung.quer) } : null;
      const text = kurz(k.text, 1000);
      const daten = {
        funktionsfaehig: k.funktionsfaehig,
        art: wahl(k.art, ["BW", "BY"]), oeffnen: wahl(k.oeffnen, ["links", "rechts"]), standrohr: wahl(k.standrohr, ["kurz", "lang"]),
        schild, abweichung, text, mangel: !!k.mangel,
        foto: String(k.foto || "").startsWith("kontrolle/") ? String(k.foto) : "",
      };
      if ((daten.funktionsfaehig === false || daten.mangel) && text.length < 3) return json(400, { error: "Bitte kurz beschreiben, was nicht in Ordnung ist." });
      const pos = k.standort ? sauberePosition(k.standort) : null;
      const jetzt = new Date().toISOString();
      const { error } = await db.from("hydranten_kontrollen").upsert({ id: neueId(), hydrant: row.id, art: "kontrolle", datum, ts: jetzt, von: ich, data: daten });
      if (error) throw error;

      let d = { ...(row.data || {}) };
      const letzteVorher = d.letzteKontrolle && d.letzteKontrolle.datum;
      // Die neueste Kontrolle bestätigt Ausführung, Öffnen und Standrohr (nachgetragene ältere nicht).
      if (!letzteVorher || datum >= letzteVorher) {
        if (daten.art) d.art = daten.art;
        if (daten.oeffnen) d.oeffnen = daten.oeffnen;
        if (daten.standrohr) d.standrohr = daten.standrohr;
        if (daten.art || daten.oeffnen || daten.standrohr) d.vorbelegt = false;
      }
      // Standort gleich mit erfassen (z. B. bei der ersten Kontrollrunde).
      if (pos) {
        const p = pos;
        Object.assign(d, p, { standortVon: ich, standortAm: jetzt, standortQuelle: "gps" });
        await db.from("hydranten_kontrollen").upsert({ id: neueId(), hydrant: row.id, art: "standort", datum: heute(), ts: jetzt, von: ich, data: { ...p, quelle: "gps" } });
      }
      d = await standAktualisieren({ ...row, data: d });

      const b = befunde(daten);
      if (b.length) {
        const name = `${d.nr}${d.lage ? ` (${d.lage})` : ""}`;
        await push(verwalterNamen(lage, ich), daten.funktionsfaehig === false ? `🚒 Hydrant nicht funktionsfähig: ${name}` : `⚠️ Hydrant mit Mangel: ${name}`, `${ich}: ${b.join(" · ")}`, ich);
      }
      return json(200, { ok: true, hydrant: { ...d, id: row.id } });
    }

    if (action === "behoben") {
      nurVerwalter();
      const row = await hydrantLaden(body.hydrant);
      if (!row) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const text = kurz(body.text, 600);
      if (text.length < 3) return json(400, { error: "Bitte kurz eintragen, was gemacht wurde." });
      const jetzt = new Date().toISOString();
      const { error } = await db.from("hydranten_kontrollen").upsert({ id: neueId(), hydrant: row.id, art: "behoben", datum: heute(), ts: jetzt, von: ich, data: { text } });
      if (error) throw error;
      const d = await standAktualisieren(row);
      return json(200, { ok: true, hydrant: { ...d, id: row.id } });
    }

    if (action === "standort") {
      const row = await hydrantLaden(body.hydrant);
      if (!row) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const quelle = body.quelle === "karte" ? "karte" : "gps";
      const p = sauberePosition(body);
      const jetzt = new Date().toISOString();
      const alt = row.data || {};
      const { error } = await db.from("hydranten_kontrollen").upsert({ id: neueId(), hydrant: row.id, art: "standort", datum: heute(), ts: jetzt, von: ich, data: { ...p, quelle, vorher: alt.lat != null ? { lat: alt.lat, lng: alt.lng } : null } });
      if (error) throw error;
      const d = { ...alt, ...p, standortVon: ich, standortAm: jetzt, standortQuelle: quelle };
      const { error: e2 } = await db.from("hydranten").upsert({ ...row, data: d, updated_at: jetzt });
      if (e2) throw e2;
      return json(200, { ok: true, hydrant: { ...d, id: row.id } });
    }

    if (action === "standortEntfernen") {
      nurVerwalter();
      const row = await hydrantLaden(body.hydrant);
      if (!row) return json(404, { error: "Diesen Hydranten gibt es nicht (mehr)." });
      const { lat, lng, genauigkeit, standortVon, standortAm, standortQuelle, ...rest } = row.data || {};
      const jetzt = new Date().toISOString();
      await db.from("hydranten_kontrollen").upsert({ id: neueId(), hydrant: row.id, art: "standort", datum: heute(), ts: jetzt, von: ich, data: { entfernt: true, vorher: lat != null ? { lat, lng } : null } });
      const { error } = await db.from("hydranten").upsert({ ...row, data: rest, updated_at: jetzt });
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === "deleteEintrag") {
      nurVerwalter();
      const { data: e } = await db.from("hydranten_kontrollen").select("*").eq("id", String(body.eintrag || "")).maybeSingle();
      if (!e) return json(200, { ok: true });
      await fotoLoeschen([(e.data || {}).foto]);
      await db.from("hydranten_kontrollen").delete().eq("id", e.id);
      const row = await hydrantLaden(e.hydrant);
      if (row) await standAktualisieren(row);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    const text = e && e.message ? e.message : String(e);
    if (/hydranten/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabellen für die Hydranten fehlen noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
