import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { AlertTriangle, ArrowLeft, Bell, Car, ChevronDown, ChevronRight, Eye, EyeOff, Flame, FolderOpen, KeyRound, Landmark, LayoutGrid, Lock, Megaphone, Pencil, Plus, RefreshCw, Settings, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Trash2, Truck, User, UserCog, Users, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { LION_ICON } from "./lib/icons";
import { APP_NAME, APP_VERSION, ATEMSCHUTZ_UEBUNG_TYPES, BEREICHE, BEREICH_KEYS, CAPACITY_DEFAULT_CATEGORIES, CATEGORIES, CHANGELOG, GRUPPENFUEHRER_CATEGORIES, LKW_KLASSEN, PKW_KLASSEN, PRIORITIES } from "./lib/constants";
import { BereichIcon } from "./components/BereichIcon";
import { atemschutzStatus, bewegungKandidaten, callServer, compressImage, currentYear, daysSince, daysUntil, emptyDraft, emptyNoticeDraft, emptyRosterEntry, emptySitzungDraft, emptyVehicle, erstelleMonatsplan, fmtDate, formatDateParts, matchesSearch, monatKey, monatLabel, normalizeBewegung, normalizeConfig, normalizeEvent, normalizeRosterEntry, normalizeSitzung, normalizeVehicle, nowTs, storageGetSafe, storageSetWithRetry, todayISO, uid } from "./lib/helpers";
import { styles } from "./lib/styles";
import { EventCard, HeroCard, SearchBox, TabBtn } from "./components/Shared";
import { AppContext } from "./AppContext";

// Kacheln werden erst geladen, wenn man sie öffnet – so startet die App immer gleich schnell.
const kachelImporte = {
  fuehrerschein: () => import("./tiles/FuehrerscheinKachel"),
  atemschutz: () => import("./tiles/AtemschutzKachel"),
  ausschuss: () => import("./tiles/AusschussKachel"),
  einstellungen: () => import("./tiles/EinstellungenKachel"),
  personalakte: () => import("./tiles/PersonalakteKachel"),
  bewegung: () => import("./tiles/BewegungsfahrtenKachel"),
};
const FuehrerscheinKachel = lazy(kachelImporte.fuehrerschein);
const AtemschutzKachel = lazy(kachelImporte.atemschutz);
const AusschussKachel = lazy(kachelImporte.ausschuss);
const EinstellungenKachel = lazy(kachelImporte.einstellungen);
const PersonalakteView = lazy(kachelImporte.personalakte);
const BewegungsfahrtenKachel = lazy(kachelImporte.bewegung);
// Ladeanzeige deckt immer den ganzen Bildschirm ab, damit die Startseite nicht kurz durchblitzt.
function KachelLaden() { return <div style={{ ...styles.fullscreenPage, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: "#8A8C86" }}>Lädt …</div>; }

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
  const [confirmBlock, setConfirmBlock] = useState(null); // { name, gesperrt }
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
  const [bewegung, setBewegung] = useState(normalizeBewegung());
  const [showBewegung, setShowBewegung] = useState(false);
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
  // Gesperrte Mitglieder (ausgetreten) tauchen in keiner Liste mehr auf – ihre Daten bleiben aber erhalten.
  const aktiveMitglieder = useMemo(() => roster.filter((r) => !r.gesperrt), [roster]);
  const isMaschinist = !!(myEntry && myEntry.maschinist);
  const isGeraetewart = !!(myEntry && myEntry.geraetewart);
  const lkwFahrzeuge = useMemo(() => vehicles.filter((v) => v.type === "lkw"), [vehicles]);
  const isAdmin = !!(me && config && config.adminNames && config.adminNames.includes(me));
  const canSeeBewegung = isAdmin || isMaschinist || isGeraetewart;
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

  const configRef = useRef(null); const rosterRef = useRef([]); const eventsRef = useRef([]); const noticesRef = useRef([]); const sitzungenRef = useRef([]); const vehiclesRef = useRef([]); const bewegungRef = useRef(normalizeBewegung());
  const lastEditRef = useRef({ config: 0, roster: 0, events: 0, notices: 0, sitzungen: 0, vehicles: 0, bewegungsfahrten: 0 });
  const EDIT_COOLDOWN_MS = 8000;
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { noticesRef.current = notices; }, [notices]);
  useEffect(() => { sitzungenRef.current = sitzungen; }, [sitzungen]);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);
  useEffect(() => { bewegungRef.current = bewegung; }, [bewegung]);

  async function fetchAllData(isInitial = false) {
    const cfgRaw = await storageGetSafe("config", true);
    const rosterRaw = await storageGetSafe("roster", true);
    const eventsRaw = await storageGetSafe("events", true);
    const noticesRaw = await storageGetSafe("notices", true);
    const sitzungenRaw = await storageGetSafe("sitzungen", true);
    const vehiclesRaw = await storageGetSafe("vehicles", true);
    const bewegungRaw = await storageGetSafe("bewegungsfahrten", true);

    // Bei Folge-Abrufen NIE mit leeren Ergebnissen überschreiben, falls
    // ein Abruf mal fehlschlägt — nur beim allerersten Laden gilt "nichts gefunden" = leer.
    let cfg = cfgRaw ? normalizeConfig(JSON.parse(cfgRaw)) : (isInitial ? null : configRef.current);
    let rst = rosterRaw ? JSON.parse(rosterRaw).map(normalizeRosterEntry) : (isInitial ? [] : rosterRef.current);
    let evs = eventsRaw ? JSON.parse(eventsRaw).map(normalizeEvent) : (isInitial ? [] : eventsRef.current);
    let nts = noticesRaw ? JSON.parse(noticesRaw) : (isInitial ? [] : noticesRef.current);
    let szg = sitzungenRaw ? JSON.parse(sitzungenRaw).map(normalizeSitzung) : (isInitial ? [] : sitzungenRef.current);
    let vhs = vehiclesRaw ? JSON.parse(vehiclesRaw).map(normalizeVehicle) : (isInitial ? [] : vehiclesRef.current);
    let bwg = bewegungRaw ? normalizeBewegung(JSON.parse(bewegungRaw)) : (isInitial ? normalizeBewegung() : bewegungRef.current);

    if (!isInitial) {
      const now = Date.now();
      if (now - lastEditRef.current.config < EDIT_COOLDOWN_MS) cfg = configRef.current;
      if (now - lastEditRef.current.roster < EDIT_COOLDOWN_MS) rst = rosterRef.current;
      if (now - lastEditRef.current.events < EDIT_COOLDOWN_MS) evs = eventsRef.current;
      if (now - lastEditRef.current.notices < EDIT_COOLDOWN_MS) nts = noticesRef.current;
      if (now - lastEditRef.current.sitzungen < EDIT_COOLDOWN_MS) szg = sitzungenRef.current;
      if (now - lastEditRef.current.vehicles < EDIT_COOLDOWN_MS) vhs = vehiclesRef.current;
      if (now - lastEditRef.current.bewegungsfahrten < EDIT_COOLDOWN_MS) bwg = bewegungRef.current;
    }

    // Automatische Endlöschung: Termine, die länger als 3 Jahre zurückliegen, werden endgültig entfernt.
    if (cfg) {
      const cutoff = `${currentYear() - 3}-01-01`;
      const before = evs.length;
      evs = evs.filter((e) => e.date >= cutoff);
      if (evs.length !== before) storageSetWithRetry("events", JSON.stringify(evs), true);
    }

    setConfig(cfg); setRoster(rst); setEvents(evs); setNotices(nts); setSitzungen(szg); setVehicles(vhs); setBewegung(bwg);
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
    setShowKontrollen(null); setG26EditOpen(false); setShowSitzungen(false); setShowSettings(false); setShowPersonalakte(false); setShowBewegung(false);
    if (kachelReturnTo === "tiles") setShowTileMenu(true);
  }
  function openTileFuehrerschein() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowKontrollen("fuehrerschein"); }
  function openTileAtemschutz() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowKontrollen("atemschutz"); }
  function openTileAusschuss() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowSitzungen(true); setSeenSitzungIds(new Set(sitzungen.map((s) => s.id))); }
  function openTileBewegung() { setShowTileMenu(false); setKachelReturnTo("tiles"); setShowBewegung(true); }
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
        else if (key === "bewegungsfahrten") setBewegung(normalizeBewegung(rawValue));
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
  async function setMemberBlocked(name, gesperrt) {
    const r = await callAuthed("auth", { action: "setBlocked", target: name, value: gesperrt });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Änderung fehlgeschlagen."); return; }
    updateRosterEntry(name, (x) => ({ ...x, gesperrt, gesperrtSeit: gesperrt ? todayISO() : null }));
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
  async function persistBewegung(next) { lastEditRef.current.bewegungsfahrten = Date.now(); setBewegung(next); const r = await storageSetWithRetry("bewegungsfahrten", JSON.stringify(next), true); if (!r.ok) flashError("Bewegungsfahrten evtl. nicht dauerhaft gespeichert."); }
  // Gezielte Benachrichtigung an bestimmte Personen (Einteilung, Mängel).
  function notifyPersons(an, title, text) {
    if (!an || an.length === 0) return;
    fetch("/.netlify/functions/send-push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ an, title, text, sender: me }) }).catch(() => {});
  }
  // Aus der Personalakte übernommene Funktionen (nur Ja/Nein) in der Mitgliederliste setzen.
  function setFunktionsFlags(name, flags) {
    updateRosterEntry(name, (r) => ({ ...r, ...flags }));
  }
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
  function eligibleVoters(s) { return aktiveMitglieder.filter((r) => r.ausschuss && (s.anwesenheit || {})[r.name] === "anwesend").map((r) => r.name); }
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
    const anwesenheitRows = aktiveMitglieder.filter((r) => r.ausschuss).map((r) => {
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
<body style="font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#2C2F2A;line-height:1.5;"><button class="no-print" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:20px;padding:9px 14px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">✕ Schließen</button><style>@media print { .no-print { display:none !important; } } @media screen { body { padding-top: 46px !important; } }</style>
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
      file = await compressImage(file);
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
      file = await compressImage(file);
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
</head><body><button class="no-print" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:20px;padding:9px 14px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">✕ Schließen</button><style>@media print { .no-print { display:none !important; } } @media screen { body { padding-top: 46px !important; } }</style>${bodyHtml}
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
    aktiveMitglieder.filter((r) => r.bereiche.includes("einsatzabteilung")).forEach((r) => {
      const pkw = r.fuehrerschein.pkw; const lkw = r.fuehrerschein.lkw;
      rows.push([r.name, !pkw.hasLicense ? "Kein PKW" : pkw.confirmedYear === currentYear() ? "Bestätigt" : "Offen", pkw.confirmedBy || "", pkw.confirmedDate ? fmtDate(pkw.confirmedDate) : "",
        !lkw.hasLicense ? "Kein LKW" : lkw.confirmedYear === currentYear() ? "Bestätigt" : "Offen", lkw.confirmedBy || "", lkw.confirmedDate ? fmtDate(lkw.confirmedDate) : "",
        lkw.hasLicense && lkw.ablaufDatum ? fmtDate(lkw.ablaufDatum) : ""]);
    });
    exportCSV(rows, `Fuehrerschein_${currentYear()}.csv`);
  }
  function exportAtemschutz() {
    const rows = [["Name", "G26 Termin", "G26 Status", "Streckendurchgang", "Übung Typ", "Übung Datum", "Unterweisung", "Einsatztauglich", "Tauglich bis"]];
    aktiveMitglieder.filter((r) => r.atemschutz).forEach((r) => {
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
    const bm = bewegung.plan[monatKey()];
    if (bm && bm.status === "geplant") {
      lkwFahrzeuge.forEach((v) => {
        const f = bm.fahrzeuge[v.id];
        if (f && !f.erledigt && (f.personen || []).includes(me)) {
          const mit = f.personen.filter((n) => n !== me);
          list.push({ key: `bewegung-${monatKey()}-${v.id}`, text: `Bewegungsfahrt diesen Monat: ${v.name}${mit.length ? ` (mit ${mit.join(", ")})` : ""}. Bitte bis Monatsende erledigen und die Abfahrtskontrolle abhaken.`, target: "bewegung" });
        }
      });
    }
    return list.filter((r) => !dismissedReminders[r.key]);
  }, [myEntry, inEinsatzabteilung, dismissedReminders, bewegung, lkwFahrzeuge, me]);

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

  const adminPendingG26 = useMemo(() => { if (!isAdmin) return []; return aktiveMitglieder.filter((r) => r.atemschutz && r.g26.pendingConfirmation); }, [aktiveMitglieder, isAdmin]);

  const incomingFsRequests = useMemo(() => {
    if (!me) return [];
    const list = [];
    aktiveMitglieder.forEach((r) => {
      ["pkw", "lkw"].forEach((type) => { if (r.fuehrerschein[type].confirmRequestTo === me) list.push({ name: r.name, type }); });
    });
    return list;
  }, [roster, me]);

  const incomingVehicleRequests = useMemo(() => {
    if (!me) return [];
    const list = [];
    aktiveMitglieder.forEach((r) => {
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

  // Ein paar Sekunden nach dem Start alle Kacheln still im Hintergrund vorladen,
  // damit sie beim Antippen sofort da sind (der Start selbst bleibt schnell).
  useEffect(() => {
    if (phase !== "app") return;
    const t = setTimeout(() => { Object.values(kachelImporte).forEach((f) => f().catch(() => {})); }, 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // Wird das eigene Konto gesperrt, meldet sich die App auf diesem Gerät sofort ab.
  useEffect(() => {
    if (phase === "app" && myEntry && myEntry.gesperrt) {
      clearAuth(); setMe(null); setCodeInput(""); setPhase("gate");
      setGateError("Dein Zugang zur App wurde gesperrt. Bei Fragen bitte beim Kommandanten melden.");
    }
  }, [phase, myEntry]);

  // Automatische Einteilung der Bewegungsfahrten: sobald ein neuer (aktiver) Monat beginnt,
  // teilt die App fair ein und benachrichtigt die Eingeteilten.
  useEffect(() => {
    if (phase !== "app" || !config || lkwFahrzeuge.length === 0) return;
    const key = monatKey();
    const monat = Number(key.slice(5));
    if (!(config.bewegung.monate || []).includes(monat)) return;
    if (bewegung.plan[key]) return;
    // Noch niemand geeignet (z. B. direkt nach dem Update)? Dann erst einteilen, wenn Maschinisten hinterlegt sind.
    if (lkwFahrzeuge.every((v) => bewegungKandidaten(aktiveMitglieder, v.id).length === 0)) return;
    const t = setTimeout(() => {
      if (bewegungRef.current.plan[key]) return;
      const plan = erstelleMonatsplan(bewegungRef.current, aktiveMitglieder, lkwFahrzeuge, config.bewegung.personen || 2, key);
      persistBewegung({ ...bewegungRef.current, plan: { ...bewegungRef.current.plan, [key]: plan } });
      lkwFahrzeuge.forEach((v) => {
        const p = plan.fahrzeuge[v.id].personen;
        notifyPersons(p, `Bewegungsfahrt ${monatLabel(key)}`, `Du bist für ${v.name} eingeteilt${p.length > 1 ? ` (mit ${p.join(", ")})` : ""}.`);
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [phase, config, lkwFahrzeuge, bewegung, aktiveMitglieder]);

  const appCtx = { phase, setPhase, config, setConfig, codeInput, setCodeInput, adminNameInput, setAdminNameInput, adminPinInput, setAdminPinInput, gateError, setGateError, gateBusy, setGateBusy, roster, setRoster, me, setMe, nameInput, setNameInput, pendingName, setPendingName, pinInput, setPinInput, pinConfirm, setPinConfirm, pinError, setPinError, events, setEvents, notices, setNotices, filter, setFilter, selectedBereiche, setSelectedBereiche, seenCategories, setSeenCategories, showForm, setShowForm, draft, setDraft, formError, setFormError, showNoticeForm, setShowNoticeForm, noticeDraft, setNoticeDraft, noticeError, setNoticeError, showSettings, setShowSettings, newCode, setNewCode, rosterSearch, setRosterSearch, newMemberName, setNewMemberName, confirmDeleteName, setConfirmDeleteName, showAdvanced, setShowAdvanced, loginSearch, setLoginSearch, confirmTargetSearch, setConfirmTargetSearch, confirmTargetType, setConfirmTargetType, confirmVehicleSearch, setConfirmVehicleSearch, confirmVehicleTarget, setConfirmVehicleTarget, newVehicleName, setNewVehicleName, newVehicleType, setNewVehicleType, confirmDeleteVehicleId, setConfirmDeleteVehicleId, confirmDeleteSitzungId, setConfirmDeleteSitzungId, editVehicleId, setEditVehicleId, editVehicleName, setEditVehicleName, editVehicleType, setEditVehicleType, showSitzungen, setShowSitzungen, sitzungen, setSitzungen, vehicles, setVehicles, showSitzungForm, setShowSitzungForm, sitzungDraft, setSitzungDraft, sitzungError, setSitzungError, expandedSitzung, setExpandedSitzung, showSitzungArchiv, setShowSitzungArchiv, showEventArchiv, setShowEventArchiv, printSitzungId, setPrintSitzungId, confirmResetG26Name, setConfirmResetG26Name, confirmResetVote, setConfirmResetVote, voteStartDraft, setVoteStartDraft, confirmDeleteEventId, setConfirmDeleteEventId, confirmDeleteNoticeId, setConfirmDeleteNoticeId, expandedEvent, setExpandedEvent, saveBanner, setSaveBanner, dismissedReminders, setDismissedReminders, showKontrollen, setShowKontrollen, showTileMenu, setShowTileMenu, kachelReturnTo, setKachelReturnTo, seenSitzungIds, setSeenSitzungIds, g26EditOpen, setG26EditOpen, g26DateInput, setG26DateInput, lightboxSrc, setLightboxSrc, showPersonalakte, setShowPersonalakte, myEntry, isAdmin, isMainAdmin, myBereiche, inEinsatzabteilung, isAtemschutz, canSeeAusschuss, canEditSitzung, canEditProtokoll, canEditCalendarFor, canEditNewsFor, editableCalendarBereiche, editableNewsBereiche, canEditAtemschutzUnterweisung, configRef, rosterRef, eventsRef, noticesRef, sitzungenRef, vehiclesRef, lastEditRef, EDIT_COOLDOWN_MS, fetchAllData, saveAuth, clearAuth, logout, authTokenRef, loadToken, saveToken, pinPrompt, setPinPrompt, pinPromptResolveRef, requestPinConfirm, submitPinPrompt, cancelPinPrompt, callAuthed, closeKachelView, openTileFuehrerschein, openTileAtemschutz, openTileAusschuss, openTilePersonalakte, openTileSettings, manualRefreshing, setManualRefreshing, showWhatsNew, setShowWhatsNew, dismissWhatsNew, manualRefresh, flashError, submitGate, persistRoster, persistEvents, persistNotices, persistConfig, updateMyRosterEntry, updateRosterEntry, pickRosterEntry, startNewName, pinBusy, setPinBusy, submitPinEntry, submitPinSetup, resetPin, removeMember, toggleAdmin, togglePermission, toggleBereichAssignment, toggleAtemschutz, adminAddMember, toggleGruppenfuehrer, toggleAusschuss, toggleAusschussRecht, persistSitzungen, persistVehicles, effectiveBereiche, toggleBereichFilter, openNew, openEdit, saveDraft, deleteEvent, toggleAttendance, setResponse, setMyGuestCount, toggleSignup, openNewNotice, openEditNotice, saveNoticeDraft, deleteNotice, openNewSitzung, openEditSitzung, saveSitzungDraft, deleteSitzung, setAnwesenheit, saveProtokollText, eligibleVoters, voteResult, startAbstimmung, castVote, finalizeAbstimmung, resetAbstimmung, triggerPrint, escapeHtml, exportSitzungFile, requestFuehrerscheinConfirmation, cancelFuehrerscheinRequest, confirmFuehrerschein, reportFuehrerscheinProblem, dismissFuehrerscheinProblem, toggleHasLicense, setLkwAblauf, setFuehrerscheinKlassen, fuehrerscheinDue, addVehicle, deleteVehicle, renameVehicle, getVehicleStatus, requestVehicleConfirmation, cancelVehicleRequest, confirmVehicleInstruction, setStreckendurchgang, resetStreckendurchgang, setAtemschutzUebung, resetAtemschutzUebung, setAtemschutzUnterweisung, resetAtemschutzUnterweisung, saveG26Date, adminConfirmG26, resetG26Date, g26PhotoUploading, setG26PhotoUploading, attachmentUploading, setAttachmentUploading, uploadG26Photo, removeG26Photo, uploadSitzungAttachment, removeSitzungAttachmentDraft, g26ReminderActive, urlBase64ToUint8Array, subscribeToPush, notifyAboutNotice, openPreviewPage, exportCSV, exportFuehrerschein, exportAtemschutz, bereichAndCategoryFiltered, filtered, archivedEvents, archivedGrouped, grouped, nextEvent, activeNotices, categoryDots, isRecent, eventBadgeLabel, myReminders, anmeldeschlussReminders, adminPendingG26, incomingFsRequests, incomingVehicleRequests, neueSitzungenCount, upcomingSitzungenTeaser, myRelevantVehicles, isIOSDevice, isStandaloneApp, iosHintDismissed, setIosHintDismissed, dismissIosHint, showIosPushHint, fontImport };
  Object.assign(appCtx, { bewegung, persistBewegung, notifyPersons, isMaschinist, isGeraetewart, lkwFahrzeuge, alleMitgliederFuerPlan: aktiveMitglieder });
  appCtx.alleMitglieder = roster;
  appCtx.roster = aktiveMitglieder;
  appCtx.confirmBlock = confirmBlock; appCtx.setConfirmBlock = setConfirmBlock; appCtx.setMemberBlocked = setMemberBlocked;

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
              {aktiveMitglieder.filter((r) => matchesSearch(r.name, loginSearch)).map((r) => (
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
    <AppContext.Provider value={appCtx}>
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
              <div style={{ flex: 1, cursor: r.target ? "pointer" : "default" }} onClick={() => { if (r.target) { setKachelReturnTo("calendar"); if (r.target === "bewegung") setShowBewegung(true); else setShowKontrollen(r.target); } }}>
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
              <EventCard key={ev.id} ev={ev} me={me} canEdit={canEditCalendarFor(ev.bereich)} expanded={expandedEvent === ev.id} onToggleExpand={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)} onRespond={setResponse} onSignup={toggleSignup} onSetGuests={setMyGuestCount} onEdit={() => openEdit(ev)} showBereich={myBereiche.length > 1} badgeLabel={eventBadgeLabel(ev)} roster={aktiveMitglieder} onToggleAttendance={toggleAttendance} />
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
                  <EventCard key={ev.id} ev={ev} me={me} canEdit={canEditCalendarFor(ev.bereich)} expanded={expandedEvent === ev.id} onToggleExpand={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)} onRespond={setResponse} onSignup={toggleSignup} onSetGuests={setMyGuestCount} onEdit={() => openEdit(ev)} showBereich={myBereiche.length > 1} badgeLabel={null} roster={aktiveMitglieder} onToggleAttendance={toggleAttendance} isArchived />
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
                    {aktiveMitglieder.filter((r) => r.bereiche.includes("einsatzabteilung") && r.gruppenfuehrer).map((r) => (
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
            {canSeeBewegung && (
              <button style={styles.tile} onClick={openTileBewegung}>
                <Truck size={26} color="#B8791A" />
                <span style={styles.tileLabel}>Bewegungsfahrten</span>
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

            {showKontrollen === "fuehrerschein" && <Suspense fallback={<KachelLaden />}><FuehrerscheinKachel /></Suspense>}

            {showKontrollen === "atemschutz" && <Suspense fallback={<KachelLaden />}><AtemschutzKachel /></Suspense>}
          </div>
        </div>
      )}

      {showSitzungen && <Suspense fallback={<KachelLaden />}><AusschussKachel /></Suspense>}
      {showBewegung && <Suspense fallback={<KachelLaden />}><BewegungsfahrtenKachel /></Suspense>}

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
              {aktiveMitglieder.filter((r) => r.ausschuss).map((r) => (
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

      {showSettings && isAdmin && <Suspense fallback={<KachelLaden />}><EinstellungenKachel /></Suspense>}

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
          <Suspense fallback={<KachelLaden />}><PersonalakteView me={me} isAdmin={isAdmin} roster={roster} config={config} callAuthed={callAuthed} flashError={flashError}
            onOpenPhoto={setLightboxSrc} onSetKlassen={setFuehrerscheinKlassen} onSetFlags={setFunktionsFlags} onClose={closeKachelView} /></Suspense>
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

      {confirmBlock && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setConfirmBlock(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <ShieldAlert size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{confirmBlock.name} wirklich {confirmBlock.gesperrt ? "sperren" : "entsperren"}?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>{confirmBlock.gesperrt
              ? "Kein Zugriff mehr auf die App, keine Benachrichtigungen, verschwindet aus allen Listen. Alle Daten und die Personalakte bleiben erhalten. In der Akte wird automatisch \"Austritt\" mit heutigem Datum eingetragen."
              : "Die Person kann sich wieder mit ihrer bisherigen PIN anmelden und erscheint wieder in allen Listen. In der Akte wird automatisch \"Wiedereintritt\" mit heutigem Datum eingetragen."}</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setConfirmBlock(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={() => { setMemberBlocked(confirmBlock.name, confirmBlock.gesperrt); setConfirmBlock(null); }}>{confirmBlock.gesperrt ? "Sperren" : "Entsperren"}</button>
            </div>
          </div>
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
    </AppContext.Provider>
  );
}
