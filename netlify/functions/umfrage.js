// netlify/functions/umfrage.js
// Terminumfragen (wie Doodle): Für eine Umfrage werden mehrere Terminvorschläge eingetragen, die Mitglieder des
// Bereichs stimmen je Termin mit Ja oder Nein ab (die Namen sind für alle Beteiligten sichtbar).
// Beim Abschluss werden ein oder mehrere Termine bestätigt und als Kalendertermine übernommen – die Kameraden,
// die für einen Termin mit Ja gestimmt haben, sind dort automatisch als „Zusage“ eingetragen.
//
//  - Tabelle terminumfragen          (eine Zeile je Umfrage: Titel, Bereich, Termine, Status, bestätigte Termine)
//  - Limit je Termin (t.max, optional): die ersten Ja-Stimmen haben einen Platz, weitere stehen auf der Warteliste und rücken nach
//  - Tabelle terminumfragen_stimmen  (eine Zeile je Mitglied und Termin – so gehen gleichzeitige Stimmen nicht verloren)
//
// Rechte (immer frisch aus der Mitgliederliste ermittelt):
//  - Sehen und abstimmen: Mitglieder des Bereichs der Umfrage, Admins (Admins sehen alle Bereiche)
//  - Anlegen, abschließen, löschen: Admins und Mitglieder mit Kalender-Schreibrecht im Bereich der Umfrage
// Die Kalendertermine selbst schreibt die App (Kalender-Daten gehören der App); der Server liefert die fertigen Termine.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BEREICHE = ["einsatzabteilung", "jugendfeuerwehr", "wettkampfgruppe", "altersabteilung", "atemschutz", "fuehrungskraefte"];
const BEREICH_NAME = { einsatzabteilung: "Einsatzabteilung", jugendfeuerwehr: "Jugendfeuerwehr", wettkampfgruppe: "Wettkampfgruppe", altersabteilung: "Altersabteilung", atemschutz: "Atemschutz", fuehrungskraefte: "Führungskräfte" };
const KATEGORIEN = ["uebung", "brandwache", "einsatz", "sonstiges"];
const MAX_TERMINE = 10;
const AUFBEWAHRUNG_TAGE = 180; // abgeschlossene Umfragen werden nach ca. 6 Monaten automatisch gelöscht
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const neueId = () => crypto.randomBytes(6).toString("hex");
const kurz = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const lang = (v, n) => String(v ?? "").trim().slice(0, n);
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const heute = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
const istZeit = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
const datumKurz = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };

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
  const gesperrt = new Set([...users.filter((u) => u.blocked).map((u) => u.name), ...liste.filter((r) => r && r.gesperrt).map((r) => r.name)]);
  const eintrag = (name) => liste.find((r) => r && r.name === name) || {};
  const adminVon = (name) => !!users.find((u) => u.name === name && u.is_admin);
  return {
    me, users, roster: liste, config: config || {}, gesperrt, eintrag, adminVon,
    admin: !!(me && me.is_admin),
    // Mitglied des Bereichs (Admins gelten für alle Bereiche)
    istMitglied: (name, bereich) => !!name && !gesperrt.has(name) && (adminVon(name) || (eintrag(name).bereiche || []).includes(bereich)),
    // Darf Umfragen für den Bereich anlegen/abschließen/löschen (wie Kalender-Schreibrecht)
    darfVerwalten: (name, bereich) => !!name && !gesperrt.has(name) && (adminVon(name) || !!((eintrag(name).rechte || {})[bereich] || {}).calendar),
  };
}
async function push(an, title, text, sender) {
  const ziel = [...new Set(an)].filter(Boolean);
  if (!ziel.length) return;
  try { await sendPush({ httpMethod: "POST", body: JSON.stringify({ an: ziel, title, text, sender }) }); } catch (e) { /* Push ist Zusatz – die Umfrage ist gespeichert */ }
}
const alsUmfrage = (row) => ({ ...(row.data || {}), id: row.id });

// Aus den Stimmen je Termin die Namen mit Ja / Nein. Hat ein Termin ein Limit (t.max), haben die ersten Ja-Stimmen
// (nach Zeitpunkt der Ja-Stimme) einen Platz, alle weiteren stehen in der Reihenfolge auf der Warteliste.
function stimmenJeTermin(umfrage, stimmen) {
  const ja = {}, nein = {}, warte = {}, jaRoh = {};
  umfrage.termine.forEach((t) => { ja[t.id] = []; nein[t.id] = []; warte[t.id] = []; jaRoh[t.id] = []; });
  (stimmen || []).forEach((s) => {
    if (!ja[s.termin]) return;
    if (s.antwort === "ja") jaRoh[s.termin].push(s); else nein[s.termin].push(s.name);
  });
  umfrage.termine.forEach((t) => {
    const reihe = jaRoh[t.id].sort((x, y) => String(x.ts || "").localeCompare(String(y.ts || "")) || x.name.localeCompare(y.name, "de")).map((s) => s.name);
    const max = Number(t.max) > 0 ? Number(t.max) : 0;
    ja[t.id] = max ? reihe.slice(0, max) : reihe;
    warte[t.id] = max ? reihe.slice(max) : [];
    ja[t.id].sort((x, y) => x.localeCompare(y, "de"));
    nein[t.id].sort((x, y) => x.localeCompare(y, "de"));
  });
  return { ja, nein, warte };
}

// Fertige Kalendertermine für die bestätigten Termine (Zusage der Ja-Stimmen schon eingetragen).
// Dieselben Termin-IDs wie beim Abschluss – so lässt sich die Übernahme bei Bedarf wiederholen, ohne Doppelte zu erzeugen.
function kalenderTermine(u) {
  return (u.bestaetigt || []).map((b) => {
    const t = (u.termine || []).find((x) => x.id === b.terminId);
    if (!t) return null;
    const responses = {}; (b.namen || []).forEach((n) => { responses[n] = "zu"; });
    const ts = Date.parse(u.abgeschlossenAm || "") || Date.now();
    return {
      id: b.eventId, title: u.titel, date: t.datum, time: t.zeit || "", location: u.ort || "", category: u.kategorie || "uebung", notes: [u.hinweis || "", Number(t.max) > 0 ? `Max. ${Number(t.max)} Personen` : ""].filter(Boolean).join("\n"), bereich: u.bereich,
      capacityMode: false, capacityNeeded: 3, namesVisible: true, gruppenfuehrer: "", anmeldeschluss: "", anmeldeschlussReminderDays: 3,
      responses, signups: {}, createdAt: ts, updatedAt: ts, ausUmfrage: u.id,
    };
  }).filter(Boolean);
}

async function alleUmfragen() {
  const { data, error } = await db.from("terminumfragen").select("*");
  if (error) throw error;
  return data || [];
}
async function umfrageLaden(id) {
  const { data } = await db.from("terminumfragen").select("*").eq("id", String(id || "")).maybeSingle();
  return data || null;
}
async function stimmenLaden(ids) {
  if (!ids.length) return [];
  const { data, error } = await db.from("terminumfragen_stimmen").select("*").in("umfrage", ids);
  if (error) throw error;
  return data || [];
}
async function umfrageLoeschen(id) {
  await db.from("terminumfragen_stimmen").delete().eq("umfrage", id);
  await db.from("terminumfragen").delete().eq("id", id);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    {
      // Vom Hauptadmin für die ganze Feuerwehr gesperrte Kachel (Einstellungen → Kacheln verwalten).
      const aus = Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : [];
      if (aus.includes("umfragen")) return json(403, { error: "Diese Kachel ist derzeit für die ganze Feuerwehr gesperrt." });
    }
    const ich = lage.me.name;
    const meinBereiche = lage.admin ? BEREICHE : (lage.eintrag(ich).bereiche || []).filter((b) => BEREICHE.includes(b));
    const meineVerwalten = BEREICHE.filter((b) => lage.darfVerwalten(ich, b));
    const { action } = body;

    // ---------------- Liste ----------------
    if (action === "list") {
      const alle = await alleUmfragen();
      const sichtbar = alle.map(alsUmfrage).filter((u) => lage.istMitglied(ich, u.bereich) || u.erstelltVon === ich);
      // abgeschlossene Umfragen nach ca. 6 Monaten still aufräumen
      const grenze = Date.now() - AUFBEWAHRUNG_TAGE * 86400000;
      const veraltet = alle.filter((r) => (r.data || {}).status === "abgeschlossen" && (Date.parse((r.data || {}).abgeschlossenAm || "") || Date.now()) < grenze).map((r) => r.id);
      for (const id of veraltet) await umfrageLoeschen(id);
      const aktuell = sichtbar.filter((u) => !veraltet.includes(u.id));
      const stimmen = await stimmenLaden(aktuell.map((u) => u.id));
      const umfragen = aktuell.map((u) => {
        const eigene = stimmen.filter((s) => s.umfrage === u.id);
        const { ja, nein, warte } = stimmenJeTermin(u, eigene);
        const meine = {}; eigene.filter((s) => s.name === ich).forEach((s) => { meine[s.termin] = s.antwort; });
        const mitglieder = lage.roster.filter((r) => r && (r.bereiche || []).includes(u.bereich) && !lage.gesperrt.has(r.name)).length;
        return {
          ...u, ja, nein, warte, meine,
          abgestimmt: [...new Set(eigene.map((s) => s.name))].length, mitglieder,
          darfVerwalten: lage.darfVerwalten(ich, u.bereich),
          darfAbstimmen: u.status === "offen" && lage.istMitglied(ich, u.bereich) && !(u.abstimmenBis && u.abstimmenBis < heute()),
          termineKalender: u.status === "abgeschlossen" && lage.darfVerwalten(ich, u.bereich) ? kalenderTermine(u) : [],
        };
      }).sort((a, b) => String(b.erstelltAm || "").localeCompare(String(a.erstelltAm || "")));
      return json(200, { ich, umfragen, rechte: { anlegen: meineVerwalten, bereiche: meinBereiche } });
    }

    // ---------------- Anlegen ----------------
    if (action === "create") {
      const d = body.umfrage || {};
      const bereich = BEREICHE.includes(d.bereich) ? d.bereich : "";
      if (!bereich) throw fehler(400, "Bitte einen Bereich wählen.");
      if (!lage.darfVerwalten(ich, bereich)) throw fehler(403, "Umfragen für diesen Bereich dürfen nur Admins und Mitglieder mit Kalender-Schreibrecht anlegen.");
      const titel = kurz(d.titel, 80);
      if (!titel) throw fehler(400, "Bitte einen Titel eingeben.");
      const roh = Array.isArray(d.termine) ? d.termine : [];
      const gesehen = new Set();
      const termine = [];
      for (const t of roh) {
        if (!istDatum(t && t.datum)) throw fehler(400, "Bitte bei jedem Terminvorschlag ein Datum eintragen.");
        if (t.datum < heute()) throw fehler(400, "Ein Terminvorschlag liegt in der Vergangenheit.");
        const zeit = istZeit(t.zeit) ? t.zeit : "";
        const key = `${t.datum} ${zeit}`;
        if (gesehen.has(key)) throw fehler(400, "Zwei Terminvorschläge sind gleich.");
        gesehen.add(key);
        const m = t.max === "" || t.max == null ? 0 : Number(t.max);
        if (!Number.isInteger(m) || m < 0 || m > 200) throw fehler(400, "Die maximale Personenzahl muss eine ganze Zahl zwischen 1 und 200 sein (leer = unbegrenzt).");
        termine.push({ id: neueId(), datum: t.datum, zeit, ...(m > 0 ? { max: m } : {}) });
      }
      if (termine.length < 2) throw fehler(400, "Bitte mindestens zwei Terminvorschläge eintragen.");
      if (termine.length > MAX_TERMINE) throw fehler(400, `Es sind höchstens ${MAX_TERMINE} Terminvorschläge möglich.`);
      termine.sort((a, b) => (a.datum + a.zeit).localeCompare(b.datum + b.zeit));
      let abstimmenBis = "";
      if (d.abstimmenBis) {
        if (!istDatum(d.abstimmenBis)) throw fehler(400, "Das Datum „Abstimmen bis“ ist ungültig.");
        if (d.abstimmenBis < heute()) throw fehler(400, "„Abstimmen bis“ liegt in der Vergangenheit.");
        abstimmenBis = d.abstimmenBis;
      }
      const jetzt = new Date().toISOString();
      const id = neueId();
      const data = {
        titel, bereich, ort: kurz(d.ort, 80), hinweis: lang(d.hinweis, 500), kategorie: KATEGORIEN.includes(d.kategorie) ? d.kategorie : "uebung",
        termine, abstimmenBis, status: "offen", erstelltVon: ich, erstelltAm: jetzt, bestaetigt: [],
      };
      const { error } = await db.from("terminumfragen").upsert({ id, data, created_at: jetzt, updated_at: jetzt });
      if (error) throw error;
      const empfaenger = lage.roster.filter((r) => r && lage.istMitglied(r.name, bereich) && r.name !== ich).map((r) => r.name);
      lage.users.filter((u) => u.is_admin && !u.blocked && u.name !== ich).forEach((u) => empfaenger.push(u.name));
      await push(empfaenger, `Neue Terminumfrage: ${titel}`, `${BEREICH_NAME[bereich]} – bitte abstimmen${abstimmenBis ? ` bis ${datumKurz(abstimmenBis)}` : ""}.`, ich);
      return json(200, { ok: true, id });
    }

    // ---------------- Abstimmen ----------------
    if (action === "vote") {
      const row = await umfrageLaden(body.id);
      if (!row) return json(404, { error: "Diese Umfrage gibt es nicht (mehr)." });
      const u = alsUmfrage(row);
      if (!lage.istMitglied(ich, u.bereich)) throw fehler(403, "Diese Umfrage ist nicht für dich.");
      if (u.status !== "offen") throw fehler(400, "Die Umfrage ist schon abgeschlossen.");
      if (u.abstimmenBis && u.abstimmenBis < heute()) throw fehler(400, "Die Abstimmung ist beendet (Frist abgelaufen).");
      const antworten = body.antworten && typeof body.antworten === "object" ? body.antworten : {};
      const vorher = await stimmenLaden([u.id]);
      const davor = stimmenJeTermin(u, vorher);
      const bisher = {}; vorher.filter((s) => s.name === ich).forEach((s) => { bisher[s.termin] = s.antwort; });
      for (const t of u.termine) {
        if (!(t.id in antworten)) continue;
        const a = antworten[t.id];
        const sid = `${u.id}|${ich}|${t.id}`;
        if (a === "ja" || a === "nein") {
          if (bisher[t.id] === a) continue; // unverändert: Zeitpunkt behalten, damit der Platz in der Reihenfolge nicht verloren geht
          const { error } = await db.from("terminumfragen_stimmen").upsert({ id: sid, umfrage: u.id, name: ich, termin: t.id, antwort: a, ts: new Date().toISOString() });
          if (error) throw error;
        } else if (a === null) await db.from("terminumfragen_stimmen").delete().eq("id", sid);
      }
      // Nachrücker: wer vorher auf der Warteliste stand und jetzt einen Platz hat, bekommt eine Benachrichtigung
      const danach = stimmenJeTermin(u, await stimmenLaden([u.id]));
      const nachrueckt = {};
      u.termine.forEach((t) => {
        danach.ja[t.id].filter((n) => n !== ich && davor.warte[t.id].includes(n)).forEach((n) => {
          (nachrueckt[n] = nachrueckt[n] || []).push(`${datumKurz(t.datum)}${t.zeit ? ` ${t.zeit} Uhr` : ""}`);
        });
      });
      for (const [name, liste] of Object.entries(nachrueckt)) {
        await push([name], `Platz frei: ${u.titel}`, `Du bist nachgerückt und hast jetzt einen Platz: ${liste.join(", ")}.`, ich);
      }
      return json(200, { ok: true });
    }

    // ---------------- Abschließen (mit Übernahme in den Kalender) ----------------
    if (action === "abschliessen") {
      const row = await umfrageLaden(body.id);
      if (!row) return json(404, { error: "Diese Umfrage gibt es nicht (mehr)." });
      const u = alsUmfrage(row);
      if (!lage.darfVerwalten(ich, u.bereich)) throw fehler(403, "Das dürfen nur Admins und Mitglieder mit Kalender-Schreibrecht im Bereich.");
      if (u.status !== "offen") throw fehler(400, "Die Umfrage ist schon abgeschlossen.");
      const gewaehlt = (Array.isArray(body.termine) ? body.termine.map(String) : []).filter((id, i, a) => a.indexOf(id) === i);
      if (gewaehlt.some((id) => !u.termine.some((t) => t.id === id))) throw fehler(400, "Ein gewählter Termin gehört nicht zur Umfrage.");
      const stimmen = await stimmenLaden([u.id]);
      const { ja } = stimmenJeTermin(u, stimmen); // nur Personen mit Platz (ohne Warteliste)
      const jetzt = new Date().toISOString();
      const bestaetigt = u.termine.filter((t) => gewaehlt.includes(t.id)).map((t) => ({
        terminId: t.id, eventId: `u${Date.now().toString(36)}${neueId()}`,
        namen: ja[t.id].filter((n) => lage.istMitglied(n, u.bereich)),
      }));
      const data = { ...(row.data || {}), status: "abgeschlossen", bestaetigt, abgeschlossenVon: ich, abgeschlossenAm: jetzt };
      const { error } = await db.from("terminumfragen").upsert({ ...row, data, updated_at: jetzt });
      if (error) throw error;
      const neu = { ...data, id: row.id };
      // Wer eingeteilt ist, bekommt eine Benachrichtigung mit den eigenen Terminen
      const jeName = {};
      bestaetigt.forEach((b) => { const t = u.termine.find((x) => x.id === b.terminId); b.namen.forEach((n) => { (jeName[n] = jeName[n] || []).push(`${datumKurz(t.datum)}${t.zeit ? ` ${t.zeit} Uhr` : ""}`); }); });
      for (const [name, liste] of Object.entries(jeName)) {
        if (name === ich) continue;
        await push([name], `Termin bestätigt: ${u.titel}`, `Du bist eingeteilt: ${liste.join(", ")}.`, ich);
      }
      return json(200, { ok: true, termineKalender: kalenderTermine(neu) });
    }

    // ---------------- Übernahme in den Kalender wiederholen ----------------
    if (action === "kalender") {
      const row = await umfrageLaden(body.id);
      if (!row) return json(404, { error: "Diese Umfrage gibt es nicht (mehr)." });
      const u = alsUmfrage(row);
      if (!lage.darfVerwalten(ich, u.bereich)) throw fehler(403, "Das dürfen nur Admins und Mitglieder mit Kalender-Schreibrecht im Bereich.");
      if (u.status !== "abgeschlossen") throw fehler(400, "Die Umfrage ist noch nicht abgeschlossen.");
      return json(200, { ok: true, termineKalender: kalenderTermine(u) });
    }

    // ---------------- Löschen ----------------
    if (action === "delete") {
      const row = await umfrageLaden(body.id);
      if (!row) return json(200, { ok: true });
      const u = alsUmfrage(row);
      if (!lage.darfVerwalten(ich, u.bereich)) throw fehler(403, "Das dürfen nur Admins und Mitglieder mit Kalender-Schreibrecht im Bereich.");
      await umfrageLoeschen(row.id);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    const text = e && e.message ? e.message : String(e);
    if (/terminumfragen/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabellen für die Terminumfragen fehlen noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
