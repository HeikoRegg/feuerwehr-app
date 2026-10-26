// netlify/functions/beschluesse.js
// Beschlussbuch: Beschlüsse des Ausschusses (Datum, Titel, Text, Thema, Status, Sitzung/Abstimmung, Anhänge).
//  - Beschlüsse                      -> Tabelle beschluesse (id, data)
//  - Themenliste                     -> kv_store "beschlussThemen" (vom Admin änderbar)
//  - Anhänge (Bilder, PDFs, Dateien) -> privater Speicher "beschluesse" (Zugriff nur über kurzlebige Links, 1 Stunde)
//
// Rechte (immer frisch aus der Mitgliederliste ermittelt):
//  - Ausschuss (Mitglied mit Ausschuss-Zuordnung) und Admins sehen ALLE Beschlüsse.
//  - Alle anderen angemeldeten Mitglieder sehen nur Beschlüsse mit dem Häkchen "für alle sichtbar".
//  - Eintragen, ändern, löschen: Admins und Ausschuss-Mitglieder mit dem Recht "Sitzungen bearbeiten" oder "Protokoll".
//  - Themenliste ändern: nur Admins.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "beschluesse";
const STANDARD_THEMEN = ["Finanzen und Kasse", "Fahrzeuge und Geräte", "Ausrüstung und Kleidung", "Personal und Mitglieder", "Veranstaltungen und Feste", "Satzung und Organisation", "Sonstiges"];
const STATUS = { gueltig: "Gültig", aufgehoben: "Aufgehoben", ersetzt: "Ersetzt" };
const MAX_ANHAENGE = 5;

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const neueId = () => crypto.randomBytes(5).toString("hex");
const kurz = (v, n) => String(v ?? "").trim().slice(0, n);
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
const istId = (s) => /^[a-f0-9]{10}$/.test(String(s || ""));
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };

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
  const ausschuss = admin || !!e.ausschuss;
  const r = e.ausschussRechte || {};
  const bearbeiter = admin || (!!e.ausschuss && (!!r.calendar || !!r.protokoll));
  // Seit 2.32: Mitglieder nur der Jugendfeuerwehr sehen das Beschlussbuch nicht (außer Admin/Ausschuss).
  const nurJugend = (e.bereiche || []).includes("jugendfeuerwehr") && !(e.bereiche || []).includes("einsatzabteilung");
  return { me, config: config || {}, gesperrtJugend: nurJugend && !ausschuss, rechte: { admin, ausschuss, bearbeiter } };
}

async function themen() {
  const t = await getKv("beschlussThemen");
  return Array.isArray(t) && t.length ? t.filter((x) => typeof x === "string" && x.trim()) : STANDARD_THEMEN;
}

// Eine Tabellenzeile in die Form für die App bringen.
function alsBeschluss(row) {
  const d = row.data || {};
  return { id: row.id, ...d, anhaenge: Array.isArray(d.anhaenge) ? d.anhaenge : [] };
}
// Für die Liste: nur was nötig ist (Text gekürzt wird in der App, hier komplett – Beschlüsse sind kurz).
function sichtbar(b, rechte) { return rechte.ausschuss || !!b.fuerAlle; }

async function dateienLoeschen(pfade) {
  const p = (pfade || []).filter(Boolean);
  if (p.length) { try { await db.storage.from(BUCKET).remove(p); } catch (e) { /* egal */ } }
}

function sauberAnhaenge(liste, id) {
  const arr = Array.isArray(liste) ? liste : [];
  if (arr.length > MAX_ANHAENGE) throw fehler(400, `Höchstens ${MAX_ANHAENGE} Anhänge je Beschluss.`);
  const gesehen = new Set();
  return arr.map((a) => {
    const pfad = String((a && a.pfad) || "");
    if (!pfad.startsWith(`${id}/`) || pfad.includes("..") || gesehen.has(pfad)) throw fehler(400, "Ungültiger Anhang.");
    gesehen.add(pfad);
    return { pfad, name: kurz(a.name, 120) || "Datei", typ: kurz(a.typ, 80), groesse: Math.max(0, Math.min(Number(a.groesse) || 0, 50 * 1024 * 1024)), beschreibung: kurz(a.beschreibung, 300) };
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    {
      const aus = Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : [];
      if (aus.includes("beschluesse")) return json(403, { error: "Diese Kachel ist derzeit für die ganze Feuerwehr gesperrt." });
    }
    if (lage.gesperrtJugend) return json(403, { error: "Das Beschlussbuch ist für die Jugendfeuerwehr nicht freigegeben." });
    const { rechte } = lage;
    const ich = lage.me.name;
    const { action } = body;
    const nurBearbeiter = () => { if (!rechte.bearbeiter) throw fehler(403, "Beschlüsse dürfen nur Admins und Ausschuss-Mitglieder mit dem Recht für Sitzungen bzw. Protokoll eintragen."); };

    if (action === "list") {
      const { data, error } = await db.from("beschluesse").select("*");
      if (error) throw error;
      const alle = (data || []).map(alsBeschluss).filter((b) => sichtbar(b, rechte));
      // Kachel geöffnet: neue Beschlüsse gelten als gesehen (Zahl an der Kachel wird 0)
      try {
        const g = await getKv("beschlussGesehen");
        const neu = { ...((g && typeof g === "object") ? g : {}), [ich]: new Date().toISOString() };
        await db.from("kv_store").upsert({ key: "beschlussGesehen", value: neu, updated_at: new Date().toISOString() });
      } catch (e) { /* nur die Zahl – egal */ }
      return json(200, { ich, rechte, themen: await themen(), beschluesse: alle });
    }

    if (action === "get") {
      const { data, error } = await db.from("beschluesse").select("*").eq("id", String(body.id || "")).maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { error: "Diesen Beschluss gibt es nicht (mehr)." });
      const b = alsBeschluss(data);
      if (!sichtbar(b, rechte)) return json(403, { error: "Dieser Beschluss ist nur für den Ausschuss sichtbar." });
      const anhaenge = await Promise.all(b.anhaenge.map(async (a) => {
        const { data: s } = await db.storage.from(BUCKET).createSignedUrl(a.pfad, 60 * 60);
        return { ...a, url: s ? s.signedUrl : null };
      }));
      return json(200, { beschluss: { ...b, anhaenge } });
    }

    if (action === "uploadUrl") {
      nurBearbeiter();
      const id = String(body.id || "");
      if (!istId(id)) throw fehler(400, "Ungültiger Beschluss.");
      const safe = String(body.filename || "datei").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const pfad = `${id}/${neueId()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(pfad);
      if (error) throw error;
      return json(200, { path: pfad, uploadToken: data.token });
    }

    if (action === "save") {
      nurBearbeiter();
      const b = body.beschluss || {};
      const titel = kurz(b.titel, 160);
      if (!titel) throw fehler(400, "Bitte einen Titel eingeben.");
      if (!istDatum(b.datum)) throw fehler(400, "Bitte ein Datum angeben.");
      const text = kurz(b.text, 8000);
      const thema = kurz(b.thema, 60) || "Sonstiges";
      const status = STATUS[b.status] ? b.status : "gueltig";
      const id = String(b.id || "");
      if (!istId(id)) throw fehler(400, "Ungültiger Beschluss.");
      const { data: altRow } = await db.from("beschluesse").select("*").eq("id", id).maybeSingle();
      const alt = altRow ? alsBeschluss(altRow) : null;
      let ersetztDurch = "";
      if (status === "ersetzt") {
        ersetztDurch = String(b.ersetztDurch || "");
        if (!ersetztDurch || ersetztDurch === id) throw fehler(400, "Bitte den Beschluss wählen, der diesen ersetzt.");
        const { data: ziel } = await db.from("beschluesse").select("id").eq("id", ersetztDurch).maybeSingle();
        if (!ziel) throw fehler(400, "Der ersetzende Beschluss existiert nicht (mehr).");
      }
      const anhaenge = sauberAnhaenge(b.anhaenge, id);
      const neuePfade = new Set(anhaenge.map((a) => a.pfad));
      await dateienLoeschen(((alt && alt.anhaenge) || []).map((a) => a.pfad).filter((p) => !neuePfade.has(p)));
      const s = b.sitzung && typeof b.sitzung === "object" ? b.sitzung : null;
      const ergebnis = b.ergebnis && typeof b.ergebnis === "object" ? { dafuer: Number(b.ergebnis.dafuer) || 0, dagegen: Number(b.ergebnis.dagegen) || 0, label: kurz(b.ergebnis.label, 30) } : null;
      const jetzt = new Date().toISOString();
      const data = {
        datum: b.datum, titel, text, thema, status, ersetztDurch, fuerAlle: !!b.fuerAlle, anhaenge,
        // Zeitpunkt, ab dem der Beschluss für alle sichtbar ist (für die Zahl „neu“ an der Kachel)
        freigegebenAm: b.fuerAlle ? ((alt && alt.fuerAlle && alt.freigegebenAm) || (alt && alt.fuerAlle ? alt.angelegtAm : "") || jetzt) : "",
        sitzung: s ? { id: kurz(s.id, 40), titel: kurz(s.titel, 160), datum: istDatum(s.datum) ? s.datum : "", punkt: kurz(s.punkt, 300) } : (alt && alt.sitzung) || null,
        ergebnis: ergebnis || (alt && alt.ergebnis) || null,
        angelegtVon: (alt && alt.angelegtVon) || ich, angelegtAm: (alt && alt.angelegtAm) || jetzt, geaendertVon: ich,
      };
      const { error } = await db.from("beschluesse").upsert({ id, data, created_at: altRow ? altRow.created_at : jetzt, updated_at: jetzt });
      if (error) throw error;
      return json(200, { ok: true, id });
    }

    if (action === "delete") {
      nurBearbeiter();
      const { data } = await db.from("beschluesse").select("*").eq("id", String(body.id || "")).maybeSingle();
      if (!data) return json(200, { ok: true });
      await dateienLoeschen(alsBeschluss(data).anhaenge.map((a) => a.pfad));
      const { error } = await db.from("beschluesse").delete().eq("id", data.id);
      if (error) throw error;
      // Beschlüsse, die auf diesen verwiesen haben ("ersetzt durch"), wieder auf "gültig" setzen.
      const { data: alle } = await db.from("beschluesse").select("*");
      for (const r of alle || []) {
        const b = alsBeschluss(r);
        if (b.status === "ersetzt" && b.ersetztDurch === data.id) {
          await db.from("beschluesse").update({ data: { ...r.data, status: "gueltig", ersetztDurch: "" }, updated_at: new Date().toISOString() }).eq("id", r.id);
        }
      }
      return json(200, { ok: true });
    }

    if (action === "themenSpeichern") {
      if (!rechte.admin) throw fehler(403, "Die Themen dürfen nur Admins ändern.");
      const t = (Array.isArray(body.themen) ? body.themen : []).map((x) => kurz(x, 60)).filter(Boolean);
      const eindeutig = [...new Set(t)];
      if (!eindeutig.length) throw fehler(400, "Mindestens ein Thema muss bleiben.");
      if (eindeutig.length > 30) throw fehler(400, "Höchstens 30 Themen.");
      const { error } = await db.from("kv_store").upsert({ key: "beschlussThemen", value: eindeutig, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json(200, { ok: true, themen: eindeutig });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    const text = e && e.message ? e.message : String(e);
    if (/beschluesse/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabelle für das Beschlussbuch fehlt noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
