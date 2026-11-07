// netlify/functions/verbandbuch.js  (seit 2.38)
// Elektronisches Verbandbuch: Dokumentation von Erste-Hilfe-Leistungen und Vorfällen (DGUV Vorschrift 1 § 24).
//  - Einträge                -> Tabelle verbandbuch (id, data)
//  - Änderungsprotokoll      -> Tabelle verbandbuch_log (id, eintrag, ts, data) – nur anfügen; ein Trigger in der Datenbank
//                              verbietet Ändern und Löschen (außer in der Testphase über verbandbuch_testphase_leeren()).
//
// Rechte (immer frisch aus Mitgliederliste und Anmeldung ermittelt):
//  - Eintragen:   jedes Mitglied (für sich oder einen anderen Kameraden). Für Jugendliche (Jugendfeuerwehr ohne
//                 Einsatzabteilung) nur Jugendwart/Jugendleiter (und Admins).
//  - Lesen:       Kommandant, stellv. Kommandant, Admins alles; die verletzte Person ihren eigenen Eintrag;
//                 Jugendwart/Jugendleiter die Einträge von Jugendlichen. Wer einträgt, sieht den Eintrag danach NICHT mehr (außer es ist sein eigener).
//  - Ändern:      Kommandant, stellv. Kommandant, Admins (Jugendeinträge auch Jugendwart/Jugendleiter) – jede Änderung steht im Protokoll.
//  - Ergänzen:    jeder, der den Eintrag lesen darf (Ergänzungen sind eigene Zeilen, der ursprüngliche Text bleibt).
//  - Protokoll:   nur Kommandant, stellv. Kommandant, Admins. Es kann nicht gelöscht werden.
//  - Löschen:     Kommandant, stellv. Kommandant, Admins – erst 5 Jahre nach der letzten Eintragung; im Protokoll bleibt nur „Eintrag Nr. X gelöscht“.
// Nachfrage: Wer einträgt, kann ein Häkchen setzen; nach 3 Tagen fragt die App den Verletzten per Push „Geht es dir gut?“
// (stündlich über umfrage-erinnerung.js → pruefeNachfragen). Bei „Beschwerden“ bekommen die Kommandanten einen Hinweis.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";
import { kvAendern } from "./person.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// TESTPHASE: Solange true, kann der Admin alle Einträge und das Protokoll ohne Vermerk löschen (nur Testdaten eintragen!).
// Zum Abschalten: diese Zeile auf false setzen (oder die Testphase-Teile entfernen) UND im Supabase-SQL
//   drop function if exists public.verbandbuch_testphase_leeren();
// ausführen (steht in der Anleitung des Updates, das die Testphase beendet).
export const TESTPHASE = true;

const AUFBEWAHRUNG_JAHRE = 5;
const NACHFRAGE_TAGE = 3;
const ARTEN = { erste_hilfe: "Erste Hilfe geleistet", vorfall: "Nur Vorfall (keine Behandlung)" };
const ANLAESSE = { uebung: "Übung", einsatz: "Einsatz", geraetehaus: "Gerätehaus / Arbeitsdienst", sonstiges: "Sonstiges" };
export const VERLETZUNGEN = ["Schürfwunde", "Schnittwunde", "Prellung", "Verstauchung", "Fremdkörper im Auge", "Verbrennung", "Stichverletzung", "Knochenbruch (Verdacht)", "Kreislaufbeschwerden", "Hitzeerschöpfung", "Sonstiges"];
export const MASSNAHMEN = ["Pflaster", "Verband", "Kühlen", "Wundreinigung", "Ruhigstellung", "Augenspülung", "Beobachtung", "Rettungsdienst gerufen", "Arzt / Krankenhaus"];
export const MATERIAL = ["Pflaster", "Wundschnellverband", "Mullbinde", "Verbandpäckchen", "Dreiecktuch", "Kältepack", "Desinfektionstuch", "Einmalhandschuhe", "Rettungsdecke", "Augenspülung"];
const URL_KACHEL = "/?kachel=verbandbuch";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const neueId = () => crypto.randomBytes(5).toString("hex");
const istId = (s) => /^[a-f0-9]{10}$/.test(String(s || ""));
const kurz = (v, n) => String(v ?? "").trim().slice(0, n);
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
const berlin = (d, opt) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", ...opt }).format(d);
const heuteBerlin = (d = new Date()) => berlin(d, { year: "numeric", month: "2-digit", day: "2-digit" });
const MS_TAG = 86400000;

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

async function ladeLage(token) {
  const [usersRes, roster, config, aktenRes] = await Promise.all([
    db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("config"),
    db.from("personalakten").select("name,funktionen:data->funktionen").then((r) => r, () => ({ data: [] })),
  ]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const meUser = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const liste = (roster || []).filter((r) => r && r.name);
  const gesperrt = new Set([...users.filter((u) => u.blocked).map((u) => u.name), ...liste.filter((r) => r.gesperrt).map((r) => r.name)]);
  const eintrag = (n) => liste.find((r) => r.name === n) || {};
  const admin = (n) => !!users.find((u) => u.name === n && u.is_admin);
  const kommando = (n) => !!(eintrag(n).kommandant || eintrag(n).stellvKommandant);
  const funktionen = {};
  ((aktenRes && aktenRes.data) || []).forEach((a) => { funktionen[a.name] = (a.funktionen || []).map((f) => (typeof f === "string" ? { name: f, status: "aktiv" } : f)).filter((f) => f && f.status !== "ad").map((f) => f.name); });
  const jugendleitung = (n) => !!(eintrag(n).jugendwart || (funktionen[n] || []).some((f) => f === "Jugendwart" || f === "Jugendleiter"));
  const nurJugend = (n) => { const b = eintrag(n).bereiche || []; return b.includes("jugendfeuerwehr") && !b.includes("einsatzabteilung"); };
  const aktiv = new Set(liste.filter((r) => !gesperrt.has(r.name)).map((r) => r.name));
  const ich = meUser && aktiv.has(meUser.name) ? meUser.name : null;
  return {
    ich, config: config || {}, aktiv, admin, kommando, jugendleitung, nurJugend,
    darfAlles: (n) => admin(n) || kommando(n),
    kommandoNamen: () => liste.filter((r) => r.kommandant || r.stellvKommandant).map((r) => r.name).filter((n) => aktiv.has(n)),
  };
}

// ---------- Rechte je Eintrag ----------
const darfLesen = (e, n, lage) => !!n && (lage.darfAlles(n) || e.person === n || (!!e.jugend && lage.jugendleitung(n)));
const darfAendern = (e, n, lage) => !!n && (lage.darfAlles(n) || (!!e.jugend && lage.jugendleitung(n)));
function letzteAktivitaet(e) {
  const zeiten = [e.erstelltAm, e.geaendertAm, ...(e.ergaenzungen || []).map((x) => x.ts), e.nachfrage && e.nachfrage.gefragtAm].filter(Boolean).map((t) => Date.parse(t)).filter(Number.isFinite);
  return zeiten.length ? Math.max(...zeiten) : 0;
}
const loeschenAb = (e) => { const d = new Date(letzteAktivitaet(e) || Date.now()); d.setFullYear(d.getFullYear() + AUFBEWAHRUNG_JAHRE); return d.toISOString(); };
function alsEintrag(row) { return { id: row.id, ...(row.data || {}), ergaenzungen: Array.isArray((row.data || {}).ergaenzungen) ? row.data.ergaenzungen : [] }; }

function tabellenFehler(e) {
  const t = String((e && e.message) || e || "");
  if (/relation|does not exist|schema cache|not find/i.test(t)) return fehler(500, "Die Tabellen für das Verbandbuch fehlen noch – bitte das SQL aus der Update-Anleitung ausführen.");
  return e;
}
async function eintragLaden(id) {
  if (!istId(id)) throw fehler(400, "Ungültiger Eintrag.");
  const { data, error } = await db.from("verbandbuch").select("id,data").eq("id", id).maybeSingle();
  if (error) throw tabellenFehler(error);
  if (!data) throw fehler(404, "Diesen Eintrag gibt es nicht (mehr).");
  return alsEintrag(data);
}
async function logSchreiben(eintragId, nr, von, aktion, details = null) {
  const ts = new Date().toISOString();
  const { error } = await db.from("verbandbuch_log").insert({ id: neueId(), eintrag: eintragId, ts, data: { nr, aktion, von, ts, details } });
  if (error) throw tabellenFehler(error);
}
async function push(an, title, text) {
  const liste = [...new Set((an || []).filter(Boolean))];
  if (!liste.length) return;
  try { await sendPush({ httpMethod: "POST", intern: true, body: JSON.stringify({ an: liste, title, text, sender: "", wichtig: false, url: URL_KACHEL }) }); } catch (e) { /* Push ist Zusatz */ }
}

// ---------- Eingaben säubern ----------
const auswahl = (liste, erlaubt, max = 20) => [...new Set((Array.isArray(liste) ? liste : []).map((x) => kurz(x, 60)).filter((x) => erlaubt.includes(x)))].slice(0, max);
function felder(x, ich) {
  const art = ARTEN[x.art] ? x.art : "";
  if (!art) throw fehler(400, "Bitte wählen: Erste Hilfe geleistet oder nur Vorfall.");
  const t = Date.parse(x.ts || "");
  if (!Number.isFinite(t)) throw fehler(400, "Bitte Datum und Uhrzeit angeben.");
  if (t > Date.now() + 15 * 60 * 1000) throw fehler(400, "Datum und Uhrzeit liegen in der Zukunft.");
  const anlass = ANLAESSE[x.anlass] ? x.anlass : "";
  if (!anlass) throw fehler(400, "Bitte den Anlass wählen (Übung, Einsatz, Gerätehaus oder Sonstiges).");
  const ort = kurz(x.ort, 150), hergang = kurz(x.hergang, 2000), zeugen = kurz(x.zeugen, 300);
  if (!ort) throw fehler(400, "Bitte den Ort angeben.");
  if (!hergang) throw fehler(400, "Bitte den Hergang beschreiben.");
  if (!zeugen) throw fehler(400, "Bitte Zeugen angeben – wenn es keine gab: „keine“.");
  const verletzungArten = auswahl(x.verletzungArten, VERLETZUNGEN), massnahmeArten = auswahl(x.massnahmeArten, MASSNAHMEN);
  const verletzung = kurz(x.verletzung, 1000), massnahme = kurz(x.massnahme, 1000);
  if (art === "erste_hilfe") {
    if (!verletzungArten.length && !verletzung) throw fehler(400, "Bitte Art und Umfang der Verletzung angeben.");
    if (!massnahmeArten.length && !massnahme) throw fehler(400, "Bitte die Erste-Hilfe-Maßnahme angeben.");
  }
  const material = [...new Set((Array.isArray(x.material) ? x.material : []).map((m) => kurz(m, 60)).filter(Boolean))].slice(0, 30);
  const ua = x.unfallanzeige && typeof x.unfallanzeige === "object" ? x.unfallanzeige : {};
  const v = x.verknuepfung && typeof x.verknuepfung === "object" && ["termin", "einsatz"].includes(x.verknuepfung.art) && kurz(x.verknuepfung.id, 60)
    ? { art: x.verknuepfung.art, id: kurz(x.verknuepfung.id, 60), titel: kurz(x.verknuepfung.titel, 120), datum: kurz(x.verknuepfung.datum, 10) } : null;
  return {
    art, ts: new Date(t).toISOString(), anlass, ort, hergang, zeugen, verletzungArten, verletzung, massnahmeArten, massnahme, material,
    ersthelfer: kurz(x.ersthelfer, 100) || ich,
    unfallanzeige: { erstattet: !!ua.erstattet, datum: ua.erstattet && istDatum(ua.datum) ? ua.datum : "" },
    verknuepfung: v,
  };
}
const FELD_NAMEN = { art: "Art", ts: "Datum/Uhrzeit", anlass: "Anlass", ort: "Ort", hergang: "Hergang", zeugen: "Zeugen", verletzungArten: "Verletzung (Auswahl)", verletzung: "Verletzung (Text)", massnahmeArten: "Maßnahme (Auswahl)", massnahme: "Maßnahme (Text)", material: "Material", ersthelfer: "Ersthelfer", unfallanzeige: "Unfallanzeige", verknuepfung: "Verknüpfung" };
const zeigeWert = (v) => (v === null || v === undefined || v === "" ? "–" : Array.isArray(v) ? (v.length ? v.join(", ") : "–") : typeof v === "object" ? (v.titel ? `${v.art}: ${v.titel}` : v.erstattet !== undefined ? (v.erstattet ? `ja${v.datum ? ` (${v.datum})` : ""}` : "nein") : JSON.stringify(v)) : String(v)).slice(0, 400);

// ---------- Zahlen für Kachel, Erinnerung ----------
// Offene Nachfragen an die verletzte Person (für die Zahl an der Kachel). Fehlen die Tabellen noch, ist das Ergebnis 0.
export async function offeneNachfragenZahl(name) {
  try {
    const { data, error } = await db.from("verbandbuch").select("id,data");
    if (error) return 0;
    return (data || []).map(alsEintrag).filter((e) => e.person === name && e.nachfrage && e.nachfrage.gefragt && !e.nachfrage.antwort).length;
  } catch (e) { return 0; }
}

// Stündlich (umfrage-erinnerung.js): 3 Tage nach dem Eintrag fragt die App die verletzte Person „Geht es dir gut?“ (nur tagsüber).
export async function pruefeNachfragen(jetzt = new Date()) {
  const config = (await getKv("config")) || {};
  if ((Array.isArray(config.kachelnAus) ? config.kachelnAus : []).includes("verbandbuch")) return { gefragt: 0 };
  const stunde = Number(berlin(jetzt, { hour: "2-digit", hour12: false }));
  if (stunde < 8 || stunde >= 20) return { gefragt: 0 };
  const { data, error } = await db.from("verbandbuch").select("id,data");
  if (error) return { gefragt: 0 };
  const faellig = (data || []).map(alsEintrag).filter((e) => e.nachfrage && e.nachfrage.aktiv && !e.nachfrage.gefragt && Date.parse(e.erstelltAm || "") + NACHFRAGE_TAGE * MS_TAG <= jetzt.getTime());
  let gefragt = 0;
  for (const e of faellig) {
    await push([e.person], "🩹 Geht es dir gut?", `Nachfrage zu deinem Eintrag im Verbandbuch (Nr. ${e.nr}). Bitte kurz antworten.`);
    const { id, ...daten } = e;
    const ts = jetzt.toISOString();
    await db.from("verbandbuch").update({ data: { ...daten, nachfrage: { ...e.nachfrage, gefragt: true, gefragtAm: ts } }, updated_at: ts }).eq("id", id);
    await logSchreiben(id, e.nr, "System", "nachfrage", "Nachfrage „Geht es dir gut?“ nach 3 Tagen gesendet");
    gefragt++;
  }
  return { gefragt };
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
    if ((Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : []).includes("verbandbuch")) return json(403, { error: "Die Kachel „Verbandbuch“ ist derzeit für die ganze Feuerwehr gesperrt." });
    const rechte = { alles: lage.darfAlles(ich), admin: lage.admin(ich), jugendleitung: lage.jugendleitung(ich) };

    // ---------------- Liste ----------------
    if (action === "list") {
      const { data: rows, error } = await db.from("verbandbuch").select("id,data");
      if (error) throw tabellenFehler(error);
      const eintraege = (rows || []).map(alsEintrag).filter((e) => darfLesen(e, ich, lage)).sort((a, b) => (a.ts < b.ts ? 1 : -1)).map((e) => ({
        ...e,
        rechte: { bearbeiten: darfAendern(e, ich, lage), ergaenzen: true, loeschen: rechte.alles && Date.now() >= Date.parse(loeschenAb(e)), protokoll: rechte.alles },
        loeschenAb: loeschenAb(e),
        nachfrageOffen: e.person === ich && !!e.nachfrage && !!e.nachfrage.gefragt && !e.nachfrage.antwort,
      }));
      // Wen darf ich eintragen? Mitglieder; Jugendliche nur Jugendwart/Jugendleiter/Admin.
      const eintragenJugend = lage.jugendleitung(ich) || lage.admin(ich);
      const personen = [...lage.aktiv].sort((a, b) => a.localeCompare(b, "de")).map((n) => ({ name: n, jugend: lage.nurJugend(n) })).filter((p) => !p.jugend || eintragenJugend);
      return json(200, { eintraege, rechte, testphase: TESTPHASE, personen, nachfrageTage: NACHFRAGE_TAGE, aufbewahrungJahre: AUFBEWAHRUNG_JAHRE });
    }

    // ---------------- Eintragen / Ändern ----------------
    if (action === "save") {
      const x = body.eintrag && typeof body.eintrag === "object" ? body.eintrag : {};
      const jetzt = new Date().toISOString();
      if (!x.id) {
        const person = kurz(x.person, 80);
        if (!person || !lage.aktiv.has(person)) throw fehler(400, "Bitte die verletzte Person aus der Mitgliederliste wählen (nur eigene Mitglieder).");
        const jugend = lage.nurJugend(person);
        if (jugend && !(lage.jugendleitung(ich) || lage.admin(ich))) throw fehler(403, "Für Jugendliche tragen nur Jugendwart und Jugendleiter ein.");
        const f = felder(x, ich);
        const zaehler = await kvAendern("verbandbuchNr", (m) => ({ zaehler: Number((m && m.zaehler) || 0) + 1 }), { zaehler: 0 });
        const nr = zaehler.zaehler;
        const id = neueId();
        const data = {
          ...f, nr, person, jugend, erstelltVon: ich, erstelltAm: jetzt, geaendertAm: jetzt, ergaenzungen: [],
          nachfrage: x.nachfrage ? { aktiv: true, gefragt: false, gefragtAm: "", antwort: null } : null,
          benachrichtigt: !!x.benachrichtigen,
        };
        const { error } = await db.from("verbandbuch").insert({ id, data, created_at: jetzt, updated_at: jetzt });
        if (error) throw tabellenFehler(error);
        await logSchreiben(id, nr, ich, "angelegt", `${ARTEN[f.art]} · Anlass: ${ANLAESSE[f.anlass]}${x.nachfrage ? " · Nachfrage nach 3 Tagen geplant" : ""}`);
        if (x.benachrichtigen) await push(lage.kommandoNamen().filter((n) => n !== ich), "🩹 Neuer Eintrag im Verbandbuch", `Nr. ${nr} (${ANLAESSE[f.anlass]}) – bitte in der Kachel „Verbandbuch“ ansehen.`);
        return json(200, { ok: true, id, nr });
      }
      const alt = await eintragLaden(String(x.id));
      if (!darfAendern(alt, ich, lage)) throw fehler(403, "Ändern dürfen nur Kommandant, stellv. Kommandant und Admins (Einträge von Jugendlichen auch Jugendwart und Jugendleiter).");
      const f = felder(x, ich);
      const aenderungen = Object.keys(FELD_NAMEN).filter((k) => JSON.stringify(alt[k] ?? null) !== JSON.stringify(f[k] ?? null)).map((k) => ({ feld: FELD_NAMEN[k], alt: zeigeWert(alt[k]), neu: zeigeWert(f[k]) }));
      let nachfrage = alt.nachfrage;
      if (!alt.nachfrage || !alt.nachfrage.gefragt) {
        const will = !!x.nachfrage;
        if (will !== !!(alt.nachfrage && alt.nachfrage.aktiv)) {
          nachfrage = will ? { aktiv: true, gefragt: false, gefragtAm: "", antwort: null } : null;
          aenderungen.push({ feld: "Nachfrage nach 3 Tagen", alt: alt.nachfrage && alt.nachfrage.aktiv ? "ja" : "nein", neu: will ? "ja" : "nein" });
        }
      }
      if (!aenderungen.length) return json(200, { ok: true, id: alt.id, nr: alt.nr, unveraendert: true });
      const { id, ...rest } = alt;
      const data = { ...rest, ...f, nachfrage, geaendertAm: jetzt };
      const { error } = await db.from("verbandbuch").update({ data, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      await logSchreiben(id, alt.nr, ich, "geaendert", aenderungen);
      return json(200, { ok: true, id, nr: alt.nr });
    }

    // ---------------- Ergänzung (eigene Zeile, der Text bleibt sichtbar) ----------------
    if (action === "ergaenzung") {
      const e = await eintragLaden(String(body.id || ""));
      if (!darfLesen(e, ich, lage)) throw fehler(403, "Diesen Eintrag darfst du nicht ergänzen.");
      const text = kurz(body.text, 2000);
      if (!text) throw fehler(400, "Bitte einen Text eingeben.");
      const jetzt = new Date().toISOString();
      const { id, ...rest } = e;
      const ergaenzungen = [...e.ergaenzungen, { id: neueId(), von: ich, ts: jetzt, art: "ergaenzung", text }];
      const { error } = await db.from("verbandbuch").update({ data: { ...rest, ergaenzungen, geaendertAm: jetzt }, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      await logSchreiben(id, e.nr, ich, "ergaenzt", text.slice(0, 400));
      return json(200, { ok: true });
    }

    // ---------------- Antwort auf „Geht es dir gut?“ (nur die verletzte Person) ----------------
    if (action === "nachfrageAntwort") {
      const e = await eintragLaden(String(body.id || ""));
      if (e.person !== ich) throw fehler(403, "Die Nachfrage beantwortet nur die verletzte Person.");
      if (!e.nachfrage || !e.nachfrage.gefragt) throw fehler(409, "Zu diesem Eintrag gibt es noch keine Nachfrage.");
      if (e.nachfrage.antwort) throw fehler(409, "Die Nachfrage ist schon beantwortet. Weitere Meldungen bitte als Ergänzung schreiben.");
      const ergebnis = body.ergebnis === "gut" ? "gut" : body.ergebnis === "beschwerden" ? "beschwerden" : "";
      if (!ergebnis) throw fehler(400, "Bitte „Alles gut“ oder „Beschwerden“ wählen.");
      const text = kurz(body.text, 1000);
      if (ergebnis === "beschwerden" && !text) throw fehler(400, "Bitte kurz beschreiben, welche Beschwerden du hast.");
      const jetzt = new Date().toISOString();
      const { id, ...rest } = e;
      const satz = ergebnis === "gut" ? `Rückmeldung nach ${NACHFRAGE_TAGE} Tagen: Alles gut.${text ? ` ${text}` : ""}` : `Rückmeldung nach ${NACHFRAGE_TAGE} Tagen: Beschwerden – ${text}`;
      const ergaenzungen = [...e.ergaenzungen, { id: neueId(), von: ich, ts: jetzt, art: "rueckmeldung", text: satz }];
      const { error } = await db.from("verbandbuch").update({ data: { ...rest, ergaenzungen, nachfrage: { ...e.nachfrage, antwort: { ergebnis, am: jetzt } }, geaendertAm: jetzt }, updated_at: jetzt }).eq("id", id);
      if (error) throw tabellenFehler(error);
      await logSchreiben(id, e.nr, ich, "antwort", satz.slice(0, 400));
      if (ergebnis === "beschwerden") await push(lage.kommandoNamen().filter((n) => n !== ich), "🩹 Rückmeldung im Verbandbuch", `Zu Eintrag Nr. ${e.nr} wurden Beschwerden gemeldet – bitte in der Kachel „Verbandbuch“ ansehen.`);
      return json(200, { ok: true });
    }

    // ---------------- Protokoll (nur Kommandant, stellv. Kommandant, Admins) ----------------
    if (action === "protokoll") {
      if (!rechte.alles) throw fehler(403, "Das Protokoll sehen nur Kommandant, stellv. Kommandant und Admins.");
      const id = String(body.id || "");
      if (!istId(id)) throw fehler(400, "Ungültiger Eintrag.");
      const { data, error } = await db.from("verbandbuch_log").select("id,eintrag,ts,data").eq("eintrag", id);
      if (error) throw tabellenFehler(error);
      const eintraege = (data || []).map((r) => ({ id: r.id, ...(r.data || {}), ts: (r.data || {}).ts || r.ts })).sort((a, b) => (a.ts < b.ts ? -1 : 1));
      return json(200, { protokoll: eintraege });
    }

    // ---------------- Löschen (erst 5 Jahre nach der letzten Eintragung) ----------------
    if (action === "loeschen") {
      if (!rechte.alles) throw fehler(403, "Löschen dürfen nur Kommandant, stellv. Kommandant und Admins.");
      const e = await eintragLaden(String(body.id || ""));
      if (Date.now() < Date.parse(loeschenAb(e))) throw fehler(403, `Einträge müssen ${AUFBEWAHRUNG_JAHRE} Jahre nach der letzten Eintragung aufbewahrt werden – löschbar ab ${loeschenAb(e).slice(0, 10).split("-").reverse().join(".")}.`);
      await logSchreiben(e.id, e.nr, ich, "geloescht", "Eintrag nach Ablauf der Aufbewahrungsfrist gelöscht (Inhalt nicht mehr vorhanden)");
      const { error } = await db.from("verbandbuch").delete().eq("id", e.id);
      if (error) throw tabellenFehler(error);
      return json(200, { ok: true });
    }

    // ---------------- Auswertung ohne Namen (Kommandant, stellv. Kommandant, Admins) ----------------
    if (action === "auswertung") {
      if (!rechte.alles) throw fehler(403, "Die Auswertung sehen nur Kommandant, stellv. Kommandant und Admins.");
      const jahr = /^\d{4}$/.test(String(body.jahr || "")) ? String(body.jahr) : heuteBerlin().slice(0, 4);
      const { data, error } = await db.from("verbandbuch").select("id,data");
      if (error) throw tabellenFehler(error);
      const alle = (data || []).map(alsEintrag);
      const jahre = [...new Set(alle.map((e) => berlin(new Date(e.ts), { year: "numeric" })))].sort().reverse();
      const im = alle.filter((e) => berlin(new Date(e.ts), { year: "numeric" }) === jahr);
      const zaehle = (liste) => liste.reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {});
      const monate = Array.from({ length: 12 }, () => 0);
      im.forEach((e) => { monate[Number(berlin(new Date(e.ts), { month: "2-digit" })) - 1]++; });
      return json(200, {
        jahr, jahre, gesamt: im.length,
        arten: { erste_hilfe: im.filter((e) => e.art === "erste_hilfe").length, vorfall: im.filter((e) => e.art === "vorfall").length },
        anlaesse: zaehle(im.map((e) => e.anlass)), jugend: im.filter((e) => e.jugend).length,
        unfallanzeigen: im.filter((e) => e.unfallanzeige && e.unfallanzeige.erstattet).length,
        beschwerden: im.filter((e) => e.nachfrage && e.nachfrage.antwort && e.nachfrage.antwort.ergebnis === "beschwerden").length,
        verletzungen: zaehle(im.flatMap((e) => e.verletzungArten || [])), monate,
      });
    }

    // ---------------- Testphase: alles löschen (nur Admin, nur solange TESTPHASE) ----------------
    if (action === "testphaseLeeren") {
      if (!TESTPHASE) throw fehler(403, "Die Testphase ist beendet.");
      if (!lage.admin(ich)) throw fehler(403, "Das dürfen nur Admins.");
      if (body.bestaetigt !== true) throw fehler(400, "Bitte die Rückfrage bestätigen.");
      const { error } = await db.rpc("verbandbuch_testphase_leeren");
      if (error) {
        const t = String(error.message || error);
        if (/function|schema cache|not find|does not exist/i.test(t)) throw fehler(500, "Die Testphasen-Funktion fehlt noch in der Datenbank – bitte das SQL aus der Update-Anleitung ausführen.");
        throw error;
      }
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
