import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, X, Flame, MapPin, Clock, Trash2, Pencil, Bell, Lock, User, Settings, Check,
  UserCheck, UserX, ChevronRight, ShieldCheck, AlertTriangle, KeyRound, ArrowLeft,
  RotateCcw, Megaphone, Users, EyeOff, Eye, HandHelping, ClipboardCheck, Car, Truck,
  Stethoscope, Download, Sparkles, Pencil as PencilIcon, ChevronDown, Search, Landmark,
  Printer, ShieldAlert, RefreshCw, UserCog, LayoutGrid, FolderOpen
} from "lucide-react";
import { supabase } from "./supabaseClient";

const APP_NAME = "Feuerwehr Regglisweiler";
const APP_VERSION = "2.3";
const CHANGELOG = [
  "Neue Kachel Personalakte: Kontaktdaten, Lehrgänge mit Nachweis-Foto, Leistungsabzeichen, Rang, Ehrungen u. v. m. – sichtbar nur für dich und den Admin",
  "Neuer Bereich Führungskräfte mit eigenen Terminen und Mitteilungen",
  "Benachrichtigungen jetzt für alle Bereiche: jede neue Mitteilung meldet sich kurz und zählt am App-Symbol mit",
  "LKW-Führerschein: Ablaufdatum eintragen, Erinnerung 4 Monate vorher",
  "Mehr Sicherheit: PINs werden jetzt geschützt auf dem Server geprüft",
];
// WICHTIG (Heiko): Diese beiden Zeilen NICHT aus dieser Datei übernehmen — bitte die
// Original-Werte für LION_ICON und JF_ICON aus deiner aktuellen App.jsx bei GitHub
// hier einsetzen (einfach die beiden kompletten Zeilen von dort rüberkopieren), damit
// die Wappen-Icons nicht beschädigt werden. Alles andere in dieser Datei ist neu/aktualisiert.
const LION_ICON = "data:image/png;base64,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";
const JF_ICON = "data:image/png;base64,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";

const CATEGORIES = {
  uebung: { label: "Übung", color: "#C1272D", bg: "#FBEAEA" },
  brandwache: { label: "Brandwache", color: "#7A3B9E", bg: "#F1E9F6" },
  einsatz: { label: "Arbeitseinsatz", color: "#1F6F5C", bg: "#E7F2EF" },
  sonstiges: { label: "Kameradschaft", color: "#5C5F58", bg: "#EEEEEC" },
};
const CAPACITY_DEFAULT_CATEGORIES = ["brandwache", "einsatz"];

const PRIORITIES = {
  info: { label: "Info", color: "#4A6670", bg: "#EAF0F1", rank: 2 },
  wichtig: { label: "Wichtig", color: "#B8791A", bg: "#FBF1E1", rank: 1 },
  dringend: { label: "Dringend", color: "#C1272D", bg: "#FBEAEA", rank: 0 },
};

const BEREICHE = {
  jugendfeuerwehr: { label: "Jugendfeuerwehr", short: "JF", color: "#B8791A" },
  einsatzabteilung: { label: "Einsatzabteilung", short: "EA", color: "#C1272D" },
  altersabteilung: { label: "Altersabteilung", short: "AA", color: "#5C5F58" },
  wettkampfgruppe: { label: "Wettkampfgruppe", short: "WK", color: "#1F6F5C" },
  atemschutz: { label: "Atemschutz", short: "AS", color: "#2C6E8F" },
  fuehrungskraefte: { label: "Führungskräfte", short: "FK", color: "#8A3B5C" },
};
const BEREICH_KEYS = Object.keys(BEREICHE);

function BereichIcon({ bereich, size = 18 }) {
  if (bereich === "einsatzabteilung") return <img src={LION_ICON} alt="Einsatzabteilung" style={{ width: size, height: size, objectFit: "contain" }} />;
  if (bereich === "jugendfeuerwehr") return <img src={JF_ICON} alt="Jugendfeuerwehr" style={{ width: size, height: size, objectFit: "contain" }} />;
  if (bereich === "wettkampfgruppe") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.wettkampfgruppe.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3.2" /><circle cx="18" cy="18" r="3.2" /><path d="M8.3 8.3l7.4 7.4" /><path d="M14 10l3-3M10 14l-3 3" />
      </svg>
    );
  }
  if (bereich === "altersabteilung") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.altersabteilung.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12a7 7 0 0 1 14 0v3H5v-3z" /><path d="M4 17h16" /><path d="M12 5v0" /><circle cx="12" cy="4" r="1.2" fill={BEREICHE.altersabteilung.color} stroke="none" />
      </svg>
    );
  }
  if (bereich === "atemschutz") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.atemschutz.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0v-4z" />
        <circle cx="9.5" cy="12" r="1.1" fill={BEREICHE.atemschutz.color} stroke="none" />
        <circle cx="14.5" cy="12" r="1.1" fill={BEREICHE.atemschutz.color} stroke="none" />
        <path d="M12 16v2M9 20h6" />
      </svg>
    );
  }
  if (bereich === "fuehrungskraefte") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.fuehrungskraefte.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9l7-4 7 4" /><path d="M5 14l7-4 7 4" /><path d="M5 19l7-4 7 4" />
      </svg>
    );
  }
  return null;
}

// Führerscheinklassen: Aus den eingetragenen Klassen ergibt sich automatisch, ob jemand
// bei der Führerscheinkontrolle und den Fahrzeugeinweisungen für PKW bzw. LKW auftaucht.
const FUEHRERSCHEIN_KLASSEN = ["B", "BE", "C1", "C1E", "C", "CE", "FF 4,75 t", "FF 7,5 t"];
const PKW_KLASSEN = ["B", "BE"];
const LKW_KLASSEN = ["C1", "C1E", "C", "CE", "FF 4,75 t", "FF 7,5 t"];
const JUBILAEUMS_JAHRE = [10, 15, 20, 25, 30, 40, 50, 60];

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WEEKDAYS_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowTs() { return Date.now(); }
function inNDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function currentYear() { return new Date().getFullYear(); }
function formatDateParts(iso) {
  const d = new Date(iso + "T00:00:00");
  return { day: d.getDate().toString().padStart(2, "0"), monthShort: MONTHS[d.getMonth()].slice(0, 3).toUpperCase(), weekday: WEEKDAYS_SHORT[d.getDay()], monthYear: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}
function daysUntil(iso) {
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(iso + "T00:00:00");
  return Math.round((target - today) / 86400000);
}
function daysSince(iso) { return -daysUntil(iso); }
function addDays(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmtDate(iso) { if (!iso) return "—"; const { day } = formatDateParts(iso); const d = new Date(iso + "T00:00:00"); return `${day}.${(d.getMonth()+1).toString().padStart(2,"0")}.${d.getFullYear()}`; }

const emptyDraft = (bereich) => ({
  id: null, title: "", date: todayISO(), time: bereich === "jugendfeuerwehr" ? "18:00" : "20:00", location: "", category: "uebung", notes: "", bereich: bereich || "",
  capacityMode: false, capacityNeeded: 3, namesVisible: true, gruppenfuehrer: "",
  anmeldeschluss: "", anmeldeschlussReminderDays: 3,
});
const GRUPPENFUEHRER_CATEGORIES = ["uebung", "brandwache"];
const ATEMSCHUTZ_UEBUNG_TYPES = { container: "Brandübungscontainer", warm: "Warmer Einsatz", einsatznah: "Einsatznahe Übung" };
const emptyNoticeDraft = () => ({ id: null, text: "", priority: "info", expiryDate: inNDays(7), bereich: "" });
const emptyRosterEntry = (name, hasPin) => ({
  name, hasPin: !!hasPin, bereiche: [],
  rechte: BEREICH_KEYS.reduce((acc, k) => ({ ...acc, [k]: { calendar: false, news: false } }), {}),
  atemschutz: false,
  gruppenfuehrer: false,
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
const emptySitzungDraft = () => ({ id: null, title: "", date: todayISO(), time: "20:00", location: "", tagesordnung: [""], links: "", protokoll: {}, attachments: [] });
const emptyVehicle = (name, type) => ({ id: uid(), name, type: type === "lkw" ? "lkw" : "pkw" });

function atemschutzStatus(entry) {
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
async function callServer(fn, body) {
  try {
    const res = await fetch(`/.netlify/functions/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "Keine Verbindung zum Server." } };
  }
}

async function storageSetWithRetry(key, jsonString, shared = true, retries = 2) {
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
async function storageGetSafe(key, shared = true, retries = 3) {
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
function normalizeRosterEntry(r) {
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
function normalizeEvent(e) {
  const ts = e.createdAt || Date.now();
  return { responses: {}, signups: {}, capacityNeeded: 1, anwesenheit: {}, guests: {}, anmeldeschluss: "", anmeldeschlussReminderDays: 3, ...e, createdAt: ts, updatedAt: e.updatedAt || ts };
}
function normalizeSitzung(s) {
  const ts = s.createdAt || Date.now();
  return { protokoll: {}, anwesenheit: {}, links: "", tagesordnung: [], abstimmungen: {}, attachments: [], ...s, createdAt: ts };
}
function normalizeVehicle(v) { return { id: v.id || uid(), name: v.name || "", type: v.type === "lkw" ? "lkw" : "pkw" }; }
function normalizeConfig(cfg) {
  if (!cfg) return cfg;
  // Ältere Konfigurationen hatten ein einzelnes "adminName" statt einer Admin-Liste.
  const legacyAdmin = cfg.adminName;
  return {
    doctorName: "", doctorAddress: "", doctorPhone: "", lastCleanupYear: currentYear(),
    raenge: [], funktionen: [],
    ...cfg,
    adminNames: cfg.adminNames || (legacyAdmin ? [legacyAdmin] : []),
    mainAdminName: cfg.mainAdminName || legacyAdmin || (cfg.adminNames && cfg.adminNames[0]) || null,
  };
}

export default function App() {
  const [phase, setPhase] = useState("loading");
  const [config, setConfig] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [adminNameInput, setAdminNameInput] = useState("");
  const [adminPinInput, setAdminPinInput] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);

  const [roster, setRoster] = useState([]);
  const [me, setMe] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [pendingName, setPendingName] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [filter, setFilter] = useState("alle");
  const [selectedBereiche, setSelectedBereiche] = useState(null); // null = init from myEntry
  const [seenCategories, setSeenCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ffw_seen_categories") || "{}"); } catch (e) { return {}; }
  });
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [formError, setFormError] = useState("");
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(emptyNoticeDraft());
  const [noticeError, setNoticeError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loginSearch, setLoginSearch] = useState("");
  const [confirmTargetSearch, setConfirmTargetSearch] = useState("");
  const [confirmTargetType, setConfirmTargetType] = useState(null); // 'pkw' | 'lkw' | null — controls colleague picker
  const [confirmVehicleSearch, setConfirmVehicleSearch] = useState("");
  const [confirmVehicleTarget, setConfirmVehicleTarget] = useState(null); // vehicleId | null
  const [newVehicleName, setNewVehicleName] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("pkw");
  const [confirmDeleteVehicleId, setConfirmDeleteVehicleId] = useState(null);
  const [confirmDeleteSitzungId, setConfirmDeleteSitzungId] = useState(null);
  const [editVehicleId, setEditVehicleId] = useState(null);
  const [editVehicleName, setEditVehicleName] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("pkw");
  const [showSitzungen, setShowSitzungen] = useState(false);
  const [sitzungen, setSitzungen] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showSitzungForm, setShowSitzungForm] = useState(false);
  const [sitzungDraft, setSitzungDraft] = useState(emptySitzungDraft());
  const [sitzungError, setSitzungError] = useState("");
  const [expandedSitzung, setExpandedSitzung] = useState(null);
  const [showSitzungArchiv, setShowSitzungArchiv] = useState(false);
  const [showEventArchiv, setShowEventArchiv] = useState(false);
  const [printSitzungId, setPrintSitzungId] = useState(null);
  const [confirmResetG26Name, setConfirmResetG26Name] = useState(null);
  const [confirmResetVote, setConfirmResetVote] = useState(null); // { sitzungId, idx }
  const [voteStartDraft, setVoteStartDraft] = useState(null); // { sitzungId, idx, text }
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState(null);
  const [confirmDeleteNoticeId, setConfirmDeleteNoticeId] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [saveBanner, setSaveBanner] = useState(null);
  const [dismissedReminders, setDismissedReminders] = useState({});

  const [showKontrollen, setShowKontrollen] = useState(null); // null | 'fuehrerschein' | 'atemschutz'
  const [showTileMenu, setShowTileMenu] = useState(false);
  const [kachelReturnTo, setKachelReturnTo] = useState("calendar"); // 'calendar' | 'tiles'
  const [seenSitzungIds, setSeenSitzungIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ffw_seen_sitzungen") || "[]")); } catch (e) { return new Set(); }
  });
  const [g26EditOpen, setG26EditOpen] = useState(false);
  const [g26DateInput, setG26DateInput] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showPersonalakte, setShowPersonalakte] = useState(false); // Foto-Vollbildansicht, gilt für jedes Foto in der App

  // Beide "gesehen"-Listen dauerhaft im Browser sichern, damit der Neu-Punkt/die Zahl
  // nach dem Neuladen der App nicht wieder fälschlich auftaucht.
  useEffect(() => { try { localStorage.setItem("ffw_seen_categories", JSON.stringify(seenCategories)); } catch (e) {} }, [seenCategories]);
  useEffect(() => { try { localStorage.setItem("ffw_seen_sitzungen", JSON.stringify([...seenSitzungIds])); } catch (e) {} }, [seenSitzungIds]);

  const myEntry = roster.find((r) => r.name === me);
  const isAdmin = !!(me && config && config.adminNames && config.adminNames.includes(me));
  const isMainAdmin = !!(me && config && me === config.mainAdminName);
  const myBereiche = isAdmin ? BEREICH_KEYS : (myEntry ? myEntry.bereiche : []);
  const inEinsatzabteilung = myEntry && myEntry.bereiche.includes("einsatzabteilung");
  const isAtemschutz = isAdmin || (myEntry && myEntry.atemschutz);
  const canSeeAusschuss = isAdmin || (myEntry && myEntry.ausschuss);
  const canEditSitzung = isAdmin || (myEntry && myEntry.ausschuss && myEntry.ausschussRechte.calendar);
  const canEditProtokoll = isAdmin || (myEntry && myEntry.ausschuss && myEntry.ausschussRechte.protokoll);

  function canEditCalendarFor(bereich) { if (isAdmin) return true; if (!myEntry || !bereich) return false; return !!(myEntry.rechte[bereich] && myEntry.rechte[bereich].calendar); }
  function canEditNewsFor(bereich) { if (isAdmin) return true; if (!myEntry || !bereich) return false; return !!(myEntry.rechte[bereich] && myEntry.rechte[bereich].news); }
  const editableCalendarBereiche = myBereiche.filter((b) => canEditCalendarFor(b));
  const editableNewsBereiche = myBereiche.filter((b) => canEditNewsFor(b));
  const canEditAtemschutzUnterweisung = isAdmin || canEditCalendarFor("atemschutz");

  const configRef = useRef(null); const rosterRef = useRef([]); const eventsRef = useRef([]); const noticesRef = useRef([]); const sitzungenRef = useRef([]); const vehiclesRef = useRef([]);
  const lastEditRef = useRef({ config: 0, roster: 0, events: 0, notices: 0, sitzungen: 0, vehicles: 0 });
  const EDIT_COOLDOWN_MS = 8000;
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { noticesRef.current = notices; }, [notices]);
  useEffect(() => { sitzungenRef.current = sitzungen; }, [sitzungen]);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  async function fetchAllData(isInitial = false) {
    const cfgRaw = await storageGetSafe("config", true);
    const rosterRaw = await storageGetSafe("roster", true);
    const eventsRaw = await storageGetSafe("events", true);
    const noticesRaw = await storageGetSafe("notices", true);
    const sitzungenRaw = await storageGetSafe("sitzungen", true);
    const vehiclesRaw = await storageGetSafe("vehicles", true);

    // Bei Folge-Abrufen NIE mit leeren Ergebnissen überschreiben, falls
    // ein Abruf mal fehlschlägt — nur beim allerersten Laden gilt "nichts gefunden" = leer.
    let cfg = cfgRaw ? normalizeConfig(JSON.parse(cfgRaw)) : (isInitial ? null : configRef.current);
    let rst = rosterRaw ? JSON.parse(rosterRaw).map(normalizeRosterEntry) : (isInitial ? [] : rosterRef.current);
    let evs = eventsRaw ? JSON.parse(eventsRaw).map(normalizeEvent) : (isInitial ? [] : eventsRef.current);
    let nts = noticesRaw ? JSON.parse(noticesRaw) : (isInitial ? [] : noticesRef.current);
    let szg = sitzungenRaw ? JSON.parse(sitzungenRaw).map(normalizeSitzung) : (isInitial ? [] : sitzungenRef.current);
    let vhs = vehiclesRaw ? JSON.parse(vehiclesRaw).map(normalizeVehicle) : (isInitial ? [] : vehiclesRef.current);

    if (!isInitial) {
      const now = Date.now();
      if (now - lastEditRef.current.config < EDIT_COOLDOWN_MS) cfg = configRef.current;
      if (now - lastEditRef.current.roster < EDIT_COOLDOWN_MS) rst = rosterRef.current;
      if (now - lastEditRef.current.events < EDIT_COOLDOWN_MS) evs = eventsRef.current;
      if (now - lastEditRef.current.notices < EDIT_COOLDOWN_MS) nts = noticesRef.current;
      if (now - lastEditRef.current.sitzungen < EDIT_COOLDOWN_MS) szg = sitzungenRef.current;
      if (now - lastEditRef.current.vehicles < EDIT_COOLDOWN_MS) vhs = vehiclesRef.current;
    }

    // Automatische Endlöschung: Termine, die länger als 3 Jahre zurückliegen, werden endgültig entfernt.
    if (cfg) {
      const cutoff = `${currentYear() - 3}-01-01`;
      const before = evs.length;
      evs = evs.filter((e) => e.date >= cutoff);
      if (evs.length !== before) storageSetWithRetry("events", JSON.stringify(evs), true);
    }

    setConfig(cfg); setRoster(rst); setEvents(evs); setNotices(nts); setSitzungen(szg); setVehicles(vhs);
    return cfg;
  }

  useEffect(() => {
    (async () => {
      // Einmalig/automatisch: evtl. noch öffentlich gespeicherte PINs in den geschützten
      // Server-Speicher übernehmen, bevor irgendetwas anderes gespeichert wird.
      await callServer("auth", { action: "migrate" });
      const cfg = await fetchAllData(true);
      // Dauerhaft angemeldet bleiben: prüfen, ob dieses Gerät sich schon einmal erfolgreich angemeldet hat.
      try {
        const saved = JSON.parse(localStorage.getItem("ffw_auth") || "null");
        if (saved && cfg && saved.code === cfg.accessCode && saved.name) {
          setMe(saved.name); setPhase("app"); return;
        }
      } catch (e) { /* localStorage evtl. nicht verfügbar — normal weiter zum Code-Bildschirm */ }
      setPhase("gate");
    })();
  }, []);
  function saveAuth(code, name) { try { localStorage.setItem("ffw_auth", JSON.stringify({ code, name })); } catch (e) {} }
  function clearAuth() { try { localStorage.removeItem("ffw_auth"); localStorage.removeItem("ffw_token"); } catch (e) {} authTokenRef.current = null; }
  function logout() { clearAuth(); setMe(null); setCodeInput(""); setPhase("gate"); }

  // --- Sitzungs-Schlüssel (Token) für geschützte Serverfunktionen ---
  // Wird bei der PIN-Anmeldung vom Server ausgegeben. Wer schon vor dem Update angemeldet
  // war, wird bei der ersten geschützten Aktion (z. B. Personalakte) einmal nach der PIN gefragt.
  const authTokenRef = useRef(null);
  function loadToken(name) {
    try { const t = JSON.parse(localStorage.getItem("ffw_token") || "null"); return t && t.name === name ? t.token : null; } catch (e) { return null; }
  }
  function saveToken(name, token) { authTokenRef.current = token; try { localStorage.setItem("ffw_token", JSON.stringify({ name, token })); } catch (e) {} }
  const [pinPrompt, setPinPrompt] = useState(null); // { input, error, busy }
  const pinPromptResolveRef = useRef(null);
  function requestPinConfirm() {
    return new Promise((resolve) => { pinPromptResolveRef.current = resolve; setPinPrompt({ input: "", error: "", busy: false }); });
  }
  async function submitPinPrompt() {
    if (!pinPrompt || !/^\d{4}$/.test(pinPrompt.input)) { setPinPrompt((p) => ({ ...p, error: "Bitte deine 4-stellige PIN eingeben." })); return; }
    setPinPrompt((p) => ({ ...p, busy: true, error: "" }));
    const r = await callServer("auth", { action: "login", name: me, pin: pinPrompt.input });
    if (r.ok && r.data.token) {
      saveToken(me, r.data.token);
      setPinPrompt(null);
      const res = pinPromptResolveRef.current; pinPromptResolveRef.current = null; if (res) res(r.data.token);
    } else {
      setPinPrompt((p) => ({ ...p, busy: false, error: (r.data && r.data.error) || "PIN stimmt nicht." }));
    }
  }
  function cancelPinPrompt() { setPinPrompt(null); const res = pinPromptResolveRef.current; pinPromptResolveRef.current = null; if (res) res(null); }
  async function callAuthed(fn, body) {
    if (!authTokenRef.current && me) authTokenRef.current = loadToken(me);
    if (authTokenRef.current) {
      const r = await callServer(fn, { ...body, token: authTokenRef.current });
      if (r.status !== 401) return r;
    }
    const tok = await requestPinConfirm();
    if (!tok) return { ok: false, status: 401, data: { error: "abgebrochen" } };
    return callServer(fn, { ...body, token: tok });
  }
  function closeKachelView() {
    setShowKontrollen(null); setG26EditOpen(false); setShowSitzungen(false); setShowSettings(false); setShowPersonalakte(false);
    if (kachelReturnTo === "tiles") setShowTileMenu(true);
  }
  function openTileFuehrerschein() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowKontrollen("fuehrerschein"); }
  function openTileAtemschutz() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowKontrollen("atemschutz"); }
  function openTileAusschuss() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowSitzungen(true); setSeenSitzungIds(new Set(sitzungen.map((s) => s.id))); }
  function openTilePersonalakte() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowPersonalakte(true); }
  function openTileSettings() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowSettings(true); }

  // Service Worker registrieren (für Push-Benachrichtigungen & Homescreen-Zähler) und
  // beim ersten Anmelden auf dem Gerät einmalig automatisch nach der Erlaubnis fragen
  // (danach lässt es sich jederzeit über die Glocke im Kopf der App nachholen).
  // Ist das Gerät schon angemeldet, wird die Anmeldung bei jedem Start still aufgefrischt.
  useEffect(() => {
    if (phase !== "app" || !me) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
    try {
      const key = `ffw_push_asked_v2_${me}`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") subscribeToPush(true);
      else if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        if (typeof Notification !== "undefined" && Notification.permission === "default") subscribeToPush();
      }
    } catch (e) {}
  }, [phase, me]);

  // Zahl am App-Symbol zurücksetzen, sobald die App geöffnet bzw. wieder in den Vordergrund geholt wird.
  useEffect(() => {
    if (phase !== "app") return;
    const resetBadge = async () => {
      try { if ("clearAppBadge" in navigator) await navigator.clearAppBadge(); } catch (e) {}
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        if (sub) await supabase.from("push_subscriptions").update({ badge_count: 0 }).eq("endpoint", sub.endpoint);
      } catch (e) {}
    };
    resetBadge();
    const onVis = () => { if (document.visibilityState === "visible") resetBadge(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  // Echtzeit-Updates: Statt regelmäßig nachzufragen, meldet sich Supabase von selbst,
  // sobald sich in der Datenbank etwas ändert (Realtime). Deutlich schneller als Polling.
  useEffect(() => {
    if (phase !== "app") return;
    const applyRow = (key, rawValue) => {
      const now = Date.now();
      if (now - (lastEditRef.current[key] || 0) < EDIT_COOLDOWN_MS) return; // eigene, gerade erst gespeicherte Änderung nicht überschreiben
      try {
        if (key === "config") setConfig(normalizeConfig(rawValue));
        else if (key === "roster") setRoster((rawValue || []).map(normalizeRosterEntry));
        else if (key === "events") setEvents((rawValue || []).map(normalizeEvent));
        else if (key === "notices") setNotices(rawValue || []);
        else if (key === "sitzungen") setSitzungen((rawValue || []).map(normalizeSitzung));
        else if (key === "vehicles") setVehicles((rawValue || []).map(normalizeVehicle));
      } catch (e) { /* ignorieren, nächste Änderung kommt sicher */ }
    };
    const channel = supabase
      .channel("kv_store_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "kv_store" }, (payload) => {
        const row = payload.new && payload.new.key ? payload.new : payload.old;
        if (!row || !row.key) return;
        applyRow(row.key, payload.new ? payload.new.value : undefined);
      })
      .subscribe();
    // Sicherheitsnetz: falls die Echtzeit-Verbindung mal kurz ausfällt (z.B. Netzwechsel),
    // beim Zurückkommen in den Vordergrund trotzdem einmal nachladen.
    const onVisible = () => { if (document.visibilityState === "visible") fetchAllData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVisible); };
  }, [phase]);

  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  useEffect(() => {
    if (phase !== "app") return;
    try {
      const seen = localStorage.getItem("ffw_seen_version");
      if (seen !== APP_VERSION) setShowWhatsNew(true);
    } catch (e) {}
  }, [phase]);
  function dismissWhatsNew() { try { localStorage.setItem("ffw_seen_version", APP_VERSION); } catch (e) {} setShowWhatsNew(false); }
  async function manualRefresh() { setManualRefreshing(true); await fetchAllData(); setTimeout(() => setManualRefreshing(false), 500); }

  function flashError(text) { setSaveBanner({ type: "error", text }); setTimeout(() => setSaveBanner(null), 4500); }

  async function submitGate() {
    setGateError("");
    if (!config) {
      if (codeInput.trim().length < 4) { setGateError("Bitte mindestens 4 Zeichen für den Code wählen."); return; }
      if (!adminNameInput.trim()) { setGateError("Bitte deinen Namen eintragen."); return; }
      if (!/^\d{4}$/.test(adminPinInput)) { setGateError("Bitte eine 4-stellige PIN für dich als Admin festlegen."); return; }
      setGateBusy(true);
      const setupRes = await callServer("auth", { action: "setup", name: adminNameInput.trim(), pin: adminPinInput });
      if (!setupRes.ok) { setGateBusy(false); setGateError((setupRes.data && setupRes.data.error) || "Einrichtung fehlgeschlagen."); return; }
      if (setupRes.data.token) saveToken(adminNameInput.trim(), setupRes.data.token);
      const newConfig = { accessCode: codeInput.trim(), adminNames: [adminNameInput.trim()], mainAdminName: adminNameInput.trim(), doctorName: "", doctorAddress: "", doctorPhone: "", lastCleanupYear: currentYear(), raenge: [], funktionen: [] };
      const newRoster = [{ ...emptyRosterEntry(adminNameInput.trim(), true), bereiche: [...BEREICH_KEYS] }];
      setConfig(newConfig); setRoster(newRoster); setMe(adminNameInput.trim());
      setGateBusy(false); setPhase("app"); saveAuth(newConfig.accessCode, adminNameInput.trim());
      storageSetWithRetry("config", JSON.stringify(newConfig), true).then((res) => { if (!res.ok) flashError("Einrichtung evtl. nicht dauerhaft gespeichert."); });
      storageSetWithRetry("roster", JSON.stringify(newRoster), true);
      return;
    }
    if (codeInput.trim() === config.accessCode) setPhase("name");
    else setGateError("Code falsch. Bitte bei deinem Kommandanten nachfragen.");
  }

  async function persistRoster(next) { lastEditRef.current.roster = Date.now(); setRoster(next); const r = await storageSetWithRetry("roster", JSON.stringify(next), true); if (!r.ok) flashError("Mitgliederliste evtl. nicht dauerhaft gespeichert."); }
  async function persistEvents(next) { lastEditRef.current.events = Date.now(); setEvents(next); const r = await storageSetWithRetry("events", JSON.stringify(next), true); if (!r.ok) flashError("Änderung evtl. nicht dauerhaft gespeichert."); }
  async function persistNotices(next) { lastEditRef.current.notices = Date.now(); setNotices(next); const r = await storageSetWithRetry("notices", JSON.stringify(next), true); if (!r.ok) flashError("Mitteilung evtl. nicht dauerhaft gespeichert."); }
  async function persistConfig(next) { lastEditRef.current.config = Date.now(); setConfig(next); const r = await storageSetWithRetry("config", JSON.stringify(next), true); if (!r.ok) flashError("Einstellung evtl. nicht dauerhaft gespeichert."); }

  function updateMyRosterEntry(mutator) { persistRoster(roster.map((r) => (r.name === me ? mutator({ ...r }) : r))); }
  function updateRosterEntry(name, mutator) { persistRoster(roster.map((r) => (r.name === name ? mutator({ ...r }) : r))); }

  function pickRosterEntry(entry) { setPinError(""); setPinInput(""); setPinConfirm(""); setPendingName(entry.name); setNameInput(""); setLoginSearch(""); setPhase(entry.hasPin ? "pinEntry" : "pinSetup"); }
  function startNewName() {
    const trimmed = nameInput.trim(); if (!trimmed) return;
    const existing = roster.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) { pickRosterEntry(existing); return; }
    setPinError(""); setPinInput(""); setPinConfirm(""); setPendingName(trimmed); setNameInput(""); setLoginSearch(""); setPhase("pinSetup");
  }
  const [pinBusy, setPinBusy] = useState(false);
  async function submitPinEntry() {
    if (pinBusy) return;
    setPinBusy(true); setPinError("");
    const r = await callServer("auth", { action: "login", name: pendingName, pin: pinInput });
    setPinBusy(false);
    if (r.ok && r.data.token) {
      saveToken(pendingName, r.data.token);
      setMe(pendingName); setSelectedBereiche(null); setPhase("app"); saveAuth(config.accessCode, pendingName);
    } else setPinError((r.data && r.data.error) || "PIN stimmt nicht. Nochmal versuchen.");
  }
  async function submitPinSetup() {
    if (!/^\d{4}$/.test(pinInput)) { setPinError("Bitte eine 4-stellige PIN eingeben."); return; }
    if (pinInput !== pinConfirm) { setPinError("PINs stimmen nicht überein."); return; }
    if (pinBusy) return;
    setPinBusy(true); setPinError("");
    const r = await callServer("auth", { action: "setPin", name: pendingName, pin: pinInput });
    setPinBusy(false);
    if (!r.ok || !r.data.token) { setPinError((r.data && r.data.error) || "PIN konnte nicht gespeichert werden."); return; }
    saveToken(pendingName, r.data.token);
    const exists = roster.some((x) => x.name === pendingName);
    const next = exists
      ? roster.map((x) => (x.name === pendingName ? { ...x, hasPin: true } : x))
      : [...roster, emptyRosterEntry(pendingName, true)].sort((a, b) => a.name.localeCompare(b.name, "de"));
    persistRoster(next); setMe(pendingName); setSelectedBereiche(null); setPhase("app"); saveAuth(config.accessCode, pendingName);
  }
  async function resetPin(name) {
    const r = await callAuthed("auth", { action: "resetPin", target: name });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "PIN konnte nicht zurückgesetzt werden."); return; }
    updateRosterEntry(name, (x) => ({ ...x, hasPin: false }));
  }
  async function removeMember(name) {
    const r = await callAuthed("auth", { action: "deleteUser", target: name });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Mitglied konnte nicht entfernt werden."); return; }
    persistRoster(roster.filter((x) => x.name !== name));
  }
  async function toggleAdmin(name) {
    const makeAdmin = !config.adminNames.includes(name);
    const r = await callAuthed("auth", { action: "setAdmin", target: name, value: makeAdmin });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Admin-Recht konnte nicht geändert werden."); return; }
    persistConfig({ ...config, adminNames: makeAdmin ? [...config.adminNames, name] : config.adminNames.filter((n) => n !== name) });
  }
  function togglePermission(name, bereich, field) { updateRosterEntry(name, (r) => ({ ...r, rechte: { ...r.rechte, [bereich]: { ...r.rechte[bereich], [field]: !r.rechte[bereich][field] } } })); }
  function toggleBereichAssignment(name, bereich) { updateRosterEntry(name, (r) => ({ ...r, bereiche: r.bereiche.includes(bereich) ? r.bereiche.filter((b) => b !== bereich) : [...r.bereiche, bereich] })); }
  function toggleAtemschutz(name) { updateRosterEntry(name, (r) => ({ ...r, atemschutz: !r.atemschutz })); }
  function adminAddMember(name) {
    const trimmed = name.trim(); if (!trimmed) return;
    if (roster.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) { flashError("Diesen Namen gibt es schon."); return; }
    persistRoster([...roster, emptyRosterEntry(trimmed, null)].sort((a, b) => a.name.localeCompare(b.name, "de")));
  }
  function toggleGruppenfuehrer(name) { updateRosterEntry(name, (r) => ({ ...r, gruppenfuehrer: !r.gruppenfuehrer })); }
  function toggleAusschuss(name) { updateRosterEntry(name, (r) => ({ ...r, ausschuss: !r.ausschuss })); }
  function toggleAusschussRecht(name, field) { updateRosterEntry(name, (r) => ({ ...r, ausschussRechte: { ...r.ausschussRechte, [field]: !r.ausschussRechte[field] } })); }
  async function persistSitzungen(next) { lastEditRef.current.sitzungen = Date.now(); setSitzungen(next); const r = await storageSetWithRetry("sitzungen", JSON.stringify(next), true); if (!r.ok) flashError("Sitzung evtl. nicht dauerhaft gespeichert."); }
  async function persistVehicles(next) { lastEditRef.current.vehicles = Date.now(); setVehicles(next); const r = await storageSetWithRetry("vehicles", JSON.stringify(next), true); if (!r.ok) flashError("Fahrzeugliste evtl. nicht dauerhaft gespeichert."); }

  const effectiveBereiche = selectedBereiche === null ? myBereiche : selectedBereiche;
  function toggleBereichFilter(b) {
    const base = selectedBereiche === null ? myBereiche : selectedBereiche;
    const next = base.includes(b) ? base.filter((x) => x !== b) : [...base, b];
    setSelectedBereiche(next.length === 0 ? myBereiche : next);
  }

  function openNew() { if (editableCalendarBereiche.length === 0) return; setDraft(emptyDraft(editableCalendarBereiche[0])); setShowForm(true); setFormError(""); }
  function openEdit(ev) { if (!canEditCalendarFor(ev.bereich)) return; setDraft({ capacityMode: false, capacityNeeded: 3, namesVisible: true, ...ev }); setShowForm(true); setFormError(""); }
  function saveDraft() {
    if (!draft.bereich || !canEditCalendarFor(draft.bereich)) { setFormError("Keine Berechtigung für diesen Bereich."); return; }
    if (!draft.title.trim()) { setFormError("Bitte einen Titel eingeben."); return; }
    if (!draft.date) { setFormError("Bitte ein Datum wählen."); return; }
    if (draft.capacityMode && (!draft.capacityNeeded || draft.capacityNeeded < 1)) { setFormError("Bitte eine gültige Anzahl benötigter Personen angeben."); return; }
    const ts = nowTs();
    let next;
    if (draft.id) next = events.map((ev) => (ev.id === draft.id ? { ...ev, ...draft, updatedAt: ts } : ev));
    else next = [...events, { ...draft, id: uid(), responses: {}, signups: {}, createdAt: ts, updatedAt: ts }];
    next.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    persistEvents(next); setShowForm(false);
  }
  function deleteEvent(id) { const ev = events.find((e) => e.id === id); if (!ev || !canEditCalendarFor(ev.bereich)) return; persistEvents(events.filter((e) => e.id !== id)); }
  function toggleAttendance(eventId, name) {
    const ev = events.find((e) => e.id === eventId); if (!ev || !canEditCalendarFor(ev.bereich)) return;
    persistEvents(events.map((e) => {
      if (e.id !== eventId) return e;
      const anwesenheit = { ...(e.anwesenheit || {}) };
      if (anwesenheit[name]) delete anwesenheit[name]; else anwesenheit[name] = true;
      return { ...e, anwesenheit };
    }));
  }

  function setResponse(eventId, status) {
    if (!me) return;
    const next = events.map((ev) => {
      if (ev.id !== eventId) return ev;
      const responses = { ...(ev.responses || {}) };
      if (responses[me] === status) delete responses[me]; else responses[me] = status;
      let guests = ev.guests;
      if (responses[me] !== "zu" && guests && guests[me] !== undefined) { guests = { ...guests }; delete guests[me]; }
      return { ...ev, responses, guests };
    });
    persistEvents(next);
  }
  function setMyGuestCount(eventId, count) {
    if (!me) return;
    const next = events.map((ev) => (ev.id === eventId ? { ...ev, guests: { ...(ev.guests || {}), [me]: Math.max(0, count) } } : ev));
    persistEvents(next);
  }
  function toggleSignup(eventId) {
    if (!me) return;
    const next = events.map((ev) => {
      if (ev.id !== eventId) return ev;
      const signups = { ...(ev.signups || {}) }; const count = Object.keys(signups).length;
      if (signups[me]) delete signups[me]; else { if (count >= (ev.capacityNeeded || 0)) return ev; signups[me] = true; }
      return { ...ev, signups };
    });
    persistEvents(next);
  }

  function openNewNotice() { if (editableNewsBereiche.length === 0) return; setNoticeDraft({ ...emptyNoticeDraft(), bereich: editableNewsBereiche[0] }); setShowNoticeForm(true); setNoticeError(""); }
  function openEditNotice(n) { if (!canEditNewsFor(n.bereich)) return; setNoticeDraft({ ...n }); setShowNoticeForm(true); setNoticeError(""); }
  function saveNoticeDraft() {
    if (!noticeDraft.bereich || !canEditNewsFor(noticeDraft.bereich)) { setNoticeError("Keine Berechtigung für diesen Bereich."); return; }
    if (!noticeDraft.text.trim()) { setNoticeError("Bitte einen Text eingeben."); return; }
    if (!noticeDraft.expiryDate) { setNoticeError("Bitte ein Ablaufdatum wählen."); return; }
    let next;
    if (noticeDraft.id) next = notices.map((n) => (n.id === noticeDraft.id ? { ...noticeDraft, createdBy: n.createdBy } : n));
    else next = [...notices, { ...noticeDraft, id: uid(), createdBy: me }];
    persistNotices(next); setShowNoticeForm(false);
    if (!noticeDraft.id) notifyAboutNotice(noticeDraft);
  }
  function deleteNotice(id) { const n = notices.find((x) => x.id === id); if (!n || !canEditNewsFor(n.bereich)) return; persistNotices(notices.filter((x) => x.id !== id)); }

  // --- Ausschuss / Sitzungen ---
  function openNewSitzung() { if (!canEditSitzung) return; setSitzungDraft(emptySitzungDraft()); setShowSitzungForm(true); setSitzungError(""); }
  function openEditSitzung(s) { if (!canEditSitzung) return; setSitzungDraft({ ...emptySitzungDraft(), ...s }); setShowSitzungForm(true); setSitzungError(""); }
  function saveSitzungDraft() {
    if (!canEditSitzung) return;
    if (!sitzungDraft.title.trim()) { setSitzungError("Bitte einen Titel eingeben."); return; }
    if (!sitzungDraft.date) { setSitzungError("Bitte ein Datum wählen."); return; }
    const cleanTop = sitzungDraft.tagesordnung.map((t) => t.trim()).filter(Boolean);
    if (cleanTop.length === 0) { setSitzungError("Bitte mindestens einen Tagesordnungspunkt eingeben."); return; }
    let next;
    if (sitzungDraft.id) next = sitzungen.map((s) => (s.id === sitzungDraft.id ? { ...sitzungDraft, tagesordnung: cleanTop } : s));
    else next = [...sitzungen, { ...sitzungDraft, tagesordnung: cleanTop, id: uid(), protokoll: {}, anwesenheit: {} }];
    next.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    persistSitzungen(next); setShowSitzungForm(false);
  }
  function deleteSitzung(id) { if (!canEditSitzung) return; persistSitzungen(sitzungen.filter((s) => s.id !== id)); }
  function setAnwesenheit(sitzungId, name, status) {
    if (!canEditProtokoll) return;
    persistSitzungen(sitzungen.map((s) => {
      if (s.id !== sitzungId) return s;
      const anwesenheit = { ...(s.anwesenheit || {}) };
      if (anwesenheit[name] === status) delete anwesenheit[name]; else anwesenheit[name] = status;
      return { ...s, anwesenheit };
    }));
  }
  function saveProtokollText(sitzungId, index, text) {
    if (!canEditProtokoll) return;
    persistSitzungen(sitzungen.map((s) => (s.id === sitzungId ? { ...s, protokoll: { ...s.protokoll, [index]: text } } : s)));
  }

  // --- Abstimmungen ---
  function eligibleVoters(s) { return roster.filter((r) => r.ausschuss && (s.anwesenheit || {})[r.name] === "anwesend").map((r) => r.name); }
  function voteResult(ab) {
    const vals = Object.values((ab && ab.votes) || {});
    const dafuer = vals.filter((v) => v === "dafuer").length;
    const dagegen = vals.filter((v) => v === "dagegen").length;
    const label = dafuer > dagegen ? "angenommen" : dagegen > dafuer ? "abgelehnt" : "unentschieden";
    return { dafuer, dagegen, gesamt: vals.length, label };
  }
  function startAbstimmung(sitzungId, idx, text) {
    if (!canEditProtokoll) return;
    persistSitzungen(sitzungen.map((s) => (s.id === sitzungId ? { ...s, abstimmungen: { ...(s.abstimmungen || {}), [idx]: { active: true, finalized: false, votes: {}, text: text || "", startedBy: me, startedAt: nowTs() } } } : s)));
  }
  function castVote(sitzungId, idx, choice) {
    const s = sitzungen.find((x) => x.id === sitzungId); if (!s) return;
    const ab = (s.abstimmungen || {})[idx]; if (!ab || !ab.active) return;
    if (!eligibleVoters(s).includes(me)) return;
    const votes = { ...ab.votes, [me]: choice };
    const done = eligibleVoters(s).every((n) => votes[n]);
    persistSitzungen(sitzungen.map((x) => (x.id === sitzungId ? { ...x, abstimmungen: { ...(x.abstimmungen || {}), [idx]: { ...ab, votes, active: !done, finalized: done } } } : x)));
  }
  function finalizeAbstimmung(sitzungId, idx) {
    if (!canEditProtokoll) return;
    persistSitzungen(sitzungen.map((s) => {
      if (s.id !== sitzungId) return s;
      const ab = (s.abstimmungen || {})[idx]; if (!ab) return s;
      return { ...s, abstimmungen: { ...s.abstimmungen, [idx]: { ...ab, active: false, finalized: true } } };
    }));
  }
  function resetAbstimmung(sitzungId, idx) {
    if (!canEditProtokoll) return;
    persistSitzungen(sitzungen.map((s) => {
      if (s.id !== sitzungId) return s;
      const next = { ...(s.abstimmungen || {}) }; delete next[idx];
      return { ...s, abstimmungen: next };
    }));
    setConfirmResetVote(null);
  }
  function triggerPrint(sitzungId) { setPrintSitzungId(sitzungId); setTimeout(() => { window.print(); setPrintSitzungId(null); }, 100); }
  function escapeHtml(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function exportSitzungFile(sitzungId) {
    const s = sitzungen.find((x) => x.id === sitzungId); if (!s) return;
    const anwesenheitRows = roster.filter((r) => r.ausschuss).map((r) => {
      const status = (s.anwesenheit || {})[r.name];
      return `<li>${escapeHtml(r.name)} — ${status === "anwesend" ? "anwesend" : status === "entschuldigt" ? "entschuldigt" : "keine Angabe"}</li>`;
    }).join("");
    const agendaRows = s.tagesordnung.map((point, idx) => {
      const ab = (s.abstimmungen || {})[idx];
      let voteHtml = "";
      if (ab && ab.finalized) {
        const r = voteResult(ab);
        const votesList = Object.entries(ab.votes).map(([n, v]) => `${escapeHtml(n)}: ${v === "dafuer" ? "dafür" : "dagegen"}`).join(", ");
        voteHtml = `<p style="margin-top:6px;">${ab.text ? `<em>„${escapeHtml(ab.text)}“</em><br/>` : ""}<strong>Abstimmung:</strong> ${r.dafuer} dafür · ${r.dagegen} dagegen — ${r.label}<br/><span style="font-size:12px;color:#5C5F58;">${votesList}</span></p>`;
      }
      const divider = idx > 0 ? `<hr style="border:none;border-top:1px solid #E2DFD6;margin:16px 0;"/>` : "";
      return `${divider}<div style="margin-bottom:6px"><strong>${idx + 1}. ${escapeHtml(point)}</strong><p style="white-space:pre-wrap;">${escapeHtml(s.protokoll[idx] || "—")}</p>${voteHtml}</div>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(s.title)}</title></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#2C2F2A;line-height:1.5;">
<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #C1272D;padding-bottom:14px;margin-bottom:18px;">
  <img src="${LION_ICON}" alt="" style="width:48px;height:48px;object-fit:contain;" />
  <div><div style="font-size:20px;font-weight:700;letter-spacing:0.03em;">FEUERWEHR REGGLISWEILER</div><div style="font-size:12px;color:#8A8C86;">Ausschuss-Protokoll</div></div>
</div>
<h2 style="margin-bottom:4px;">${escapeHtml(s.title)}</h2>
<p style="color:#5C5F58;margin-top:0;">${fmtDate(s.date)} · ${s.time} Uhr ${s.location ? "· " + escapeHtml(s.location) : ""}</p>
<hr style="border:none;border-top:1px solid #E2DFD6;margin:16px 0;"/>
<p><strong>Anwesenheit</strong></p>
<ul>${anwesenheitRows || "<li>Keine Ausschussmitglieder eingetragen.</li>"}</ul>
<hr style="border:none;border-top:1px solid #E2DFD6;margin:16px 0;"/>
${agendaRows}
${s.links ? `<p><strong>Link:</strong> ${escapeHtml(s.links)}</p>` : ""}
${(s.attachments || []).length > 0 ? `<p><strong>Anhänge:</strong></p><ul>${s.attachments.map((a) => `<li><a href="${escapeHtml(a.url)}">${escapeHtml(a.name)}</a></li>`).join("")}</ul>` : ""}
<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.25);" class="no-print">🖨️ Drucken / Als PDF sichern</button>
<style>@media print { .no-print { display:none; } }</style>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  // --- Führerschein ---
  function requestFuehrerscheinConfirmation(type, colleagueName) {
    updateMyRosterEntry((r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], confirmRequestTo: colleagueName, requestDate: todayISO() } } }));
    setConfirmTargetType(null); setConfirmTargetSearch("");
  }
  function cancelFuehrerscheinRequest(type) {
    updateMyRosterEntry((r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], confirmRequestTo: null, requestDate: null } } }));
  }
  function confirmFuehrerschein(subjectName, type) {
    updateRosterEntry(subjectName, (r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], confirmedYear: currentYear(), confirmedBy: me, confirmedDate: todayISO(), confirmRequestTo: null, requestDate: null, problemReported: false, problemReportedBy: null } } }));
  }
  function reportFuehrerscheinProblem(subjectName, type) {
    updateRosterEntry(subjectName, (r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], confirmRequestTo: null, requestDate: null, problemReported: true, problemReportedBy: me, problemDate: todayISO() } } }));
  }
  function dismissFuehrerscheinProblem(type) {
    updateMyRosterEntry((r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], problemReported: false, problemReportedBy: null } } }));
  }
  function toggleHasLicense(name, type) {
    updateRosterEntry(name, (r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, [type]: { ...r.fuehrerschein[type], hasLicense: !r.fuehrerschein[type].hasLicense, confirmedYear: !r.fuehrerschein[type].hasLicense ? r.fuehrerschein[type].confirmedYear : currentYear() } } }));
  }
  function setLkwAblauf(name, date) {
    if (!isAdmin && me !== name) return;
    updateRosterEntry(name, (r) => ({ ...r, fuehrerschein: { ...r.fuehrerschein, lkw: { ...r.fuehrerschein.lkw, ablaufDatum: date || null } } }));
  }
  // Führerscheinklassen setzen: PKW/LKW-Status für Kontrolle und Fahrzeugeinweisung wird daraus abgeleitet.
  function setFuehrerscheinKlassen(name, klassen) {
    if (!isAdmin && me !== name) return;
    updateRosterEntry(name, (r) => {
      const next = { ...r, fuehrerscheinKlassen: klassen };
      if (klassen.length > 0) {
        next.fuehrerschein = {
          ...r.fuehrerschein,
          pkw: { ...r.fuehrerschein.pkw, hasLicense: klassen.some((k) => PKW_KLASSEN.includes(k) || LKW_KLASSEN.includes(k)) },
          lkw: { ...r.fuehrerschein.lkw, hasLicense: klassen.some((k) => LKW_KLASSEN.includes(k)) },
        };
      }
      return next;
    });
  }
  function fuehrerscheinDue(entry, type) { const f = entry.fuehrerschein[type]; return f.hasLicense && f.confirmedYear !== currentYear(); }

  // --- Fahrzeuge / Fahrzeugeinweisung ---
  function addVehicle(name, type) {
    const trimmed = name.trim(); if (!trimmed || !isAdmin) return;
    persistVehicles([...vehicles, emptyVehicle(trimmed, type)]);
  }
  function deleteVehicle(id) { if (!isAdmin) return; persistVehicles(vehicles.filter((v) => v.id !== id)); }
  function renameVehicle(id, name, type) { if (!isAdmin) return; persistVehicles(vehicles.map((v) => (v.id === id ? { ...v, name, type: type === "lkw" ? "lkw" : "pkw" } : v))); }
  function getVehicleStatus(entry, vehicleId) { return (entry.fahrzeuge || {})[vehicleId] || { confirmedBy: null, confirmedDate: null, confirmRequestTo: null, requestDate: null }; }
  function requestVehicleConfirmation(vehicleId, colleagueName) {
    updateMyRosterEntry((r) => ({ ...r, fahrzeuge: { ...(r.fahrzeuge || {}), [vehicleId]: { ...getVehicleStatus(r, vehicleId), confirmRequestTo: colleagueName, requestDate: todayISO() } } }));
    setConfirmVehicleTarget(null); setConfirmVehicleSearch("");
  }
  function cancelVehicleRequest(vehicleId) {
    updateMyRosterEntry((r) => ({ ...r, fahrzeuge: { ...(r.fahrzeuge || {}), [vehicleId]: { ...getVehicleStatus(r, vehicleId), confirmRequestTo: null, requestDate: null } } }));
  }
  function confirmVehicleInstruction(subjectName, vehicleId) {
    updateRosterEntry(subjectName, (r) => ({ ...r, fahrzeuge: { ...(r.fahrzeuge || {}), [vehicleId]: { confirmedBy: me, confirmedDate: todayISO(), confirmRequestTo: null, requestDate: null } } }));
  }

  // --- Atemschutz: Streckendurchgang, Übungstyp (Admin oder Träger selbst) & Unterweisung (Admin/Berechtigter) ---
  function setStreckendurchgang(name, date) { if (!isAdmin && me !== name) return; updateRosterEntry(name, (r) => ({ ...r, streckendurchgang: { date, confirmedBy: me } })); }
  function resetStreckendurchgang(name) { if (!isAdmin && me !== name) return; updateRosterEntry(name, (r) => ({ ...r, streckendurchgang: { date: null, confirmedBy: null } })); }
  function setAtemschutzUebung(name, type, date) { if (!isAdmin && me !== name) return; updateRosterEntry(name, (r) => ({ ...r, atemschutzUebung: { type, date } })); }
  function resetAtemschutzUebung(name) { if (!isAdmin && me !== name) return; updateRosterEntry(name, (r) => ({ ...r, atemschutzUebung: { type: null, date: null } })); }
  function setAtemschutzUnterweisung(name, date) { if (!canEditAtemschutzUnterweisung) return; updateRosterEntry(name, (r) => ({ ...r, atemschutzUnterweisung: { date, confirmedBy: me } })); }
  function resetAtemschutzUnterweisung(name) { if (!canEditAtemschutzUnterweisung) return; updateRosterEntry(name, (r) => ({ ...r, atemschutzUnterweisung: { date: null, confirmedBy: null } })); }

  // --- G26 ---
  function saveG26Date(newDate) {
    updateMyRosterEntry((r) => ({ ...r, g26: { dueDate: newDate, pendingConfirmation: true, enteredDate: todayISO(), confirmedByAdmin: false, confirmedAdminDate: null } }));
    setG26EditOpen(false); setG26DateInput("");
  }
  function adminConfirmG26(name) { updateRosterEntry(name, (r) => ({ ...r, g26: { ...r.g26, pendingConfirmation: false, confirmedByAdmin: true, confirmedAdminDate: todayISO() } })); }
  function resetG26Date(name) { updateRosterEntry(name, (r) => ({ ...r, g26: { dueDate: null, pendingConfirmation: false, enteredDate: null, confirmedByAdmin: false, confirmedAdminDate: null, photoUrl: null } })); setConfirmResetG26Name(null); }

  // --- Datei-Uploads (Supabase Storage, Bucket "anhaenge") ---
  const [g26PhotoUploading, setG26PhotoUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  async function uploadG26Photo(file) {
    if (!file || !me) return;
    setG26PhotoUploading(true);
    try {
      const path = `g26/${me.replace(/[^a-z0-9]+/gi, "_")}_${Date.now()}`;
      const { error } = await supabase.storage.from("anhaenge").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("anhaenge").getPublicUrl(path);
      updateMyRosterEntry((r) => ({ ...r, g26: { ...r.g26, photoUrl: data.publicUrl } }));
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setG26PhotoUploading(false);
  }
  function removeG26Photo() { updateMyRosterEntry((r) => ({ ...r, g26: { ...r.g26, photoUrl: null } })); }
  async function uploadSitzungAttachment(file) {
    if (!file) return;
    setAttachmentUploading(true);
    try {
      const path = `ausschuss/${Date.now()}_${file.name.replace(/[^a-z0-9.\-_]+/gi, "_")}`;
      const { error } = await supabase.storage.from("anhaenge").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("anhaenge").getPublicUrl(path);
      setSitzungDraft((d) => ({ ...d, attachments: [...(d.attachments || []), { name: file.name, url: data.publicUrl }] }));
    } catch (e) { flashError("Datei-Upload fehlgeschlagen."); }
    setAttachmentUploading(false);
  }
  function removeSitzungAttachmentDraft(idx) { setSitzungDraft((d) => ({ ...d, attachments: d.attachments.filter((_, i) => i !== idx) })); }
  function g26ReminderActive(entry) { if (!entry.atemschutz || !entry.g26.dueDate) return false; return daysUntil(entry.g26.dueDate) <= 122; }

  // --- Push-Benachrichtigungen (Dringend + Einsatzabteilung) & Homescreen-Zähler ---
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
    return out;
  }
  async function subscribeToPush(silent = false) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      if (!silent) flashError("Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!sub && vapidKey) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      }
      if (sub) {
        await supabase.from("push_subscriptions").upsert({
          endpoint: sub.endpoint,
          name: me,
          bereiche: myEntry ? myEntry.bereiche : [],
          subscription: sub.toJSON(),
        });
      }
    } catch (e) { if (!silent) flashError("Benachrichtigungen konnten nicht aktiviert werden."); }
  }
  // Jede neue Mitteilung löst eine kurze Benachrichtigung + Zahl am App-Symbol aus
  // (nur für Mitglieder des jeweiligen Bereichs, nicht für den Verfasser selbst).
  // "Dringend" in der Einsatzabteilung wird besonders hervorgehoben.
  function notifyAboutNotice(notice) {
    const label = (BEREICHE[notice.bereich] && BEREICHE[notice.bereich].label) || "";
    const title = notice.priority === "dringend"
      ? (notice.bereich === "einsatzabteilung" ? "🚨 DRINGEND – Einsatzabteilung" : `Dringend – ${label}`)
      : `Neue Mitteilung – ${label}`;
    fetch("/.netlify/functions/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bereich: notice.bereich, priority: notice.priority, title, text: notice.text, sender: me }),
    }).catch(() => {});
  }

  function openPreviewPage(bodyHtml, title) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;padding:0 16px 60px;color:#2C2F2A;}
table{border-collapse:collapse;width:100%;margin-top:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left;}
th{background:#F3F1EC;} h2{margin-bottom:4px;}
.print-btn{position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.25);}
@media print { .print-btn { display:none; } }</style>
</head><body>${bodyHtml}
<p style="margin-top:24px;font-size:12px;color:#8A8C86;">Am Handy: über das Teilen-Symbol deines Browsers zusätzlich speichern/weiterleiten möglich.</p>
<button class="print-btn" onclick="window.print()">🖨️ Drucken / Als PDF sichern</button>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
  function exportCSV(rows, filename) {
    const title = filename.replace(/\.csv$/i, "").replace(/_/g, " ");
    const [header, ...body] = rows;
    const theadHtml = `<tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
    const tbodyHtml = body.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
    openPreviewPage(`<h2>${escapeHtml(title)}</h2><table><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>`, title);
  }
  function exportFuehrerschein() {
    const rows = [["Name", "PKW Status", "PKW bestätigt von", "PKW Datum", "LKW Status", "LKW bestätigt von", "LKW Datum", "LKW gültig bis"]];
    roster.filter((r) => r.bereiche.includes("einsatzabteilung")).forEach((r) => {
      const pkw = r.fuehrerschein.pkw; const lkw = r.fuehrerschein.lkw;
      rows.push([r.name, !pkw.hasLicense ? "Kein PKW" : pkw.confirmedYear === currentYear() ? "Bestätigt" : "Offen", pkw.confirmedBy || "", pkw.confirmedDate ? fmtDate(pkw.confirmedDate) : "",
        !lkw.hasLicense ? "Kein LKW" : lkw.confirmedYear === currentYear() ? "Bestätigt" : "Offen", lkw.confirmedBy || "", lkw.confirmedDate ? fmtDate(lkw.confirmedDate) : "",
        lkw.hasLicense && lkw.ablaufDatum ? fmtDate(lkw.ablaufDatum) : ""]);
    });
    exportCSV(rows, `Fuehrerschein_${currentYear()}.csv`);
  }
  function exportAtemschutz() {
    const rows = [["Name", "G26 Termin", "G26 Status", "Streckendurchgang", "Übung Typ", "Übung Datum", "Unterweisung", "Einsatztauglich", "Tauglich bis"]];
    roster.filter((r) => r.atemschutz).forEach((r) => {
      const st = atemschutzStatus(r);
      rows.push([
        r.name,
        r.g26.dueDate ? fmtDate(r.g26.dueDate) : "nicht eingetragen",
        r.g26.pendingConfirmation ? "Wartet auf Bestätigung" : "OK",
        r.streckendurchgang.date ? fmtDate(r.streckendurchgang.date) : "offen",
        r.atemschutzUebung.type ? ATEMSCHUTZ_UEBUNG_TYPES[r.atemschutzUebung.type] : "offen",
        r.atemschutzUebung.date ? fmtDate(r.atemschutzUebung.date) : "",
        r.atemschutzUnterweisung && r.atemschutzUnterweisung.date ? fmtDate(r.atemschutzUnterweisung.date) : "offen",
        st.allValid ? "Ja" : "Nein",
        st.bis ? fmtDate(st.bis) : "",
      ]);
    });
    exportCSV(rows, `Atemschutz_Uebersicht_${currentYear()}.csv`);
  }

  // --- derived data ---
  const bereichAndCategoryFiltered = useMemo(() => {
    return events
      .filter((ev) => effectiveBereiche.includes(ev.bereich))
      .filter((ev) => filter === "alle" || ev.category === filter)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [events, filter, effectiveBereiche]);
  const filtered = useMemo(() => bereichAndCategoryFiltered.filter((ev) => daysUntil(ev.date) >= -1), [bereichAndCategoryFiltered]);
  const archivedEvents = useMemo(() => bereichAndCategoryFiltered.filter((ev) => daysUntil(ev.date) < -1).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [bereichAndCategoryFiltered]);
  const archivedGrouped = useMemo(() => {
    const groups = {}; archivedEvents.forEach((ev) => { const key = formatDateParts(ev.date).monthYear; if (!groups[key]) groups[key] = []; groups[key].push(ev); }); return groups;
  }, [archivedEvents]);
  const grouped = useMemo(() => {
    const groups = {}; filtered.forEach((ev) => { const key = formatDateParts(ev.date).monthYear; if (!groups[key]) groups[key] = []; groups[key].push(ev); }); return groups;
  }, [filtered]);
  const nextEvent = filtered[0];

  const activeNotices = useMemo(() => {
    return notices.filter((n) => effectiveBereiche.includes(n.bereich)).filter((n) => daysUntil(n.expiryDate) >= 0)
      .sort((a, b) => PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank || a.expiryDate.localeCompare(b.expiryDate));
  }, [notices, effectiveBereiche]);


  const categoryDots = useMemo(() => {
    const dots = {};
    events.filter((ev) => effectiveBereiche.includes(ev.bereich)).forEach((ev) => {
      const age = daysSince(new Date((ev.updatedAt || ev.createdAt || 0)).toISOString().slice(0, 10));
      if (age <= 28 && !seenCategories[ev.category]) dots[ev.category] = true;
    });
    return dots;
  }, [events, seenCategories, effectiveBereiche]);

  function isRecent(ev) { const ts = ev.updatedAt || ev.createdAt || 0; return (nowTs() - ts) / 86400000 <= 28; }
  function eventBadgeLabel(ev) { if (!isRecent(ev)) return null; return ev.createdAt === ev.updatedAt ? "Neu" : "Geändert"; }

  // reminders for "me"
  const myReminders = useMemo(() => {
    if (!myEntry) return [];
    const list = [];
    if (inEinsatzabteilung) {
      if (fuehrerscheinDue(myEntry, "pkw")) list.push({ key: "fs-pkw", text: "Bitte deinen PKW-Führerschein einem Kameraden zur Kontrolle zeigen.", target: "fuehrerschein" });
      if (fuehrerscheinDue(myEntry, "lkw")) list.push({ key: "fs-lkw", text: "Bitte deinen LKW-Führerschein einem Kameraden zur Kontrolle zeigen.", target: "fuehrerschein" });
      const lkwAblauf = myEntry.fuehrerschein.lkw.ablaufDatum;
      if (myEntry.fuehrerschein.lkw.hasLicense && lkwAblauf && daysUntil(lkwAblauf) <= 122) {
        const d = daysUntil(lkwAblauf);
        const when = d < 0 ? `ist seit ${Math.abs(d)} Tagen abgelaufen` : d === 0 ? "läuft heute ab" : `läuft in ${d} Tagen ab`;
        list.push({ key: `lkw-ablauf-${lkwAblauf}`, text: `Dein LKW-Führerschein ${when} (${fmtDate(lkwAblauf)}). Bitte rechtzeitig verlängern und danach das neue Datum eintragen.`, target: "fuehrerschein" });
      }
    }
    if (myEntry.atemschutz) {
      if (!myEntry.g26.dueDate) list.push({ key: "g26-missing", text: "Bitte trage deinen nächsten G26.3-Untersuchungstermin ein.", target: "atemschutz" });
      else if (g26ReminderActive(myEntry)) {
        const d = daysUntil(myEntry.g26.dueDate);
        const when = d < 0 ? `vor ${Math.abs(d)} Tagen abgelaufen` : d === 0 ? "heute fällig" : `noch ${d} Tage`;
        list.push({ key: "g26-due", text: `G26.3-Untersuchung ${when} (${fmtDate(myEntry.g26.dueDate)}).`, doctor: true, target: "atemschutz" });
      }
    }
    return list.filter((r) => !dismissedReminders[r.key]);
  }, [myEntry, inEinsatzabteilung, dismissedReminders]);

  const anmeldeschlussReminders = useMemo(() => {
    if (!me) return [];
    return events.filter((ev) => {
      if (ev.category !== "sonstiges" || !ev.anmeldeschluss) return false;
      if (!effectiveBereiche.includes(ev.bereich)) return false;
      const d = daysUntil(ev.anmeldeschluss);
      if (d < 0 || d > (ev.anmeldeschlussReminderDays || 0)) return false;
      return !((ev.responses || {})[me]);
    }).map((ev) => ({ key: `anmeldeschluss-${ev.id}`, text: `Anmeldeschluss für "${ev.title}" in ${daysUntil(ev.anmeldeschluss)} Tag(en) (${fmtDate(ev.anmeldeschluss)}).` }))
      .filter((r) => !dismissedReminders[r.key]);
  }, [events, me, effectiveBereiche, dismissedReminders]);

  const adminPendingG26 = useMemo(() => { if (!isAdmin) return []; return roster.filter((r) => r.atemschutz && r.g26.pendingConfirmation); }, [roster, isAdmin]);

  const incomingFsRequests = useMemo(() => {
    if (!me) return [];
    const list = [];
    roster.forEach((r) => {
      ["pkw", "lkw"].forEach((type) => { if (r.fuehrerschein[type].confirmRequestTo === me) list.push({ name: r.name, type }); });
    });
    return list;
  }, [roster, me]);

  const incomingVehicleRequests = useMemo(() => {
    if (!me) return [];
    const list = [];
    roster.forEach((r) => {
      Object.entries(r.fahrzeuge || {}).forEach(([vehicleId, status]) => {
        if (status.confirmRequestTo === me) { const v = vehicles.find((x) => x.id === vehicleId); list.push({ name: r.name, vehicleId, vehicleName: v ? v.name : "Fahrzeug" }); }
      });
    });
    return list;
  }, [roster, vehicles, me]);

  const neueSitzungenCount = useMemo(() => sitzungen.filter((s) => !seenSitzungIds.has(s.id)).length, [sitzungen, seenSitzungIds]);
  const upcomingSitzungenTeaser = useMemo(() => sitzungen.filter((s) => s.date >= todayISO()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 1), [sitzungen]);
  const myRelevantVehicles = useMemo(() => {
    if (!myEntry) return [];
    return vehicles.filter((v) => (v.type === "lkw" ? myEntry.fuehrerschein.lkw.hasLicense : myEntry.fuehrerschein.pkw.hasLicense));
  }, [vehicles, myEntry]);

  // Hinweis für iPhones: Push-Benachrichtigungen funktionieren nur, wenn die App vorher
  // zum Home-Bildschirm hinzugefügt wurde (Safari selbst kann keine Push-Nachrichten empfangen).
  const isIOSDevice = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandaloneApp = typeof window !== "undefined" && (window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
  const [iosHintDismissed, setIosHintDismissed] = useState(() => { try { return localStorage.getItem("ffw_ios_push_hint_dismissed") === "1"; } catch (e) { return false; } });
  function dismissIosHint() { setIosHintDismissed(true); try { localStorage.setItem("ffw_ios_push_hint_dismissed", "1"); } catch (e) {} }
  const showIosPushHint = isIOSDevice && !isStandaloneApp && !iosHintDismissed;

  const fontImport = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
      * { box-sizing: border-box; } html, body { margin: 0; overscroll-behavior-y: contain; }
      @media print {
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 20px; }
      }
      button { font-family: inherit; cursor: pointer; }
      input, textarea, select { font-family: inherit; }
      .card-enter { animation: slideIn 0.22s ease-out; }
      @keyframes slideIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .card-enter { animation: none; } }
      button:focus-visible, input:focus-visible { outline: 2px solid #C1272D; outline-offset: 2px; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
    `}</style>
  );

  if (phase === "loading") return <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>{fontImport}<Flame size={26} color="#C1272D" /></div>;

  if (phase === "gate") {
    return (
      <div style={styles.gatePage}>{fontImport}
        <div style={styles.gateCard} className="card-enter">
          <div style={styles.gateBrand}><Flame size={16} color="#C1272D" /> {APP_NAME.toUpperCase()}</div>
          {config ? <Lock size={24} color="#C1272D" style={{ marginBottom: 10 }} /> : <ShieldCheck size={24} color="#C1272D" style={{ marginBottom: 10 }} />}
          <div style={styles.gateTitle}>{config ? "Zugangscode eingeben" : "App einrichten"}</div>
          <div style={styles.gateSub}>{config ? "Diesen Code hast du von deinem Kommandanten erhalten." : "Noch nicht eingerichtet. Lege einen Code fest, trag dich als Admin ein und vergib deine persönliche PIN."}</div>
          <input style={styles.gateInput} type="text" placeholder="Zugangscode" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitGate()} autoFocus />
          {!config && (<>
            <input style={{ ...styles.gateInput, marginTop: 8 }} type="text" placeholder="Dein Name (Admin)" value={adminNameInput} onChange={(e) => setAdminNameInput(e.target.value)} />
            <input style={{ ...styles.gateInput, marginTop: 8 }} type="text" inputMode="numeric" maxLength={4} placeholder="Deine PIN (4 Ziffern)" value={adminPinInput} onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && submitGate()} />
          </>)}
          {gateError && <div style={styles.errorText}>{gateError}</div>}
          <button style={styles.gateBtn} onClick={submitGate} disabled={gateBusy}>{gateBusy ? "Speichert …" : (config ? "Bestätigen" : "Einrichten")} {!gateBusy && <ChevronRight size={16} />}</button>
        </div>
      </div>
    );
  }

  if (phase === "name") {
    return (
      <div style={styles.gatePage}>{fontImport}
        <div style={styles.gateCard} className="card-enter">
          <User size={24} color="#C1272D" style={{ marginBottom: 10 }} />
          <div style={styles.gateTitle}>Wer bist du?</div>
          <div style={styles.gateSub}>{me ? "Wähle deinen Namen — du brauchst danach deine persönliche PIN." : "Wähle deinen Namen aus der Liste oder trage ihn neu ein — du brauchst danach deine persönliche PIN."}</div>
          {roster.length > 5 && <SearchBox value={loginSearch} onChange={setLoginSearch} placeholder="Name suchen …" />}
          {roster.length > 0 && (
            <div style={styles.rosterList}>
              {roster.filter((r) => matchesSearch(r.name, loginSearch)).map((r) => (
                <button key={r.name} style={styles.rosterItem} onClick={() => pickRosterEntry(r)}>
                  <span>{r.name} {config && config.adminNames && config.adminNames.includes(r.name) && <span style={styles.adminTag}>Admin</span>}</span>
                  <KeyRound size={13} color="#B8BCB6" />
                </button>
              ))}
            </div>
          )}
          {!me && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, width: "100%" }}>
              <input style={{ ...styles.gateInput, marginTop: 0, flex: 1 }} type="text" placeholder="Neuer Name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startNewName()} />
              <button style={{ ...styles.gateBtn, marginTop: 0, width: "auto", padding: "0 16px" }} onClick={startNewName}>OK</button>
            </div>
          )}
          {me && (
            <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 12 }}>Fehlt jemand? Nur der Admin kann in den Einstellungen neue Mitglieder anlegen lassen.</div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "pinEntry") {
    return (
      <div style={styles.gatePage}>{fontImport}
        <div style={styles.gateCard} className="card-enter">
          <KeyRound size={24} color="#C1272D" style={{ marginBottom: 10 }} />
          <div style={styles.gateTitle}>PIN von {pendingName}</div>
          <div style={styles.gateSub}>Bitte deine persönliche 4-stellige PIN eingeben.</div>
          <input style={{ ...styles.gateInput, letterSpacing: "0.5em", textAlign: "center" }} type="password" inputMode="numeric" maxLength={4} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && submitPinEntry()} autoFocus />
          {pinError && <div style={styles.errorText}>{pinError}</div>}
          <button style={styles.gateBtn} onClick={submitPinEntry} disabled={pinBusy}>{pinBusy ? "Prüfe …" : <>Anmelden <ChevronRight size={16} /></>}</button>
          <button style={styles.backLink} onClick={() => setPhase("name")}><ArrowLeft size={13} /> Zurück zur Namensliste</button>
        </div>
      </div>
    );
  }

  if (phase === "pinSetup") {
    const isNew = !roster.some((r) => r.name === pendingName);
    return (
      <div style={styles.gatePage}>{fontImport}
        <div style={styles.gateCard} className="card-enter">
          <KeyRound size={24} color="#C1272D" style={{ marginBottom: 10 }} />
          <div style={styles.gateTitle}>{isNew ? `PIN für ${pendingName} festlegen` : `Neue PIN für ${pendingName}`}</div>
          <div style={styles.gateSub}>Merk dir diese PIN gut — nur damit kannst du dich künftig als {pendingName} anmelden.</div>
          <input style={{ ...styles.gateInput, letterSpacing: "0.5em", textAlign: "center" }} type="password" inputMode="numeric" maxLength={4} placeholder="PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} autoFocus />
          <input style={{ ...styles.gateInput, letterSpacing: "0.5em", textAlign: "center", marginTop: 8 }} type="password" inputMode="numeric" maxLength={4} placeholder="PIN bestätigen" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && submitPinSetup()} />
          {pinError && <div style={styles.errorText}>{pinError}</div>}
          <button style={styles.gateBtn} onClick={submitPinSetup} disabled={pinBusy}>{pinBusy ? "Speichert …" : <>PIN speichern <ChevronRight size={16} /></>}</button>
          <button style={styles.backLink} onClick={() => setPhase("name")}><ArrowLeft size={13} /> Zurück zur Namensliste</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {fontImport}
      {saveBanner && <div style={styles.errorBanner}><AlertTriangle size={14} /> {saveBanner.text}</div>}

      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerBrand}>
            <Flame size={20} color="#C1272D" strokeWidth={2.4} />
            <div><div style={styles.headerBrandText}>{APP_NAME.toUpperCase()}</div><div style={styles.headerBrandSub}>Terminplan</div></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={styles.settingsBtn} onClick={manualRefresh} aria-label="Aktualisieren"><RefreshCw size={17} color="#8FA0A6" style={{ animation: manualRefreshing ? "spin 0.6s linear" : "none" }} /></button>
            <button style={styles.settingsBtn} onClick={() => subscribeToPush()} aria-label="Benachrichtigungen">
              <Bell size={17} color={typeof Notification !== "undefined" && Notification.permission === "granted" ? "#E8A33D" : "#8FA0A6"} />
            </button>
            {me && (
              <button style={{ ...styles.settingsBtn, position: "relative" }} onClick={() => setShowTileMenu(true)} aria-label="Funktionen">
                <LayoutGrid size={18} color="#8FA0A6" />
                {neueSitzungenCount > 0 && <span style={styles.tileHeaderDot} />}
              </button>
            )}
            {isAdmin && <button style={styles.settingsBtn} onClick={() => { setKachelReturnTo("calendar"); setShowSettings(true); }} aria-label="Einstellungen"><Settings size={18} color="#8FA0A6" /></button>}
          </div>
        </div>
        <div style={styles.headerMe}>
          <User size={12} /> Angemeldet als <strong>{me}</strong>
          {isAdmin && <span style={styles.adminTagHeader}>Admin</span>}
          <button style={styles.switchLink} onClick={() => setPhase("name")}>wechseln</button>
          <button style={styles.switchLink} onClick={logout}>abmelden</button>
        </div>
        {myBereiche.length > 0 && (
          <div style={styles.bereichRow}>
            {myBereiche.map((b) => {
              const active = effectiveBereiche.includes(b);
              return (
                <button key={b} onClick={() => toggleBereichFilter(b)} style={{ ...styles.bereichChip, opacity: active ? 1 : 0.4, borderColor: active ? BEREICHE[b].color : "#3A3F3B" }}>
                  <BereichIcon bereich={b} size={14} /> {BEREICHE[b].short}
                </button>
              );
            })}
          </div>
        )}
        {showIosPushHint && (
          <div style={styles.iosHintBanner}>
            <span>Für Push-Benachrichtigungen: Seite über "Teilen" → "Zum Home-Bildschirm" hinzufügen, dann die App von dort aus öffnen.</span>
            <button style={styles.iosHintClose} onClick={dismissIosHint} aria-label="Schließen"><X size={13} color="#8FA0A6" /></button>
          </div>
        )}
      </header>

      {(myReminders.length > 0 || incomingFsRequests.length > 0 || incomingVehicleRequests.length > 0 || anmeldeschlussReminders.length > 0) && (
        <div style={styles.remindersSection}>
          {incomingFsRequests.map((req) => (
            <div key={`${req.name}-${req.type}`} style={styles.reminderCard} className="card-enter">
              {req.type === "pkw" ? <Car size={16} color="#4A6670" style={{ flexShrink: 0, marginTop: 1 }} /> : <Truck size={16} color="#4A6670" style={{ flexShrink: 0, marginTop: 1 }} />}
              <div style={{ flex: 1 }}><div style={styles.reminderText}>{req.name} bittet dich, den {req.type.toUpperCase()}-Führerschein zu bestätigen.</div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button style={styles.tinyBtnPrimary} onClick={() => confirmFuehrerschein(req.name, req.type)}>Bestätigen</button>
                <button style={styles.tinyBtn} onClick={() => reportFuehrerscheinProblem(req.name, req.type)}>Nicht gültig/vorhanden</button>
              </div>
            </div>
          ))}
          {incomingVehicleRequests.map((req) => (
            <div key={`veh-${req.name}-${req.vehicleId}`} style={styles.reminderCard} className="card-enter">
              <Truck size={16} color="#4A6670" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}><div style={styles.reminderText}>{req.name} bittet dich, die Einweisung für "{req.vehicleName}" zu bestätigen.</div></div>
              <button style={styles.tinyBtnPrimary} onClick={() => confirmVehicleInstruction(req.name, req.vehicleId)}>Bestätigen</button>
            </div>
          ))}
          {myReminders.map((r) => (
            <div key={r.key} style={styles.reminderCard} className="card-enter">
              <AlertTriangle size={16} color="#B8791A" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, cursor: r.target ? "pointer" : "default" }} onClick={() => { if (r.target) { setKachelReturnTo("calendar"); setShowKontrollen(r.target); } }}>
                <div style={styles.reminderText}>{r.text}</div>
                {r.doctor && config && (config.doctorName || config.doctorAddress || config.doctorPhone) && (
                  <div style={styles.reminderDoctor}>{config.doctorName} {config.doctorAddress && `· ${config.doctorAddress}`} {config.doctorPhone && `· Tel. ${config.doctorPhone}`}</div>
                )}
              </div>
              <button style={styles.reminderOk} onClick={() => setDismissedReminders({ ...dismissedReminders, [r.key]: true })}>OK</button>
            </div>
          ))}
          {anmeldeschlussReminders.map((r) => (
            <div key={r.key} style={styles.reminderCard} className="card-enter">
              <AlertTriangle size={16} color="#B8791A" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}><div style={styles.reminderText}>{r.text}</div></div>
              <button style={styles.reminderOk} onClick={() => setDismissedReminders({ ...dismissedReminders, [r.key]: true })}>OK</button>
            </div>
          ))}
        </div>
      )}

      {(activeNotices.length > 0 || editableNewsBereiche.length > 0) && (
        <div style={styles.noticesSection}>
          <div style={styles.sectionLabelRow}>
            <div style={styles.sectionLabel}><Megaphone size={13} /><span>SCHWARZES BRETT</span></div>
            {editableNewsBereiche.length > 0 && <button style={styles.smallAddBtn} onClick={openNewNotice}><Plus size={13} /> Neu</button>}
          </div>
          {activeNotices.length === 0 && <div style={styles.noNotices}>Keine aktuellen Mitteilungen.</div>}
          {activeNotices.map((n) => {
            const p = PRIORITIES[n.priority]; const daysLeft = daysUntil(n.expiryDate);
            return (
              <div key={n.id} className="card-enter" style={{ ...styles.noticeCard, borderLeftColor: p.color, background: p.bg }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ ...styles.noticeBadge, background: p.color }}>{p.label}</span>
                    {myBereiche.length > 1 && <span style={styles.miniBereichTag}><BereichIcon bereich={n.bereich} size={11} /> {BEREICHE[n.bereich].short}</span>}
                    <span style={styles.noticeExpiry}>{daysLeft === 0 ? "läuft heute ab" : `noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"}`}</span>
                  </div>
                  <div style={styles.noticeText}>{n.text}</div>
                </div>
                {canEditNewsFor(n.bereich) && (
                  <div style={{ display: "flex", gap: 2 }}>
                    <button style={styles.editBtn} onClick={() => openEditNotice(n)} aria-label="Bearbeiten"><Pencil size={14} color="#8A8C86" /></button>
                    <button style={styles.editBtn} onClick={() => setConfirmDeleteNoticeId(n.id)} aria-label="Löschen"><Trash2 size={14} color="#8A8C86" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {nextEvent && (
        <div style={styles.hero}>
          <div style={styles.heroLabel}><Bell size={13} /><span>NÄCHSTER TERMIN</span></div>
          <HeroCard ev={nextEvent} me={me} onRespond={setResponse} onSignup={toggleSignup} onSetGuests={setMyGuestCount} showBereich={myBereiche.length > 1} badgeLabel={eventBadgeLabel(nextEvent)} />
        </div>
      )}

      {canSeeAusschuss && upcomingSitzungenTeaser.length > 0 && (
        <div style={styles.teaserSection}>
          {upcomingSitzungenTeaser.map((s) => (
            <button key={s.id} style={styles.teaserCard} onClick={() => { setKachelReturnTo("calendar"); setShowSitzungen(true); setExpandedSitzung(s.id); setSeenSitzungIds(new Set(sitzungen.map((x) => x.id))); }}>
              <Landmark size={15} color="#7A3B9E" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2F2A" }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#8A8C86" }}>{fmtDate(s.date)} · {s.time} Uhr — Ausschusssitzung</div>
              </div>
              <ChevronRight size={15} color="#A5A79F" />
            </button>
          ))}
        </div>
      )}

      <div style={styles.tabRow}>
        <TabBtn active={filter === "alle"} onClick={() => setFilter("alle")} label="Alle" />
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <TabBtn key={key} active={filter === key} onClick={() => { setFilter(key); setSeenCategories({ ...seenCategories, [key]: true }); }} label={cat.label} color={cat.color} dot={categoryDots[key]} />
        ))}
      </div>

      <main style={styles.main}>
        {filtered.length === 0 && (
          <div style={styles.emptyState}>
            <Flame size={28} color="#C7C4BC" style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 600, color: "#3A3D38", marginBottom: 4 }}>Keine Termine</div>
            <div style={{ fontSize: 13, color: "#8A8C86" }}>{filter === "alle" ? (editableCalendarBereiche.length > 0 ? "Leg den ersten Termin an." : "Noch keine Termine eingetragen.") : "Kein Termin in dieser Kategorie."}</div>
          </div>
        )}
        {Object.entries(grouped).map(([monthYear, evs]) => (
          <div key={monthYear} style={{ marginBottom: 22 }}>
            <div style={styles.monthLabel}>{monthYear}</div>
            {evs.map((ev) => (
              <EventCard key={ev.id} ev={ev} me={me} canEdit={canEditCalendarFor(ev.bereich)} expanded={expandedEvent === ev.id} onToggleExpand={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)} onRespond={setResponse} onSignup={toggleSignup} onSetGuests={setMyGuestCount} onEdit={() => openEdit(ev)} showBereich={myBereiche.length > 1} badgeLabel={eventBadgeLabel(ev)} roster={roster} onToggleAttendance={toggleAttendance} />
            ))}
          </div>
        ))}

        {archivedEvents.length > 0 && (
          <div style={{ marginTop: 8, marginBottom: 20 }}>
            <button style={styles.advancedToggle} onClick={() => setShowEventArchiv(!showEventArchiv)}>
              <ChevronDown size={13} style={{ transform: showEventArchiv ? "rotate(180deg)" : "none" }} /> Archiv ({archivedEvents.length})
            </button>
            {showEventArchiv && Object.entries(archivedGrouped).map(([monthYear, evs]) => (
              <div key={monthYear} style={{ marginBottom: 22, marginTop: 12 }}>
                <div style={styles.monthLabel}>{monthYear}</div>
                {evs.map((ev) => (
                  <EventCard key={ev.id} ev={ev} me={me} canEdit={canEditCalendarFor(ev.bereich)} expanded={expandedEvent === ev.id} onToggleExpand={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)} onRespond={setResponse} onSignup={toggleSignup} onSetGuests={setMyGuestCount} onEdit={() => openEdit(ev)} showBereich={myBereiche.length > 1} badgeLabel={null} roster={roster} onToggleAttendance={toggleAttendance} isArchived />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {editableCalendarBereiche.length > 0 && <button style={styles.fab} onClick={openNew} aria-label="Neuen Termin anlegen"><Plus size={24} color="white" strokeWidth={2.5} /></button>}

      {showForm && (
        <div style={styles.modalBackdrop} onClick={() => setShowForm(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()} className="card-enter">
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>{draft.id ? "Termin bearbeiten" : "Neuer Termin"}</span>
              <button style={styles.iconBtn} onClick={() => setShowForm(false)}><X size={20} color="#5C5F58" /></button>
            </div>
            <div style={styles.formBody}>
              {editableCalendarBereiche.length > 1 && (<>
                <label style={styles.label}>Bereich</label>
                <div style={styles.categoryPicker}>
                  {editableCalendarBereiche.map((b) => (
                    <button key={b} type="button" onClick={() => setDraft({ ...draft, bereich: b, time: !draft.id ? (b === "jugendfeuerwehr" ? "18:00" : "20:00") : draft.time })} style={{ ...styles.categoryChip, background: draft.bereich === b ? BEREICHE[b].color : "#F3F1EC", color: draft.bereich === b ? "white" : "#5C5F58", borderColor: draft.bereich === b ? BEREICHE[b].color : "#E2DFD6" }}>{BEREICHE[b].label}</button>
                  ))}
                </div>
              </>)}
              <label style={styles.label}>Titel</label>
              <input style={styles.input} placeholder="z. B. Atemschutzübung" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label style={styles.label}>Datum</label><input style={styles.input} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
                <div style={{ width: 110 }}><label style={styles.label}>Uhrzeit</label><input style={styles.input} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></div>
              </div>
              <label style={styles.label}>Ort</label>
              <input style={styles.input} placeholder="z. B. Feuerwehrhaus" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              <label style={styles.label}>Kategorie</label>
              <div style={styles.categoryPicker}>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <button key={key} type="button" onClick={() => setDraft({ ...draft, category: key, capacityMode: CAPACITY_DEFAULT_CATEGORIES.includes(key) ? true : draft.capacityMode })} style={{ ...styles.categoryChip, background: draft.category === key ? cat.color : "#F3F1EC", color: draft.category === key ? "white" : "#5C5F58", borderColor: draft.category === key ? cat.color : "#E2DFD6" }}>{cat.label}</button>
                ))}
              </div>
              <div style={styles.capacityBox}>
                <label style={styles.checkboxRow}><input type="checkbox" checked={draft.capacityMode} onChange={(e) => setDraft({ ...draft, capacityMode: e.target.checked })} /><span><Users size={13} style={{ verticalAlign: -2 }} /> Personenbedarf statt Zusage/Absage</span></label>
                {draft.capacityMode && (
                  <div style={{ marginTop: 10 }}>
                    <label style={styles.label}>Benötigte Personen</label>
                    <input style={{ ...styles.input, width: 90 }} type="number" min="1" value={draft.capacityNeeded} onChange={(e) => { const v = e.target.value; setDraft({ ...draft, capacityNeeded: v === "" ? "" : parseInt(v) || "" }); }} onBlur={(e) => { if (!e.target.value) setDraft({ ...draft, capacityNeeded: 1 }); }} />
                    {!["wettkampfgruppe", "atemschutz"].includes(draft.bereich) && (
                      <label style={{ ...styles.checkboxRow, marginTop: 10 }}><input type="checkbox" checked={draft.namesVisible} onChange={(e) => setDraft({ ...draft, namesVisible: e.target.checked })} /><span>{draft.namesVisible ? <Eye size={13} style={{ verticalAlign: -2 }} /> : <EyeOff size={13} style={{ verticalAlign: -2 }} />} Namen für alle sichtbar</span></label>
                    )}
                  </div>
                )}
              </div>

              {draft.category === "sonstiges" && (
                <div style={styles.capacityBox}>
                  <label style={styles.label}>Anmeldeschluss (optional)</label>
                  <input style={styles.input} type="date" value={draft.anmeldeschluss || ""} onChange={(e) => setDraft({ ...draft, anmeldeschluss: e.target.value })} />
                  {draft.anmeldeschluss && (
                    <>
                      <label style={{ ...styles.label, marginTop: 10 }}>Erinnerung wie viele Tage vorher?</label>
                      <input style={{ ...styles.input, width: 90 }} type="number" min="0" value={draft.anmeldeschlussReminderDays} onChange={(e) => { const v = e.target.value; setDraft({ ...draft, anmeldeschlussReminderDays: v === "" ? "" : parseInt(v) || "" }); }} onBlur={(e) => { if (!e.target.value) setDraft({ ...draft, anmeldeschlussReminderDays: 3 }); }} />
                    </>
                  )}
                  <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 6 }}>Nach dem Anmeldeschluss ist Zu-/Absage für alle gesperrt. Kann hier jederzeit geändert werden.</div>
                </div>
              )}

              {draft.bereich === "einsatzabteilung" && GRUPPENFUEHRER_CATEGORIES.includes(draft.category) && (
                <div style={{ marginTop: 12 }}>
                  <label style={styles.label}><UserCog size={13} style={{ verticalAlign: -2 }} /> Gruppenführer</label>
                  <select style={styles.input} value={draft.gruppenfuehrer || ""} onChange={(e) => setDraft({ ...draft, gruppenfuehrer: e.target.value })}>
                    <option value="">— nicht festgelegt —</option>
                    {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && r.gruppenfuehrer).map((r) => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label style={styles.label}>Notizen (optional)</label>
              <textarea style={{ ...styles.input, minHeight: 64, resize: "vertical" }} placeholder="Mitzubringende Ausrüstung …" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              {formError && <div style={styles.errorText}>{formError}</div>}
              <div style={styles.formActions}>
                {draft.id && <button style={styles.deleteBtn} onClick={() => setConfirmDeleteEventId(draft.id)}><Trash2 size={15} /> Löschen</button>}
                <button style={styles.saveBtn} onClick={saveDraft}>{draft.id ? "Speichern" : "Termin anlegen"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoticeForm && (
        <div style={styles.modalBackdrop} onClick={() => setShowNoticeForm(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()} className="card-enter">
            <div style={styles.modalHeader}><span style={styles.modalTitle}>{noticeDraft.id ? "Mitteilung bearbeiten" : "Neue Mitteilung"}</span><button style={styles.iconBtn} onClick={() => setShowNoticeForm(false)}><X size={20} color="#5C5F58" /></button></div>
            <div style={styles.formBody}>
              {editableNewsBereiche.length > 1 && (<>
                <label style={styles.label}>Bereich</label>
                <div style={styles.categoryPicker}>
                  {editableNewsBereiche.map((b) => (
                    <button key={b} type="button" onClick={() => setNoticeDraft({ ...noticeDraft, bereich: b })} style={{ ...styles.categoryChip, background: noticeDraft.bereich === b ? BEREICHE[b].color : "#F3F1EC", color: noticeDraft.bereich === b ? "white" : "#5C5F58", borderColor: noticeDraft.bereich === b ? BEREICHE[b].color : "#E2DFD6" }}>{BEREICHE[b].label}</button>
                  ))}
                </div>
              </>)}
              <label style={styles.label}>Text</label>
              <textarea style={{ ...styles.input, minHeight: 72, resize: "vertical" }} placeholder="z. B. Neue Schutzausrüstung im Lager, bitte abholen" value={noticeDraft.text} onChange={(e) => setNoticeDraft({ ...noticeDraft, text: e.target.value })} />
              <label style={styles.label}>Wichtigkeit</label>
              <div style={styles.categoryPicker}>
                {Object.entries(PRIORITIES).map(([key, p]) => (
                  <button key={key} type="button" onClick={() => setNoticeDraft({ ...noticeDraft, priority: key })} style={{ ...styles.categoryChip, background: noticeDraft.priority === key ? p.color : "#F3F1EC", color: noticeDraft.priority === key ? "white" : "#5C5F58", borderColor: noticeDraft.priority === key ? p.color : "#E2DFD6" }}>{p.label}</button>
                ))}
              </div>
              <label style={styles.label}>Läuft ab am</label>
              <input style={styles.input} type="date" value={noticeDraft.expiryDate} onChange={(e) => setNoticeDraft({ ...noticeDraft, expiryDate: e.target.value })} />
              {noticeError && <div style={styles.errorText}>{noticeError}</div>}
              <div style={styles.formActions}><button style={styles.saveBtn} onClick={saveNoticeDraft}>{noticeDraft.id ? "Speichern" : "Mitteilung veröffentlichen"}</button></div>
            </div>
          </div>
        </div>
      )}

      {showTileMenu && (
        <div style={styles.fullscreenPage}>
          <div style={styles.fullscreenHeader}>
            <button style={styles.fullscreenBackBtn} onClick={() => setShowTileMenu(false)}><ArrowLeft size={18} /> Kalender</button>
          </div>
          <div style={styles.modalTitle}>Funktionen</div>
          <div style={{ ...styles.tileGrid, marginTop: 14 }}>
            {(inEinsatzabteilung || isAdmin) && (
              <button style={styles.tile} onClick={openTileFuehrerschein}>
                <Car size={26} color="#B8791A" />
                <span style={styles.tileLabel}>Führerschein</span>
              </button>
            )}
            {(isAtemschutz) && (
              <button style={styles.tile} onClick={openTileAtemschutz}>
                <Stethoscope size={26} color="#B8791A" />
                <span style={styles.tileLabel}>Atemschutz</span>
              </button>
            )}
            {canSeeAusschuss && (
              <button style={{ ...styles.tile, position: "relative" }} onClick={openTileAusschuss}>
                <Landmark size={26} color="#B8791A" />
                <span style={styles.tileLabel}>Ausschuss</span>
                {neueSitzungenCount > 0 && <span style={styles.tileBadge}>{neueSitzungenCount}</span>}
              </button>
            )}
            <button style={styles.tile} onClick={openTilePersonalakte}>
              <FolderOpen size={26} color="#B8791A" />
              <span style={styles.tileLabel}>Personalakte</span>
            </button>
            {isAdmin && (
              <button style={styles.tile} onClick={openTileSettings}>
                <Settings size={26} color="#B8791A" />
                <span style={styles.tileLabel}>Einstellungen</span>
              </button>
            )}
            <div style={styles.tilePlaceholder}>
              <Plus size={20} color="#A5A79F" />
              <span style={{ fontSize: 11, color: "#8A8C86" }}>bald mehr</span>
            </div>
          </div>
        </div>
      )}

      {showKontrollen && (
        <div style={styles.fullscreenPage}>
          <div style={styles.fullscreenHeader}>
            <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
          </div>
          <div style={styles.modalTitle}>{showKontrollen === "fuehrerschein" ? "Führerschein" : "Atemschutz"}</div>
          <div style={{ marginTop: 14 }}>

            {showKontrollen === "fuehrerschein" && (
              <div>
                {myEntry && inEinsatzabteilung && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine Führerscheine</div>
                    {["pkw", "lkw"].map((type) => {
                      const data = myEntry.fuehrerschein[type];
                      const ok = !data.hasLicense || data.confirmedYear === currentYear();
                      return (
                        <div key={type} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                              {type === "pkw" ? <Car size={13} /> : <Truck size={13} />} {type.toUpperCase()}: {!data.hasLicense ? <span style={{ color: "#8A8C86" }}>keiner</span> : ok ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>bestätigt ({data.confirmedBy})</span> : data.problemReported ? <span style={{ color: "#C1272D", fontWeight: 600 }}>Problem gemeldet</span> : data.confirmRequestTo ? <span style={{ color: "#4A6670", fontWeight: 600 }}>Anfrage an {data.confirmRequestTo}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}
                            </div>
                            <button style={styles.tinyBtn} onClick={() => toggleHasLicense(me, type)}>{data.hasLicense ? "kein " + type.toUpperCase() : "hat " + type.toUpperCase()}</button>
                          </div>
                          {type === "lkw" && data.hasLicense && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                              <span style={{ fontSize: 11.5, color: "#5C5F58" }}>Gültig bis:</span>
                              <input key={`lkwab-${data.ablaufDatum || ""}`} style={{ ...styles.input, width: 145, padding: "5px 8px", fontSize: 12 }} type="date" defaultValue={data.ablaufDatum || ""} onBlur={(e) => { if (e.target.value !== (data.ablaufDatum || "")) setLkwAblauf(me, e.target.value); }} />
                              {data.ablaufDatum && daysUntil(data.ablaufDatum) < 0 && <span style={{ fontSize: 11, color: "#C1272D", fontWeight: 700 }}>abgelaufen</span>}
                            </div>
                          )}
                          {data.problemReported && (
                            <div style={styles.problemBanner}>
                              <AlertTriangle size={13} color="#C1272D" style={{ flexShrink: 0 }} />
                              <span>{data.problemReportedBy} hat gemeldet: nicht vorhanden/nicht gültig. Bitte mit dem Admin klären.</span>
                              <button style={styles.tinyBtn} onClick={() => dismissFuehrerscheinProblem(type)}>OK</button>
                            </div>
                          )}
                          {data.hasLicense && !ok && !data.problemReported && (
                            data.confirmRequestTo ? (
                              <button style={{ ...styles.tinyBtn, marginTop: 4 }} onClick={() => cancelFuehrerscheinRequest(type)}>Anfrage zurückziehen</button>
                            ) : (
                              <button style={{ ...styles.smallAddBtn, marginTop: 4 }} onClick={() => { setConfirmTargetType(type); setConfirmTargetSearch(""); }}><Search size={12} /> Kameraden zur Bestätigung auswählen</button>
                            )
                          )}
                          {confirmTargetType === type && (
                            <div style={{ marginTop: 6, background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: 8 }}>
                              <SearchBox value={confirmTargetSearch} onChange={setConfirmTargetSearch} placeholder="Name suchen …" />
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                                {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && r.name !== me && matchesSearch(r.name, confirmTargetSearch)).map((r) => (
                                  <button key={r.name} style={styles.rosterItem} onClick={() => requestFuehrerscheinConfirmation(type, r.name)}>{r.name}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {myEntry && inEinsatzabteilung && myRelevantVehicles.length > 0 && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine Fahrzeugeinweisungen</div>
                    {myRelevantVehicles.map((v) => {
                      const status = getVehicleStatus(myEntry, v.id);
                      const eingewiesen = !!status.confirmedBy;
                      return (
                        <div key={v.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                              <Truck size={13} /> {v.name}: {eingewiesen ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>eingewiesen ({status.confirmedBy})</span> : status.confirmRequestTo ? <span style={{ color: "#4A6670", fontWeight: 600 }}>Anfrage an {status.confirmRequestTo}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}
                            </div>
                          </div>
                          {!eingewiesen && (
                            status.confirmRequestTo ? (
                              <button style={{ ...styles.tinyBtn, marginTop: 4 }} onClick={() => cancelVehicleRequest(v.id)}>Anfrage zurückziehen</button>
                            ) : (
                              <button style={{ ...styles.smallAddBtn, marginTop: 4 }} onClick={() => { setConfirmVehicleTarget(v.id); setConfirmVehicleSearch(""); }}><Search size={12} /> Kameraden zur Bestätigung auswählen</button>
                            )
                          )}
                          {confirmVehicleTarget === v.id && (
                            <div style={{ marginTop: 6, background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: 8 }}>
                              <SearchBox value={confirmVehicleSearch} onChange={setConfirmVehicleSearch} placeholder="Name suchen …" />
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                                {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && r.name !== me && matchesSearch(r.name, confirmVehicleSearch)).map((r) => (
                                  <button key={r.name} style={styles.rosterItem} onClick={() => requestVehicleConfirmation(v.id, r.name)}>{r.name}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  <>
                    <button style={styles.exportBtn} onClick={exportFuehrerschein}><Download size={14} /> Als Excel-Liste exportieren</button>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ADMIN-ÜBERSICHT EINSATZABTEILUNG</div>
                    {roster.filter((r) => r.bereiche.includes("einsatzabteilung")).map((r) => (
                      <div key={r.name} style={styles.kontrollRow}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{r.name}</div>
                        <FuehrerscheinLine label="PKW" icon={<Car size={13} />} data={r.fuehrerschein.pkw} isSelf={r.name === me} onConfirm={() => confirmFuehrerschein(r.name, "pkw")} onToggleHas={() => toggleHasLicense(r.name, "pkw")} />
                        <FuehrerscheinLine label="LKW" icon={<Truck size={13} />} data={r.fuehrerschein.lkw} isSelf={r.name === me} onConfirm={() => confirmFuehrerschein(r.name, "lkw")} onToggleHas={() => toggleHasLicense(r.name, "lkw")} />
                        {r.fuehrerschein.lkw.hasLicense && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11.5, color: "#5C5F58" }}>LKW gültig bis:</span>
                            <input key={`lkwab-${r.name}-${r.fuehrerschein.lkw.ablaufDatum || ""}`} style={{ ...styles.input, width: 140, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.fuehrerschein.lkw.ablaufDatum || ""} onBlur={(e) => { if (e.target.value !== (r.fuehrerschein.lkw.ablaufDatum || "")) setLkwAblauf(r.name, e.target.value); }} />
                            {r.fuehrerschein.lkw.ablaufDatum && daysUntil(r.fuehrerschein.lkw.ablaufDatum) < 0 && <span style={{ fontSize: 11, color: "#C1272D", fontWeight: 700 }}>abgelaufen</span>}
                            {r.fuehrerschein.lkw.ablaufDatum && daysUntil(r.fuehrerschein.lkw.ablaufDatum) >= 0 && daysUntil(r.fuehrerschein.lkw.ablaufDatum) <= 122 && <span style={{ fontSize: 11, color: "#B8791A", fontWeight: 700 }}>läuft bald ab</span>}
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "16px 0 6px", letterSpacing: "0.04em" }}>FAHRZEUGE VERWALTEN</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input style={{ ...styles.input, flex: 1 }} placeholder="Neues Fahrzeug (z. B. LF 20)" value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newVehicleName.trim()) { addVehicle(newVehicleName, newVehicleType); setNewVehicleName(""); } }} />
                      <select style={{ ...styles.input, width: 88 }} value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)}>
                        <option value="pkw">PKW</option>
                        <option value="lkw">LKW</option>
                      </select>
                      <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => { if (newVehicleName.trim()) { addVehicle(newVehicleName, newVehicleType); setNewVehicleName(""); } }}><Plus size={16} /></button>
                    </div>
                    {vehicles.map((v) => (
                      <div key={v.id} style={styles.kontrollRow}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          {editVehicleId === v.id ? (
                            <div style={{ display: "flex", gap: 6, flex: 1 }}>
                              <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 13 }} value={editVehicleName} onChange={(e) => setEditVehicleName(e.target.value)} autoFocus />
                              <select style={{ ...styles.input, width: 80, padding: "6px 9px", fontSize: 13 }} value={editVehicleType} onChange={(e) => setEditVehicleType(e.target.value)}>
                                <option value="pkw">PKW</option>
                                <option value="lkw">LKW</option>
                              </select>
                              <button style={styles.tinyBtnPrimary} onClick={() => { if (editVehicleName.trim()) { renameVehicle(v.id, editVehicleName.trim(), editVehicleType); setEditVehicleId(null); } }}><Check size={13} /></button>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.name} <span style={{ fontSize: 10, fontWeight: 700, color: "#8A8C86" }}>({v.type === "lkw" ? "LKW" : "PKW"})</span></div>
                          )}
                          <div style={{ display: "flex", gap: 4 }}>
                            {editVehicleId !== v.id && <button style={styles.rosterRemoveBtn} onClick={() => { setEditVehicleId(v.id); setEditVehicleName(v.name); setEditVehicleType(v.type || "pkw"); }}><Pencil size={13} /></button>}
                            <button style={styles.rosterRemoveBtn} onClick={() => setConfirmDeleteVehicleId(v.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && (v.type === "lkw" ? r.fuehrerschein.lkw.hasLicense : r.fuehrerschein.pkw.hasLicense)).map((r) => {
                          const status = getVehicleStatus(r, v.id);
                          return (
                            <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: status.confirmedBy ? "#1F6F5C" : "#8A8C86", marginBottom: 2 }}>
                              <span>{r.name}: {status.confirmedBy ? `eingewiesen (${status.confirmedBy}, ${fmtDate(status.confirmedDate)})` : "offen"}</span>
                              {!status.confirmedBy && <button style={styles.tinyBtn} onClick={() => confirmVehicleInstruction(r.name, v.id)}>direkt bestätigen</button>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {showKontrollen === "atemschutz" && (
              <div>
                {myEntry && myEntry.atemschutz && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine G26.3-Untersuchung</div>
                    <div style={{ fontSize: 13, color: "#5C5F58", marginBottom: 8 }}>Nächster Termin: <strong>{fmtDate(myEntry.g26.dueDate)}</strong>{myEntry.g26.pendingConfirmation && <span style={styles.pinPendingTag}> wartet auf Bestätigung</span>}</div>
                    {!g26EditOpen ? (
                      <button style={styles.smallAddBtn} onClick={() => { setG26EditOpen(true); setG26DateInput(myEntry.g26.dueDate || ""); }}><Pencil size={12} /> Neuen Termin eintragen</button>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={{ ...styles.input, flex: 1 }} type="date" value={g26DateInput} onChange={(e) => setG26DateInput(e.target.value)} />
                        <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => g26DateInput && saveG26Date(g26DateInput)}><Check size={15} /></button>
                      </div>
                    )}
                    {g26ReminderActive(myEntry) && config && (config.doctorName || config.doctorAddress || config.doctorPhone) && (
                      <div style={styles.reminderDoctor}>{config.doctorName} {config.doctorAddress && `· ${config.doctorAddress}`} {config.doctorPhone && `· Tel. ${config.doctorPhone}`}</div>
                    )}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>NACHWEIS-FOTO (nur du und Admin sehen das)</div>
                      {myEntry.g26.photoUrl ? (
                        <div>
                          <img src={myEntry.g26.photoUrl} alt="G26-Nachweis" style={{ maxWidth: 160, borderRadius: 6, border: "1px solid #E2DFD6", display: "block", marginBottom: 6, cursor: "zoom-in" }} onClick={() => setLightboxSrc(myEntry.g26.photoUrl)} />
                          <button style={styles.tinyBtn} onClick={removeG26Photo}>Foto entfernen</button>
                        </div>
                      ) : (
                        <label style={styles.smallAddBtn}>
                          {g26PhotoUploading ? "Lädt hoch …" : <><Plus size={12} /> Foto hochladen</>}
                          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) uploadG26Photo(e.target.files[0]); }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {myEntry && myEntry.atemschutz && (() => {
                  const st = atemschutzStatus(myEntry);
                  return (
                    <div style={styles.kontrollRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: st.allValid ? "#1F6F5C" : "#C1272D", flexShrink: 0 }} />
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{st.allValid ? `Einsatztauglich bis ${fmtDate(st.bis)}` : "Nicht einsatztauglich"}</div>
                      </div>
                      <div style={{ fontSize: 12, color: st.g26Valid ? "#1F6F5C" : "#C1272D", marginBottom: 8 }}>G26.3: {st.g26Valid ? "aktuell" : "abgelaufen/fehlt"}</div>

                      <div style={{ fontSize: 12, color: st.streckeValid ? "#1F6F5C" : "#C1272D", marginBottom: 4 }}>Streckendurchgang: {myEntry.streckendurchgang.date ? `${fmtDate(myEntry.streckendurchgang.date)}${st.streckeValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                        <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 12 }} type="date" defaultValue={myEntry.streckendurchgang.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== myEntry.streckendurchgang.date) setStreckendurchgang(me, e.target.value); }} />
                        {myEntry.streckendurchgang.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetStreckendurchgang(me)}><RotateCcw size={12} /></button>}
                      </div>

                      <div style={{ fontSize: 12, color: st.uebungValid ? "#1F6F5C" : "#C1272D", marginBottom: 4 }}>Übung (Container/Warmer Einsatz/Einsatznah): {myEntry.atemschutzUebung.date ? `${ATEMSCHUTZ_UEBUNG_TYPES[myEntry.atemschutzUebung.type] || ""} am ${fmtDate(myEntry.atemschutzUebung.date)}${st.uebungValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                        <select style={{ ...styles.input, width: 150, padding: "6px 9px", fontSize: 12 }} defaultValue={myEntry.atemschutzUebung.type || ""} onChange={(e) => { const type = e.target.value; if (type) setAtemschutzUebung(me, type, myEntry.atemschutzUebung.date || todayISO()); }}>
                          <option value="">— Art wählen —</option>
                          {Object.entries(ATEMSCHUTZ_UEBUNG_TYPES).map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
                        </select>
                        <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 12 }} type="date" defaultValue={myEntry.atemschutzUebung.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== myEntry.atemschutzUebung.date) setAtemschutzUebung(me, myEntry.atemschutzUebung.type || "einsatznah", e.target.value); }} />
                        {myEntry.atemschutzUebung.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUebung(me)}><RotateCcw size={12} /></button>}
                      </div>

                      <div style={{ fontSize: 12, color: st.unterweisungValid ? "#1F6F5C" : "#C1272D" }}>
                        Atemschutzunterweisung: {myEntry.atemschutzUnterweisung && myEntry.atemschutzUnterweisung.date ? `${fmtDate(myEntry.atemschutzUnterweisung.date)}${st.unterweisungValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}
                        <span style={{ fontSize: 10.5, color: "#8A8C86", display: "block", marginTop: 2 }}>(wird von Admin/Berechtigten eingetragen)</span>
                      </div>
                    </div>
                  );
                })()}

                {canEditAtemschutzUnterweisung && roster.filter((r) => r.atemschutz).length > 0 && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Atemschutzunterweisung eintragen</div>
                    {roster.filter((r) => r.atemschutz).map((r) => {
                      const u = r.atemschutzUnterweisung || {};
                      const valid = !!(u.date && daysSince(u.date) <= 365);
                      return (
                        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 110 }}>{r.name}:</span>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={u.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== u.date) setAtemschutzUnterweisung(r.name, e.target.value); }} />
                          <span style={{ fontSize: 11, color: valid ? "#1F6F5C" : "#C1272D", fontWeight: 600 }}>{u.date ? (valid ? "gültig" : "abgelaufen") : "offen"}</span>
                          {u.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUnterweisung(r.name)}><RotateCcw size={12} /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  <>
                    <button style={styles.exportBtn} onClick={exportAtemschutz}><Download size={14} /> Als Excel-Liste exportieren</button>
                    {adminPendingG26.length > 0 && (
                      <div style={styles.reminderCard}><AlertTriangle size={14} color="#B8791A" /><div style={{ fontSize: 12, color: "#5C5F58" }}>{adminPendingG26.length} Bestätigung(en) offen — bitte Nachweis zeigen lassen.</div></div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ARZT-KONTAKT PFLEGEN</div>
                    <input key={`docname-${config.doctorName}`} style={styles.input} placeholder="Name des Arztes" defaultValue={config.doctorName || ""} onBlur={(e) => { if (e.target.value !== config.doctorName) persistConfig({ ...config, doctorName: e.target.value }); }} />
                    <input key={`docaddr-${config.doctorAddress}`} style={{ ...styles.input, marginTop: 6 }} placeholder="Adresse" defaultValue={config.doctorAddress || ""} onBlur={(e) => { if (e.target.value !== config.doctorAddress) persistConfig({ ...config, doctorAddress: e.target.value }); }} />
                    <input key={`docphone-${config.doctorPhone}`} style={{ ...styles.input, marginTop: 6 }} placeholder="Telefonnummer" defaultValue={config.doctorPhone || ""} onBlur={(e) => { if (e.target.value !== config.doctorPhone) persistConfig({ ...config, doctorPhone: e.target.value }); }} />
                    <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 4 }}>Wird beim Verlassen des Feldes gespeichert.</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "16px 0 6px", letterSpacing: "0.04em" }}>ATEMSCHUTZTRÄGER ÜBERSICHT</div>
                    {roster.filter((r) => r.atemschutz).map((r) => {
                      const st = atemschutzStatus(r);
                      return (
                      <div key={r.name} style={styles.kontrollRow}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: st.allValid ? "#1F6F5C" : "#C1272D", flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: "#8A8C86" }}>{st.allValid ? `tauglich bis ${fmtDate(st.bis)}` : "nicht tauglich"}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {r.g26.pendingConfirmation && <button style={styles.tinyIconBtn} aria-label="G26 zurücksetzen" onClick={() => setConfirmResetG26Name(r.name)}><RotateCcw size={12} /></button>}
                            {r.g26.pendingConfirmation && <button style={styles.smallAddBtn} onClick={() => adminConfirmG26(r.name)}><Check size={12} /> G26 bestätigen</button>}
                          </div>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#5C5F58", marginBottom: 6 }}>G26.3: {fmtDate(r.g26.dueDate)}{r.g26.pendingConfirmation && <span style={styles.pinPendingTag}>offen</span>}</div>
                        {r.g26.photoUrl && <img src={r.g26.photoUrl} alt="Nachweis" style={{ maxWidth: 100, borderRadius: 6, border: "1px solid #E2DFD6", display: "block", marginBottom: 6, cursor: "zoom-in" }} onClick={() => setLightboxSrc(r.g26.photoUrl)} />}

                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 130 }}>Streckendurchgang:</span>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.streckendurchgang.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== r.streckendurchgang.date) setStreckendurchgang(r.name, e.target.value); }} />
                          {r.streckendurchgang.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetStreckendurchgang(r.name)}><RotateCcw size={12} /></button>}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 130 }}>Übung:</span>
                          <select style={{ ...styles.input, width: 140, padding: "5px 8px", fontSize: 11.5 }} defaultValue={r.atemschutzUebung.type || ""} onChange={(e) => { const type = e.target.value; if (type) setAtemschutzUebung(r.name, type, r.atemschutzUebung.date || todayISO()); }}>
                            <option value="">— wählen —</option>
                            {Object.entries(ATEMSCHUTZ_UEBUNG_TYPES).map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
                          </select>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.atemschutzUebung.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== r.atemschutzUebung.date) setAtemschutzUebung(r.name, r.atemschutzUebung.type || "einsatznah", e.target.value); }} />
                          {r.atemschutzUebung.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUebung(r.name)}><RotateCcw size={12} /></button>}
                        </div>
                      </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showSitzungen && (() => {
        const upcoming = sitzungen.filter((s) => s.date >= todayISO()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const past = sitzungen.filter((s) => s.date < todayISO()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        const renderSitzung = (s) => (
          <div key={s.id} style={styles.kontrollRow}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpandedSitzung(expandedSitzung === s.id ? null : s.id)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#8A8C86" }}>{fmtDate(s.date)} · {s.time} Uhr{s.location && ` · ${s.location}`}</div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {canEditSitzung && <button style={styles.rosterRemoveBtn} title="Termin bearbeiten" onClick={(e) => { e.stopPropagation(); openEditSitzung(s); }}><Pencil size={13} /></button>}
                <button style={styles.expandSitzungBtn} onClick={(e) => { e.stopPropagation(); setExpandedSitzung(expandedSitzung === s.id ? null : s.id); }}>
                  Protokoll & Anwesenheit <ChevronDown size={13} style={{ transform: expandedSitzung === s.id ? "rotate(180deg)" : "none" }} />
                </button>
              </div>
            </div>
            {expandedSitzung === s.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>ANWESENHEIT</div>
                {roster.filter((r) => r.ausschuss).map((r) => {
                  const status = (s.anwesenheit || {})[r.name];
                  return (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, color: "#2C2F2A" }}>{r.name}</span>
                      {canEditProtokoll ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => setAnwesenheit(s.id, r.name, "anwesend")} style={{ ...styles.tinyBtn, background: status === "anwesend" ? "#1F6F5C" : "#F3F1EC", color: status === "anwesend" ? "white" : "#5C5F58", borderColor: status === "anwesend" ? "#1F6F5C" : "#E2DFD6" }}>Anwesend</button>
                          <button onClick={() => setAnwesenheit(s.id, r.name, "entschuldigt")} style={{ ...styles.tinyBtn, background: status === "entschuldigt" ? "#B8791A" : "#F3F1EC", color: status === "entschuldigt" ? "white" : "#5C5F58", borderColor: status === "entschuldigt" ? "#B8791A" : "#E2DFD6" }}>Entschuldigt</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: status === "anwesend" ? "#1F6F5C" : status === "entschuldigt" ? "#B8791A" : "#A5A79F", fontWeight: 600 }}>{status === "anwesend" ? "Anwesend" : status === "entschuldigt" ? "Entschuldigt" : "—"}</span>
                      )}
                    </div>
                  );
                })}
                {roster.filter((r) => r.ausschuss).length === 0 && <div style={{ fontSize: 11.5, color: "#8A8C86" }}>Noch niemand dem Ausschuss zugeordnet.</div>}

                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px" }}>TAGESORDNUNG & PROTOKOLL</div>
                {s.tagesordnung.map((point, idx) => {
                  const ab = (s.abstimmungen || {})[idx];
                  const eligible = eligibleVoters(s);
                  const iVoted = ab && ab.votes[me];
                  const canVote = ab && ab.active && eligible.includes(me);
                  const result = ab && ab.finalized ? voteResult(ab) : null;
                  return (
                    <div key={idx} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2F2A", marginBottom: 4 }}>{idx + 1}. {point}</div>
                      {canEditProtokoll ? (
                        <textarea key={`protokoll-${s.id}-${idx}-${s.protokoll[idx] || ""}`} style={{ ...styles.input, minHeight: 50, resize: "vertical", fontSize: 12.5 }} placeholder="Protokolltext …" defaultValue={s.protokoll[idx] || ""} onBlur={(e) => { if (e.target.value !== (s.protokoll[idx] || "")) saveProtokollText(s.id, idx, e.target.value); }} />
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#5C5F58", lineHeight: 1.4 }}>{s.protokoll[idx] || <span style={{ color: "#A5A79F" }}>Noch kein Protokoll.</span>}</div>
                      )}

                      <div style={styles.voteBox}>
                        {!ab && canEditProtokoll && voteStartDraft && voteStartDraft.sitzungId === s.id && voteStartDraft.idx === idx && (
                          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <input style={{ ...styles.input, flex: 1, fontSize: 12.5 }} placeholder="Kurzer Text zur Abstimmung (optional)" value={voteStartDraft.text} onChange={(e) => setVoteStartDraft({ ...voteStartDraft, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { startAbstimmung(s.id, idx, voteStartDraft.text); setVoteStartDraft(null); } }} autoFocus />
                            <button style={{ ...styles.saveBtn, flex: "none", padding: "0 12px" }} onClick={() => { startAbstimmung(s.id, idx, voteStartDraft.text); setVoteStartDraft(null); }}><Check size={14} /></button>
                          </div>
                        )}
                        {!ab && canEditProtokoll && !(voteStartDraft && voteStartDraft.sitzungId === s.id && voteStartDraft.idx === idx) && (
                          <button style={styles.smallAddBtn} onClick={() => setVoteStartDraft({ sitzungId: s.id, idx, text: "" })}><HandHelping size={12} /> Abstimmung starten</button>
                        )}
                        {ab && ab.text && <div style={styles.voteAntrag}>„{ab.text}"</div>}
                        {ab && ab.active && (
                          <>
                            {canVote && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button style={{ ...styles.respBtnSmall, ...styles.respBtn, background: iVoted === "dafuer" ? "#1F6F5C" : "white", color: iVoted === "dafuer" ? "white" : "#1F6F5C", borderColor: "#1F6F5C" }} onClick={() => castVote(s.id, idx, "dafuer")}>Dafür</button>
                                <button style={{ ...styles.respBtnSmall, ...styles.respBtn, background: iVoted === "dagegen" ? "#C1272D" : "white", color: iVoted === "dagegen" ? "white" : "#C1272D", borderColor: "#C1272D" }} onClick={() => castVote(s.id, idx, "dagegen")}>Dagegen</button>
                              </div>
                            )}
                            {iVoted && <div style={styles.voteNote}>Du hast abgestimmt: <strong>{iVoted === "dafuer" ? "Dafür" : "Dagegen"}</strong> — kannst du noch ändern, bis alle abgestimmt haben.</div>}
                            {!eligible.includes(me) && !iVoted && <div style={styles.voteNote}>Nur anwesende Ausschussmitglieder können abstimmen.</div>}
                            {canEditProtokoll && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                <span style={styles.voteNote}>{Object.keys(ab.votes).length} von {eligible.length} Stimmen abgegeben</span>
                                <button style={styles.tinyBtn} onClick={() => finalizeAbstimmung(s.id, idx)}>Jetzt auswerten</button>
                              </div>
                            )}
                          </>
                        )}
                        {result && (
                          <div style={styles.voteResultBox}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: result.label === "angenommen" ? "#1F6F5C" : result.label === "abgelehnt" ? "#C1272D" : "#5C5F58" }}>
                              Ergebnis: {result.dafuer} dafür · {result.dagegen} dagegen — {result.label}
                            </div>
                            <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 3 }}>
                              {Object.entries(ab.votes).map(([n, v]) => `${n}: ${v === "dafuer" ? "dafür" : "dagegen"}`).join(" · ")}
                            </div>
                            {canEditProtokoll && (
                              <button style={{ ...styles.tinyBtn, marginTop: 5 }} onClick={() => setConfirmResetVote({ sitzungId: s.id, idx })}>Abstimmung zurücksetzen</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {s.links && <div style={{ fontSize: 11.5, color: "#4A6670", marginTop: 4, wordBreak: "break-all" }}>Link: {s.links}</div>}
                {(s.attachments || []).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {s.attachments.map((a, idx) => (
                      <a key={idx} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11.5, color: "#4A6670", marginBottom: 3 }}>📎 {a.name}</a>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button style={styles.exportBtn} onClick={() => exportSitzungFile(s.id)}><Printer size={14} /> Als PDF anzeigen / drucken</button>
                  {canEditSitzung && <button style={styles.deleteBtn} onClick={() => setConfirmDeleteSitzungId(s.id)}><Trash2 size={14} /> Löschen</button>}
                </div>
              </div>
            )}
          </div>
        );
        return (
          <div style={styles.fullscreenPage}>
            <div style={styles.fullscreenHeader}>
              <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
            </div>
            <div style={styles.modalTitle}>Ausschuss</div>
            <div style={{ marginTop: 14 }}>
              {canEditSitzung && <button style={styles.smallAddBtn} onClick={openNewSitzung}><Plus size={13} /> Neue Sitzung</button>}
              <div style={{ marginTop: 12 }}>
                {upcoming.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8C86", marginBottom: 10 }}>Keine anstehenden Sitzungen.</div>}
                {upcoming.map(renderSitzung)}

                {past.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button style={styles.advancedToggle} onClick={() => setShowSitzungArchiv(!showSitzungArchiv)}>
                      <ChevronDown size={13} style={{ transform: showSitzungArchiv ? "rotate(180deg)" : "none" }} /> Archiv ({past.length})
                    </button>
                    {showSitzungArchiv && <div style={{ marginTop: 10 }}>{past.map(renderSitzung)}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showSitzungForm && canEditSitzung && (
        <div style={styles.modalBackdrop} onClick={() => setShowSitzungForm(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()} className="card-enter">
            <div style={styles.modalHeader}><span style={styles.modalTitle}>{sitzungDraft.id ? "Sitzung bearbeiten" : "Neue Sitzung"}</span><button style={styles.iconBtn} onClick={() => setShowSitzungForm(false)}><X size={20} color="#5C5F58" /></button></div>
            <div style={styles.formBody}>
              <label style={styles.label}>Titel</label>
              <input style={styles.input} placeholder="z. B. Ausschusssitzung Herbst" value={sitzungDraft.title} onChange={(e) => setSitzungDraft({ ...sitzungDraft, title: e.target.value })} />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label style={styles.label}>Datum</label><input style={styles.input} type="date" value={sitzungDraft.date} onChange={(e) => setSitzungDraft({ ...sitzungDraft, date: e.target.value })} /></div>
                <div style={{ width: 110 }}><label style={styles.label}>Uhrzeit</label><input style={styles.input} type="time" value={sitzungDraft.time} onChange={(e) => setSitzungDraft({ ...sitzungDraft, time: e.target.value })} /></div>
              </div>
              <label style={styles.label}>Ort</label>
              <input style={styles.input} placeholder="z. B. Feuerwehrhaus" value={sitzungDraft.location} onChange={(e) => setSitzungDraft({ ...sitzungDraft, location: e.target.value })} />
              <label style={styles.label}>Tagesordnung</label>
              {sitzungDraft.tagesordnung.map((point, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input style={{ ...styles.input, flex: 1 }} placeholder={`Punkt ${idx + 1}`} value={point} onChange={(e) => { const next = [...sitzungDraft.tagesordnung]; next[idx] = e.target.value; setSitzungDraft({ ...sitzungDraft, tagesordnung: next }); }} />
                  {sitzungDraft.tagesordnung.length > 1 && <button style={styles.rosterRemoveBtn} onClick={() => setSitzungDraft({ ...sitzungDraft, tagesordnung: sitzungDraft.tagesordnung.filter((_, i) => i !== idx) })}><X size={13} /></button>}
                </div>
              ))}
              <button style={styles.tinyBtn} onClick={() => setSitzungDraft({ ...sitzungDraft, tagesordnung: [...sitzungDraft.tagesordnung, ""] })}>+ Punkt hinzufügen</button>
              <label style={styles.label}>Anhänge (Link, optional)</label>
              <input style={styles.input} placeholder="z. B. Link zur Gemeinde-Cloud-Datei" value={sitzungDraft.links} onChange={(e) => setSitzungDraft({ ...sitzungDraft, links: e.target.value })} />
              <label style={{ ...styles.label, marginTop: 10 }}>Dateien/Fotos anhängen</label>
              {(sitzungDraft.attachments || []).map((a, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#5C5F58" }}>{a.name}</span>
                  <button style={styles.rosterRemoveBtn} onClick={() => removeSitzungAttachmentDraft(idx)}><X size={13} /></button>
                </div>
              ))}
              <label style={styles.smallAddBtn}>
                {attachmentUploading ? "Lädt hoch …" : <><Plus size={12} /> Datei hinzufügen</>}
                <input type="file" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) uploadSitzungAttachment(e.target.files[0]); }} />
              </label>
              {sitzungError && <div style={styles.errorText}>{sitzungError}</div>}
              <div style={styles.formActions}><button style={styles.saveBtn} onClick={saveSitzungDraft}>{sitzungDraft.id ? "Speichern" : "Sitzung anlegen"}</button></div>
            </div>
          </div>
        </div>
      )}

      {printSitzungId && (() => {
        const s = sitzungen.find((x) => x.id === printSitzungId); if (!s) return null;
        return (
          <div className="print-area">
            <h2>{s.title}</h2>
            <p>{fmtDate(s.date)} · {s.time} Uhr {s.location && `· ${s.location}`}</p>
            <hr />
            <p><strong>Anwesenheit:</strong></p>
            <ul>
              {roster.filter((r) => r.ausschuss).map((r) => (
                <li key={r.name}>{r.name} — {(s.anwesenheit || {})[r.name] === "anwesend" ? "anwesend" : (s.anwesenheit || {})[r.name] === "entschuldigt" ? "entschuldigt" : "keine Angabe"}</li>
              ))}
            </ul>
            <hr />
            {s.tagesordnung.map((point, idx) => {
              const ab = (s.abstimmungen || {})[idx];
              const r = ab && ab.finalized ? voteResult(ab) : null;
              return (
                <div key={idx} style={{ marginBottom: 14 }}>
                  <strong>{idx + 1}. {point}</strong>
                  <p>{s.protokoll[idx] || "—"}</p>
                  {r && (
                    <p style={{ fontSize: 13 }}>
                      <strong>Abstimmung:</strong> {r.dafuer} dafür · {r.dagegen} dagegen — {r.label}<br />
                      <span style={{ fontSize: 11, color: "#5C5F58" }}>{Object.entries(ab.votes).map(([n, v]) => `${n}: ${v === "dafuer" ? "dafür" : "dagegen"}`).join(", ")}</span>
                    </p>
                  )}
                </div>
              );
            })}
            {s.links && <p>Anhänge: {s.links}</p>}
          </div>
        );
      })()}

      {showSettings && isAdmin && (
        <div style={styles.fullscreenPage}>
          <div style={styles.fullscreenHeader}>
            <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
          </div>
          <div style={styles.modalTitle}>Einstellungen</div>
          <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 14px" }}>Version {APP_VERSION}</div>
          <div style={styles.formBody}>
              <label style={styles.label}>Mitgliederliste, Bereiche & Rechte</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input style={{ ...styles.input, flex: 1 }} placeholder="Neues Mitglied: Name eingeben" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newMemberName.trim()) { adminAddMember(newMemberName); setNewMemberName(""); } }} />
                <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => { if (newMemberName.trim()) { adminAddMember(newMemberName); setNewMemberName(""); } }}><Plus size={16} /></button>
              </div>
              <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 10 }}>Die Person vergibt sich beim ersten eigenen Login selbst eine PIN.</div>
              <SearchBox value={rosterSearch} onChange={setRosterSearch} placeholder="Name suchen …" />
              <div style={styles.rosterManageList}>
                {roster.filter((r) => matchesSearch(r.name, rosterSearch)).map((r) => (
                  <RosterAdminRow key={r.name} r={r} isAdminName={config.adminNames.includes(r.name)}
                    onResetPin={() => resetPin(r.name)}
                    onRequestRemove={() => setConfirmDeleteName(r.name)}
                    onToggleBereich={(b) => toggleBereichAssignment(r.name, b)}
                    onTogglePerm={(b, f) => togglePermission(r.name, b, f)}
                    onToggleAtemschutz={() => toggleAtemschutz(r.name)}
                    onToggleGruppenfuehrer={() => toggleGruppenfuehrer(r.name)}
                    onToggleAusschuss={() => toggleAusschuss(r.name)}
                    onToggleAusschussRecht={(f) => toggleAusschussRecht(r.name, f)}
                  />
                ))}
                {roster.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Noch niemand eingetragen.</div>}
              </div>
              <label style={{ ...styles.label, marginTop: 22 }}>Ränge (Auswahlliste für die Personalakte)</label>
              <SimpleListEditor items={config.raenge || []} onChange={(v) => persistConfig({ ...config, raenge: v })} placeholder="z. B. Oberfeuerwehrmann" />
              <label style={{ ...styles.label, marginTop: 16 }}>Funktionen / Qualifikationen (Auswahlliste)</label>
              <SimpleListEditor items={config.funktionen || []} onChange={(v) => persistConfig({ ...config, funktionen: v })} placeholder="z. B. Maschinist" />
              <label style={{ ...styles.label, marginTop: 22 }}>Zugangscode ändern</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...styles.input, flex: 1 }} placeholder={`aktuell: ${config.accessCode}`} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <button style={{ ...styles.saveBtn, flex: "none", padding: "0 16px" }} onClick={() => { if (newCode.trim().length >= 4) { persistConfig({ ...config, accessCode: newCode.trim() }); setNewCode(""); } }}><Check size={16} /></button>
              </div>

              {isMainAdmin && (
                <div style={{ marginTop: 22 }}>
                  <button style={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
                    <ChevronDown size={13} style={{ transform: showAdvanced ? "rotate(180deg)" : "none" }} /> Erweitert
                  </button>
                  {showAdvanced && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>ADMIN-RECHTE VERGEBEN</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {roster.filter((r) => r.name !== config.mainAdminName).map((r) => (
                          <label key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                            <input type="checkbox" checked={config.adminNames.includes(r.name)} onChange={() => toggleAdmin(r.name)} /> {r.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
      )}

      {confirmResetVote && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmResetVote(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Abstimmung wirklich zurücksetzen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Das Ergebnis und alle abgegebenen Stimmen gehen verloren. Eine neue Abstimmung kann danach gestartet werden.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmResetVote(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => resetAbstimmung(confirmResetVote.sitzungId, confirmResetVote.idx)}>Zurücksetzen</button>
            </div>
          </div>
        </div>
      )}

      {confirmResetG26Name && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmResetG26Name(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Eingetragenes G26-Datum von {confirmResetG26Name} wirklich zurücksetzen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Die Person muss danach erneut einen Termin eintragen.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmResetG26Name(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => resetG26Date(confirmResetG26Name)}>Zurücksetzen</button>
            </div>
          </div>
        </div>
      )}

      {showWhatsNew && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={dismissWhatsNew}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <Sparkles size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Was ist neu</div>
            <ul style={{ textAlign: "left", fontSize: 12.5, color: "#5C5F58", lineHeight: 1.6, paddingLeft: 18, marginBottom: 14 }}>
              {CHANGELOG.map((item, idx) => (<li key={idx}>{item}</li>))}
            </ul>
            <button style={{ ...styles.saveBtn, width: "100%" }} onClick={dismissWhatsNew}>Verstanden</button>
          </div>
        </div>
      )}

      {confirmDeleteVehicleId && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmDeleteVehicleId(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Fahrzeug wirklich löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Alle Einweisungsdaten dazu gehen verloren.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmDeleteVehicleId(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { deleteVehicle(confirmDeleteVehicleId); setConfirmDeleteVehicleId(null); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSitzungId && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmDeleteSitzungId(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sitzung wirklich löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Protokoll und Anwesenheit gehen dabei verloren.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmDeleteSitzungId(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { deleteSitzung(confirmDeleteSitzungId); setConfirmDeleteSitzungId(null); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteEventId && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmDeleteEventId(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Termin wirklich löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Das kann nicht rückgängig gemacht werden.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmDeleteEventId(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { deleteEvent(confirmDeleteEventId); setConfirmDeleteEventId(null); setShowForm(false); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteNoticeId && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmDeleteNoticeId(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Mitteilung wirklich löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Das kann nicht rückgängig gemacht werden.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmDeleteNoticeId(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { deleteNotice(confirmDeleteNoticeId); setConfirmDeleteNoticeId(null); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}

      {showPersonalakte && (
        <div style={styles.fullscreenPage}>
          <PersonalakteView me={me} isAdmin={isAdmin} roster={roster} config={config} callAuthed={callAuthed} flashError={flashError}
            onOpenPhoto={setLightboxSrc} onSetKlassen={setFuehrerscheinKlassen} onClose={closeKachelView} />
        </div>
      )}

      {pinPrompt && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center", zIndex: 80 }} onClick={cancelPinPrompt}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <KeyRound size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Bitte PIN bestätigen</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 12 }}>Für geschützte Daten einmalig auf diesem Gerät nötig.</div>
            <input style={{ ...styles.gateInput, letterSpacing: "0.5em" }} type="password" inputMode="numeric" maxLength={4} value={pinPrompt.input} autoFocus
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPinPrompt((p) => ({ ...p, input: v })); }}
              onKeyDown={(e) => e.key === "Enter" && submitPinPrompt()} />
            {pinPrompt.error && <div style={styles.errorText}>{pinPrompt.error}</div>}
            <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 14 }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={cancelPinPrompt}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} disabled={pinPrompt.busy} onClick={submitPinPrompt}>{pinPrompt.busy ? "Prüfe …" : "Bestätigen"}</button>
            </div>
          </div>
        </div>
      )}

      {lightboxSrc && (
        <div style={styles.lightboxBackdrop} onClick={() => setLightboxSrc(null)}>
          <button style={styles.lightboxClose} onClick={() => setLightboxSrc(null)} aria-label="Schließen"><X size={22} color="white" /></button>
          <img src={lightboxSrc} alt="" style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {confirmDeleteName && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmDeleteName(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{confirmDeleteName} wirklich entfernen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Das kann nicht rückgängig gemacht werden. Die Personalakte samt Nachweisen wird dabei ebenfalls gelöscht.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmDeleteName(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { removeMember(confirmDeleteName); setConfirmDeleteName(null); }}>Entfernen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Personalakte – sichtbar nur für die Person selbst und den Admin.
// Alle Daten laufen ausschließlich über die geschützte Serverfunktion
// "personalakte" (Netlify), nie direkt über die öffentliche Datenbank.
// ============================================================================
const emptyAkte = () => ({
  strasse: "", plz: "", ort: "", email: "", telefon: "", geburtsdatum: "",
  arbeitgeber: { name: "", telefon: "", email: "" },
  notfallkontakt: { name: "", telefon: "" },
  bemerkung: "", eintrittsdatum: "",
  lehrgaenge: [], leistungsabzeichen: [], funktionen: [], mitgliedsverlauf: [],
  befoerderungen: [], ehrungen: [],
});
function normalizeAkte(d) {
  const b = emptyAkte(); d = d || {};
  return {
    ...b, ...d,
    arbeitgeber: { ...b.arbeitgeber, ...(d.arbeitgeber || {}) },
    notfallkontakt: { ...b.notfallkontakt, ...(d.notfallkontakt || {}) },
    lehrgaenge: d.lehrgaenge || [], leistungsabzeichen: d.leistungsabzeichen || [], funktionen: d.funktionen || [],
    mitgliedsverlauf: d.mitgliedsverlauf || [], befoerderungen: d.befoerderungen || [], ehrungen: d.ehrungen || [],
  };
}
function aktuellerRang(akte) {
  const list = [...((akte && akte.befoerderungen) || [])].filter((b) => b.rang).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  return list.length ? list[list.length - 1] : null;
}
function nextBirthdayInfo(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date(todayISO() + "T00:00:00");
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return { days: Math.round((next - today) / 86400000), age: next.getFullYear() - y, date: next };
}

function AkteSection({ title, children, adminOnly }) {
  return (
    <div style={styles.kontrollRow}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em", marginBottom: 8 }}>{title}{adminOnly && <span style={{ fontWeight: 600, color: "#A5A79F" }}> · nur Admin trägt ein</span>}</div>
      {children}
    </div>
  );
}
function AkteField({ label, value, onChange, type = "text", readOnly, placeholder }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 2 }}>{label}</div>
      {readOnly ? (
        <div style={{ fontSize: 13, color: "#2C2F2A", minHeight: 18 }}>{type === "date" ? fmtDate(value) : (value || "—")}</div>
      ) : type === "textarea" ? (
        <textarea style={{ ...styles.input, minHeight: 60, resize: "vertical", fontSize: 13 }} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={{ ...styles.input, padding: "7px 9px", fontSize: 13 }} type={type} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
// Liste aus Einträgen mit Titel/Datum (Leistungsabzeichen, Ehrungen, Mitgliedsverlauf, Beförderungen)
function AkteList({ items, onChange, readOnly, textKey = "titel", textLabel = "Bezeichnung", options, addLabel = "Eintrag hinzufügen" }) {
  const update = (id, patch) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const sorted = [...items].sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
  return (
    <div>
      {sorted.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F", marginBottom: 6 }}>Noch keine Einträge.</div>}
      {sorted.map((it) => (
        readOnly ? (
          <div key={it.id} style={{ fontSize: 12.5, color: "#2C2F2A", marginBottom: 4 }}>{it[textKey] || "—"} <span style={{ color: "#8A8C86" }}>{it.datum ? `· ${fmtDate(it.datum)}` : ""}</span></div>
        ) : (
          <div key={it.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
            {options ? (
              <select style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} value={it[textKey] || ""} onChange={(e) => update(it.id, { [textKey]: e.target.value })}>
                <option value="">— {textLabel} wählen —</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
                {it[textKey] && !options.includes(it[textKey]) && <option value={it[textKey]}>{it[textKey]}</option>}
              </select>
            ) : (
              <input style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} placeholder={textLabel} value={it[textKey] || ""} onChange={(e) => update(it.id, { [textKey]: e.target.value })} />
            )}
            <input style={{ ...styles.input, width: 140, padding: "6px 8px", fontSize: 12.5 }} type="date" value={it.datum || ""} onChange={(e) => update(it.id, { datum: e.target.value })} />
            <button style={styles.tinyIconBtn} aria-label="Entfernen" onClick={() => onChange(items.filter((x) => x.id !== it.id))}><X size={12} /></button>
          </div>
        )
      ))}
      {!readOnly && <button style={styles.smallAddBtn} onClick={() => onChange([...items, { id: uid(), [textKey]: "", datum: "" }])}><Plus size={12} /> {addLabel}</button>}
    </div>
  );
}
function ChipPicker({ options, selected, onToggle, readOnly, emptyHint }) {
  if (!options.length) return <div style={{ fontSize: 12, color: "#A5A79F" }}>{emptyHint}</div>;
  if (readOnly) return <div style={{ fontSize: 12.5, color: "#2C2F2A" }}>{selected.length ? selected.join(", ") : "—"}</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return <button key={o} onClick={() => onToggle(o)} style={{ ...styles.categoryChip, fontSize: 11.5, padding: "4px 10px", background: on ? "#2C2F2A" : "#F3F1EC", color: on ? "white" : "#5C5F58", borderColor: on ? "#2C2F2A" : "#E2DFD6" }}>{o}</button>;
      })}
    </div>
  );
}

function PersonalakteView({ me, isAdmin, roster, config, callAuthed, flashError, onOpenPhoto, onSetKlassen, onClose }) {
  const [target, setTarget] = useState(isAdmin ? null : me);
  const [search, setSearch] = useState("");
  const [akte, setAkte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!target) { setAkte(null); if (isAdmin) loadOverview(); return; }
    loadAkte(target);
  }, [target]);

  async function loadOverview() {
    setErrorText("");
    const r = await callAuthed("personalakte", { action: "list" });
    if (r.ok) setOverview(r.data.items || []);
    else if (r.data.error === "abgebrochen") onClose();
    else setErrorText(r.data.error || "Übersicht konnte nicht geladen werden.");
  }
  async function loadAkte(name) {
    setLoading(true); setErrorText("");
    const r = await callAuthed("personalakte", { action: "get", target: name });
    setLoading(false);
    if (r.ok) { setAkte(normalizeAkte(r.data.data)); setDirty(false); }
    else if (r.data.error === "abgebrochen") { if (isAdmin) setTarget(null); else onClose(); }
    else setErrorText(r.data.error || "Personalakte konnte nicht geladen werden.");
  }
  function upd(patch) { setAkte((a) => ({ ...a, ...patch })); setDirty(true); }
  async function save(data) {
    setSaving(true);
    const clean = { ...data, lehrgaenge: data.lehrgaenge.map(({ photoUrl, ...rest }) => rest) };
    const r = await callAuthed("personalakte", { action: "save", target, data: clean });
    setSaving(false);
    if (r.ok) { setDirty(false); return true; }
    if (r.data.error !== "abgebrochen") flashError(r.data.error || "Personalakte konnte nicht gespeichert werden.");
    return false;
  }
  async function uploadLehrgangFoto(id, file) {
    if (!file) return;
    setUploadingId(id);
    try {
      const r = await callAuthed("personalakte", { action: "uploadUrl", target, filename: file.name });
      if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
      const { error } = await supabase.storage.from("personalakte").uploadToSignedUrl(r.data.path, r.data.uploadToken, file);
      if (error) throw error;
      const next = { ...akte, lehrgaenge: akte.lehrgaenge.map((l) => (l.id === id ? { ...l, photoPath: r.data.path } : l)) };
      if (await save(next)) await loadAkte(target);
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setUploadingId(null);
  }
  function back() {
    if (dirty && !window.confirm("Es gibt ungespeicherte Änderungen. Trotzdem zurück?")) return;
    if (isAdmin && target) setTarget(null); else onClose();
  }

  // ---------- Admin-Übersicht ----------
  if (isAdmin && !target) {
    const items = overview || [];
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    const geburtstage = items.map((i) => ({ ...i, bd: nextBirthdayInfo(i.geburtsdatum) })).filter((i) => i.bd && i.bd.days <= 30).sort((a, b) => a.bd.days - b.bd.days);
    const jubilaeen = items.filter((i) => i.eintrittsdatum).map((i) => ({ ...i, jahre: currentYear() - Number(i.eintrittsdatum.slice(0, 4)) })).filter((i) => JUBILAEUMS_JAHRE.includes(i.jahre)).sort((a, b) => b.jahre - a.jahre);
    return (
      <div>
        <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Zurück</button></div>
        <div style={styles.modalTitle}>Personalakten</div>
        {errorText && <div style={styles.errorText}>{errorText}</div>}
        {overview === null && !errorText && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}
        {overview !== null && (
          <div style={{ marginTop: 14 }}>
            <AkteSection title="GEBURTSTAGE (NÄCHSTE 30 TAGE)">
              {geburtstage.length === 0 ? <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine anstehenden Geburtstage.</div> : geburtstage.map((g) => (
                <div key={g.name} style={{ fontSize: 12.5, marginBottom: 3 }}><strong>{g.name}</strong> wird {g.bd.age} · {g.bd.days === 0 ? "heute 🎉" : g.bd.days === 1 ? "morgen" : `in ${g.bd.days} Tagen`} <span style={{ color: "#8A8C86" }}>({fmtDate(g.bd.date.toISOString().slice(0, 10))})</span></div>
              ))}
            </AkteSection>
            <AkteSection title={`DIENSTJUBILÄEN ${currentYear()}`}>
              {jubilaeen.length === 0 ? <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine Jubiläen in diesem Jahr (bzw. Eintrittsdaten noch nicht eingetragen).</div> : jubilaeen.map((j) => (
                <div key={j.name} style={{ fontSize: 12.5, marginBottom: 3 }}><strong>{j.name}</strong> · {j.jahre} Jahre <span style={{ color: "#8A8C86" }}>(Eintritt {fmtDate(j.eintrittsdatum)})</span></div>
              ))}
            </AkteSection>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ALLE MITGLIEDER</div>
            <SearchBox value={search} onChange={setSearch} placeholder="Name suchen …" />
            {roster.filter((r) => matchesSearch(r.name, search)).map((r) => (
              <button key={r.name} style={{ ...styles.rosterItem, marginBottom: 6 }} onClick={() => setTarget(r.name)}>
                <span>{r.name}{byName[r.name] && byName[r.name].rang && <span style={{ fontSize: 11, color: "#8A8C86" }}> · {byName[r.name].rang}</span>}</span>
                <ChevronRight size={15} color="#A5A79F" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Einzelne Akte ----------
  const entry = roster.find((r) => r.name === target);
  const klassen = (entry && entry.fuehrerscheinKlassen) || [];
  const rang = akte ? aktuellerRang(akte) : null;
  const dienstjahre = akte && akte.eintrittsdatum ? currentYear() - Number(akte.eintrittsdatum.slice(0, 4)) : null;
  return (
    <div>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={back}><ArrowLeft size={18} /> {isAdmin ? "Alle Personalakten" : "Zurück"}</button></div>
      <div style={styles.modalTitle}>Personalakte {target}</div>
      {rang && <div style={{ fontSize: 12.5, color: "#5C5F58", marginTop: 2 }}>{rang.rang}{rang.datum ? ` seit ${fmtDate(rang.datum)}` : ""}</div>}
      <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 12px" }}>Nur {isAdmin && target !== me ? `${target} und` : "du und"} der Admin können diese Akte sehen.</div>
      {errorText && <div style={styles.errorText}>{errorText}</div>}
      {loading && <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Lädt …</div>}
      {akte && !loading && (
        <>
          <AkteSection title="PERSÖNLICHES">
            <AkteField label="Geburtsdatum" type="date" value={akte.geburtsdatum} onChange={(v) => upd({ geburtsdatum: v })} />
            <AkteField label="Straße und Hausnummer" value={akte.strasse} onChange={(v) => upd({ strasse: v })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 90 }}><AkteField label="PLZ" value={akte.plz} onChange={(v) => upd({ plz: v })} /></div>
              <div style={{ flex: 1 }}><AkteField label="Ort" value={akte.ort} onChange={(v) => upd({ ort: v })} /></div>
            </div>
            <AkteField label="Telefon" type="tel" value={akte.telefon} onChange={(v) => upd({ telefon: v })} />
            <AkteField label="E-Mail" type="email" value={akte.email} onChange={(v) => upd({ email: v })} />
          </AkteSection>

          <AkteSection title="NOTFALLKONTAKT">
            <AkteField label="Name" value={akte.notfallkontakt.name} onChange={(v) => upd({ notfallkontakt: { ...akte.notfallkontakt, name: v } })} />
            <AkteField label="Telefon" type="tel" value={akte.notfallkontakt.telefon} onChange={(v) => upd({ notfallkontakt: { ...akte.notfallkontakt, telefon: v } })} />
          </AkteSection>

          <AkteSection title="ARBEITGEBER">
            <AkteField label="Name" value={akte.arbeitgeber.name} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, name: v } })} />
            <AkteField label="Telefon" type="tel" value={akte.arbeitgeber.telefon} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, telefon: v } })} />
            <AkteField label="E-Mail" type="email" value={akte.arbeitgeber.email} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, email: v } })} />
          </AkteSection>

          <AkteSection title="FEUERWEHR">
            <AkteField label="Eintrittsdatum" type="date" value={akte.eintrittsdatum} onChange={(v) => upd({ eintrittsdatum: v })} />
            {dienstjahre !== null && <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 8 }}>{dienstjahre} Dienstjahre (Stand {currentYear()})</div>}
            <div style={{ fontSize: 11, color: "#8A8C86", margin: "4px 0 4px" }}>Mitgliedsverlauf (Eintritt, Übertritte)</div>
            <AkteList items={akte.mitgliedsverlauf} onChange={(v) => upd({ mitgliedsverlauf: v })} textKey="text" textLabel="z. B. Übertritt Einsatzabteilung" />
            <div style={{ fontSize: 11, color: "#8A8C86", margin: "10px 0 4px" }}>Funktionen / Qualifikationen</div>
            <ChipPicker options={config.funktionen || []} selected={akte.funktionen} onToggle={(f) => upd({ funktionen: akte.funktionen.includes(f) ? akte.funktionen.filter((x) => x !== f) : [...akte.funktionen, f] })} emptyHint="Noch keine Funktionen angelegt (Admin: Einstellungen)." />
          </AkteSection>

          <AkteSection title="RANG & BEFÖRDERUNGEN" adminOnly>
            <AkteList items={akte.befoerderungen} onChange={(v) => upd({ befoerderungen: v })} readOnly={!isAdmin} textKey="rang" textLabel="Rang" options={config.raenge || []} addLabel="Beförderung eintragen" />
            {isAdmin && (config.raenge || []).length === 0 && <div style={{ fontSize: 11, color: "#B8791A", marginTop: 4 }}>Bitte zuerst die Ränge in den Einstellungen anlegen.</div>}
          </AkteSection>

          <AkteSection title="EHRUNGEN & AUSZEICHNUNGEN" adminOnly>
            <AkteList items={akte.ehrungen} onChange={(v) => upd({ ehrungen: v })} readOnly={!isAdmin} textLabel="z. B. Ehrenzeichen Silber" addLabel="Ehrung eintragen" />
          </AkteSection>

          <AkteSection title="LEISTUNGSABZEICHEN">
            <AkteList items={akte.leistungsabzeichen} onChange={(v) => upd({ leistungsabzeichen: v })} textLabel="z. B. Leistungsabzeichen Bronze" addLabel="Abzeichen eintragen" />
          </AkteSection>

          <AkteSection title="LEHRGÄNGE">
            {akte.lehrgaenge.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F", marginBottom: 6 }}>Noch keine Lehrgänge.</div>}
            {akte.lehrgaenge.map((l) => (
              <div key={l.id} style={{ borderBottom: "1px dashed #E2DFD6", paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} placeholder="z. B. Truppführer" value={l.titel || ""} onChange={(e) => upd({ lehrgaenge: akte.lehrgaenge.map((x) => (x.id === l.id ? { ...x, titel: e.target.value } : x)) })} />
                  <input style={{ ...styles.input, width: 140, padding: "6px 8px", fontSize: 12.5 }} type="date" value={l.datum || ""} onChange={(e) => upd({ lehrgaenge: akte.lehrgaenge.map((x) => (x.id === l.id ? { ...x, datum: e.target.value } : x)) })} />
                  <button style={styles.tinyIconBtn} aria-label="Lehrgang entfernen" onClick={() => { if (window.confirm("Lehrgang samt Nachweis-Foto entfernen?")) upd({ lehrgaenge: akte.lehrgaenge.filter((x) => x.id !== l.id) }); }}><X size={12} /></button>
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  {l.photoUrl && <img src={l.photoUrl} alt="Nachweis" style={{ width: 70, height: 50, objectFit: "cover", borderRadius: 4, border: "1px solid #E2DFD6", cursor: "zoom-in" }} onClick={() => onOpenPhoto(l.photoUrl)} />}
                  <label style={styles.smallAddBtn}>
                    {uploadingId === l.id ? "Lädt hoch …" : <><Plus size={12} /> {l.photoPath ? "Foto ersetzen" : "Nachweis-Foto"}</>}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) uploadLehrgangFoto(l.id, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            ))}
            <button style={styles.smallAddBtn} onClick={() => upd({ lehrgaenge: [...akte.lehrgaenge, { id: uid(), titel: "", datum: "", photoPath: null }] })}><Plus size={12} /> Lehrgang hinzufügen</button>
          </AkteSection>

          <AkteSection title="FÜHRERSCHEINKLASSEN">
            <ChipPicker options={FUEHRERSCHEIN_KLASSEN} selected={klassen} onToggle={(k) => onSetKlassen(target, klassen.includes(k) ? klassen.filter((x) => x !== k) : [...klassen, k])} />
            <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 6 }}>Wird sofort gespeichert. Bestimmt, ob PKW/LKW bei der Führerscheinkontrolle und den Fahrzeugeinweisungen erscheinen. FF = Feuerwehrführerschein.</div>
          </AkteSection>

          <AkteSection title="BEMERKUNG">
            <AkteField label="" type="textarea" value={akte.bemerkung} onChange={(v) => upd({ bemerkung: v })} placeholder="Freitext …" />
          </AkteSection>

          <div style={{ position: "sticky", bottom: 0, background: "#F3F1EC", padding: "10px 0 4px" }}>
            <button style={{ ...styles.saveBtn, width: "100%", opacity: dirty ? 1 : 0.6 }} disabled={saving || !dirty} onClick={() => save(akte)}>{saving ? "Speichert …" : dirty ? "Änderungen speichern" : "Alles gespeichert"}</button>
          </div>
        </>
      )}
    </div>
  );
}

// Einfache Liste zum Pflegen von Auswahlwerten (Ränge, Funktionen) in den Einstellungen.
function SimpleListEditor({ items, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => { const t = input.trim(); if (!t || items.includes(t)) return; onChange([...items, t]); setInput(""); };
  const move = (idx, dir) => { const next = [...items]; const j = idx + dir; if (j < 0 || j >= next.length) return; [next[idx], next[j]] = [next[j], next[idx]]; onChange(next); };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input style={{ ...styles.input, flex: 1 }} placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={add}><Plus size={16} /></button>
      </div>
      {items.map((it, idx) => (
        <div key={it} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: "5px 8px", marginBottom: 4 }}>
          <span style={{ fontSize: 12.5 }}>{it}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={styles.tinyIconBtn} aria-label="nach oben" onClick={() => move(idx, -1)}><ChevronDown size={12} style={{ transform: "rotate(180deg)" }} /></button>
            <button style={styles.tinyIconBtn} aria-label="nach unten" onClick={() => move(idx, 1)}><ChevronDown size={12} /></button>
            <button style={styles.tinyIconBtn} aria-label="entfernen" onClick={() => onChange(items.filter((x) => x !== it))}><X size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FuehrerscheinLine({ label, icon, data, isSelf, onConfirm, onToggleHas }) {
  const ok = !data.hasLicense || data.confirmedYear === currentYear();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>{icon} {label}: {!data.hasLicense ? <span style={{ color: "#8A8C86" }}>keiner</span> : ok ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>bestätigt ({data.confirmedBy})</span> : data.problemReported ? <span style={{ color: "#C1272D", fontWeight: 600 }}>Problem: {data.problemReportedBy}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {onToggleHas && <button style={styles.tinyBtn} onClick={onToggleHas}>{data.hasLicense ? "kein " + label : "hat " + label}</button>}
        {!isSelf && data.hasLicense && !ok && <button style={styles.tinyBtnPrimary} onClick={onConfirm}>Bestätigen</button>}
      </div>
    </div>
  );
}

function RosterAdminRow({ r, isAdminName, onResetPin, onRequestRemove, onToggleBereich, onTogglePerm, onToggleAtemschutz, onToggleGruppenfuehrer, onToggleAusschuss, onToggleAusschussRecht }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.rosterManageItemFull}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span>{r.name} {isAdminName && <span style={styles.adminTag}>Admin</span>}{!r.hasPin && <span style={styles.pinPendingTag}>PIN offen</span>}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button style={styles.rosterRemoveBtn} title="PIN zurücksetzen" onClick={(e) => { e.stopPropagation(); onResetPin(); }}><RotateCcw size={13} /></button>
          {!isAdminName && <button style={styles.rosterRemoveBtn} title="Entfernen" onClick={(e) => { e.stopPropagation(); onRequestRemove(); }}><X size={13} /></button>}
          <ChevronDown size={14} color="#8A8C86" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8C86", marginBottom: 5 }}>BEREICHE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {BEREICH_KEYS.map((b) => (
              <button key={b} onClick={() => onToggleBereich(b)} style={{ ...styles.categoryChip, fontSize: 11, padding: "4px 9px", background: r.bereiche.includes(b) ? BEREICHE[b].color : "#F3F1EC", color: r.bereiche.includes(b) ? "white" : "#5C5F58", borderColor: r.bereiche.includes(b) ? BEREICHE[b].color : "#E2DFD6" }}><BereichIcon bereich={b} size={11} /> {BEREICHE[b].label}</button>
            ))}
            <button onClick={onToggleAusschuss} style={{ ...styles.categoryChip, fontSize: 11, padding: "4px 9px", background: r.ausschuss ? "#4A6670" : "#F3F1EC", color: r.ausschuss ? "white" : "#5C5F58", borderColor: r.ausschuss ? "#4A6670" : "#E2DFD6" }}><Landmark size={11} /> Ausschuss</button>
          </div>
          {r.bereiche.length > 0 && (<>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8C86", marginBottom: 5 }}>RECHTE PRO BEREICH</div>
            {r.bereiche.map((b) => (
              <div key={b} style={{ display: "flex", gap: 14, marginBottom: 4, fontSize: 11.5, color: "#5C5F58" }}>
                <span style={{ width: 90, fontWeight: 600 }}>{BEREICHE[b].short}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.rechte[b].calendar} onChange={() => onTogglePerm(b, "calendar")} /> Kalender</label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.rechte[b].news} onChange={() => onTogglePerm(b, "news")} /> Mitteilungen</label>
              </div>
            ))}
          </>)}
          {r.ausschuss && (
            <div style={{ display: "flex", gap: 14, marginBottom: 4, fontSize: 11.5, color: "#5C5F58" }}>
              <span style={{ width: 90, fontWeight: 600 }}>Ausschuss</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.ausschussRechte.calendar} onChange={() => onToggleAusschussRecht("calendar")} /> Einladung erstellen</label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.ausschussRechte.protokoll} onChange={() => onToggleAusschussRecht("protokoll")} /> Protokoll führen</label>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#5C5F58" }}><input type="checkbox" checked={r.atemschutz} onChange={onToggleAtemschutz} /> Atemschutzträger (G26.3-Pflicht)</label>
          {r.bereiche.includes("einsatzabteilung") && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#5C5F58" }}><input type="checkbox" checked={r.gruppenfuehrer} onChange={onToggleGruppenfuehrer} /> Kann als Gruppenführer eingeteilt werden</label>
          )}
        </div>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <Search size={14} color="#A5A79F" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
      <input style={{ ...styles.input, paddingLeft: 30 }} placeholder={placeholder || "Suchen …"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function matchesSearch(name, query) { if (!query.trim()) return true; return name.toLowerCase().includes(query.trim().toLowerCase()); }

function ResponseButtons({ ev, me, onRespond, size = "normal" }) {
  const myStatus = (ev.responses || {})[me]; const small = size === "small";
  const locked = ev.anmeldeschluss && todayISO() > ev.anmeldeschluss;
  return (
    <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={locked} onClick={() => onRespond(ev.id, "zu")} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: myStatus === "zu" ? "#2E7D46" : "white", color: myStatus === "zu" ? "white" : "#2E7D46", borderColor: "#2E7D46" }}><UserCheck size={small ? 12 : 14} /> Zusage</button>
        <button disabled={locked} onClick={() => onRespond(ev.id, "ab")} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: myStatus === "ab" ? "#C1272D" : "white", color: myStatus === "ab" ? "white" : "#C1272D", borderColor: "#C1272D" }}><UserX size={small ? 12 : 14} /> Absage</button>
      </div>
      {locked && <span style={{ fontSize: 10.5, color: "#C1272D" }}>Anmeldeschluss ({fmtDate(ev.anmeldeschluss)}) erreicht</span>}
    </div>
  );
}
function GuestStepper({ ev, me, onChange }) {
  if ((ev.responses || {})[me] !== "zu") return null;
  const guests = (ev.guests || {})[me] || 0;
  const locked = ev.anmeldeschluss && todayISO() > ev.anmeldeschluss;
  return (
    <div style={styles.guestStepper}>
      <span style={{ fontSize: 11, color: "#8A8C86" }}>+ Begleitung:</span>
      <button style={styles.tinyBtn} disabled={locked} onClick={() => onChange(ev.id, guests - 1)}>−</button>
      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 14, textAlign: "center" }}>{guests}</span>
      <button style={styles.tinyBtn} disabled={locked} onClick={() => onChange(ev.id, guests + 1)}>+</button>
    </div>
  );
}
function totalHeadcount(ev) {
  const responses = ev.responses || {}; const guests = ev.guests || {};
  return Object.entries(responses).filter(([, v]) => v === "zu").reduce((sum, [n]) => sum + 1 + (guests[n] || 0), 0);
}
function SignupButton({ ev, me, onSignup, size = "normal" }) {
  const signups = ev.signups || {}; const count = Object.keys(signups).length; const needed = ev.capacityNeeded || 0;
  const imIn = !!signups[me]; const full = count >= needed && !imIn; const small = size === "small";
  return (
    <button onClick={() => onSignup(ev.id)} disabled={full} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: imIn ? "#1F6F5C" : full ? "#E2DFD6" : "white", color: imIn ? "white" : full ? "#9A9C95" : "#1F6F5C", borderColor: imIn ? "#1F6F5C" : full ? "#E2DFD6" : "#1F6F5C" }}>
      <HandHelping size={small ? 12 : 14} /> {imIn ? "Bin dabei" : full ? "Voll belegt" : "Ich bin dabei"}
    </button>
  );
}
function CapacityCounter({ ev, canEdit }) {
  const signups = ev.signups || {}; const names = Object.keys(signups); const needed = ev.capacityNeeded || 0; const showNames = ev.namesVisible || canEdit;
  return (
    <div style={styles.capacityCounterRow}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: names.length >= needed ? "#1F6F5C" : "#B8791A" }}>{names.length} von {needed} angemeldet</span>
      {showNames && names.length > 0 && <span style={styles.capacityNames}>{names.join(", ")}</span>}
      {!showNames && <span style={styles.capacityNamesHidden}><EyeOff size={11} /> Namen ausgeblendet</span>}
    </div>
  );
}
function EventBadge({ label }) { if (!label) return null; const bg = label === "Neu" ? "#E8A33D" : "#4A6670"; return <span style={{ fontSize: 9, fontWeight: 700, color: "white", background: bg, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase" }}>{label}</span>; }

function GruppenfuehrerTag({ ev }) {
  const applicable = ev.bereich === "einsatzabteilung" && GRUPPENFUEHRER_CATEGORIES.includes(ev.category);
  if (!applicable) return null;
  if (ev.gruppenfuehrer) return <span style={styles.gfTagSet}><UserCog size={11} /> {ev.gruppenfuehrer}</span>;
  return <span style={styles.gfTagMissing} title="Gruppenführer noch nicht festgelegt"><UserCog size={11} /></span>;
}

function HeroCard({ ev, me, onRespond, onSignup, onSetGuests, showBereich, badgeLabel }) {
  const { day, monthShort, weekday } = formatDateParts(ev.date); const cat = CATEGORIES[ev.category]; const diff = daysUntil(ev.date);
  const relLabel = diff === 0 ? "HEUTE" : diff === 1 ? "MORGEN" : `IN ${diff} TAGEN`;
  const responses = ev.responses || {}; const zuCount = Object.values(responses).filter((v) => v === "zu").length; const abCount = Object.values(responses).filter((v) => v === "ab").length;
  const isFeier = ev.category === "sonstiges" && !ev.capacityMode;
  return (
    <div style={styles.heroCard}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={styles.heroDateBlock}><div style={styles.heroDay}>{day}</div><div style={styles.heroMonth}>{monthShort}</div></div>
        <div style={styles.heroDivider} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={styles.heroRel}>{relLabel} · {weekday}</span>
            <EventBadge label={badgeLabel} />
            {showBereich && <span style={styles.miniBereichTagDark}><BereichIcon bereich={ev.bereich} size={11} /> {BEREICHE[ev.bereich].short}</span>}
          </div>
          <div style={styles.heroTitle}>{ev.title}</div>
          <div style={styles.heroMeta}><span style={styles.heroMetaItem}><Clock size={12} /> {ev.time} Uhr</span>{ev.location && <span style={styles.heroMetaItem}><MapPin size={12} /> {ev.location}</span>}<GruppenfuehrerTag ev={ev} /></div>
        </div>
        <span style={{ ...styles.heroBadge, background: cat.color }}>{cat.label}</span>
      </div>
      <div style={styles.heroRespRow}>
        {ev.capacityMode ? <SignupButton ev={ev} me={me} onSignup={onSignup} /> : <ResponseButtons ev={ev} me={me} onRespond={onRespond} />}
        {ev.capacityMode ? <span style={styles.heroCounts}>{Object.keys(ev.signups || {}).length} von {ev.capacityNeeded} angemeldet</span> : <span style={styles.heroCounts}>{zuCount} zugesagt · {abCount} abgesagt{isFeier ? ` · ${totalHeadcount(ev)} Personen gesamt` : ""}</span>}
      </div>
      {isFeier && <GuestStepper ev={ev} me={me} onChange={onSetGuests} />}
    </div>
  );
}

function EventCard({ ev, me, canEdit, expanded, onToggleExpand, onRespond, onSignup, onSetGuests, onEdit, showBereich, badgeLabel, roster, onToggleAttendance, isArchived }) {
  const [showAttendance, setShowAttendance] = useState(false);
  const { day, monthShort, weekday } = formatDateParts(ev.date); const cat = CATEGORIES[ev.category];
  const responses = ev.responses || {}; const zuNames = Object.entries(responses).filter(([, v]) => v === "zu").map(([n]) => n); const abNames = Object.entries(responses).filter(([, v]) => v === "ab").map(([n]) => n);
  const anwesenheit = ev.anwesenheit || {};
  const anwesendCount = Object.values(anwesenheit).filter(Boolean).length;
  const isFeier = ev.category === "sonstiges" && !ev.capacityMode;
  const guests = ev.guests || {};
  return (
    <div className="card-enter" style={{ ...styles.eventCard, borderLeftColor: cat.color }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={styles.eventDateCol}><div style={styles.eventDay}>{day}</div><div style={styles.eventWeekday}>{weekday}</div></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.eventTitleRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={styles.eventTitle}>{ev.title}</span>
              <EventBadge label={badgeLabel} />
              {showBereich && <span style={styles.miniBereichTag}><BereichIcon bereich={ev.bereich} size={11} /> {BEREICHE[ev.bereich].short}</span>}
            </div>
            <span style={{ ...styles.eventBadge, background: cat.bg, color: cat.color }}>{cat.label}</span>
          </div>
          <div style={styles.eventMeta}><span style={styles.eventMetaItem}><Clock size={11} /> {ev.time}</span>{ev.location && <span style={styles.eventMetaItem}><MapPin size={11} /> {ev.location}</span>}<GruppenfuehrerTag ev={ev} /></div>
          {ev.notes && <div style={styles.eventNotes}>{ev.notes}</div>}
        </div>
        {canEdit && <button style={styles.editBtn} onClick={onEdit} aria-label="Bearbeiten"><Pencil size={14} color="#8A8C86" /></button>}
      </div>
      {ev.capacityMode ? (
        <div style={styles.eventRespFooter}><SignupButton ev={ev} me={me} onSignup={onSignup} size="small" /><CapacityCounter ev={ev} canEdit={canEdit} /></div>
      ) : (
        <>
          <div style={styles.eventRespFooter}>
            <ResponseButtons ev={ev} me={me} onRespond={onRespond} size="small" />
            <button style={styles.expandLink} onClick={onToggleExpand}>{zuNames.length} zugesagt{abNames.length > 0 ? ` · ${abNames.length} abgesagt` : ""}{isFeier ? ` · ${totalHeadcount(ev)} gesamt` : ""}</button>
          </div>
          {isFeier && <GuestStepper ev={ev} me={me} onChange={onSetGuests} />}
          {expanded && (
            <div style={styles.expandPanel}>
              {zuNames.length > 0 && <div style={styles.expandLine}><strong>Zugesagt:</strong> {zuNames.map((n) => guests[n] ? `${n} (+${guests[n]})` : n).join(", ")}</div>}
              {abNames.length > 0 && <div style={styles.expandLine}><strong>Abgesagt:</strong> {abNames.join(", ")}</div>}
              {zuNames.length === 0 && abNames.length === 0 && <div style={styles.expandLine}>Noch keine Rückmeldungen.</div>}
            </div>
          )}
        </>
      )}
      {canEdit && roster && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
          <button style={styles.expandSitzungBtn} onClick={() => setShowAttendance(!showAttendance)}>
            <Users size={12} /> Anwesenheit{anwesendCount > 0 ? ` (${anwesendCount})` : ""} <ChevronDown size={12} style={{ transform: showAttendance ? "rotate(180deg)" : "none" }} />
          </button>
          {showAttendance && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {roster.filter((r) => r.bereiche.includes(ev.bereich)).map((r) => (
                <label key={r.name} style={styles.attendanceRow}>
                  <input type="checkbox" style={styles.attendanceCheckbox} checked={!!anwesenheit[r.name]} onChange={() => onToggleAttendance(ev.id, r.name)} />
                  <span>{r.name}</span>
                </label>
              ))}
              {roster.filter((r) => r.bereiche.includes(ev.bereich)).length === 0 && <div style={{ fontSize: 11.5, color: "#8A8C86" }}>Niemand diesem Bereich zugeordnet.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, color, dot }) {
  return (
    <button onClick={onClick} style={{ ...styles.tabBtn, position: "relative", background: active ? (color || "#2C2F2A") : "transparent", color: active ? "white" : "#5C5F58", borderColor: active ? (color || "#2C2F2A") : "#E2DFD6" }}>
      {label}
      {dot && <span style={styles.tabDot} />}
    </button>
  );
}

const styles = {
  page: { fontFamily: "'Inter', sans-serif", background: "#F3F1EC", minHeight: "100vh", color: "#2C2F2A", paddingBottom: 100, overscrollBehaviorY: "contain" },
  gatePage: { fontFamily: "'Inter', sans-serif", background: "#1F2422", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  gateCard: { background: "#F3F1EC", borderRadius: 8, padding: "26px 24px", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderTop: "4px solid #C1272D" },
  gateBrand: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#C1272D", letterSpacing: "0.08em", marginBottom: 14 },
  gateTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 6 },
  gateSub: { fontSize: 12.5, color: "#8A8C86", lineHeight: 1.4, marginBottom: 16 },
  gateInput: { width: "100%", padding: "11px 12px", borderRadius: 6, border: "1.5px solid #E2DFD6", fontSize: 15, background: "white", marginTop: 4, textAlign: "center" },
  gateBtn: { width: "100%", marginTop: 12, background: "#C1272D", color: "white", border: "none", borderRadius: 6, padding: "11px 14px", fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  backLink: { marginTop: 14, background: "transparent", border: "none", color: "#8A8C86", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 },
  rosterList: { display: "flex", flexDirection: "column", gap: 6, width: "100%", maxHeight: 220, overflowY: "auto", marginTop: 6 },
  rosterItem: { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1.5px solid #E2DFD6", background: "white", fontSize: 14, fontWeight: 500, textAlign: "left", color: "#2C2F2A", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  adminTag: { fontSize: 9.5, fontWeight: 700, color: "#C1272D", background: "#FBEAEA", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase" },
  adminTagHeader: { fontSize: 9.5, fontWeight: 700, color: "#1F2422", background: "#E8A33D", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase", marginLeft: 4 },
  pinPendingTag: { fontSize: 9, fontWeight: 700, color: "#B8791A", background: "#FBF1E1", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase", marginLeft: 5 },
  miniBereichTag: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: "#5C5F58", background: "#EEEEEC", padding: "1px 6px", borderRadius: 3 },
  miniBereichTagDark: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: "#B8BCB6", background: "#2C2F2A", padding: "1px 6px", borderRadius: 3 },

  header: { background: "#1F2422", padding: "16px 20px 12px" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerBrand: { display: "flex", alignItems: "center", gap: 9 },
  headerBrandText: { fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 15.5, letterSpacing: "0.04em", color: "#F3F1EC", lineHeight: 1.2 },
  headerBrandSub: { fontSize: 10.5, color: "#8FA0A6", fontWeight: 500, letterSpacing: "0.03em" },
  settingsBtn: { background: "transparent", border: "none", padding: 4 },
  headerMe: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#8FA0A6", marginTop: 10, flexWrap: "wrap" },
  switchLink: { background: "transparent", border: "none", color: "#E8A33D", fontSize: 11.5, fontWeight: 600, textDecoration: "underline", padding: 0, marginLeft: 4 },
  bereichRow: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  bereichChip: { display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#F3F1EC", background: "transparent", border: "1.5px solid", borderRadius: 14, padding: "3px 8px" },
  iosHintBanner: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, background: "#2C2F2A", borderRadius: 6, padding: "8px 10px", fontSize: 10.5, color: "#B8BCB6", lineHeight: 1.4 },
  iosHintClose: { background: "transparent", border: "none", padding: 0, flexShrink: 0 },

  errorBanner: { position: "sticky", top: 0, zIndex: 40, background: "#C1272D", color: "white", fontSize: 12.5, fontWeight: 600, padding: "9px 16px", display: "flex", alignItems: "center", gap: 8 },

  remindersSection: { padding: "14px 16px 0" },
  reminderCard: { display: "flex", alignItems: "flex-start", gap: 9, background: "#FBF1E1", border: "1px solid #E8C98A", borderRadius: 6, padding: "10px 12px", marginBottom: 8 },
  reminderText: { fontSize: 12.5, color: "#6B4E12", lineHeight: 1.4, fontWeight: 500 },
  reminderDoctor: { fontSize: 11, color: "#8A6B2E", marginTop: 4 },
  reminderOk: { background: "#B8791A", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 },

  noticesSection: { padding: "16px 16px 4px" },
  sectionLabelRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginLeft: 4, marginRight: 2 },
  sectionLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#5C5F58", letterSpacing: "0.08em" },
  smallAddBtn: { display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "1px solid #C1272D", color: "#C1272D", borderRadius: 14, padding: "3px 9px", fontSize: 11, fontWeight: 700 },
  noNotices: { fontSize: 12, color: "#8A8C86", padding: "4px 4px 8px" },
  noticeCard: { display: "flex", gap: 10, alignItems: "flex-start", borderLeft: "3.5px solid", borderRadius: 4, padding: "10px 12px", marginBottom: 7 },
  noticeBadge: { fontSize: 9, fontWeight: 700, color: "white", padding: "2px 6px", borderRadius: 3, textTransform: "uppercase" },
  noticeExpiry: { fontSize: 10.5, color: "#8A8C86" },
  noticeText: { fontSize: 13, color: "#2C2F2A", lineHeight: 1.4 },

  hero: { padding: "16px 16px 4px" },
  heroLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#C1272D", letterSpacing: "0.08em", marginBottom: 8, marginLeft: 4 },
  heroCard: { background: "#1F2422", borderRadius: 4, padding: "16px 14px", borderLeft: "4px solid #C1272D" },
  heroDateBlock: { textAlign: "center", width: 46, flexShrink: 0 },
  heroDay: { fontFamily: "'JetBrains Mono', monospace", fontSize: 30, fontWeight: 700, color: "white", lineHeight: 1 },
  heroMonth: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8FA0A6", letterSpacing: "0.05em", marginTop: 2 },
  heroDivider: { width: 1, alignSelf: "stretch", background: "#3A3F3B" },
  heroRel: { fontSize: 11, fontWeight: 700, color: "#E8A33D", letterSpacing: "0.04em" },
  heroTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 17, fontWeight: 600, color: "white", lineHeight: 1.2, marginBottom: 5 },
  heroMeta: { display: "flex", gap: 12, flexWrap: "wrap" },
  heroMetaItem: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#B8BCB6" },
  heroBadge: { fontSize: 9, fontWeight: 700, color: "white", padding: "3px 7px", borderRadius: 3, letterSpacing: "0.04em", textTransform: "uppercase", alignSelf: "flex-start" },
  heroRespRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid #3A3F3B", flexWrap: "wrap", gap: 8 },
  heroCounts: { fontSize: 11.5, color: "#8FA0A6" },

  tabRow: { display: "flex", flexWrap: "wrap", gap: 6, padding: "16px 16px 4px" },
  tabBtn: { fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 16, border: "1.5px solid", whiteSpace: "nowrap" },
  tabDot: { position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#E8A33D", border: "1.5px solid #F3F1EC" },

  main: { padding: "18px 16px 0" },
  monthLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#8A8C86", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2 },

  eventCard: { background: "white", borderRadius: 3, borderLeft: "3.5px solid", padding: "12px 12px", marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  eventDateCol: { textAlign: "center", width: 34, flexShrink: 0, paddingTop: 1 },
  eventDay: { fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color: "#2C2F2A", lineHeight: 1 },
  eventWeekday: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#A5A79F", marginTop: 2, textTransform: "uppercase" },
  eventTitleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  eventTitle: { fontSize: 14.5, fontWeight: 600, color: "#2C2F2A", lineHeight: 1.3 },
  eventBadge: { fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", flexShrink: 0 },
  eventMeta: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 2 },
  eventMetaItem: { display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#8A8C86" },
  eventNotes: { fontSize: 12, color: "#9A9C95", marginTop: 4, lineHeight: 1.4 },
  editBtn: { padding: 5, borderRadius: 4, background: "transparent", border: "none", flexShrink: 0, height: "fit-content" },
  eventRespFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0EEE7", flexWrap: "wrap", gap: 6 },
  expandLink: { background: "transparent", border: "none", fontSize: 11.5, color: "#4A6670", fontWeight: 600, padding: 0 },
  expandPanel: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6", display: "flex", flexDirection: "column", gap: 3 },
  expandLine: { fontSize: 12, color: "#5C5F58", lineHeight: 1.5 },

  capacityCounterRow: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, maxWidth: "55%" },
  capacityNames: { fontSize: 10.5, color: "#8A8C86", textAlign: "right", lineHeight: 1.3 },
  capacityNamesHidden: { display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: "#A5A79F" },

  respBtn: { display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: "1.5px solid" },
  respBtnSmall: { fontSize: 11, padding: "5px 9px", gap: 4 },

  emptyState: { textAlign: "center", padding: "50px 20px", display: "flex", flexDirection: "column", alignItems: "center" },
  fab: { position: "fixed", bottom: 22, right: 20, width: 52, height: 52, borderRadius: "50%", background: "#C1272D", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(193,39,45,0.4)" },

  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(31,36,34,0.55)", display: "flex", alignItems: "flex-end", zIndex: 70 },
  modalSheet: { background: "#F3F1EC", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: "14px 18px 24px" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 17, fontWeight: 600, color: "#2C2F2A" },
  iconBtn: { background: "transparent", border: "none", padding: 4, borderRadius: 4 },

  formBody: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11.5, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.03em", marginTop: 10, marginBottom: 5 },
  input: { width: "100%", padding: "10px 11px", borderRadius: 6, border: "1.5px solid #E2DFD6", fontSize: 14.5, background: "white", color: "#2C2F2A" },
  categoryPicker: { display: "flex", flexWrap: "wrap", gap: 6 },
  categoryChip: { fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: "1.5px solid", display: "flex", alignItems: "center", gap: 4 },
  errorText: { color: "#C1272D", fontSize: 12.5, marginTop: 10, fontWeight: 500 },
  formActions: { display: "flex", gap: 10, marginTop: 20 },
  deleteBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1.5px solid #E2A9A9", color: "#C1272D", borderRadius: 6, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 },
  saveBtn: { flex: 1, background: "#C1272D", color: "white", border: "none", borderRadius: 6, padding: "11px 14px", fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },

  capacityBox: { background: "white", border: "1.5px solid #E2DFD6", borderRadius: 8, padding: "12px 12px", marginTop: 12 },
  checkboxRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "#2C2F2A", lineHeight: 1.4, cursor: "pointer" },

  rosterManageList: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" },
  rosterManageItemFull: { background: "white", padding: "9px 10px", borderRadius: 6, border: "1px solid #E2DFD6", fontSize: 13.5 },
  rosterRemoveBtn: { background: "transparent", border: "none", padding: 3, color: "#8A8C86" },

  kontrollTab: { display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: "1.5px solid #E2DFD6", background: "white", color: "#5C5F58" },
  kontrollTabActive: { background: "#2C2F2A", color: "white", borderColor: "#2C2F2A" },
  kontrollRow: { background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: "9px 10px", marginBottom: 6 },
  exportBtn: { display: "flex", alignItems: "center", gap: 6, background: "#4A6670", color: "white", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 4 },
  tinyBtn: { fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 4, border: "1px solid #E2DFD6", background: "#F3F1EC", color: "#5C5F58" },
  tinyIconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "3px 5px", borderRadius: 4, border: "1px solid #E2DFD6", background: "#F3F1EC", color: "#5C5F58", flexShrink: 0 },
  lightboxBackdrop: { position: "fixed", inset: 0, background: "rgba(20,20,20,0.92)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  lightboxImg: { maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 4 },
  lightboxClose: { position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", padding: 8, zIndex: 91, display: "flex", alignItems: "center", justifyContent: "center" },
  tinyBtnPrimary: { fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 4, border: "1px solid #1F6F5C", background: "#1F6F5C", color: "white" },
  tileGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  tile: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "#FBF1E1", border: "0.5px solid #E8C98A", borderRadius: 12, padding: "18px 10px", position: "relative" },
  fullscreenPage: { position: "fixed", inset: 0, background: "#F3F1EC", zIndex: 60, overflowY: "auto", padding: "20px 18px 40px" },
  fullscreenHeader: { display: "flex", alignItems: "center", marginBottom: 12 },
  fullscreenBackBtn: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#5C5F58", fontSize: 13, fontWeight: 600, padding: 0 },
  tileLabel: { fontSize: 12.5, fontWeight: 600, color: "#2C2F2A" },
  tileBadge: { position: "absolute", top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, background: "#E8A33D", color: "white", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" },
  tilePlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "#F3F1EC", border: "1px dashed #C7C4BC", borderRadius: 12, padding: "18px 10px" },
  tileHeaderDot: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#E8A33D" },
  teaserSection: { padding: "0 16px 4px" },
  teaserCard: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#F1E9F6", border: "1px solid #DCC8EA", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
  confirmDialog: { background: "#F3F1EC", borderRadius: 10, padding: "22px 20px", width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", margin: "auto" },
  advancedToggle: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#8A8C86", fontSize: 11.5, fontWeight: 600, padding: 0 },
  expandSitzungBtn: { display: "flex", alignItems: "center", gap: 4, background: "#EAF0F1", border: "1px solid #C7D4D8", color: "#4A6670", fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 14, whiteSpace: "nowrap" },
  problemBanner: { display: "flex", alignItems: "center", gap: 6, background: "#FBEAEA", border: "1px solid #E2A9A9", borderRadius: 6, padding: "6px 9px", marginTop: 5, fontSize: 11.5, color: "#8A2A2A" },
  voteBox: { marginTop: 6, paddingTop: 6, borderTop: "1px dashed #E2DFD6" },
  voteNote: { fontSize: 11, color: "#8A8C86" },
  voteResultBox: { background: "#EAF0F1", borderRadius: 6, padding: "8px 10px", marginTop: 4 },
  voteAntrag: { fontSize: 12, fontStyle: "italic", color: "#4A6670", marginBottom: 5 },
  attendanceRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#2C2F2A", padding: "9px 6px", borderRadius: 6, cursor: "pointer" },
  attendanceCheckbox: { width: 22, height: 22, flexShrink: 0, accentColor: "#1F6F5C" },
  guestStepper: { display: "flex", alignItems: "center", gap: 6, marginTop: 8 },
  gfTagSet: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#4A6670", fontWeight: 600 },
  gfTagMissing: { display: "inline-flex", alignItems: "center", color: "#E8A33D" },
};
