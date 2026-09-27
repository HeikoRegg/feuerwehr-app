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
    paTraeger: m.filter((x) => zahl(x.pa) > 0).length,
    stunden: Math.round(m.reduce((s, x) => s + zahl(x.ein), 0) * 100) / 100,
    stundenBer: Math.round(m.reduce((s, x) => s + zahl(x.ber), 0) * 100) / 100,
    stundenPa: Math.round(m.reduce((s, x) => s + zahl(x.pa), 0) * 100) / 100,
    fotoAnzahl: (d.fotos || []).length,
  };
}
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
    const me = await userByToken(body.token);
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });
    const isAdmin = !!me.is_admin;
    const roster = (await getKv("roster")) || [];
    const config = (await getKv("config")) || {};
    const ich = roster.find((r) => r && r.name === me.name) || {};
    const gf = isAdmin || (await istGruppenfuehrer(me.name));
    const rechte = { schreiben: gf, namen: gf, fotos: isAdmin || (ich.bereiche || []).includes("einsatzabteilung") };
    const { action } = body;

    if (action === "list") {
      const { data, error } = await db.from("einsatzberichte").select("id,einsatzjahr,nr,data");
      if (error) throw error;
      const items = (data || []).map((row) => fuerLeser(row, rechte))
        .sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || (b.alarm || "").localeCompare(a.alarm || "") || b.nr - a.nr);
      return json(200, { items, einsatzjahr: aktuellesEinsatzjahr(config), rechte });
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
      // Für die Statistik-Kachel (nur Admin): alle Berichte mit Namen.
      if (!isAdmin) return json(403, { error: "Nur für Admins." });
      const { data, error } = await db.from("einsatzberichte").select("id,einsatzjahr,nr,data");
      if (error) throw error;
      return json(200, { items: (data || []).map((row) => fuerLeser(row, { namen: true, fotos: false })) });
    }

    if (action === "save") {
      if (!rechte.schreiben) return json(403, { error: "Einsatzberichte schreiben nur Gruppenführer und Admins." });
      const id = sichereId(body.id);
      if (!id) return json(400, { error: "Bericht-Kennung fehlt." });
      const eingang = { ...(body.data || {}) };
      if (!eingang.datum) return json(400, { error: "Bitte das Datum eintragen." });
      // Felder, die nur der Server vergibt, nicht aus der Anfrage übernehmen.
      ["id", "einsatzjahr", "nr", "nummer", "kraefte", "paTraeger", "stunden", "stundenBer", "stundenPa", "fotoAnzahl"].forEach((k) => delete eingang[k]);
      eingang.fotos = (eingang.fotos || []).filter((f) => f && typeof f.path === "string" && f.path.startsWith(`${id}/`)).map((f) => ({ path: f.path, name: f.name || "" }));
      eingang.mannschaft = (eingang.mannschaft || []).filter((m) => m && m.name).map((m) => ({ name: String(m.name), ein: zahl(m.ein), ber: zahl(m.ber), pa: zahl(m.pa), fahrzeug: m.fahrzeug || "" }));

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
