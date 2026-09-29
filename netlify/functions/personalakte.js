// netlify/functions/personalakte.js
// Personalakten liegen in der geschützten Tabelle "personalakten" und die Nachweis-Fotos
// im privaten Speicher "personalakte". Lesen und Schreiben ist nur über diese Funktion
// möglich – und nur für die Person selbst und für Admins. Jugendwarte (Funktion "Jugendwart" in der
// eigenen Akte, die nur der Admin vergeben kann) dürfen zusätzlich die Akten der Jugendlichen pflegen.

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "personalakte";
const ADMIN_ONLY_FIELDS = ["befoerderungen", "ehrungen", "funktionen"]; // Rang, Beförderungen, Ehrungen, Funktionen: nur Admin

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const folderFor = (name) => String(name || "").replace(/[^a-z0-9]+/gi, "_");

async function userByToken(token) {
  if (!token) return null;
  // Kleine Tabelle – deshalb einfach alle Benutzer laden und den Schlüssel hier im Code suchen.
  const { data, error } = await db.from("app_users").select("name,is_admin,tokens,blocked,elevated_token,elevated_until");
  if (error) throw error;
  return (data || []).find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) || null;
}
async function loadAkte(name) {
  const { data } = await db.from("personalakten").select("data").eq("name", name).maybeSingle();
  return (data && data.data) || {};
}
async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
function aktiveFunktionen(akte) {
  return ((akte && akte.funktionen) || []).map((f) => (typeof f === "string" ? { name: f, status: "aktiv" } : f)).filter((f) => f.status !== "ad").map((f) => f.name);
}
async function istJugendwart(name) { return aktiveFunktionen(await loadAkte(name)).includes("Jugendwart"); }
// Jugendliche = Bereich Jugendfeuerwehr, aber nicht Einsatzabteilung, und kein Admin.
async function jugendlicheNamen() {
  const roster = (await getKv("roster")) || [];
  const { data: admins } = await db.from("app_users").select("name").eq("is_admin", true);
  const adminSet = new Set((admins || []).map((a) => a.name));
  return new Set(roster.filter((r) => r && (r.bereiche || []).includes("jugendfeuerwehr") && !(r.bereiche || []).includes("einsatzabteilung") && !adminSet.has(r.name)).map((r) => r.name));
}
function photoPaths(akte) {
  return ((akte && akte.lehrgaenge) || []).map((l) => l.photoPath).filter(Boolean);
}
function aktuellerRang(akte) {
  const list = ((akte && akte.befoerderungen) || []).filter((b) => b.rang).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  return list.length ? list[list.length - 1].rang : "";
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const me = await userByToken(body.token);
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });
    {
      // Vom Hauptadmin für die ganze Feuerwehr gesperrte Kachel (Einstellungen → Kacheln verwalten).
      const cfgSperre = await getKv("config");
      const aus = (cfgSperre && Array.isArray(cfgSperre.kachelnAus)) ? cfgSperre.kachelnAus : [];
      if (aus.includes("personalakte") && aus.includes("jugend")) return json(403, { error: "Diese Kachel ist derzeit für die ganze Feuerwehr gesperrt." });
    }

    const isAdmin = !!me.is_admin;
    const { action, target } = body;

    // Fremde Akten (und Übersicht/Arbeitgeberliste) nur mit frischer PIN-Freischaltung.
    const brauchtFreischaltung = action === "list" || action === "arbeitgeber" || action === "jugendAnlegen" || (target && target !== me.name);
    let jugendwartZugriff = false; // Jugendwart arbeitet an der Akte eines Jugendlichen
    if (brauchtFreischaltung) {
      if (!isAdmin) {
        const erlaubt = action !== "arbeitgeber" && (await istJugendwart(me.name))
          && (action === "list" || (target && (await jugendlicheNamen()).has(target)));
        if (!erlaubt) return json(403, { error: "Du darfst nur deine eigene Personalakte sehen." });
        jugendwartZugriff = true;
      }
      const ok = body.elevatedToken && me.elevated_token === body.elevatedToken && me.elevated_until && new Date(me.elevated_until) > new Date();
      if (!ok) return json(403, { error: "Bitte PIN eingeben.", code: "PIN_NOETIG" });
    }

    if (action === "arbeitgeber") {
      const names = Array.isArray(body.names) ? body.names : [];
      const { data } = await db.from("personalakten").select("name,data").in("name", names.length ? names : ["-"]);
      const byName = Object.fromEntries((data || []).map((r) => [r.name, r.data || {}]));
      const items = names.map((n) => ({ name: n, arbeitgeber: { name: "", telefon: "", email: "", ...((byName[n] || {}).arbeitgeber || {}) } }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
      return json(200, { items });
    }

    if (action === "statistik") {
      // Nur für Admins; liefert ausschließlich die für die Statistik nötigen, reduzierten Werte –
      // keine Adressen, Telefonnummern, Arbeitgeber oder Fotos.
      if (!isAdmin) return json(403, { error: "Nur für Admins." });
      const jahrVon = (d) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
      const { data } = await db.from("personalakten").select("name,data");
      const items = (data || []).map((row) => {
        const a = row.data || {};
        const geb = a.geburtsdatum || "";
        const ein = a.eintrittsdatum || "";
        // Dienstjahre erst ab dem 14. Geburtstag
        let beginn = ein;
        if (ein && geb) { const mit14 = `${Number(geb.slice(0, 4)) + 14}${geb.slice(4)}`; if (mit14 > ein) beginn = mit14; }
        return {
          name: row.name,
          geburtsjahr: jahrVon(geb),
          eintrittsjahr: jahrVon(ein),
          dienstbeginnJahr: jahrVon(beginn),
          rang: aktuellerRang(a),
          geschlecht: a.geschlecht || "",
          funktionen: aktiveFunktionen(a),
          lehrgaenge: (a.lehrgaenge || []).map((l) => ({ titel: l.titel || "", jahr: jahrVon(l.datum) })),
          leistungsabzeichen: (a.leistungsabzeichen || []).map((l) => ({ titel: l.titel || "", jahr: jahrVon(l.datum) })),
          verlauf: (a.mitgliedsverlauf || []).map((v) => ({ text: v.text || "", jahr: jahrVon(v.datum) })),
        };
      });
      return json(200, { items });
    }

    if (action === "list") {
      const { data } = await db.from("personalakten").select("name,data");
      const nurJugend = jugendwartZugriff ? await jugendlicheNamen() : null;
      const items = (data || []).filter((row) => !nurJugend || nurJugend.has(row.name)).map((row) => ({
        name: row.name,
        geburtsdatum: (row.data && row.data.geburtsdatum) || "",
        eintrittsdatum: (row.data && row.data.eintrittsdatum) || "",
        rang: aktuellerRang(row.data),
        geschlecht: (row.data && row.data.geschlecht) || "",
      }));
      return json(200, { items });
    }

    if (!target) return json(400, { error: "Person fehlt." });
    if (!isAdmin && !jugendwartZugriff && target !== me.name) return json(403, { error: "Du darfst nur deine eigene Personalakte sehen." });

    if (action === "jugendAnlegen") {
      // Neue(r) Jugendliche(r): Geburtsdatum, Eintritt und "Eintritt Jugendfeuerwehr" im Mitgliedsverlauf.
      const old = await loadAkte(target);
      const eintritt = /^\d{4}-\d{2}-\d{2}$/.test(body.eintrittsdatum || "") ? body.eintrittsdatum : new Date().toISOString().slice(0, 10);
      const verlauf = old.mitgliedsverlauf || [];
      const next = {
        ...old,
        geburtsdatum: old.geburtsdatum || (/^\d{4}-\d{2}-\d{2}$/.test(body.geburtsdatum || "") ? body.geburtsdatum : ""),
        eintrittsdatum: old.eintrittsdatum || eintritt,
        mitgliedsverlauf: verlauf.some((v) => v.text === "Eintritt Jugendfeuerwehr") ? verlauf
          : [...verlauf, { id: Math.random().toString(36).slice(2, 12), text: "Eintritt Jugendfeuerwehr", datum: eintritt }],
      };
      const { error } = await db.from("personalakten").upsert({ name: target, data: next, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === "get") {
      const akte = await loadAkte(target);
      const lehrgaenge = await Promise.all(((akte.lehrgaenge) || []).map(async (l) => {
        if (!l.photoPath) return l;
        const { data } = await db.storage.from(BUCKET).createSignedUrl(l.photoPath, 60 * 60);
        return { ...l, photoUrl: data ? data.signedUrl : null };
      }));
      return json(200, { data: { ...akte, lehrgaenge } });
    }

    if (action === "save") {
      const old = await loadAkte(target);
      const incoming = { ...(body.data || {}) };
      // Nicht-Admins können Rang/Beförderungen/Ehrungen nicht ändern – alte Werte bleiben.
      if (!isAdmin) for (const f of ADMIN_ONLY_FIELDS) incoming[f] = old[f] || [];
      incoming.lehrgaenge = (incoming.lehrgaenge || []).map(({ photoUrl, ...rest }) => {
        // Foto-Pfade dürfen nur in den Ordner der Person zeigen.
        if (rest.photoPath && !rest.photoPath.startsWith(folderFor(target) + "/")) rest.photoPath = null;
        return rest;
      });
      const { error } = await db.from("personalakten").upsert({ name: target, data: incoming, updated_at: new Date().toISOString() });
      if (error) throw error;
      // Nicht mehr verwendete Nachweis-Fotos endgültig löschen.
      const stillUsed = new Set(photoPaths(incoming));
      const removed = photoPaths(old).filter((p) => !stillUsed.has(p));
      if (removed.length) await db.storage.from(BUCKET).remove(removed);
      return json(200, { ok: true });
    }

    if (action === "uploadUrl") {
      const safe = String(body.filename || "foto").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const path = `${folderFor(target)}/${Date.now()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json(200, { path, uploadToken: data.token });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
