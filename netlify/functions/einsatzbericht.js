// netlify/functions/einsatzbericht.js
// Einsatzberichte liegen in der geschützten Tabelle "einsatzberichte", Fotos im privaten Speicher
// "einsatzberichte". Zugriff nur über diese Funktion:
//  - lesen: alle angemeldeten Mitglieder – aber OHNE Namen der Einsatzkräfte (nur die Anzahl)
//  - Namen sehen und Berichte schreiben: Gruppenführer (aktive Funktion in der Personalakte) und Admins
//  - Fotos sehen: Einsatzabteilung und Admins
//  - löschen: Admins und wer den Bericht angelegt hat

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "einsatzberichte";
const PRAEFIX = "RW";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const sichereId = (id) => String(id || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
const zahl = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
// Zeiten minutengenau: „1:23“ oder (alte Berichte) Dezimalstunden „1,5“
const zuMin = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (s.includes(":")) { const [h, m] = s.split(":"); const min = (Number(h) || 0) * 60 + (Number(m) || 0); return Number.isFinite(min) && min > 0 ? Math.round(min) : 0; }
  return Math.round(zahl(s) * 60);
};
const fmtHM = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const normHM = (v) => { const m = zuMin(v); return m ? fmtHM(m) : ""; };

async function userByToken(token) {
  if (!token) return null;
  const { data, error } = await db.from("app_users").select("name,is_admin,tokens,blocked");
  if (error) throw error;
  return (data || []).find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) || null;
}
async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
async function istGruppenfuehrer(name) {
  const { data } = await db.from("personalakten").select("data").eq("name", name).maybeSingle();
  const f = (data && data.data && data.data.funktionen) || [];
  return f.some((x) => (typeof x === "string" ? x === "Gruppenführer" : x.name === "Gruppenführer" && x.status !== "ad"));
}
// Laufendes Einsatzjahr: beginnt nach der Hauptversammlung, der Admin bestätigt es in der App.
function aktuellesEinsatzjahr(config) {
  return String((config && config.einsatzjahr && config.einsatzjahr.name) || new Date().getFullYear());
}
const einsatzNummer = (jahr, nr) => `${PRAEFIX}.${jahr}/${String(nr).padStart(2, "0")}`;

// Kennzahlen, die jeder sehen darf (ohne Namen).
function kennzahlen(d) {
  const m = d.mannschaft || [];
  return {
    kraefte: m.length,
    paTraeger: m.filter((x) => zuMin(x.pa) > 0).length,
    // Summen in Minuten (exakt); „stunden…“ zusätzlich als Dezimalzahl für die Statistik/Altstände
    stundenMin: m.reduce((s, x) => s + zuMin(x.ein), 0),
    stundenBerMin: m.reduce((s, x) => s + zuMin(x.ber), 0),
    stundenPaMin: m.reduce((s, x) => s + zuMin(x.pa), 0),
    stunden: Math.round(m.reduce((s, x) => s + zuMin(x.ein), 0) / 60 * 100) / 100,
    stundenBer: Math.round(m.reduce((s, x) => s + zuMin(x.ber), 0) / 60 * 100) / 100,
    stundenPa: Math.round(m.reduce((s, x) => s + zuMin(x.pa), 0) / 60 * 100) / 100,
    fotoAnzahl: (d.fotos || []).length,
  };
}
// Nur die Felder, die die Liste in der Kachel zeigt (schnell, ohne Namen, Texte und Fotos).
function fuerListe(row) {
  const d = row.data || {};
  const k = kennzahlen(d);
  return { id: row.id, einsatzjahr: row.einsatzjahr, nr: row.nr, nummer: einsatzNummer(row.einsatzjahr, row.nr), datum: d.datum || "", alarm: d.alarm || "", ende: d.ende || "", einsatz: d.einsatz || "", ort: d.ort || "", kraefte: k.kraefte, stunden: k.stunden, stundenMin: k.stundenMin, fotoAnzahl: k.fotoAnzahl };
}
const sortiereBerichte = (a, b) => (b.datum || "").localeCompare(a.datum || "") || (b.alarm || "").localeCompare(a.alarm || "") || b.nr - a.nr;
function fuerLeser(row, rechte, { mitFotos = false } = {}) {
  const d = row.data || {};
  const out = { ...d, id: row.id, einsatzjahr: row.einsatzjahr, nr: row.nr, nummer: einsatzNummer(row.einsatzjahr, row.nr), ...kennzahlen(d) };
  if (!rechte.namen) { delete out.mannschaft; delete out.erstelltVon; delete out.geaendertVon; }
  if (!rechte.fotos || !mitFotos) delete out.fotos;
  return out;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const { action } = body;
    // Alles, was voneinander unabhängig ist, gleichzeitig laden (jede Datenbank-Abfrage kostet Wartezeit).
    const berichteVorab = action === "list" || action === "archiv" || action === "statistik"
      ? db.from("einsatzberichte").select("id,einsatzjahr,nr,data").then((r) => r, (e) => ({ error: e }))
      : null;
    const [me, roster0, config0] = await Promise.all([userByToken(body.token), getKv("roster"), getKv("config")]);
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });
    {
      // Vom Hauptadmin für die ganze Feuerwehr gesperrte Kachel (Einstellungen → Kacheln verwalten).
      const aus = (config0 && Array.isArray(config0.kachelnAus)) ? config0.kachelnAus : [];
      if (aus.includes("einsatz")) return json(403, { error: "Diese Kachel ist derzeit für die ganze Feuerwehr gesperrt." });
    }

    const isAdmin = !!me.is_admin;
    const roster = roster0 || [];
    const config = config0 || {};
    const ich = roster.find((r) => r && r.name === me.name) || {};
    const [gf, vorab] = await Promise.all([isAdmin ? true : istGruppenfuehrer(me.name), berichteVorab]);
    const rechte = { schreiben: gf, namen: gf, fotos: isAdmin || (ich.bereiche || []).includes("einsatzabteilung") };

    if (action === "list") {
      // Liste nur mit den angezeigten Feldern; laufendes Einsatzjahr komplett, vom Archiv nur die Anzahl je Jahr.
      const { data, error } = vorab;
      if (error) throw error;
      const jahr = aktuellesEinsatzjahr(config);
      const archiv = {};
      const items = [];
      (data || []).forEach((row) => { if (String(row.einsatzjahr) === jahr || body.alle) items.push(fuerListe(row)); else archiv[row.einsatzjahr] = (archiv[row.einsatzjahr] || 0) + 1; });
      items.sort(sortiereBerichte);
      return json(200, { items, archiv, einsatzjahr: jahr, rechte });
    }

    if (action === "archiv") {
      const { data, error } = vorab;
      if (error) throw error;
      const jahr = String(body.jahr || "");
      return json(200, { items: (data || []).filter((row) => String(row.einsatzjahr) === jahr).map(fuerListe).sort(sortiereBerichte) });
    }

    if (action === "get") {
      const { data: row } = await db.from("einsatzberichte").select("id,einsatzjahr,nr,data").eq("id", sichereId(body.id)).maybeSingle();
      if (!row) return json(404, { error: "Bericht nicht gefunden." });
      const item = fuerLeser(row, rechte, { mitFotos: true });
      if (item.fotos) {
        item.fotos = await Promise.all(item.fotos.map(async (f) => {
          const { data } = await db.storage.from(BUCKET).createSignedUrl(f.path, 60 * 60);
          return { ...f, url: data ? data.signedUrl : null };
        }));
      }
      return json(200, { item, rechte });
    }

    if (action === "statistik") {
      // Für die Statistik-Kachel (nur Admin): nur die Felder, die die Statistik braucht (mit Namen und Stunden).
      if (!isAdmin) return json(403, { error: "Nur für Admins." });
      const { data, error } = vorab;
      if (error) throw error;
      return json(200, { items: (data || []).map((row) => {
        const d = row.data || {}; const k = kennzahlen(d);
        return { id: row.id, einsatzjahr: row.einsatzjahr, nr: row.nr, nummer: einsatzNummer(row.einsatzjahr, row.nr), datum: d.datum || "", einsatz: d.einsatz || "",
          kraefte: k.kraefte, stunden: k.stunden, stundenMin: k.stundenMin, fahrzeuge: d.fahrzeuge || [], fahrzeugNamen: d.fahrzeugNamen || {},
          mannschaft: (d.mannschaft || []).map((m) => ({ name: m.name, ein: m.ein })) };
      }) });
    }

    if (action === "save") {
      if (!rechte.schreiben) return json(403, { error: "Einsatzberichte schreiben nur Gruppenführer und Admins." });
      const id = sichereId(body.id);
      if (!id) return json(400, { error: "Bericht-Kennung fehlt." });
      const eingang = { ...(body.data || {}) };
      if (!eingang.datum) return json(400, { error: "Bitte das Datum eintragen." });
      // Felder, die nur der Server vergibt, nicht aus der Anfrage übernehmen.
      ["id", "einsatzjahr", "nr", "nummer", "kraefte", "paTraeger", "stunden", "stundenBer", "stundenPa", "stundenMin", "stundenBerMin", "stundenPaMin", "fotoAnzahl"].forEach((k) => delete eingang[k]);
      eingang.fotos = (eingang.fotos || []).filter((f) => f && typeof f.path === "string" && f.path.startsWith(`${id}/`)).map((f) => ({ path: f.path, name: f.name || "" }));
      eingang.mannschaft = (eingang.mannschaft || []).filter((m) => m && m.name).map((m) => ({ name: String(m.name), ein: normHM(m.ein), ber: normHM(m.ber), pa: normHM(m.pa), fahrzeug: m.fahrzeug || "" }));

      const { data: alt } = await db.from("einsatzberichte").select("id,einsatzjahr,nr,data").eq("id", id).maybeSingle();
      const jetzt = new Date().toISOString();
      let row;
      if (alt) {
        row = { id, einsatzjahr: alt.einsatzjahr, nr: alt.nr, data: { ...eingang, erstelltVon: (alt.data || {}).erstelltVon, erstelltAm: (alt.data || {}).erstelltAm, geaendertVon: me.name, geaendertAm: jetzt }, updated_at: jetzt };
      } else {
        // Neue laufende Nummer im aktuellen Einsatzjahr.
        const jahr = aktuellesEinsatzjahr(config);
        const { data: imJahr } = await db.from("einsatzberichte").select("nr").eq("einsatzjahr", jahr);
        const nr = (imJahr || []).reduce((m, r) => Math.max(m, r.nr || 0), 0) + 1;
        row = { id, einsatzjahr: jahr, nr, data: { ...eingang, erstelltVon: me.name, erstelltAm: jetzt }, created_at: jetzt, updated_at: jetzt };
      }
      const { error } = await db.from("einsatzberichte").upsert(row);
      if (error) throw error;
      // Nicht mehr verwendete Fotos endgültig löschen.
      if (alt) {
        const noch = new Set(eingang.fotos.map((f) => f.path));
        const weg = ((alt.data || {}).fotos || []).map((f) => f.path).filter((p) => !noch.has(p));
        if (weg.length) await db.storage.from(BUCKET).remove(weg);
      }
      return json(200, { ok: true, item: fuerLeser(row, rechte) });
    }

    if (action === "uploadUrl") {
      if (!rechte.schreiben) return json(403, { error: "Nur Gruppenführer und Admins." });
      const id = sichereId(body.id);
      if (!id) return json(400, { error: "Bericht-Kennung fehlt." });
      const safe = String(body.filename || "foto.jpg").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const path = `${id}/${Date.now()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json(200, { path, uploadToken: data.token });
    }

    if (action === "delete") {
      const id = sichereId(body.id);
      const { data: alt } = await db.from("einsatzberichte").select("id,data").eq("id", id).maybeSingle();
      if (!alt) return json(200, { ok: true });
      if (!isAdmin && (alt.data || {}).erstelltVon !== me.name) return json(403, { error: "Löschen dürfen nur Admins und wer den Bericht angelegt hat." });
      const fotos = ((alt.data || {}).fotos || []).map((f) => f.path);
      if (fotos.length) await db.storage.from(BUCKET).remove(fotos);
      const { error } = await db.from("einsatzberichte").delete().eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    const text = e && e.message ? e.message : String(e);
    if (/einsatzberichte/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabelle für Einsatzberichte fehlt noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
