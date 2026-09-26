import React from "react";
import { supabase } from "../supabaseClient";
import { BEREICH_KEYS, BEWEGUNG_DEFAULT, FESTE_FUNKTIONEN, MONTHS, WEEKDAYS_SHORT } from "./constants";

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function nowTs() { return Date.now(); }
export function inNDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function currentYear() { return new Date().getFullYear(); }
export function formatDateParts(iso) {
  const d = new Date(iso + "T00:00:00");
  return { day: d.getDate().toString().padStart(2, "0"), monthShort: MONTHS[d.getMonth()].slice(0, 3).toUpperCase(), weekday: WEEKDAYS_SHORT[d.getDay()], monthYear: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}
export function daysUntil(iso) {
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - today) / 86400000);
}
export function daysSince(iso) { return -daysUntil(iso); }
export function addDays(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function fmtDate(iso) { if (!iso) return "—"; const { day } = formatDateParts(iso); const d = new Date(iso + "T00:00:00"); return `${day}.${(d.getMonth()+1).toString().padStart(2,"0")}.${d.getFullYear()}`; }

export const emptyDraft = (bereich) => ({
  id: null, title: "", date: todayISO(), time: bereich === "jugendfeuerwehr" ? "18:00" : "20:00", location: "", category: "uebung", notes: "", bereich: bereich || "",
  capacityMode: false, capacityNeeded: 3, namesVisible: true, gruppenfuehrer: "",
  anmeldeschluss: "", anmeldeschlussReminderDays: 3,
});
export const emptyNoticeDraft = () => ({ id: null, text: "", priority: "info", expiryDate: inNDays(7), bereich: "" });
export const emptyRosterEntry = (name, hasPin) => ({
  name, hasPin: !!hasPin, bereiche: [],
  rechte: BEREICH_KEYS.reduce((acc, k) => ({ ...acc, [k]: { calendar: false, news: false } }), {}),
  atemschutz: false,
  gruppenfuehrer: false,
  maschinist: false,
  geraetewart: false,
  ausschuss: false,
  ausschussRechte: { calendar: false, protokoll: false },
  g26: { dueDate: null, pendingConfirmation: false, enteredDate: null, confirmedByAdmin: false, confirmedAdminDate: null, photoUrl: null },
  streckendurchgang: { date: null, confirmedBy: null },
  atemschutzUebung: { type: null, date: null },
  atemschutzUnterweisung: { date: null, confirmedBy: null },
  fuehrerschein: {
    pkw: { hasLicense: true, confirmedYear: null, confirmedBy: null, confirmedDate: null, confirmRequestTo: null, requestDate: null, problemReported: false, problemReportedBy: null, problemDate: null },
    lkw: { hasLicense: true, confirmedYear: null, confirmedBy: null, confirmedDate: null, confirmRequestTo: null, requestDate: null, problemReported: false, problemReportedBy: null, problemDate: null, ablaufDatum: null },
  },
  fuehrerscheinKlassen: [],
  fahrzeuge: {},
});
export const emptySitzungDraft = () => ({ id: null, title: "", date: todayISO(), time: "20:00", location: "", tagesordnung: [""], links: "", protokoll: {}, attachments: [] });
export const emptyVehicle = (name, type) => ({ id: uid(), name, type: type === "lkw" ? "lkw" : "pkw" });

export function atemschutzStatus(entry) {
  const g26Valid = !!(entry.g26 && entry.g26.dueDate && daysUntil(entry.g26.dueDate) >= 0);
  const strecke = entry.streckendurchgang || {};
  const streckeValid = !!(strecke.date && daysSince(strecke.date) <= 365);
  const uebung = entry.atemschutzUebung || {};
  const uebungValid = !!(uebung.date && daysSince(uebung.date) <= 365);
  const unterweisung = entry.atemschutzUnterweisung || {};
  const unterweisungValid = !!(unterweisung.date && daysSince(unterweisung.date) <= 365);
  const allValid = g26Valid && streckeValid && uebungValid && unterweisungValid;
  let bis = null;
  if (allValid) {
    const dates = [entry.g26.dueDate, addDays(strecke.date, 365), addDays(uebung.date, 365), addDays(unterweisung.date, 365)];
    bis = dates.sort()[0];
  }
  return { g26Valid, streckeValid, uebungValid, unterweisungValid, allValid, bis };
}

// Aufruf der geschützten Serverfunktionen bei Netlify (PIN-Prüfung, Personalakte).
export async function callServer(fn, body) {
  try {
    const res = await fetch(`/.netlify/functions/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "Keine Verbindung zum Server." } };
  }
}

export async function storageSetWithRetry(key, jsonString, shared = true, retries = 2) {
  let lastErr = null;
  let parsedValue;
  try { parsedValue = JSON.parse(jsonString); } catch (e) { return { ok: false, error: "invalid-json" }; }
  for (let i = 0; i < retries; i++) {
    try {
      const { error } = await supabase.from("kv_store").upsert({ key, value: parsedValue, updated_at: new Date().toISOString() });
      if (!error) return { ok: true };
      lastErr = error;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return { ok: false, error: lastErr };
}
export async function storageGetSafe(key, shared = true, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? JSON.stringify(data.value) : null;
    } catch (e) { if (i < retries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1))); }
  }
  return null;
}

// Ältere gespeicherte Datensätze können Felder aus früheren App-Versionen vermissen.
// Beim Laden ergänzen wir fehlende Felder mit sinnvollen Standardwerten, damit die
// App nie an einem unvollständigen Datensatz abstürzt.
export function normalizeRosterEntry(r) {
  // PINs liegen seit Version 2.3 geschützt auf dem Server. Ein evtl. noch vorhandenes
  // "pin"-Feld wird hier entfernt, damit es nie wieder öffentlich gespeichert wird.
  const { pin: legacyPin, ...rest } = r;
  r = { ...rest, hasPin: r.hasPin !== undefined ? !!r.hasPin : !!legacyPin };
  const base = emptyRosterEntry(r.name, r.hasPin);
  const rechte = { ...base.rechte };
  Object.keys(rechte).forEach((k) => { rechte[k] = { ...base.rechte[k], ...((r.rechte && r.rechte[k]) || {}) }; });
  return {
    ...base, ...r,
    rechte,
    ausschussRechte: { ...base.ausschussRechte, ...(r.ausschussRechte || {}) },
    g26: { ...base.g26, ...(r.g26 || {}) },
    streckendurchgang: { ...base.streckendurchgang, ...(r.streckendurchgang || {}) },
    atemschutzUebung: { ...base.atemschutzUebung, ...(r.atemschutzUebung || {}) },
    atemschutzUnterweisung: { ...base.atemschutzUnterweisung, ...(r.atemschutzUnterweisung || {}) },
    fuehrerschein: {
      pkw: { ...base.fuehrerschein.pkw, ...((r.fuehrerschein && r.fuehrerschein.pkw) || {}) },
      lkw: { ...base.fuehrerschein.lkw, ...((r.fuehrerschein && r.fuehrerschein.lkw) || {}) },
    },
    fahrzeuge: r.fahrzeuge || {},
    bereiche: r.bereiche || [],
    fuehrerscheinKlassen: r.fuehrerscheinKlassen || [],
  };
}
export function normalizeEvent(e) {
  const ts = e.createdAt || Date.now();
  return { responses: {}, signups: {}, capacityNeeded: 1, anwesenheit: {}, guests: {}, anmeldeschluss: "", anmeldeschlussReminderDays: 3, ...e, createdAt: ts, updatedAt: e.updatedAt || ts };
}
export function normalizeSitzung(s) {
  const ts = s.createdAt || Date.now();
  return { protokoll: {}, anwesenheit: {}, links: "", tagesordnung: [], abstimmungen: {}, attachments: [], ...s, createdAt: ts };
}
export function normalizeVehicle(v) { return { id: v.id || uid(), name: v.name || "", type: v.type === "lkw" ? "lkw" : "pkw" }; }
export function normalizeConfig(cfg) {
  if (!cfg) return cfg;
  // Ältere Konfigurationen hatten ein einzelnes "adminName" statt einer Admin-Liste.
  const legacyAdmin = cfg.adminName;
  return {
    doctorName: "", doctorAddress: "", doctorPhone: "", lastCleanupYear: currentYear(),
    raenge: [],
    ...cfg,
    funktionen: [...FESTE_FUNKTIONEN, ...((cfg.funktionen || []).filter((f) => !FESTE_FUNKTIONEN.includes(f)))],
    bewegung: { ...BEWEGUNG_DEFAULT, ...(cfg.bewegung || {}) },
    adminNames: cfg.adminNames || (legacyAdmin ? [legacyAdmin] : []),
    mainAdminName: cfg.mainAdminName || legacyAdmin || (cfg.adminNames && cfg.adminNames[0]) || null,
  };
}

export function matchesSearch(name, query) { if (!query.trim()) return true; return name.toLowerCase().includes(query.trim().toLowerCase()); }

export function totalHeadcount(ev) {
  const responses = ev.responses || {}; const guests = ev.guests || {};
  return Object.entries(responses).filter(([, v]) => v === "zu").reduce((sum, [n]) => sum + 1 + (guests[n] || 0), 0);
}

// Fotos vor dem Hochladen verkleinern: längste Seite max. 1600 px, JPEG in guter Qualität.
// Andere Dateien (PDF usw.) und Fotos, die sich nicht lesen lassen, bleiben unverändert.
export async function compressImage(file, maxSize = 1600, quality = 0.82) {
  try {
    if (!file || !file.type || !file.type.startsWith("image/") || /gif|svg/.test(file.type)) return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image(); const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
      });
    }
    const w = bitmap.width, h = bitmap.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch (e) {
    return file;
  }
}

// Dienstjahre zählen erst ab dem 14. Lebensjahr: Maßgeblich ist das spätere Datum
// von Eintritt und 14. Geburtstag. Ohne Geburtsdatum gilt das Eintrittsdatum.
export function dienstbeginn(eintrittsdatum, geburtsdatum) {
  if (!eintrittsdatum) return null;
  if (!geburtsdatum) return eintrittsdatum;
  const mit14 = `${Number(geburtsdatum.slice(0, 4)) + 14}${geburtsdatum.slice(4)}`;
  return mit14 > eintrittsdatum ? mit14 : eintrittsdatum;
}
export function dienstjahreImJahr(eintrittsdatum, geburtsdatum, jahr = currentYear()) {
  const beginn = dienstbeginn(eintrittsdatum, geburtsdatum);
  return beginn ? jahr - Number(beginn.slice(0, 4)) : null;
}

// ---------------- Bewegungsfahrten ----------------
export function monatKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
export function monatLabel(key) { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }
export function normalizeBewegung(b) {
  return { plan: {}, maengel: [], ...(b || {}) };
}
// Wer darf ein Fahrzeug bewegen? Maschinist + gültiger LKW-Führerschein + Einweisung auf dem Fahrzeug.
export function bewegungKandidaten(mitglieder, fahrzeugId) {
  const heute = todayISO();
  return mitglieder.filter((r) => r.maschinist && !r.gesperrt && r.fuehrerschein && r.fuehrerschein.lkw && r.fuehrerschein.lkw.hasLicense
    && (!r.fuehrerschein.lkw.ablaufDatum || r.fuehrerschein.lkw.ablaufDatum >= heute)
    && r.fahrzeuge && r.fahrzeuge[fahrzeugId] && r.fahrzeuge[fahrzeugId].confirmedBy);
}
// Letzter Monat, in dem jemand eingeteilt war (ausgesetzte Monate zählen nicht).
function zuletztEingeteilt(plan, name, vorMonat) {
  let last = "0000-00";
  Object.entries(plan || {}).forEach(([key, m]) => {
    if (key >= vorMonat || !m || m.status === "ausgesetzt") return;
    Object.values(m.fahrzeuge || {}).forEach((f) => { if ((f.personen || []).includes(name) && key > last) last = key; });
  });
  return last;
}
// Faire Einteilung für einen Monat: wer am längsten nicht dran war, kommt zuerst.
export function erstelleMonatsplan(bewegung, mitglieder, lkwFahrzeuge, personen, key) {
  const fahrzeuge = {};
  const vergeben = new Set();
  const mix = (name) => { let h = 0; for (const c of name + key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  lkwFahrzeuge.forEach((v) => {
    const kandidaten = bewegungKandidaten(mitglieder, v.id)
      .map((r) => ({ name: r.name, last: zuletztEingeteilt(bewegung.plan, r.name, key), neu: vergeben.has(r.name) ? 1 : 0 }))
      .sort((a, b) => a.neu - b.neu || a.last.localeCompare(b.last) || mix(a.name) - mix(b.name));
    const auswahl = kandidaten.slice(0, personen).map((k) => k.name);
    auswahl.forEach((n) => vergeben.add(n));
    fahrzeuge[v.id] = { personen: auswahl, erledigt: null };
  });
  return { status: "geplant", erstellt: todayISO(), fahrzeuge };
}
