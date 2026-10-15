// netlify/functions/kalender.js
// Termine der App in den Handy-Kalender (iPhone, Google, Outlook):
//  - GET ?abo=<Schlüssel>                 → Kalender-Abo (ICS) mit allen Terminen der eigenen Bereiche (ändert sich automatisch mit)
//  - GET ?abo=<Schlüssel>&termin=<id>     → ein einzelner Termin als ICS („Zum Kalender hinzufügen“)
//  - POST { token, action: "abo" }        → persönlichen Abo-Link holen
//  - POST { token, action: "neu" }        → neuen Link erstellen (der alte wird ungültig)
//  - POST { token, action: "sperren", name } → (nur Admin) Link eines Kameraden ungültig machen
// Der Schlüssel ist geheim: Name + Prüfsumme (HMAC mit dem Server-Schlüssel) + Version. Eine höhere Version
// (kv_store „kalenderAbos“: { name: version }, eigener Schlüssel, damit die App ihn nie überschreibt) macht alte Links ungültig. Im Abo stehen nur Titel, Datum, Uhrzeit, Ort und Bemerkung –
// keine Namen von Zu- oder Absagen.
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEHEIM = process.env.KALENDER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "kalender";
const BEREICHE = ["einsatzabteilung", "jugendfeuerwehr", "wettkampfgruppe", "altersabteilung", "atemschutz", "fuehrungskraefte"];
const BEREICH_NAME = { einsatzabteilung: "Einsatzabteilung", jugendfeuerwehr: "Jugendfeuerwehr", wettkampfgruppe: "Wettkampfgruppe", altersabteilung: "Altersabteilung", atemschutz: "Atemschutz", fuehrungskraefte: "Führungskräfte" };
const KATEGORIE = { uebung: "Übung", brandwache: "Brandwache", einsatz: "Arbeitseinsatz", sonstiges: "Kameradschaft" };
const KALENDERNAME = "Feuerwehr Regglisweiler";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const text = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "text/plain; charset=utf-8" }, body });

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
async function setKv(key, value) {
  const { error } = await db.from("kv_store").upsert({ key, value });
  if (error) throw error;
}

// ---------------- Schlüssel ----------------
const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s) => { try { return Buffer.from(String(s), "base64url").toString("utf8"); } catch (e) { return ""; } };
const pruef = (name, version) => crypto.createHmac("sha256", GEHEIM).update(`kalender|${name}|${version}`).digest("base64url").slice(0, 22);
export const aboSchluessel = (name, version = 0) => `${b64(name)}.${version}.${pruef(name, version)}`;
function schluesselLesen(s, versionen) {
  const teile = String(s || "").split(".");
  if (teile.length !== 3) return null;
  const name = unb64(teile[0]); const version = Number(teile[1]);
  if (!name || !Number.isInteger(version) || version < 0) return null;
  const a = Buffer.from(teile[2]); const b = Buffer.from(pruef(name, version));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (version !== Number((versionen || {})[name] || 0)) return null; // alter Link
  return name;
}

// ---------------- ICS ----------------
const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Zeilen nach 75 Bytes umbrechen (RFC 5545)
function falten(zeile) {
  const buf = Buffer.from(zeile, "utf8");
  if (buf.length <= 75) return zeile;
  const teile = []; let rest = zeile;
  while (Buffer.byteLength(rest, "utf8") > (teile.length ? 74 : 75)) {
    let n = 75; while (Buffer.byteLength(rest.slice(0, n), "utf8") > (teile.length ? 74 : 75)) n--;
    teile.push(rest.slice(0, n)); rest = rest.slice(n);
  }
  teile.push(rest);
  return teile.join("\r\n ");
}
const stempel = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];
function vevent(ev, jetzt) {
  const datum = String(ev.date || "").replace(/-/g, "");
  const zeit = /^\d{2}:\d{2}$/.test(ev.time || "") ? ev.time : "";
  const z = ["BEGIN:VEVENT", `UID:${ev.id}@feuerwehr-regglisweiler`, `DTSTAMP:${stempel(jetzt)}`];
  if (zeit) {
    const [h, m] = zeit.split(":").map(Number);
    const ende = h * 60 + m + 120; // Dauer 2 Stunden (die App kennt keine Endzeit)
    const eh = Math.min(23, Math.floor(ende / 60)), em = ende >= 24 * 60 ? 59 : ende % 60;
    z.push(`DTSTART;TZID=Europe/Berlin:${datum}T${zeit.replace(":", "")}00`, `DTEND;TZID=Europe/Berlin:${datum}T${String(eh).padStart(2, "0")}${String(em).padStart(2, "0")}00`);
  } else {
    const d = new Date(`${ev.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
    z.push(`DTSTART;VALUE=DATE:${datum}`, `DTEND;VALUE=DATE:${d.toISOString().slice(0, 10).replace(/-/g, "")}`);
  }
  z.push(`SUMMARY:${esc(ev.title || "Termin")}`);
  if (ev.location) z.push(`LOCATION:${esc(ev.location)}`);
  const beschreibung = [[KATEGORIE[ev.category] || "", BEREICH_NAME[ev.bereich] || ""].filter(Boolean).join(" · "), ev.notes || "", "Zu- und Absagen bitte in der Feuerwehr-App."].filter(Boolean).join("\n");
  z.push(`DESCRIPTION:${esc(beschreibung)}`, `CATEGORIES:${esc(KATEGORIE[ev.category] || "Termin")}`, "END:VEVENT");
  return z;
}
export function icsDatei(termine, { name = KALENDERNAME, abo = true } = {}, jetzt = new Date()) {
  const z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Feuerwehr Regglisweiler//App//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (abo) z.push(`X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H");
  z.push(...VTIMEZONE);
  termine.forEach((ev) => z.push(...vevent(ev, jetzt)));
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}

// ---------------- Wer darf was sehen ----------------
async function lage() {
  const [usersRes, roster, versionen] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("kalenderAbos")]);
  if (usersRes.error) throw usersRes.error;
  return { users: usersRes.data || [], roster: roster || [], versionen: versionen || {} };
}
function bereicheVon(l, name) {
  const u = l.users.find((x) => x.name === name);
  const r = l.roster.find((x) => x && x.name === name);
  if (!u || u.blocked || !r || r.gesperrt) return null; // gesperrte bekommen nichts
  const eigene = (r.bereiche || []).filter((b) => BEREICHE.includes(b));
  if (u.is_admin && !eigene.length) return BEREICHE;
  return eigene;
}

export async function handler(event) {
  try {
    // ---------- Abruf durch den Kalender (GET) ----------
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const l = await lage();
      const name = schluesselLesen(q.abo, l.versionen);
      if (!name) return text(404, "Dieser Kalender-Link ist ungültig oder wurde erneuert. Bitte in der Feuerwehr-App einen neuen Link holen.");
      const bereiche = bereicheVon(l, name);
      if (!bereiche) return text(403, "Kein Zugriff mehr.");
      const events = ((await getKv("events")) || []).filter((e) => e && e.date && bereiche.includes(e.bereich));
      const kopf = { "Cache-Control": "no-cache, max-age=0" };
      if (q.termin) {
        const ev = events.find((e) => e.id === String(q.termin));
        if (!ev) return text(404, "Diesen Termin gibt es nicht (mehr).");
        return { statusCode: 200, headers: { ...kopf, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="termin.ics"` }, body: icsDatei([ev], { abo: false }) };
      }
      // Abo: ab 60 Tagen zurück, alle künftigen
      const ab = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const liste = events.filter((e) => e.date >= ab).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
      return { statusCode: 200, headers: { ...kopf, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="feuerwehr.ics"` }, body: icsDatei(liste) };
    }

    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }
    const l = await lage();
    const me = body.token ? l.users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(body.token)) : null;
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });
    if (!bereicheVon(l, me.name)) return json(403, { error: "Kein Zugriff." });
    const host = (event.headers && (event.headers["x-forwarded-host"] || event.headers.host)) || "";
    const versionen = { ...l.versionen };
    const link = (name) => {
      const s = aboSchluessel(name, Number(versionen[name] || 0));
      const pfad = `${host}/.netlify/functions/kalender?abo=${encodeURIComponent(s)}`;
      return { schluessel: s, webcal: `webcal://${pfad}`, https: `https://${pfad}` };
    };
    const neueVersion = async (name) => {
      const aktuell = (await getKv("kalenderAbos")) || {};
      versionen[name] = Number(aktuell[name] || 0) + 1;
      await setKv("kalenderAbos", { ...aktuell, [name]: versionen[name] });
    };
    if (body.action === "abo") return json(200, { ok: true, ...link(me.name) });
    if (body.action === "neu") { await neueVersion(me.name); return json(200, { ok: true, ...link(me.name) }); }
    if (body.action === "sperren") {
      if (!me.is_admin) return json(403, { error: "Nur für Admins." });
      const name = String(body.name || "");
      if (!l.roster.some((r) => r && r.name === name)) return json(400, { error: "Unbekanntes Mitglied." });
      await neueVersion(name);
      return json(200, { ok: true });
    }
    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
