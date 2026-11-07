// netlify/functions/projekte.js  (seit 2.36)
// Projekte und Aufgaben (To-do). Beide Kacheln nutzen dieselbe Aufgabenliste: Eine Aufgabe in einem Projekt
// erscheint automatisch auch im To-do der zuständigen Person – abhaken an einer Stelle gilt überall.
//  - Projekte                 -> Tabelle projekte (id, data)
//  - Aufgaben                 -> Tabelle aufgaben (id, projekt | null, data)   (null = Einzelaufgabe im To-do)
//  - Verlauf und Dokumente    -> Tabelle projekt_eintraege (id, projekt, data) + privater Speicher "projekte"
//
// Rechte (immer frisch aus Mitgliederliste und Anmeldung ermittelt):
//  - Projekt anlegen:         Admin, Ausschuss, Kommandant, stellv. Kommandant
//  - Projekt sehen:           je Projekt wählbar – alle Mitglieder, nur Ausschuss oder ausgewählte Personen;
//                             immer: Ersteller, Verantwortlicher, Beteiligte, Admins
//  - Projekt verwalten:       Ersteller, Verantwortlicher, Admins (ändern, archivieren); löschen: Ersteller, Admins
//  - Mitarbeiten:             Verwalter + Beteiligte (Aufgaben anlegen, Notizen, Dokumente)
//  - Aufgaben anderen zuweisen: Admin, Ausschuss, Kommandant, stellv. Kommandant, Gerätewart – im eigenen Projekt
//                             auch Verwalter. Für sich selbst darf jeder Aufgaben anlegen.
//  - Einzelaufgaben (ohne Projekt) sehen nur Ersteller und Zuständiger.
// Push: neue Zuweisung → Zuständiger; erledigt → Ersteller; Erinnerung ab 18 Uhr am gewählten Tag → Zuständiger
// (stündlich über umfrage-erinnerung.js → pruefeAufgabenErinnerungen).
// Seit 2.37: Erinnerung je Aufgabe wählbar; Zahl an der Kachel = neue (seit dem letzten Öffnen des To-do zugewiesene) + überfällige Aufgaben.
// Seit 2.38: Der Zuständige öffnet seine Aufgabe, setzt den Status (offen / in Bearbeitung / erledigt), schreibt eine Notiz
// und stellt seine Erinnerung selbst ein – Text, Beschreibung, Fälligkeit und Zuständigkeit ändert nur, wer dazu berechtigt ist.
// Die Erinnerung ist jetzt frei: „Tage vorher“ (0 bis 365, nur mit Fälligkeit) oder ein Datum, leer = keine. Immer um 18 Uhr.
// Push an den Ersteller nur, wenn die Aufgabe erledigt wird.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";
import { kvAendern } from "./person.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "projekte";
const PHASEN = ["idee", "planung", "laeuft", "erledigt"];
const PHASE_NAME = { idee: "Idee", planung: "Planung", laeuft: "Läuft", erledigt: "Erledigt" };
const SICHT = ["alle", "ausschuss", "personen"];
const MAX_DOKUMENTE = 40;
const TODO_URL = "/?kachel=todo";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const neueId = () => crypto.randomBytes(5).toString("hex");
const istId = (s) => /^[a-f0-9]{10}$/.test(String(s || ""));
const kurz = (v, n) => String(v ?? "").trim().slice(0, n);
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
const datum = (s) => (istDatum(s) ? s : "");
// Beträge in deutscher Schreibweise: „1.500,50“, „1500,5“, „1.500“ und „1500.50“ werden erkannt.
export function betrag(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  let t = String(v).trim().replace(/[€\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
const berlin = (d, opt) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", ...opt }).format(d);
const heuteBerlin = (d = new Date()) => berlin(d, { year: "numeric", month: "2-digit", day: "2-digit" });
const MAX_TAGE_VORHER = 365;
const tagMinus = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const tageZwischen = (von, bis) => Math.round((Date.parse(bis + "T12:00:00Z") - Date.parse(von + "T12:00:00Z")) / 86400000);
// Erinnerung einer Aufgabe säubern. Ohne Fälligkeit gibt es keine „Tage vorher“.
function sauberErinnerung(e, faellig) {
  const x = e && typeof e === "object" ? e : null;
  if (!x) return faellig ? { art: "tage", tage: 1 } : { art: "keine" };
  if (x.art === "datum" && istDatum(x.datum)) return { art: "datum", datum: x.datum };
  if (x.art === "tage" && faellig && x.tage !== "" && x.tage !== null && Number.isInteger(Number(x.tage)) && Number(x.tage) >= 0 && Number(x.tage) <= MAX_TAGE_VORHER) return { art: "tage", tage: Number(x.tage) };
  return { art: "keine" };
}
// An welchem Tag wird erinnert? (Aufgaben von vor 2.37 ohne Feld: 1 Tag vor der Fälligkeit, wie bisher)
export function erinnerungsTag(a) {
  const e = a.erinnerung;
  if (!e) return istDatum(a.faellig) ? tagMinus(a.faellig, 1) : "";
  if (e.art === "datum") return istDatum(e.datum) ? e.datum : "";
  if (e.art === "tage" && istDatum(a.faellig)) return tagMinus(a.faellig, Number(e.tage) || 0);
  return "";
}
const datumDe = (iso) => (istDatum(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

async function ladeLage(token) {
  const [usersRes, roster, config] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("config")]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const meUser = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const liste = (roster || []).filter((r) => r && r.name);
  const gesperrt = new Set([...users.filter((u) => u.blocked).map((u) => u.name), ...liste.filter((r) => r.gesperrt).map((r) => r.name)]);
  const eintrag = (n) => liste.find((r) => r.name === n) || {};
  const admin = (n) => !!users.find((u) => u.name === n && u.is_admin);
  const ausschuss = (n) => admin(n) || !!eintrag(n).ausschuss;
  const kommando = (n) => !!(eintrag(n).kommandant || eintrag(n).stellvKommandant);
  const aktiv = new Set(liste.filter((r) => !gesperrt.has(r.name)).map((r) => r.name));
  const ich = meUser && aktiv.has(meUser.name) ? meUser.name : null;
  return {
    ich, config: config || {}, aktiv, admin, ausschuss,
    darfAnlegen: (n) => admin(n) || ausschuss(n) || kommando(n),
    darfZuweisen: (n) => admin(n) || ausschuss(n) || kommando(n) || !!eintrag(n).geraetewart,
  };
}

// ---------- Projekte ----------
function alsProjekt(row) { const d = row.data || {}; return { id: row.id, ...d, beteiligte: Array.isArray(d.beteiligte) ? d.beteiligte : [] }; }
function istVerwalter(p, n, lage) { return !!n && (lage.admin(n) || p.erstelltVon === n || p.verantwortlich === n); }
function istMitarbeiter(p, n, lage) { return istVerwalter(p, n, lage) || p.beteiligte.includes(n); }
function siehtProjekt(p, n, lage) {
  if (!n) return false;
  if (istMitarbeiter(p, n, lage)) return true;
  if (p.sicht === "alle") return true;
  if (p.sicht === "ausschuss") return lage.ausschuss(n);
  return false;
}
async function projektLaden(id) {
  if (!istId(id)) throw fehler(400, "Ungültiges Projekt.");
  const { data, error } = await db.from("projekte").select("id,data").eq("id", id).maybeSingle();
  if (error) throw tabellenFehler(error);
  if (!data) throw fehler(404, "Dieses Projekt gibt es nicht (mehr).");
  return alsProjekt(data);
}
function tabellenFehler(e) {
  const t = String((e && e.message) || e || "");
  if (/relation|does not exist|schema cache|not find/i.test(t)) return fehler(500, "Die Tabellen für Projekte und Aufgaben fehlen noch – bitte das SQL aus der Update-Anleitung ausführen.");
  return e;
}
async function eintragSchreiben(projekt, von, text, art = "notiz", extra = {}) {
  const id = neueId();
  const ts = new Date().toISOString();
  await db.from("projekt_eintraege").upsert({ id, projekt, ts, data: { art, von, text: kurz(text, 2000), ts, ...extra } });
  return id;
}

// ---------- Aufgaben ----------
function alsAufgabe(row) { const d = row.data || {}; return { id: row.id, projekt: row.projekt || null, ...d }; }
async function aufgabeLaden(id) {
  if (!istId(id)) throw fehler(400, "Ungültige Aufgabe.");
  const { data, error } = await db.from("aufgaben").select("id,projekt,data").eq("id", id).maybeSingle();
  if (error) throw tabellenFehler(error);
  if (!data) throw fehler(404, "Diese Aufgabe gibt es nicht (mehr).");
  return alsAufgabe(data);
}
// Darf `n` die Aufgabe ändern/löschen? Ersteller, im Projekt auch Verwalter (Admins als Projekt-Verwalter).
function darfAufgabeAendern(a, p, n, lage) { return a.erstelltVon === n || (!!p && istVerwalter(p, n, lage)); }

async function push(an, title, text, wichtig = false) {
  const liste = [...new Set((an || []).filter(Boolean))];
  if (!liste.length) return;
  try { await sendPush({ httpMethod: "POST", intern: true, body: JSON.stringify({ an: liste, title, text, sender: "", wichtig, url: TODO_URL }) }); } catch (e) { /* Push ist Zusatz */ }
}

// Zahl für die Kachel „To-do“ (über umfrage → anzahl): neue Aufgaben (seit dem letzten Öffnen des To-do von anderen
// zugewiesen) und überfällige Aufgaben (Fälligkeit vor heute). Aufgaben in archivierten Projekten zählen nicht.
// Fehlen die Tabellen noch, ist das Ergebnis 0.
export async function offeneAufgabenZahl(name, jetzt = new Date()) {
  try {
    const [{ data, error }, gesehenAlle] = await Promise.all([db.from("aufgaben").select("id,projekt,data").eq("data->>zustaendig", name), getKv("todoGesehen")]);
    if (error) return 0;
    const gesehen = String(((gesehenAlle && typeof gesehenAlle === "object") ? gesehenAlle : {})[name] || "");
    const heute = heuteBerlin(jetzt);
    const zaehlt = (data || []).map(alsAufgabe).filter((a) => !a.erledigt && (
      (istDatum(a.faellig) && a.faellig < heute) ||
      (a.erstelltVon !== name && String(a.zugewiesenAm || a.erstelltAm || "") > gesehen)
    ));
    if (!zaehlt.length) return 0;
    const projektIds = [...new Set(zaehlt.map((a) => a.projekt).filter(Boolean))];
    let archiviert = new Set();
    if (projektIds.length) {
      const { data: ps } = await db.from("projekte").select("id,data").in("id", projektIds);
      archiviert = new Set((ps || []).filter((p) => (p.data || {}).archiviert).map((p) => p.id));
    }
    return zaehlt.filter((a) => !a.projekt || !archiviert.has(a.projekt)).length;
  } catch (e) { return 0; }
}

// Stündlich (umfrage-erinnerung.js): Am gewählten Erinnerungstag ab 18 Uhr eine Erinnerung an den Zuständigen (einmal).
export async function pruefeAufgabenErinnerungen(jetzt = new Date()) {
  const config = (await getKv("config")) || {};
  const aus = Array.isArray(config.kachelnAus) ? config.kachelnAus : [];
  if (aus.includes("todo") && aus.includes("projekte")) return { erinnert: 0 };
  if (Number(berlin(jetzt, { hour: "2-digit", hour12: false })) < 18) return { erinnert: 0 };
  const heute = heuteBerlin(jetzt);
  const { data, error } = await db.from("aufgaben").select("id,projekt,data");
  if (error) return { erinnert: 0 };
  const faellig = (data || []).map(alsAufgabe).filter((a) => !a.erledigt && a.zustaendig && erinnerungsTag(a) === heute && a.erinnertFuer !== heute);
  if (!faellig.length) return { erinnert: 0 };
  const projektIds = [...new Set(faellig.map((a) => a.projekt).filter(Boolean))];
  const projekte = {};
  if (projektIds.length) {
    const { data: ps } = await db.from("projekte").select("id,data").in("id", projektIds);
    (ps || []).forEach((p) => { projekte[p.id] = p.data || {}; });
  }
  let erinnert = 0;
  for (const a of faellig) {
    const p = a.projekt ? projekte[a.projekt] : null;
    if (a.projekt && (!p || p.archiviert)) continue;
    let titel = "🔔 Erinnerung an eine Aufgabe";
    if (istDatum(a.faellig)) {
      const n = tageZwischen(heute, a.faellig);
      titel = n < 0 ? "⏰ Aufgabe ist überfällig" : n === 0 ? "⏰ Aufgabe ist heute fällig" : n === 1 ? "⏰ Aufgabe ist morgen fällig" : `⏰ Aufgabe ist in ${n} Tagen fällig`;
    }
    await push([a.zustaendig], titel, `${a.text}${istDatum(a.faellig) ? ` (bis ${datumDe(a.faellig)})` : ""}${p ? ` · Projekt: ${p.name}` : ""}`);
    const { id, projekt, ...daten } = a;
    await db.from("aufgaben").update({ data: { ...daten, erinnertFuer: heute }, updated_at: new Date().toISOString() }).eq("id", id);
    erinnert++;
  }
  return { erinnert };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }
  try {
    const lage = await ladeLage(body.token);
    if (!lage.ich) return json(401, { error: "Bitte PIN bestätigen." });
    const ich = lage.ich;
    const { action } = body;
    const aus = Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : [];
    const projektAktion = ["list", "get", "save", "archivieren", "delete", "notiz", "eintragDelete", "uploadUrl", "dokument"].includes(action);
    if (projektAktion && aus.includes("projekte")) return json(403, { error: "Die Kachel „Projekte“ ist derzeit für die ganze Feuerwehr gesperrt." });
    if (!projektAktion && aus.includes("todo") && aus.includes("projekte")) return json(403, { error: "Die Kachel „To-do“ ist derzeit für die ganze Feuerwehr gesperrt." });

    // ---------------- Projektliste ----------------
    if (action === "list") {
      const [{ data: rows, error }, { data: aRows, error: e2 }] = await Promise.all([db.from("projekte").select("id,data"), db.from("aufgaben").select("id,projekt,data")]);
      if (error || e2) throw tabellenFehler(error || e2);
      const zahl = {};
      (aRows || []).forEach((r) => { if (!r.projekt) return; const z = (zahl[r.projekt] = zahl[r.projekt] || { gesamt: 0, erledigt: 0, meine: 0 }); z.gesamt++; if ((r.data || {}).erledigt) z.erledigt++; else if ((r.data || {}).zustaendig === ich) z.meine++; });
      const projekte = (rows || []).map(alsProjekt).filter((p) => siehtProjekt(p, ich, lage)).map((p) => ({
        id: p.id, name: p.name, phase: p.phase, verantwortlich: p.verantwortlich || "", ziel: p.ziel || "", start: p.start || "",
        archiviert: !!p.archiviert, archiviertAm: p.archiviertAm || "", sicht: p.sicht, erstelltVon: p.erstelltVon, geaendertAm: p.geaendertAm || p.erstelltAm || "",
        aufgaben: zahl[p.id] || { gesamt: 0, erledigt: 0, meine: 0 }, verwalter: istVerwalter(p, ich, lage), beteiligt: istMitarbeiter(p, ich, lage),
      }));
      return json(200, { projekte, darfAnlegen: lage.darfAnlegen(ich), darfZuweisen: lage.darfZuweisen(ich) });
    }

    // ---------------- Ein Projekt ----------------
    if (action === "get") {
      const p = await projektLaden(String(body.id || ""));
      if (!siehtProjekt(p, ich, lage)) throw fehler(403, "Dieses Projekt ist für dich nicht freigegeben.");
      const [{ data: aRows, error: e1 }, { data: eRows, error: e2 }] = await Promise.all([
        db.from("aufgaben").select("id,projekt,data").eq("projekt", p.id),
        db.from("projekt_eintraege").select("id,projekt,data,ts").eq("projekt", p.id),
      ]);
      if (e1 || e2) throw tabellenFehler(e1 || e2);
      const eintraege = (eRows || []).map((r) => ({ id: r.id, ...(r.data || {}), ts: (r.data || {}).ts || r.ts })).sort((a, b) => (a.ts < b.ts ? 1 : -1));
      const doks = eintraege.filter((e) => e.art === "dokument" && e.pfad);
      if (doks.length) {
        const { data: links } = await db.storage.from(BUCKET).createSignedUrls(doks.map((d) => d.pfad), 60 * 60);
        doks.forEach((d, i) => { d.url = links && links[i] && !links[i].error ? links[i].signedUrl : null; });
      }
      const verwalter = istVerwalter(p, ich, lage);
      return json(200, {
        projekt: p, aufgaben: (aRows || []).map(alsAufgabe), eintraege,
        rechte: { verwalter, mitarbeiter: istMitarbeiter(p, ich, lage), loeschen: lage.admin(ich) || p.erstelltVon === ich, zuweisen: verwalter || lage.darfZuweisen(ich) },
      });
    }

    // ---------------- Projekt anlegen / ändern ----------------
    if (action === "save") {
      const x = body.projekt && typeof body.projekt === "object" ? body.projekt : {};
      const name = kurz(x.name, 120);
      if (!name) throw fehler(400, "Bitte einen Namen für das Projekt eingeben.");
      const person = (n) => { const s = kurz(n, 80); return s && lage.aktiv.has(s) ? s : ""; };
      const felder = {
        name, beschreibung: kurz(x.beschreibung, 3000), phase: PHASEN.includes(x.phase) ? x.phase : "idee",
        verantwortlich: person(x.verantwortlich), start: datum(x.start), ziel: datum(x.ziel),
        sicht: SICHT.includes(x.sicht) ? x.sicht : "alle",
        beteiligte: [...new Set((Array.isArray(x.beteiligte) ? x.beteiligte : []).map(person).filter(Boolean))].slice(0, 100),
        budget: betrag(x.budget), kosten: betrag(x.kosten),
      };
      const jetzt = new Date().toISOString();
      if (!x.id) {
        if (!lage.darfAnlegen(ich)) throw fehler(403, "Projekte anlegen dürfen Kommandant, stellv. Kommandant, Ausschuss und Admins.");
        const id = neueId();
        const data = { ...felder, erstelltVon: ich, erstelltAm: jetzt, geaendertAm: jetzt, archiviert: false };
        const { error } = await db.from("projekte").upsert({ id, data, created_at: jetzt, updated_at: jetzt });
        if (error) throw tabellenFehler(error);
        await eintragSchreiben(id, ich, "Projekt angelegt", "system");
        return json(200, { ok: true, id });
      }
      const alt = await projektLaden(String(x.id));
      if (!istVerwalter(alt, ich, lage)) throw fehler(403, "Ändern dürfen nur Ersteller, Verantwortlicher und Admins.");
      const data = { ...alt, ...felder, geaendertAm: jetzt, geaendertVon: ich };
      delete data.id;
      const { error } = await db.from("projekte").update({ data, updated_at: jetzt }).eq("id", alt.id);
      if (error) throw tabellenFehler(error);
      if (alt.phase !== felder.phase) await eintragSchreiben(alt.id, ich, `Phase geändert: ${PHASE_NAME[alt.phase] || alt.phase} → ${PHASE_NAME[felder.phase]}`, "system");
      return json(200, { ok: true, id: alt.id });
    }

    if (action === "archivieren") {
      const p = await projektLaden(String(body.id || ""));
      if (!istVerwalter(p, ich, lage)) throw fehler(403, "Archivieren dürfen nur Ersteller, Verantwortlicher und Admins.");
      const an = body.archiviert !== false;
      const jetzt = new Date().toISOString();
      const { id, ...rest } = p;
      const data = { ...rest, archiviert: an, archiviertAm: an ? jetzt : "", phase: an ? "erledigt" : rest.phase, geaendertAm: jetzt, geaendertVon: ich };
      await db.from("projekte").update({ data, updated_at: jetzt }).eq("id", id);
      await eintragSchreiben(id, ich, an ? "Projekt abgeschlossen und archiviert" : "Projekt aus dem Archiv geholt", "system");
      return json(200, { ok: true });
    }

    if (action === "delete") {
      const p = await projektLaden(String(body.id || ""));
      if (!(lage.admin(ich) || p.erstelltVon === ich)) throw fehler(403, "Löschen dürfen nur der Ersteller und Admins.");
      const { data: eRows } = await db.from("projekt_eintraege").select("id,data").eq("projekt", p.id);
      const pfade = (eRows || []).map((r) => (r.data || {}).pfad).filter(Boolean);
      if (pfade.length) { try { await db.storage.from(BUCKET).remove(pfade); } catch (e) { /* egal */ } }
      await db.from("projekt_eintraege").delete().eq("projekt", p.id);
      await db.from("aufgaben").delete().eq("projekt", p.id);
      await db.from("projekte").delete().eq("id", p.id);
      return json(200, { ok: true });
    }

    // ---------------- Verlauf und Dokumente ----------------
    if (action === "notiz") {
      const p = await projektLaden(String(body.projekt || ""));
      if (!istMitarbeiter(p, ich, lage)) throw fehler(403, "Notizen schreiben nur Verantwortliche und Beteiligte des Projekts.");
      const text = kurz(body.text, 2000);
      if (!text) throw fehler(400, "Bitte einen Text eingeben.");
      const id = await eintragSchreiben(p.id, ich, text, "notiz");
      return json(200, { ok: true, id });
    }
    if (action === "eintragDelete") {
      const id = String(body.id || "");
      if (!istId(id)) throw fehler(400, "Ungültiger Eintrag.");
      const { data: row } = await db.from("projekt_eintraege").select("id,projekt,data").eq("id", id).maybeSingle();
      if (!row) throw fehler(404, "Diesen Eintrag gibt es nicht (mehr).");
      const p = await projektLaden(row.projekt);
      const d = row.data || {};
      if (d.art === "system") throw fehler(403, "Automatische Einträge lassen sich nicht löschen.");
      if (!(d.von === ich || istVerwalter(p, ich, lage))) throw fehler(403, "Löschen dürfen nur der Verfasser und die Verwalter des Projekts.");
      if (d.pfad) { try { await db.storage.from(BUCKET).remove([d.pfad]); } catch (e) { /* egal */ } }
      await db.from("projekt_eintraege").delete().eq("id", id);
      return json(200, { ok: true });
    }
    if (action === "uploadUrl") {
      const p = await projektLaden(String(body.projekt || ""));
      if (!istMitarbeiter(p, ich, lage)) throw fehler(403, "Dokumente hochladen nur Verantwortliche und Beteiligte des Projekts.");
      const safe = String(body.filename || "datei").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const pfad = `${p.id}/${neueId()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(pfad);
      if (error) throw fehler(500, "Der Speicher für Projekt-Dokumente fehlt noch – bitte das SQL aus der Update-Anleitung ausführen.");
      return json(200, { path: pfad, uploadToken: data.token });
    }
    if (action === "dokument") {
      const p = await projektLaden(String(body.projekt || ""));
      if (!istMitarbeiter(p, ich, lage)) throw fehler(403, "Dokumente hochladen nur Verantwortliche und Beteiligte des Projekts.");
      const pfad = String(body.pfad || "");
      if (!new RegExp(`^${p.id}/[a-f0-9]{10}_[A-Za-z0-9._-]{1,60}$`).test(pfad)) throw fehler(400, "Ungültige Datei.");
      const { data: eRows } = await db.from("projekt_eintraege").select("id,data").eq("projekt", p.id);
      if ((eRows || []).filter((r) => (r.data || {}).art === "dokument").length >= MAX_DOKUMENTE) throw fehler(400, `Höchstens ${MAX_DOKUMENTE} Dokumente je Projekt.`);
      const id = await eintragSchreiben(p.id, ich, kurz(body.beschreibung, 300), "dokument", { pfad, name: kurz(body.name, 120) || "Datei", typ: kurz(body.typ, 100), groesse: Math.max(0, Math.min(Number(body.groesse) || 0, 20 * 1024 * 1024)) });
      return json(200, { ok: true, id });
    }

    // ---------------- Aufgaben ----------------
    if (action === "todo") {
      // Kachel geöffnet: neue Aufgaben gelten jetzt als gesehen (für die Zahl an der Kachel)
      try { await kvAendern("todoGesehen", (m) => ({ ...((m && typeof m === "object") ? m : {}), [ich]: new Date().toISOString() }), {}); } catch (e) { /* nur für die Zahl */ }
      // Meine Aufgaben: zuständig oder selbst angelegt (Aufgaben in archivierten Projekten nicht)
      const [{ data: z, error: e1 }, { data: e, error: e2 }] = await Promise.all([
        db.from("aufgaben").select("id,projekt,data").eq("data->>zustaendig", ich),
        db.from("aufgaben").select("id,projekt,data").eq("data->>erstelltVon", ich),
      ]);
      if (e1 || e2) throw tabellenFehler(e1 || e2);
      const map = new Map();
      [...(z || []), ...(e || [])].forEach((r) => map.set(r.id, alsAufgabe(r)));
      const liste = [...map.values()];
      const projektIds = [...new Set(liste.map((a) => a.projekt).filter(Boolean))];
      const projekte = {};
      if (projektIds.length) {
        const { data: ps } = await db.from("projekte").select("id,data").in("id", projektIds);
        (ps || []).forEach((p) => { projekte[p.id] = alsProjekt(p); });
      }
      const aufgaben = liste.filter((a) => !a.projekt || (projekte[a.projekt] && !projekte[a.projekt].archiviert)).map((a) => {
        const p = a.projekt ? projekte[a.projekt] : null;
        return { ...a, projektName: p ? p.name : "", projektSichtbar: p ? siehtProjekt(p, ich, lage) : false, darfAendern: darfAufgabeAendern(a, p, ich, lage) };
      });
      return json(200, { aufgaben, darfZuweisen: lage.darfZuweisen(ich), kachelProjekte: !aus.includes("projekte") });
    }

    if (action === "aufgabeSave") {
      const x = body.aufgabe && typeof body.aufgabe === "object" ? body.aufgabe : {};
      const text = kurz(x.text, 300);
      if (!text) throw fehler(400, "Bitte beschreiben, was zu tun ist.");
      const zustaendig = kurz(x.zustaendig, 80) || ich;
      if (!lage.aktiv.has(zustaendig)) throw fehler(400, "Diese Person gibt es nicht (mehr) in der Mitgliederliste.");
      const jetzt = new Date().toISOString();
      const alt = x.id ? await aufgabeLaden(String(x.id)) : null;
      const projektId = alt ? alt.projekt : (x.projekt ? String(x.projekt) : null);
      const p = projektId ? await projektLaden(projektId) : null;
      if (p && p.archiviert) throw fehler(409, "Das Projekt ist archiviert – bitte zuerst aus dem Archiv holen.");
      if (alt) { if (!darfAufgabeAendern(alt, p, ich, lage)) throw fehler(403, "Ändern dürfen nur der Ersteller der Aufgabe und die Verwalter des Projekts."); }
      else if (p && !istMitarbeiter(p, ich, lage)) throw fehler(403, "Aufgaben anlegen dürfen nur Verantwortliche und Beteiligte des Projekts.");
      const neuZugewiesen = zustaendig !== ich && (!alt || alt.zustaendig !== zustaendig);
      if (neuZugewiesen && !(lage.darfZuweisen(ich) || (p && istVerwalter(p, ich, lage)))) throw fehler(403, "Aufgaben an andere vergeben dürfen Kommandant, stellv. Kommandant, Ausschuss, Gerätewart und Admins (im eigenen Projekt auch der Verantwortliche).");
      const faellig = datum(x.faellig);
      // Erinnerung: neu gewählt, sonst die bisherige behalten (alte Aufgaben ohne Feld: 1 Tag vorher)
      const erinnerung = sauberErinnerung("erinnerung" in x ? x.erinnerung : (alt ? (alt.erinnerung || (alt.faellig ? { art: "tage", tage: 1 } : null)) : undefined), faellig);
      const data = {
        ...(alt ? (({ id, projekt, ...r }) => r)(alt) : { erstelltVon: ich, erstelltAm: jetzt, erledigt: false }),
        text, notiz: kurz(x.notiz, 1000), zustaendig, faellig, erinnerung, geaendertAm: jetzt,
        ...(neuZugewiesen ? { zugewiesenAm: jetzt } : {}),
      };
      if (alt && neuZugewiesen) { data.status = ""; data.zNotiz = ""; data.zNotizAm = ""; }
      if (alt && erinnerungsTag(alt) !== erinnerungsTag(data)) data.erinnertFuer = "";
      const id = alt ? alt.id : neueId();
      const { error } = await db.from("aufgaben").upsert({ id, projekt: projektId, data, updated_at: jetzt, ...(alt ? {} : { created_at: jetzt }) });
      if (error) throw tabellenFehler(error);
      if (neuZugewiesen) await push([zustaendig], "📋 Neue Aufgabe für dich", `${ich}: ${text}${faellig ? ` (bis ${datumDe(faellig)})` : ""}${p ? ` · Projekt: ${p.name}` : ""}`);
      return json(200, { ok: true, id });
    }

    if (action === "aufgabeErledigt") {
      const a = await aufgabeLaden(String(body.id || ""));
      const p = a.projekt ? await projektLaden(a.projekt).catch(() => null) : null;
      if (!(a.zustaendig === ich || darfAufgabeAendern(a, p, ich, lage))) throw fehler(403, "Abhaken dürfen der Zuständige, der Ersteller und die Verwalter des Projekts.");
      const erledigt = body.erledigt !== false;
      const jetzt = new Date().toISOString();
      const { id, projekt, ...rest } = a;
      const data = { ...rest, erledigt, status: "", erledigtAm: erledigt ? jetzt : "", erledigtVon: erledigt ? ich : "", geaendertAm: jetzt };
      await db.from("aufgaben").update({ data, updated_at: jetzt }).eq("id", id);
      if (erledigt && !a.erledigt && a.erstelltVon && a.erstelltVon !== ich) await push([a.erstelltVon], "✅ Aufgabe erledigt", `${ich}: ${a.text}${p ? ` · Projekt: ${p.name}` : ""}`);
      return json(200, { ok: true, erledigt });
    }

    // Status (offen / in Bearbeitung / erledigt): Zuständiger, Ersteller, Verwalter des Projekts. Push an den Ersteller nur bei „erledigt“.
    if (action === "aufgabeStatus") {
      const a = await aufgabeLaden(String(body.id || ""));
      const p = a.projekt ? await projektLaden(a.projekt).catch(() => null) : null;
      if (p && p.archiviert) throw fehler(409, "Das Projekt ist archiviert – bitte zuerst aus dem Archiv holen.");
      if (!(a.zustaendig === ich || darfAufgabeAendern(a, p, ich, lage))) throw fehler(403, "Den Status setzen dürfen der Zuständige, der Ersteller und die Verwalter des Projekts.");
      const st = String(body.status || "");
      if (!["offen", "bearbeitung", "erledigt"].includes(st)) throw fehler(400, "Unbekannter Status.");
      const erledigt = st === "erledigt";
      const jetzt = new Date().toISOString();
      const { id, projekt, ...rest } = a;
      const data = { ...rest, erledigt, status: st === "bearbeitung" ? "bearbeitung" : "", erledigtAm: erledigt ? (a.erledigt ? a.erledigtAm : jetzt) : "", erledigtVon: erledigt ? (a.erledigt ? a.erledigtVon : ich) : "", geaendertAm: jetzt };
      const { error } = await db.from("aufgaben").update({ data, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      if (erledigt && !a.erledigt && a.erstelltVon && a.erstelltVon !== ich) await push([a.erstelltVon], "✅ Aufgabe erledigt", `${ich}: ${a.text}${p ? ` · Projekt: ${p.name}` : ""}`);
      return json(200, { ok: true, status: st });
    }

    // Notiz des Zuständigen (nur er selbst schreibt sie; Ersteller und Verwalter lesen mit)
    if (action === "aufgabeNotiz") {
      const a = await aufgabeLaden(String(body.id || ""));
      const p = a.projekt ? await projektLaden(a.projekt).catch(() => null) : null;
      if (p && p.archiviert) throw fehler(409, "Das Projekt ist archiviert – bitte zuerst aus dem Archiv holen.");
      if (a.zustaendig !== ich) throw fehler(403, "Die Notiz schreibt nur der Zuständige.");
      const jetzt = new Date().toISOString();
      const text = kurz(body.text, 1000);
      const { id, projekt, ...rest } = a;
      const data = { ...rest, zNotiz: text, zNotizAm: text ? jetzt : "", geaendertAm: jetzt };
      const { error } = await db.from("aufgaben").update({ data, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      return json(200, { ok: true });
    }

    // Erinnerung ändern: der Zuständige selbst (auch wenn er die Aufgabe nicht angelegt hat), außerdem Ersteller und Verwalter
    if (action === "aufgabeErinnerung") {
      const a = await aufgabeLaden(String(body.id || ""));
      const p = a.projekt ? await projektLaden(a.projekt).catch(() => null) : null;
      if (p && p.archiviert) throw fehler(409, "Das Projekt ist archiviert – bitte zuerst aus dem Archiv holen.");
      if (!(a.zustaendig === ich || darfAufgabeAendern(a, p, ich, lage))) throw fehler(403, "Die Erinnerung ändern dürfen der Zuständige, der Ersteller und die Verwalter des Projekts.");
      const e = body.erinnerung && typeof body.erinnerung === "object" ? body.erinnerung : null;
      if (e && e.art === "datum" && !istDatum(e.datum)) throw fehler(400, "Bitte ein gültiges Datum für die Erinnerung wählen.");
      if (e && e.art === "tage" && !istDatum(a.faellig)) throw fehler(400, "„Tage vorher“ geht nur, wenn die Aufgabe ein Fälligkeitsdatum hat.");
      if (e && e.art === "tage" && !(Number.isInteger(Number(e.tage)) && Number(e.tage) >= 0 && Number(e.tage) <= MAX_TAGE_VORHER)) throw fehler(400, `Bitte eine ganze Zahl von 0 bis ${MAX_TAGE_VORHER} eingeben.`);
      const erinnerung = sauberErinnerung(e, a.faellig);
      const jetzt = new Date().toISOString();
      const { id, projekt, ...rest } = a;
      const data = { ...rest, erinnerung, geaendertAm: jetzt };
      if (erinnerungsTag(a) !== erinnerungsTag(data)) data.erinnertFuer = "";
      const { error } = await db.from("aufgaben").update({ data, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      return json(200, { ok: true });
    }

    if (action === "aufgabeDelete") {
      const a = await aufgabeLaden(String(body.id || ""));
      const p = a.projekt ? await projektLaden(a.projekt).catch(() => null) : null;
      if (!darfAufgabeAendern(a, p, ich, lage)) throw fehler(403, "Löschen dürfen nur der Ersteller der Aufgabe und die Verwalter des Projekts.");
      await db.from("aufgaben").delete().eq("id", a.id);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    const t = tabellenFehler(e);
    if (t && t.code === 500) return json(500, { error: t.message });
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
