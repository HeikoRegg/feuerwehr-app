// netlify/functions/advent.js
// Adventskalender mit Quiz (seit 2.40).
//  - Inhalte der 24 Türchen (Spruch, Quizfrage, Foto, Spielregeln) -> kv_store "advent" (pflegt nur der Admin)
//  - Spielstände (geöffnet, Frage gestartet, Antwort, Punkte)      -> kv_store "adventSpiel"
//  - Fotos                                                         -> privater Speicher "projekte", Ordner advent/
//  - Fragenpool und Sprüche                                        -> adventFragen.js (bleibt auf dem Server)
//
// Regeln:
//  - Türchen 1–24 öffnen sich am jeweiligen Dezembertag (deutsche Zeit); frühere Türchen bleiben offen.
//  - Die Frage kommt erst mit „Frage starten“ aufs Handy (ohne Lösung). Der Server merkt sich die Startzeit und prüft
//    beim Antworten das Zeitlimit (leicht 40 s, mittel 60 s, anspruchsvoll 80 s, dazu 5 s Puffer fürs Netz).
//    Jede Frage nur einmal; abgelaufen = keine Punkte.
//  - Punkte (1/2/3) nur, wenn die Frage am Tag des Türchens gestartet wurde; später beantwortet = ohne Punkte.
//  - Zwei Ranglisten: Einsatzabteilung und Jugendfeuerwehr (nur Jugend). Admins kennen die Lösungen und laufen
//    außer Wertung. Gewinner ab dem 25. Dezember (Punktgleichheit = mehrere). Der Admin kann die Rangliste löschen.
//  - Einmalige Ankündigung per Push am 30. November ab 18 Uhr (pruefeAdventAnkuendigung, stündliche Funktion).
//    Keine weiteren Pushs.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";
import { kvAendern } from "./person.js";
import { FRAGEN, SPRUECHE, STUFEN, REGELN_STANDARD } from "./adventFragen.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "projekte";
const PUFFER_SEK = 5;
const ADVENT_URL = "/?kachel=advent";

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };
const kurz = (v, n) => String(v ?? "").trim().slice(0, n);
const neueId = () => crypto.randomBytes(5).toString("hex");

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

// Nur für Tests: feste Uhrzeit über die Umgebung (im Betrieb nie gesetzt).
const jetztDatum = () => (process.env.ADVENT_TEST_JETZT ? new Date(process.env.ADVENT_TEST_JETZT) : new Date());

// Datum und Stunde in deutscher Zeit
export function berlin(d) {
  const t = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { jahr: Number(t.year), monat: Number(t.month), tag: Number(t.day), stunde: Number(t.hour), iso: `${t.year}-${t.month}-${t.day}` };
}
// Welches Adventsjahr gilt, welcher Dezembertag ist heute (0 = noch nicht Dezember, 32 = danach)?
export function adventLage(d = jetztDatum()) {
  const b = berlin(d);
  if (b.monat === 1) return { jahr: b.jahr - 1, heute: 32, b };
  if (b.monat === 12) return { jahr: b.jahr, heute: b.tag, b };
  return { jahr: b.jahr, heute: 0, b };
}
const tagIso = (jahr, tag) => `${jahr}-12-${String(tag).padStart(2, "0")}`;

// ---------- Plan der 24 Türchen ----------
function zufall(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mischen(liste, rnd) { const l = [...liste]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; }
function fragenMap(cfg) {
  const m = Object.fromEntries(FRAGEN.map((q) => [q.id, q]));
  for (const q of (cfg && Array.isArray(cfg.eigeneFragen) ? cfg.eigeneFragen : [])) if (q && q.id) m[q.id] = q;
  return m;
}
// 16 Feuerwehr-Fragen (5 leicht, 6 mittel, 5 anspruchsvoll) und 8 weihnachtliche (3/3/2) – möglichst keine vom Vorjahr.
export function auslosen(jahr, ausschluss = [], cfg = null, seed = null) {
  const rnd = zufall(seed ?? jahr * 7919);
  const pool = Object.values(fragenMap(cfg)).filter((q) => !q.geloescht);
  const aus = new Set(ausschluss);
  const ziehen = (kat, stufe, n) => {
    const passend = mischen(pool.filter((q) => q.kat === kat && q.stufe === stufe), rnd);
    return [...passend.filter((q) => !aus.has(q.id)), ...passend.filter((q) => aus.has(q.id))].slice(0, n);
  };
  const feuerwehr = [...ziehen("feuerwehr", "leicht", 5), ...ziehen("feuerwehr", "mittel", 6), ...ziehen("feuerwehr", "schwer", 5)];
  const weihnachten = [...ziehen("weihnachten", "leicht", 3), ...ziehen("weihnachten", "mittel", 3), ...ziehen("weihnachten", "schwer", 2)];
  let alle = mischen([...feuerwehr, ...weihnachten], rnd);
  // Heiligabend bekommt eine weihnachtliche Frage
  const iw = alle.findIndex((q) => q.kat === "weihnachten");
  if (iw >= 0 && alle.length >= 24 && alle[23].kat !== "weihnachten") [alle[iw], alle[23]] = [alle[23], alle[iw]];
  // Sprüche: 23. und 24. Dezember fest, die übrigen wechseln von Jahr zu Jahr
  const rest = SPRUECHE.filter((_, i) => i !== 22 && i !== 23);
  const versatz = (((jahr - 2026) * 22) % rest.length + rest.length) % rest.length;
  const tueren = {};
  for (let t = 1; t <= 24; t++) {
    const q = alle[t - 1];
    const spruch = t === 23 ? SPRUECHE[22] : t === 24 ? SPRUECHE[23] : rest[(versatz + t - 1) % rest.length];
    tueren[t] = { spruch, frageId: q ? q.id : null, fotoPath: "", fotoText: "" };
  }
  return tueren;
}
function vorjahrIds(cfg, jahr) {
  const b = cfg && cfg.benutzt && typeof cfg.benutzt === "object" ? cfg.benutzt : {};
  const ids = Array.isArray(b[jahr - 1]) ? b[jahr - 1] : [];
  if (cfg && cfg.jahr === jahr - 1 && cfg.tueren) Object.values(cfg.tueren).forEach((t) => t && t.frageId && ids.push(t.frageId));
  return ids;
}
export function planFuer(cfg, jahr) {
  if (cfg && cfg.jahr === jahr && cfg.tueren && typeof cfg.tueren === "object") return cfg.tueren;
  return auslosen(jahr, vorjahrIds(cfg, jahr), cfg);
}
const regelnVon = (cfg) => (cfg && typeof cfg.regeln === "string" && cfg.regeln.trim() ? cfg.regeln : REGELN_STANDARD);

// ---------- Mitglieder ----------
async function ladeLage(token) {
  const [usersRes, roster, config] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster"), getKv("config")]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const me = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const liste = (roster || []).filter((r) => r && r.name);
  const admins = new Set(users.filter((u) => u.is_admin && !u.blocked).map((u) => u.name));
  const gesperrt = new Set(users.filter((u) => u.blocked).map((u) => u.name));
  const gruppe = (n) => { const e = liste.find((r) => r.name === n) || {}; const b = e.bereiche || []; return b.includes("jugendfeuerwehr") && !b.includes("einsatzabteilung") ? "jf" : "ea"; };
  return { me, admin: !!(me && me.is_admin), config: config || {}, liste, admins, gesperrt, gruppe };
}

// ---------- Spielstand ----------
const leerSpiel = (jahr) => ({ jahr, spieler: {} });
const spielVon = (s, jahr) => (s && s.jahr === jahr && s.spieler && typeof s.spieler === "object" ? s : leerSpiel(jahr));
function abgelaufen(e, q, jetzt) {
  if (!e || !e.gestartet || e.antwort !== undefined && e.antwort !== null) return false;
  const sek = (STUFEN[q.stufe] || STUFEN.leicht).sekunden;
  return jetzt - Date.parse(e.gestartet) > (sek + PUFFER_SEK) * 1000;
}

function ranglisten(spiel, lage) {
  const zeilen = Object.entries(spiel.spieler || {}).map(([name, tage]) => {
    const werte = Object.values(tage || {});
    return { name, punkte: werte.reduce((s, e) => s + (Number(e.punkte) || 0), 0), richtig: werte.filter((e) => e.richtig).length, beantwortet: werte.filter((e) => e.gestartet).length };
  }).filter((z) => z.beantwortet > 0 && !lage.gesperrt.has(z.name) && lage.liste.some((r) => r.name === z.name));
  const sortiere = (l) => {
    const s = [...l].sort((a, b) => b.punkte - a.punkte || b.richtig - a.richtig || a.name.localeCompare(b.name, "de"));
    let platz = 0, vorher = null;
    return s.map((z, i) => { if (!vorher || vorher.punkte !== z.punkte) platz = i + 1; vorher = z; return { ...z, platz }; });
  };
  const gewertet = zeilen.filter((z) => !lage.admins.has(z.name));
  return {
    ea: sortiere(gewertet.filter((z) => lage.gruppe(z.name) === "ea")),
    jf: sortiere(gewertet.filter((z) => lage.gruppe(z.name) === "jf")),
    ausserWertung: sortiere(zeilen.filter((z) => lage.admins.has(z.name))),
  };
}
const gewinnerVon = (liste) => { const top = liste.length && liste[0].punkte > 0 ? liste[0].punkte : null; return top === null ? [] : liste.filter((z) => z.punkte === top).map((z) => z.name); };

async function fotoLink(pfad) {
  if (!pfad) return "";
  try { const { data } = await db.storage.from(BUCKET).createSignedUrl(pfad, 3600); return data ? data.signedUrl : ""; } catch (e) { return ""; }
}

// Antworten erscheinen in gemischter, aber fester Reihenfolge je Frage (damit nicht immer „B“ stimmt).
function reihenfolge(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return mischen([0, 1, 2], zufall(h));
}
const gemischt = (q) => reihenfolge(q.id).map((i) => q.antworten[i]);
const anzeigeIndex = (q, original) => (original === null || original === undefined ? null : reihenfolge(q.id).indexOf(original));

// Quizteil eines Türchens für eine Person – ohne Lösung, solange nicht beantwortet.
function quizSicht(q, e, jahr, tag, jetzt) {
  if (!q) return null;
  const st = STUFEN[q.stufe] || STUFEN.leicht;
  const basis = { stufe: q.stufe, stufeName: st.name, sekunden: st.sekunden, punkte: st.punkte, kat: q.kat };
  if (!e || !e.gestartet) return { ...basis, zustand: "neu", mitPunkten: berlin(new Date(jetzt)).iso === tagIso(jahr, tag) };
  const fertig = e.antwort !== undefined && e.antwort !== null || e.abgelaufen || abgelaufen(e, q, jetzt);
  if (!fertig) {
    const rest = Math.max(0, Math.ceil(st.sekunden - (jetzt - Date.parse(e.gestartet)) / 1000));
    return { ...basis, zustand: "laeuft", rest, frage: q.frage, antworten: gemischt(q), mitPunkten: !!e.zaehlt };
  }
  return { ...basis, zustand: "fertig", frage: q.frage, antworten: gemischt(q), meine: anzeigeIndex(q, e.antwort), loesung: anzeigeIndex(q, q.richtig), info: q.info || "",
    richtig: !!e.richtig, punkteBekommen: Number(e.punkte) || 0, zuSpaet: e.antwort === undefined || e.antwort === null, mitPunkten: !!e.zaehlt };
}

// ---------- Einmalige Push-Ankündigung (stündliche Funktion) ----------
export async function pruefeAdventAnkuendigung(jetzt = new Date()) {
  const b = berlin(jetzt);
  if (!(b.monat === 11 && b.tag === 30 && b.stunde >= 18)) return { gesendet: false };
  const [merker, config, roster, usersRes] = await Promise.all([getKv("adventPush"), getKv("config"), getKv("roster"), db.from("app_users").select("name,blocked")]);
  if (merker && merker.jahr === b.jahr) return { gesendet: false, schon: true };
  const aus = Array.isArray((config || {}).kachelnAus) ? config.kachelnAus : [];
  await db.from("kv_store").upsert({ key: "adventPush", value: { jahr: b.jahr, am: jetzt.toISOString() }, updated_at: jetzt.toISOString() });
  if (aus.includes("advent")) return { gesendet: false, kachelAus: true };
  const gesperrt = new Set(((usersRes && usersRes.data) || []).filter((u) => u.blocked).map((u) => u.name));
  const an = (roster || []).map((r) => r && r.name).filter((n) => n && !gesperrt.has(n));
  if (!an.length) return { gesendet: false };
  try {
    await sendPush({ httpMethod: "POST", intern: true, body: JSON.stringify({ an, title: "🎄 Morgen startet der Adventskalender",
      text: "Ab 1. Dezember jeden Tag ein Türchen mit Spruch und Quizfrage. Zeit läuft erst nach „Frage starten“, Punkte gibt’s am jeweiligen Tag. Viel Spaß!", sender: "", url: ADVENT_URL }) });
  } catch (e) { /* Push ist Zusatz */ }
  return { gesendet: true, an: an.length };
}

// ---------- Anfragen aus der App ----------
export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }
  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    const ich = lage.me.name;
    const aus = Array.isArray(lage.config.kachelnAus) ? lage.config.kachelnAus : [];
    if (aus.includes("advent") && !lage.admin) return json(403, { error: "Der Adventskalender ist derzeit ausgeschaltet." });
    const { action } = body;
    const jetztD = jetztDatum();
    const jetzt = jetztD.getTime();
    const { jahr, heute } = adventLage(jetztD);
    const cfg = await getKv("advent");
    const plan = planFuer(cfg, jahr);
    const fm = fragenMap(cfg);
    const nurAdmin = () => { if (!lage.admin) throw fehler(403, "Den Adventskalender pflegt nur der Admin."); };
    const darfTuer = (t) => Number.isInteger(t) && t >= 1 && t <= 24 && (t <= heute || lage.admin);
    const tagNr = () => { const t = Number(body.tag); if (!darfTuer(t)) throw fehler(403, "Dieses Türchen ist noch zu."); return t; };

    // Kleiner Stand für die Kopfzeile: Dezember? Heutiges Türchen schon offen?
    if (action === "status") {
      const spiel = spielVon(await getKv("adventSpiel"), jahr);
      const e = heute >= 1 && heute <= 24 ? ((spiel.spieler[ich] || {})[heute] || null) : null;
      return json(200, { jahr, heute, aktiv: heute >= 1 && heute <= 31, offenHeute: heute >= 1 && heute <= 24 && !(e && e.geoeffnet) });
    }

    if (action === "kalender") {
      const spiel = spielVon(await getKv("adventSpiel"), jahr);
      const meine = spiel.spieler[ich] || {};
      const tage = [];
      for (let t = 1; t <= 24; t++) {
        const tu = plan[t] || {};
        const q = tu.frageId ? fm[tu.frageId] : null;
        const e = meine[t] || null;
        tage.push({ tag: t, offen: t <= heute, geoeffnet: !!(e && e.geoeffnet), hatQuiz: !!q, hatFoto: !!tu.fotoPath,
          beantwortet: !!(e && e.gestartet && (e.antwort !== undefined && e.antwort !== null || e.abgelaufen || (q && abgelaufen(e, q, jetzt)))),
          richtig: !!(e && e.richtig), punkte: e ? Number(e.punkte) || 0 : 0 });
      }
      const rl = ranglisten(spiel, lage);
      const vorbei = heute >= 25;
      return json(200, { jahr, heute, admin: lage.admin, gruppe: lage.gruppe(ich), regeln: regelnVon(cfg), tage, ranglisten: rl,
        gewinner: vorbei ? { ea: gewinnerVon(rl.ea), jf: gewinnerVon(rl.jf) } : null,
        meinePunkte: Object.values(meine).reduce((s, e) => s + (Number(e.punkte) || 0), 0) });
    }

    if (action === "tuer") {
      const t = tagNr();
      const tu = plan[t] || {};
      const q = tu.frageId ? fm[tu.frageId] : null;
      let e = null;
      if (t <= heute) {
        const spiel = await kvAendern("adventSpiel", (s) => {
          const sp = spielVon(s, jahr);
          const m = (sp.spieler[ich] = sp.spieler[ich] || {});
          const x = (m[t] = m[t] || {});
          if (!x.geoeffnet) x.geoeffnet = new Date(jetzt).toISOString();
          if (q && abgelaufen(x, q, jetzt)) { x.abgelaufen = true; x.punkte = 0; x.richtig = false; }
          return sp;
        }, leerSpiel(jahr));
        e = (spiel.spieler[ich] || {})[t] || null;
      }
      return json(200, { tag: t, spruch: tu.spruch || "", fotoText: tu.fotoText || "", foto: await fotoLink(tu.fotoPath), quiz: quizSicht(q, e, jahr, t, jetzt), vorschau: t > heute });
    }

    if (action === "starten") {
      const t = tagNr();
      if (t > heute) throw fehler(403, "Dieses Türchen ist noch zu.");
      const tu = plan[t] || {};
      const q = tu.frageId ? fm[tu.frageId] : null;
      if (!q) throw fehler(400, "Hinter diesem Türchen ist keine Quizfrage.");
      const spiel = await kvAendern("adventSpiel", (s) => {
        const sp = spielVon(s, jahr);
        const m = (sp.spieler[ich] = sp.spieler[ich] || {});
        const x = (m[t] = m[t] || {});
        if (!x.geoeffnet) x.geoeffnet = new Date(jetzt).toISOString();
        if (!x.gestartet) { x.gestartet = new Date(jetzt).toISOString(); x.frageId = q.id; x.zaehlt = berlin(new Date(jetzt)).iso === tagIso(jahr, t); }
        else if (abgelaufen(x, q, jetzt)) { x.abgelaufen = true; x.punkte = 0; x.richtig = false; }
        return sp;
      }, leerSpiel(jahr));
      return json(200, { quiz: quizSicht(q, spiel.spieler[ich][t], jahr, t, jetzt) });
    }

    if (action === "antworten") {
      const t = tagNr();
      const tu = plan[t] || {};
      const q = tu.frageId ? fm[tu.frageId] : null;
      if (!q) throw fehler(400, "Hinter diesem Türchen ist keine Quizfrage.");
      const angezeigt = Number(body.antwort);
      if (!Number.isInteger(angezeigt) || angezeigt < 0 || angezeigt >= q.antworten.length) throw fehler(400, "Bitte eine Antwort wählen.");
      const wahl = reihenfolge(q.id)[angezeigt]; // zurück in die Original-Reihenfolge
      const spiel = await kvAendern("adventSpiel", (s) => {
        const sp = spielVon(s, jahr);
        const m = (sp.spieler[ich] = sp.spieler[ich] || {});
        const x = (m[t] = m[t] || {});
        if (!x.gestartet) throw fehler(400, "Bitte zuerst „Frage starten“ tippen.");
        if (x.antwort !== undefined && x.antwort !== null || x.abgelaufen) return sp; // schon fertig
        if (abgelaufen(x, q, jetzt)) { x.abgelaufen = true; x.punkte = 0; x.richtig = false; return sp; }
        x.antwort = wahl; x.beantwortet = new Date(jetzt).toISOString();
        x.richtig = wahl === q.richtig;
        x.punkte = x.richtig && x.zaehlt ? (STUFEN[q.stufe] || STUFEN.leicht).punkte : 0;
        return sp;
      }, leerSpiel(jahr));
      return json(200, { quiz: quizSicht(q, spiel.spieler[ich][t], jahr, t, jetzt) });
    }

    // ---------- Admin ----------
    if (action === "adminGet") {
      nurAdmin();
      const tueren = {};
      for (let t = 1; t <= 24; t++) { const tu = plan[t] || {}; tueren[t] = { spruch: tu.spruch || "", frageId: tu.frageId || null, fotoPath: tu.fotoPath || "", fotoText: tu.fotoText || "", foto: await fotoLink(tu.fotoPath) }; }
      const benutzt = new Set(vorjahrIds(cfg, jahr));
      return json(200, { jahr, heute, tueren, regeln: regelnVon(cfg), regelnStandard: REGELN_STANDARD, gespeichert: !!(cfg && cfg.jahr === jahr),
        fragen: Object.values(fm).filter((q) => !q.geloescht).map((q) => ({ ...q, vorjahr: benutzt.has(q.id), eigen: !FRAGEN.some((x) => x.id === q.id), geaendert: FRAGEN.some((x) => x.id === q.id) && !!(cfg && (cfg.eigeneFragen || []).some((x) => x.id === q.id)) })),
        stufen: STUFEN, sprueche: SPRUECHE });
    }
    if (action === "adminSave") {
      nurAdmin();
      const roh = body.tueren && typeof body.tueren === "object" ? body.tueren : {};
      const tueren = {};
      for (let t = 1; t <= 24; t++) {
        const x = roh[t] || roh[String(t)] || {};
        const frageId = x.frageId && fm[x.frageId] ? String(x.frageId) : null;
        const fotoPath = String(x.fotoPath || "");
        if (fotoPath && !/^advent\/\d{4}-\d{1,2}-[a-f0-9]{10}_[A-Za-z0-9._-]{1,60}$/.test(fotoPath)) throw fehler(400, `Türchen ${t}: ungültiges Foto.`);
        tueren[t] = { spruch: kurz(x.spruch, 400), frageId, fotoPath, fotoText: kurz(x.fotoText, 200) };
      }
      const regeln = body.regeln === undefined ? undefined : kurz(body.regeln, 4000);
      const alteFotos = new Set(Object.values(planFuer(cfg, jahr)).map((x) => x && x.fotoPath).filter(Boolean));
      const neu = await kvAendern("advent", (c) => {
        const x = c && typeof c === "object" ? c : {};
        const benutzt = { ...(x.benutzt || {}) };
        if (x.jahr && x.jahr !== jahr && x.tueren) benutzt[x.jahr] = Object.values(x.tueren).map((y) => y && y.frageId).filter(Boolean);
        return { ...x, jahr, tueren, benutzt, ...(regeln !== undefined ? { regeln: regeln === REGELN_STANDARD ? "" : regeln } : {}), geaendertAm: new Date(jetzt).toISOString(), geaendertVon: ich };
      }, {});
      // Nicht mehr benutzte Fotos aus dem Speicher entfernen
      const jetztFotos = new Set(Object.values(neu.tueren).map((x) => x.fotoPath).filter(Boolean));
      const weg = [...alteFotos].filter((p) => !jetztFotos.has(p));
      if (weg.length) { try { await db.storage.from(BUCKET).remove(weg); } catch (e) { /* egal */ } }
      return json(200, { ok: true });
    }
    if (action === "auslosen") {
      nurAdmin();
      return json(200, { tueren: auslosen(jahr, vorjahrIds(cfg, jahr), cfg, Math.floor(Math.random() * 1e9)) });
    }
    if (action === "frageSpeichern") {
      nurAdmin();
      const x = body.frage && typeof body.frage === "object" ? body.frage : {};
      const antworten = (Array.isArray(x.antworten) ? x.antworten : []).map((a) => kurz(a, 200));
      if (!kurz(x.frage, 400)) throw fehler(400, "Bitte die Frage eingeben.");
      if (antworten.length !== 3 || antworten.some((a) => !a)) throw fehler(400, "Bitte alle drei Antworten ausfüllen.");
      const richtig = Number(x.richtig);
      if (![0, 1, 2].includes(richtig)) throw fehler(400, "Bitte die richtige Antwort markieren.");
      if (!STUFEN[x.stufe]) throw fehler(400, "Bitte die Schwierigkeit wählen.");
      const id = x.id && /^[a-z0-9]{3,12}$/.test(String(x.id)) ? String(x.id) : `e${neueId()}`;
      const frage = { id, kat: x.kat === "weihnachten" ? "weihnachten" : "feuerwehr", stufe: x.stufe, frage: kurz(x.frage, 400), antworten, richtig, info: kurz(x.info, 300) };
      await kvAendern("advent", (c) => {
        const y = c && typeof c === "object" ? c : {};
        const eigene = (Array.isArray(y.eigeneFragen) ? y.eigeneFragen : []).filter((q) => q.id !== id);
        return { ...y, eigeneFragen: [...eigene, frage] };
      }, {});
      return json(200, { ok: true, frage });
    }
    if (action === "fotoUpload") {
      nurAdmin();
      const t = Number(body.tag);
      if (!(t >= 1 && t <= 24)) throw fehler(400, "Ungültiges Türchen.");
      const safe = String(body.filename || "foto.jpg").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const pfad = `advent/${jahr}-${t}-${neueId()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(pfad);
      if (error) throw fehler(500, "Der Foto-Speicher ist nicht erreichbar.");
      return json(200, { path: pfad, uploadToken: data.token });
    }
    if (action === "ranglisteLoeschen") {
      nurAdmin();
      await db.from("kv_store").upsert({ key: "adventSpiel", value: leerSpiel(jahr), updated_at: new Date().toISOString() });
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && typeof e.code === "number") return json(e.code, { error: e.message });
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
