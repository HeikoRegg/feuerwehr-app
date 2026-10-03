// Kachel Einsatzberichte – digitale Version des Papier-Einsatzzettels.
// Schreiben: Gruppenführer und Admins. Lesen: alle – ohne Namen der Einsatzkräfte, nur die Anzahl.
// Fotos: nur Einsatzabteilung und Admins. Die Rechte prüft der Server (netlify/functions/einsatzbericht.js).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Printer, Trash2, Truck, Users, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { EINSATZ_STICHWORTE } from "../lib/constants";
import { compressImage, fmtDate, geraetTeile, matchesSearch, todayISO, uid } from "../lib/helpers";
import { styles } from "../lib/styles";
import { bereiteFensterVor, oeffneBericht } from "../lib/bericht";
import { SearchBox } from "../components/Shared";
import { useApp } from "../AppContext";
import { hole, merke } from "../lib/zwischenspeicher";
import { zuMin, fmtHM, normHM, zeitEingabe } from "../lib/zeit";

// ---------------- Hilfen ----------------
const zahl = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
const fmtZahl = (n) => (Math.round(n * 100) / 100).toLocaleString("de-DE");
export function dauerMinuten(alarm, ende) {
  if (!/^\d{2}:\d{2}$/.test(alarm || "") || !/^\d{2}:\d{2}$/.test(ende || "")) return null;
  const [ah, am] = alarm.split(":").map(Number); const [eh, em] = ende.split(":").map(Number);
  let d = eh * 60 + em - (ah * 60 + am);
  if (d < 0) d += 1440; // über Mitternacht
  return d;
}
export function fmtDauer(min) {
  if (min === null || min === undefined) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} Std.${m ? ` ${m} Min.` : ""}` : `${m} Min.`;
}
// Vorschlag für die Einsatzzeit: genau die Minuten zwischen Alarmierung und Einsatzende (Std:Min, ohne Rundung).
const stundenVorschlag = (min) => (min ? fmtHM(min) : "");
// Summen aus dem Bericht in Minuten (neue Berichte: stundenMin; ältere Antworten nur als Dezimalstunden)
const minVon = (b, feld) => (b[`${feld}Min`] ?? Math.round((b[feld] || 0) * 60));
const fmtStd = (min) => fmtHM(min);
const istZeitEinheit = (e) => /^std\.?$/i.test(String(e || "").trim());
const neuerEntwurf = () => ({
  id: uid(), neu: true, einsatz: "", ort: "", datum: todayISO(), alarm: "", ende: "",
  fahrzeuge: [], fahrzeugNamen: {}, sonstigeFahrzeuge: "", kopieKasse: false,
  mannschaft: [], geraete: {}, fahrzeugWerte: {}, sonstigesMaterial: "", bemerkung: "", fotos: [],
});

// ---------------- Druck / PDF ----------------
async function alsDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
}
export function einsatzBerichtModell(item, { fotos = [] } = {}) {
  const fz = (item.fahrzeuge || []).map((id) => (item.fahrzeugNamen || {})[id] || "Fahrzeug");
  const fzName = (id) => (item.fahrzeugNamen || {})[id] || "";
  const blocks = [
    { t: "h1", text: `${item.nummer || "Einsatzbericht"}${item.einsatz ? ` · ${item.einsatz}` : ""}` },
    { t: "felder", items: [
      { label: "Einsatz-Nummer", value: item.nummer || "" }, { label: "Datum", value: fmtDate(item.datum) },
      { label: "Einsatz", value: item.einsatz }, { label: "Ort", value: item.ort },
      { label: "Alarmierung", value: item.alarm ? `${item.alarm} Uhr` : "" }, { label: "Einsatzende", value: item.ende ? `${item.ende} Uhr` : "" },
      { label: "Einsatzdauer", value: fmtDauer(dauerMinuten(item.alarm, item.ende)) }, { label: "Kopie an Kasse", value: item.kopieKasse ? "ja" : "nein" },
      { label: "Einsatzgerät", value: [...fz, item.sonstigeFahrzeuge].filter(Boolean).join(", ") }, { label: "Einsatzkräfte", value: `${item.kraefte || 0}${item.paTraeger ? `, davon ${item.paTraeger} unter Atemschutz` : ""}` },
    ] },
  ];
  if (item.mannschaft) {
    blocks.push({ t: "h3", text: `Mannschaft (${item.mannschaft.length})` });
    const mitFz = item.mannschaft.some((m) => fzName(m.fahrzeug));
    const zeilen = item.mannschaft.map((m, i) => [String(i + 1), m.name, zuMin(m.ein) ? fmtHM(zuMin(m.ein)) : "", zuMin(m.ber) ? fmtHM(zuMin(m.ber)) : "", zuMin(m.pa) ? fmtHM(zuMin(m.pa)) : "", ...(mitFz ? [fzName(m.fahrzeug)] : [])]);
    zeilen.push(["", "Summe (Std:Min)", fmtStd(minVon(item, "stunden")), fmtStd(minVon(item, "stundenBer")), fmtStd(minVon(item, "stundenPa")), ...(mitFz ? [""] : [])]);
    blocks.push({ t: "tabelle", kopf: ["Nr.", "Name", "EIN Std:Min", "BER Std:Min", "PA Std:Min", ...(mitFz ? ["Fahrzeug"] : [])], zeilen, breiten: [0.6, 3.2, 1.1, 1.1, 1.1, ...(mitFz ? [2] : [])] });
    blocks.push({ t: "text", text: "EIN = Einsatz, BER = Bereitschaft, PA = unter Atemschutz", klein: true, grau: true });
  } else {
    blocks.push({ t: "h3", text: "Mannschaft" });
    blocks.push({ t: "text", text: `${item.kraefte || 0} Einsatzkräfte · ${fmtStd(minVon(item, "stunden"))} Std. Einsatzzeit gesamt${item.paTraeger ? ` · ${item.paTraeger} unter Atemschutz` : ""}` });
  }
  const geraete = [];
  (item.fahrzeuge || []).forEach((id) => {
    const w = (item.fahrzeugWerte || {})[id] || {};
    if (zahl(w.km)) geraete.push([`Gefahrene Kilometer ${fzName(id)}`, fmtZahl(zahl(w.km)), "km"]);
    if (zuMin(w.pumpe)) geraete.push([`Pumpenstunden ${fzName(id)}`, fmtHM(zuMin(w.pumpe)), "Std:Min"]);
  });
  if (item.paTraeger) geraete.push(["Anzahl der eingesetzten PA", String(item.paTraeger), "Stück"]);
  if (minVon(item, "stundenPa")) geraete.push(["Einsatzdauer PA", fmtStd(minVon(item, "stundenPa")), "Std:Min"]);
  Object.entries(item.geraete || {}).forEach(([k, v]) => { const t = geraetTeile(k); if (istZeitEinheit(t.einheit)) { if (zuMin(v)) geraete.push([t.name, fmtHM(zuMin(v)), "Std:Min"]); } else if (zahl(v)) geraete.push([t.name, fmtZahl(zahl(v)), t.einheit]); });
  if (geraete.length || item.sonstigesMaterial) {
    blocks.push({ t: "h3", text: "Anzahl und Betriebsdauer der eingesetzten Geräte" });
    if (geraete.length) blocks.push({ t: "tabelle", kopf: ["Gerät / Material", "Menge", "Einheit"], zeilen: geraete, breiten: [5, 1.2, 1.2] });
    if (item.sonstigesMaterial) blocks.push({ t: "text", text: `Sonstiges: ${item.sonstigesMaterial}` });
  }
  if (item.bemerkung) { blocks.push({ t: "h3", text: "Bemerkungen zum Einsatz" }); blocks.push({ t: "text", text: item.bemerkung }); }
  if (fotos.length) { blocks.push({ t: "h3", text: `Fotos (${fotos.length})` }); fotos.forEach((src) => blocks.push({ t: "bild", src })); }
  if (item.erstelltVon) blocks.push({ t: "text", text: `Erfasst von ${item.erstelltVon}${item.geaendertVon && item.geaendertVon !== item.erstelltVon ? `, zuletzt geändert von ${item.geaendertVon}` : ""}.`, klein: true, grau: true });
  return {
    titel: `Einsatzbericht ${item.nummer || ""}`.trim(),
    untertitel: `Einsatzbericht ${item.nummer || ""} · ${fmtDate(item.datum)}${item.mannschaft ? " · enthält Namen – vertraulich" : ""}`,
    dateiname: `Einsatzbericht_${String(item.nummer || item.datum).replace(/[./]/g, "-")}`,
    blocks,
  };
}

// ---------------- Foto-Großansicht mit Blättern ----------------
// Pfeile links/rechts, Wischen (iPhone), Pfeiltasten (PC), Zähler „2 / 5“.
function FotoGalerie({ fotos, start, onClose }) {
  const [i, setI] = useState(start);
  const touch = useRef(null);
  const n = fotos.length;
  const vor = () => setI((x) => (x + 1) % n);
  const zurueck = () => setI((x) => (x - 1 + n) % n);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "ArrowRight") vor(); else if (e.key === "ArrowLeft") zurueck(); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);
  const pfeil = (seite) => ({ position: "fixed", top: "50%", [seite]: 10, transform: "translateY(-50%)", background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%", width: 44, height: 44, zIndex: 91, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });
  return (
    <div role="dialog" aria-label="Fotos ansehen" data-testid="foto-galerie" style={styles.lightboxBackdrop} onClick={onClose}
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => { const a = touch.current; touch.current = null; if (!a || n < 2) return; const t = e.changedTouches[0]; const dx = t.clientX - a.x, dy = t.clientY - a.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.stopPropagation(); if (dx < 0) vor(); else zurueck(); } }}>
      <button style={styles.lightboxClose} onClick={onClose} aria-label="Schließen"><X size={22} color="white" /></button>
      {n > 1 && <div data-testid="foto-zaehler" style={{ position: "fixed", top: 22, left: 0, right: 0, textAlign: "center", color: "white", fontSize: 14, fontWeight: 700, zIndex: 91, pointerEvents: "none" }}>{i + 1} / {n}</div>}
      {n > 1 && <button style={pfeil("left")} onClick={(e) => { e.stopPropagation(); zurueck(); }} aria-label="Vorheriges Foto"><ChevronLeft size={26} color="white" /></button>}
      <img key={fotos[i]} src={fotos[i]} alt="" style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
      {n > 1 && <button style={pfeil("right")} onClick={(e) => { e.stopPropagation(); vor(); }} aria-label="Nächstes Foto"><ChevronRight size={26} color="white" /></button>}
    </div>
  );
}

// ---------------- kleine Bausteine ----------------
function Abschnitt({ titel, children, rechts }) {
  return (
    <div style={{ ...styles.kontrollRow, padding: "11px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.05em" }}>{titel}</div>
        {rechts}
      </div>
      {children}
    </div>
  );
}
function Feld({ label, children, style }) {
  return <div style={{ marginBottom: 8, ...style }}><div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 3 }}>{label}</div>{children}</div>;
}
const inp = { ...styles.input, padding: "8px 10px", fontSize: 14 };
const zahlInp = { ...styles.input, padding: "6px 4px", fontSize: 13.5, textAlign: "center" };
function Kpi({ wert, label }) {
  return (
    <div style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color: "#2C2F2A" }}>{wert}</div>
      <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}
function BerichtKarte({ b, onClick }) {
  const dauer = dauerMinuten(b.alarm, b.ende);
  return (
    <button onClick={onClick} className="card-enter" style={{ ...styles.eventCard, borderLeftColor: "#C1272D", width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "center", cursor: "pointer", font: "inherit" }}>
      <div style={{ ...styles.eventDateCol, minWidth: 46 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#C1272D" }}>{String(b.nr).padStart(2, "0")}</div>
        <div style={styles.eventWeekday}>{b.datum ? `${b.datum.slice(8, 10)}.${b.datum.slice(5, 7)}.` : ""}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...styles.eventTitle, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.einsatz || "Einsatz"}</div>
        <div style={styles.eventMeta}>
          {b.ort && <span style={styles.eventMetaItem}><MapPin size={11} /> {b.ort}</span>}
          {dauer !== null && <span style={styles.eventMetaItem}><Clock size={11} /> {fmtDauer(dauer)}</span>}
          <span style={styles.eventMetaItem}><Users size={11} /> {b.kraefte}</span>
          {b.fotoAnzahl > 0 && <span style={styles.eventMetaItem}><Camera size={11} /> {b.fotoAnzahl}</span>}
        </div>
      </div>
      <ChevronRight size={16} color="#A5A79F" />
    </button>
  );
}

// ---------------- Kachel ----------------
export default function EinsatzberichtKachel() {
  const { roster, vehicles, config, persistConfig, isAdmin, me, callAuthed, flashError, closeKachelView, kachelReturnTo } = useApp();
  const [galerie, setGalerie] = useState(null); // { urls, start }
  // Zuletzt geladene Liste sofort zeigen (auch nach einem Neustart der App), dann im Hintergrund auffrischen.
  const cacheKey = `einsatz:${me}`;
  const [gemerkt] = useState(() => hole(cacheKey));
  const [liste, setListe] = useState(gemerkt ? gemerkt.items : null);
  const [einsatzjahr, setEinsatzjahr] = useState(gemerkt ? gemerkt.einsatzjahr : null);
  const [rechte, setRechte] = useState((gemerkt && gemerkt.rechte) || { schreiben: false, namen: false, fotos: false });
  const [archivAnzahl, setArchivAnzahl] = useState((gemerkt && gemerkt.archiv) || {}); // Einsatzjahr -> Anzahl
  const [archivListen, setArchivListen] = useState({}); // Einsatzjahr -> Berichte (erst beim Aufklappen geladen)
  const [fehler, setFehler] = useState("");
  const [ansicht, setAnsicht] = useState({ typ: "liste" }); // liste | detail | form
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [archivOffen, setArchivOffen] = useState({});
  const [jahrDialog, setJahrDialog] = useState(null); // Name des neuen Einsatzjahrs
  const [mSuche, setMSuche] = useState("");
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [geraeteOffen, setGeraeteOffen] = useState(false);
  const [mitFotos, setMitFotos] = useState(true);
  const [druckt, setDruckt] = useState(false);

  async function laden() {
    setFehler("");
    const r = await callAuthed("einsatzbericht", { action: "list" });
    if (r.ok) {
      setListe(r.data.items || []); setEinsatzjahr(r.data.einsatzjahr); setRechte(r.data.rechte || {}); setArchivAnzahl(r.data.archiv || {});
      setArchivListen({}); // aufgeklappte Archivjahre neu laden
      Object.keys(archivOffenRef.current).filter((j) => archivOffenRef.current[j]).forEach((j) => archivLaden(j));
      merke(cacheKey, { items: r.data.items || [], einsatzjahr: r.data.einsatzjahr, rechte: r.data.rechte || {}, archiv: r.data.archiv || {} }, { dauerhaft: true });
    }
    else if (r.data && r.data.error === "abgebrochen") closeKachelView();
    else { setListe([]); setFehler((r.data && r.data.error) || "Einsatzberichte konnten nicht geladen werden."); }
  }
  useEffect(() => { laden(); }, []);
  const archivOffenRef = useRef({});
  useEffect(() => { archivOffenRef.current = archivOffen; }, [archivOffen]);
  async function archivLaden(jahr) {
    const r = await callAuthed("einsatzbericht", { action: "archiv", jahr });
    if (r.ok) setArchivListen((a) => ({ ...a, [jahr]: r.data.items || [] }));
    else if (r.data && r.data.error !== "abgebrochen") flashError(r.data.error || "Archiv konnte nicht geladen werden.");
  }
  function archivUmschalten(j) {
    const auf = !archivOffen[j];
    setArchivOffen({ ...archivOffen, [j]: auf });
    if (auf && !archivListen[j]) archivLaden(j);
  }

  async function oeffnen(id) {
    setAnsicht({ typ: "detail", id }); setDetail(null);
    const r = await callAuthed("einsatzbericht", { action: "get", id });
    if (r.ok) setDetail(r.data.item);
    else { flashError((r.data && r.data.error) || "Bericht konnte nicht geladen werden."); setAnsicht({ typ: "liste" }); }
  }
  function neu() { setDraft(neuerEntwurf()); setGeraeteOffen(false); setMSuche(""); setAnsicht({ typ: "form" }); }
  function bearbeiten(item) {
    const { nummer, kraefte, paTraeger, stunden, stundenBer, stundenPa, fotoAnzahl, ...rest } = item;
    setDraft({ ...neuerEntwurf(), ...rest, mannschaft: (item.mannschaft || []).map((m) => ({ ...m, ein: normHM(m.ein), ber: normHM(m.ber), pa: normHM(m.pa) })),
      geraete: Object.fromEntries(Object.entries(item.geraete || {}).map(([k, v]) => [k, istZeitEinheit(geraetTeile(k).einheit) ? normHM(v) : v])),
      fahrzeugWerte: Object.fromEntries(Object.entries(item.fahrzeugWerte || {}).map(([k, w]) => [k, { ...w, ...(w && w.pumpe ? { pumpe: normHM(w.pumpe) } : {}) }])), fotos: item.fotos || [], neu: false });
    setGeraeteOffen(Object.values(item.geraete || {}).some((v) => zuMin(v) || zahl(v)) || !!item.sonstigesMaterial || Object.values(item.fahrzeugWerte || {}).some((w) => zahl(w.km) || zuMin(w.pumpe)));
    setMSuche(""); setAnsicht({ typ: "form" });
  }
  function abbrechen() {
    if (!window.confirm("Eingaben verwerfen?")) return;
    setAnsicht(draft && !draft.neu ? { typ: "detail", id: draft.id } : { typ: "liste" });
    setDraft(null);
  }
  async function speichern() {
    if (!draft.einsatz.trim()) { flashError("Bitte eintragen, was für ein Einsatz es war."); return; }
    if (!draft.datum) { flashError("Bitte das Datum eintragen."); return; }
    setSaving(true);
    const { neu: _n, fotos, ...rest } = draft;
    const fahrzeugNamen = {};
    draft.fahrzeuge.forEach((id) => { const v = vehicles.find((x) => x.id === id); fahrzeugNamen[id] = v ? v.name : (draft.fahrzeugNamen || {})[id] || "Fahrzeug"; });
    const data = { ...rest, fahrzeugNamen, fotos: fotos.map((f) => ({ path: f.path, name: f.name || "" })) };
    const r = await callAuthed("einsatzbericht", { action: "save", id: draft.id, data });
    setSaving(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern fehlgeschlagen."); return; }
    const id = draft.id;
    setDraft(null);
    await laden();
    oeffnen(id);
  }
  async function loeschen(item) {
    if (!window.confirm(`Einsatzbericht ${item.nummer} wirklich löschen? Fotos werden ebenfalls gelöscht.`)) return;
    const r = await callAuthed("einsatzbericht", { action: "delete", id: item.id });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen fehlgeschlagen."); return; }
    setAnsicht({ typ: "liste" }); laden();
  }
  async function fotoHochladen(file) {
    if (!file) return;
    setUploading(true);
    try {
      const klein = await compressImage(file);
      const r = await callAuthed("einsatzbericht", { action: "uploadUrl", id: draft.id, filename: klein.name });
      if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
      const { error } = await supabase.storage.from("einsatzberichte").uploadToSignedUrl(r.data.path, r.data.uploadToken, klein);
      if (error) throw error;
      const url = URL.createObjectURL(klein);
      setDraft((d) => ({ ...d, fotos: [...d.fotos, { path: r.data.path, name: klein.name, url }] }));
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setUploading(false);
  }
  async function drucken(item) {
    const w = bereiteFensterVor(); // PC: Fenster sofort öffnen
    setDruckt(true);
    let fotos = [];
    if (mitFotos && item.fotos && item.fotos.length) {
      fotos = (await Promise.all(item.fotos.filter((f) => f.url).map((f) => alsDataUrl(f.url).catch(() => null)))).filter(Boolean);
    }
    setDruckt(false);
    if (!oeffneBericht(einsatzBerichtModell(item, { fotos }), w)) flashError("Das Druckfenster wurde vom Browser blockiert.");
  }
  async function neuesEinsatzjahr() {
    const name = String(jahrDialog || "").trim();
    if (!name) return;
    const vorher = config.einsatzjahr ? [...(config.einsatzjahrVorher || []), config.einsatzjahr] : (config.einsatzjahrVorher || []);
    await persistConfig({ ...config, einsatzjahr: { name, beginn: todayISO() }, einsatzjahrVorher: vorher });
    setJahrDialog(null);
    laden();
  }

  const zurueck = <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>;

  // ======================= FORMULAR =======================
  if (ansicht.typ === "form" && draft) {
    const dauer = dauerMinuten(draft.alarm, draft.ende);
    const vorschlag = stundenVorschlag(dauer);
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const ausgewaehlt = new Set(draft.mannschaft.map((m) => m.name));
    const pool = roster.filter((r) => alleZeigen || r.bereiche.includes("einsatzabteilung") || ausgewaehlt.has(r.name)).filter((r) => matchesSearch(r.name, mSuche));
    const gewaehlteFz = draft.fahrzeuge.map((id) => vehicles.find((v) => v.id === id) || { id, name: (draft.fahrzeugNamen || {})[id] || "Fahrzeug", type: "pkw" });
    const toggleFz = (id) => {
      const an = draft.fahrzeuge.includes(id);
      set({ fahrzeuge: an ? draft.fahrzeuge.filter((x) => x !== id) : [...draft.fahrzeuge, id],
        mannschaft: an ? draft.mannschaft.map((m) => (m.fahrzeug === id ? { ...m, fahrzeug: "" } : m)) : draft.mannschaft });
    };
    const togglePerson = (name) => {
      if (ausgewaehlt.has(name)) set({ mannschaft: draft.mannschaft.filter((m) => m.name !== name) });
      else set({ mannschaft: [...draft.mannschaft, { name, ein: vorschlag, ber: "", pa: "", fahrzeug: draft.fahrzeuge.length === 1 ? draft.fahrzeuge[0] : "" }] });
    };
    const setM = (name, patch) => set({ mannschaft: draft.mannschaft.map((m) => (m.name === name ? { ...m, ...patch } : m)) });
    const summeEin = draft.mannschaft.reduce((s, m) => s + zuMin(m.ein), 0);
    const paAnzahl = draft.mannschaft.filter((m) => zuMin(m.pa) > 0).length;
    const paStd = draft.mannschaft.reduce((s, m) => s + zuMin(m.pa), 0);
    const fruehereStichworte = [...new Set([...(liste || []), ...Object.values(archivListen).flat()].map((b) => b.einsatz).filter(Boolean))];
    return (
      <div style={styles.fullscreenPage}>
        {galerie && <FotoGalerie fotos={galerie.urls} start={galerie.start} onClose={() => setGalerie(null)} />}
        <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={abbrechen}><X size={18} /> Abbrechen</button></div>
        <div style={styles.modalTitle}>{draft.neu ? "Neuer Einsatzbericht" : `Einsatzbericht ${draft.nummer || ""} bearbeiten`}</div>
        <div style={{ fontSize: 11.5, color: "#8A8C86", margin: "2px 0 12px" }}>{draft.neu ? `Die Einsatznummer wird beim Speichern vergeben (Einsatzjahr ${einsatzjahr || ""}).` : "Änderungen werden erst mit „Speichern“ übernommen."}</div>

        <Abschnitt titel="EINSATZ">
          <Feld label="Einsatz (Stichwort)">
            <input style={inp} list="einsatz-stichworte" placeholder="z. B. Ölspur" value={draft.einsatz} onChange={(e) => set({ einsatz: e.target.value })} />
            <datalist id="einsatz-stichworte">{[...new Set([...EINSATZ_STICHWORTE, ...fruehereStichworte])].map((s) => <option key={s} value={s} />)}</datalist>
          </Feld>
          <Feld label="Ort"><input style={inp} placeholder="z. B. Regglisweiler, Hauptstraße 5" value={draft.ort} onChange={(e) => set({ ort: e.target.value })} /></Feld>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Feld label="Datum" style={{ flex: "1 1 140px" }}><input style={inp} type="date" value={draft.datum} onChange={(e) => set({ datum: e.target.value })} /></Feld>
            <Feld label="Alarmierung" style={{ flex: "1 1 90px" }}><input style={inp} type="time" value={draft.alarm} onChange={(e) => set({ alarm: e.target.value })} /></Feld>
            <Feld label="Einsatzende" style={{ flex: "1 1 90px" }}><input style={inp} type="time" value={draft.ende} onChange={(e) => set({ ende: e.target.value })} /></Feld>
          </div>
          {dauer !== null && <div style={{ fontSize: 12, color: "#5C5F58" }}>Einsatzdauer: <strong>{fmtDauer(dauer)}</strong>{draft.ende < draft.alarm ? " (über Mitternacht)" : ""}</div>}
        </Abschnitt>

        <Abschnitt titel="EINSATZGERÄT / FAHRZEUGE">
          {vehicles.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F", marginBottom: 6 }}>Noch keine Fahrzeuge angelegt (Führerschein-Kachel → Fahrzeuge).</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {vehicles.map((v) => {
              const an = draft.fahrzeuge.includes(v.id);
              return <button key={v.id} onClick={() => toggleFz(v.id)} style={{ ...styles.categoryChip, padding: "7px 12px", fontSize: 13, background: an ? "#C1272D" : "#F3F1EC", color: an ? "white" : "#5C5F58", borderColor: an ? "#C1272D" : "#E2DFD6" }}><Truck size={13} style={{ verticalAlign: -2 }} /> {v.name}</button>;
            })}
          </div>
          <Feld label="Sonstige (z. B. Privatfahrzeuge, andere Wehren)"><input style={inp} value={draft.sonstigeFahrzeuge} onChange={(e) => set({ sonstigeFahrzeuge: e.target.value })} /></Feld>
        </Abschnitt>

        <Abschnitt titel={`MANNSCHAFT (${draft.mannschaft.length})`} rechts={vorschlag && draft.mannschaft.length > 0 ? <button style={styles.tinyBtn} onClick={() => set({ mannschaft: draft.mannschaft.map((m) => ({ ...m, ein: vorschlag })) })}>Alle: {vorschlag} Std.</button> : null}>
          {draft.mannschaft.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 52px 52px", gap: 4, fontSize: 10, fontWeight: 700, color: "#8A8C86", marginBottom: 3, paddingRight: 30 }}>
                <span>Name</span><span style={{ textAlign: "center" }}>EIN</span><span style={{ textAlign: "center" }}>BER</span><span style={{ textAlign: "center" }}>PA</span>
              </div>
              {draft.mannschaft.map((m) => (
                <div key={m.name} style={{ borderBottom: "1px dashed #E2DFD6", padding: "5px 0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 52px 52px 26px", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    {["ein", "ber", "pa"].map((k) => <input key={k} style={zahlInp} inputMode="numeric" placeholder="0:00" aria-label={`${k.toUpperCase()} Stunden ${m.name}`} value={m[k]} onChange={(e) => setM(m.name, { [k]: zeitEingabe(e.target.value) })} onBlur={(e) => setM(m.name, { [k]: normHM(e.target.value) })} />)}
                    <button style={styles.tinyIconBtn} aria-label={`${m.name} entfernen`} onClick={() => togglePerson(m.name)}><X size={12} /></button>
                  </div>
                  {gewaehlteFz.length > 1 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, color: "#8A8C86" }}>auf</span>
                      {gewaehlteFz.map((v) => <button key={v.id} onClick={() => setM(m.name, { fahrzeug: m.fahrzeug === v.id ? "" : v.id })} style={{ ...styles.tinyBtn, background: m.fahrzeug === v.id ? "#2C2F2A" : "#F3F1EC", color: m.fahrzeug === v.id ? "white" : "#5C5F58" }}>{v.name}</button>)}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 6 }}>Zeiten als Std:Min, z. B. 1:23. EIN = Einsatz, BER = Bereitschaft (z. B. Gerätehaus besetzt), PA = unter Atemschutz. Summe Einsatz: {fmtHM(summeEin)} Std.{paAnzahl ? ` · ${paAnzahl} PA, ${fmtHM(paStd)} Std.` : ""}</div>
            </div>
          )}
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5C5F58", marginBottom: 6 }}>{draft.mannschaft.length ? "Weitere Einsatzkräfte" : "Einsatzkräfte antippen"}{vorschlag ? ` – bekommen ${vorschlag} Std. (genau Alarm bis Ende) vorgeschlagen` : " – tipp vorher Alarmierung und Ende ein, dann werden die Stunden vorgeschlagen"}</div>
          <SearchBox value={mSuche} onChange={setMSuche} placeholder="Name suchen …" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pool.filter((r) => !ausgewaehlt.has(r.name)).map((r) => (
              <button key={r.name} onClick={() => togglePerson(r.name)} style={{ ...styles.categoryChip, fontSize: 12.5, padding: "6px 10px" }}><Plus size={11} style={{ verticalAlign: -1 }} /> {r.name}</button>
            ))}
          </div>
          <label style={{ ...styles.checkboxRow, marginTop: 8, fontSize: 12 }}><input type="checkbox" checked={alleZeigen} onChange={(e) => setAlleZeigen(e.target.checked)} /> Auch Mitglieder außerhalb der Einsatzabteilung zeigen</label>
        </Abschnitt>

        <Abschnitt titel="GERÄTE & MATERIAL" rechts={<button style={styles.tinyBtn} onClick={() => setGeraeteOffen(!geraeteOffen)}>{geraeteOffen ? "einklappen" : "ausfüllen"} <ChevronDown size={10} style={{ transform: geraeteOffen ? "rotate(180deg)" : "none", verticalAlign: -1 }} /></button>}>
          {!geraeteOffen && <div style={{ fontSize: 12, color: "#8A8C86" }}>Betriebsstunden, Kilometer, Schläuche, Ölbindemittel … – nur wenn etwas eingesetzt wurde.</div>}
          {geraeteOffen && (
            <>
              {gewaehlteFz.map((v) => {
                const w = draft.fahrzeugWerte[v.id] || {};
                const setW = (patch) => set({ fahrzeugWerte: { ...draft.fahrzeugWerte, [v.id]: { ...w, ...patch } } });
                return (
                  <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 100px" }}>{v.name}</span>
                    <label style={{ fontSize: 11.5, color: "#5C5F58", display: "flex", alignItems: "center", gap: 4 }}><input style={{ ...zahlInp, width: 64 }} inputMode="decimal" value={w.km || ""} onChange={(e) => setW({ km: e.target.value.replace(/[^0-9.,]/g, "") })} /> km</label>
                    {v.type === "lkw" && <label style={{ fontSize: 11.5, color: "#5C5F58", display: "flex", alignItems: "center", gap: 4 }}><input style={{ ...zahlInp, width: 64 }} inputMode="numeric" placeholder="0:00" aria-label={`Pumpen-Std. ${v.name}`} value={w.pumpe || ""} onChange={(e) => setW({ pumpe: zeitEingabe(e.target.value) })} onBlur={(e) => setW({ pumpe: normHM(e.target.value) })} /> Pumpen-Std:Min</label>}
                  </div>
                );
              })}
              {paAnzahl > 0 && <div style={{ fontSize: 11.5, color: "#5C5F58", margin: "4px 0 8px" }}>Atemschutz aus der Mannschaft: {paAnzahl} PA, {fmtHM(paStd)} Std.</div>}
              {(config.einsatzGeraete || []).map((g) => {
                const t = geraetTeile(g);
                return (
                  <div key={g} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{t.name}</span>
                    {istZeitEinheit(t.einheit)
                      ? <input style={{ ...zahlInp, width: 64 }} inputMode="numeric" placeholder="0:00" aria-label={t.name} value={draft.geraete[g] || ""} onChange={(e) => set({ geraete: { ...draft.geraete, [g]: zeitEingabe(e.target.value) } })} onBlur={(e) => set({ geraete: { ...draft.geraete, [g]: normHM(e.target.value) } })} />
                      : <input style={{ ...zahlInp, width: 64 }} inputMode="decimal" aria-label={t.name} value={draft.geraete[g] || ""} onChange={(e) => set({ geraete: { ...draft.geraete, [g]: e.target.value.replace(/[^0-9.,]/g, "") } })} />}
                    <span style={{ fontSize: 11, color: "#8A8C86", width: 40 }}>{istZeitEinheit(t.einheit) ? "Std:Min" : t.einheit}</span>
                  </div>
                );
              })}
              <Feld label="Sonstiges" style={{ marginTop: 8 }}><input style={inp} value={draft.sonstigesMaterial} onChange={(e) => set({ sonstigesMaterial: e.target.value })} /></Feld>
            </>
          )}
        </Abschnitt>

        <Abschnitt titel="BEMERKUNGEN ZUM EINSATZ">
          <textarea style={{ ...inp, minHeight: 110, resize: "vertical" }} placeholder="Lage beim Eintreffen, durchgeführte Maßnahmen, Besonderheiten …" value={draft.bemerkung} onChange={(e) => set({ bemerkung: e.target.value })} />
        </Abschnitt>

        <Abschnitt titel={`FOTOS (${draft.fotos.length})`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {draft.fotos.map((f) => (
              <div key={f.path} style={{ position: "relative" }}>
                {f.url ? <img src={f.url} alt="" onClick={() => { const urls = draft.fotos.map((x) => x.url).filter(Boolean); setGalerie({ urls, start: Math.max(0, urls.indexOf(f.url)) }); }} style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6", cursor: "zoom-in" }} />
                  : <div style={{ width: 84, height: 64, borderRadius: 5, background: "#EEEEEC" }} />}
                <button aria-label="Foto entfernen" onClick={() => set({ fotos: draft.fotos.filter((x) => x.path !== f.path) })} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: "none", background: "#2C2F2A", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
              </div>
            ))}
          </div>
          <label style={{ ...styles.smallAddBtn, display: "inline-flex", padding: "6px 12px", fontSize: 12 }}>
            {uploading ? "Lädt hoch …" : <><Camera size={13} /> Foto aufnehmen / auswählen</>}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async (e) => { const files = [...e.target.files]; e.target.value = ""; for (const f of files) await fotoHochladen(f); }} />
          </label>
          <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 6 }}>Fotos sehen nur die Einsatzabteilung und die Admins. Bitte an die Persönlichkeitsrechte denken (keine erkennbaren Betroffenen).</div>
        </Abschnitt>

        <Abschnitt titel="ABRECHNUNG">
          <label style={{ ...styles.checkboxRow, fontSize: 13 }}><input type="checkbox" checked={draft.kopieKasse} onChange={(e) => set({ kopieKasse: e.target.checked })} /> Kopie an Kasse</label>
        </Abschnitt>

        <div style={{ position: "sticky", bottom: 0, background: "#F3F1EC", padding: "10px 0 12px" }}>
          <button style={{ ...styles.saveBtn, width: "100%" }} disabled={saving || uploading} onClick={speichern}>{saving ? "Speichert …" : draft.neu ? "Einsatzbericht speichern" : "Änderungen speichern"}</button>
        </div>
      </div>
    );
  }

  // ======================= DETAIL =======================
  if (ansicht.typ === "detail") {
    const b = detail;
    const dauer = b ? dauerMinuten(b.alarm, b.ende) : null;
    const zeile = (label, wert) => (wert ? <div style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid #F3F1EC", fontSize: 13 }}><span style={{ width: 110, color: "#8A8C86", flexShrink: 0 }}>{label}</span><span style={{ fontWeight: 600, color: "#2C2F2A" }}>{wert}</span></div> : null);
    const modell = b ? einsatzBerichtModell(b) : null;
    const geraeteTab = modell ? modell.blocks.find((x) => x.t === "tabelle" && x.kopf[0] === "Gerät / Material") : null;
    return (
      <div style={styles.fullscreenPage}>
        {galerie && <FotoGalerie fotos={galerie.urls} start={galerie.start} onClose={() => setGalerie(null)} />}
        <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={() => setAnsicht({ typ: "liste" })}><ArrowLeft size={18} /> Alle Einsatzberichte</button></div>
        {!b && <div style={{ fontSize: 12.5, color: "#8A8C86", padding: "20px 0" }}>Lädt …</div>}
        {b && (
          <>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#C1272D" }}>{b.nummer}</div>
            <div style={styles.modalTitle}>{b.einsatz || "Einsatz"}</div>
            <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 12px" }}>{fmtDate(b.datum)}{b.ort ? ` · ${b.ort}` : ""}</div>
            <Abschnitt titel="EINSATZ">
              {zeile("Alarmierung", b.alarm && `${b.alarm} Uhr`)}
              {zeile("Einsatzende", b.ende && `${b.ende} Uhr`)}
              {zeile("Dauer", fmtDauer(dauer))}
              {zeile("Einsatzgerät", [...(b.fahrzeuge || []).map((id) => (b.fahrzeugNamen || {})[id]), b.sonstigeFahrzeuge].filter(Boolean).join(", "))}
              {zeile("Kopie an Kasse", b.kopieKasse ? "ja" : "nein")}
            </Abschnitt>
            <Abschnitt titel={`MANNSCHAFT · ${b.kraefte} EINSATZKRÄFTE`}>
              {b.mannschaft ? (
                <>
                  {b.mannschaft.map((m) => (
                    <div key={m.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F3F1EC" }}>
                      <span>{m.name}{m.fahrzeug && (b.fahrzeugNamen || {})[m.fahrzeug] ? <span style={{ color: "#8A8C86", fontSize: 11.5 }}> · {(b.fahrzeugNamen || {})[m.fahrzeug]}</span> : null}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#5C5F58", whiteSpace: "nowrap" }}>{zuMin(m.ein) ? `${fmtHM(zuMin(m.ein))} h` : "–"}{zuMin(m.ber) ? ` · B ${fmtHM(zuMin(m.ber))}` : ""}{zuMin(m.pa) ? ` · PA ${fmtHM(zuMin(m.pa))}` : ""}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: "#5C5F58", marginTop: 6 }}>Summe: {fmtStd(minVon(b, "stunden"))} Std. Einsatzzeit{minVon(b, "stundenBer") ? ` · ${fmtStd(minVon(b, "stundenBer"))} Std. Bereitschaft` : ""}{b.paTraeger ? ` · ${b.paTraeger} unter Atemschutz` : ""}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#2C2F2A" }}>{b.kraefte} Einsatzkräfte · {fmtStd(minVon(b, "stunden"))} Std. Einsatzzeit{b.paTraeger ? ` · ${b.paTraeger} unter Atemschutz` : ""}
                  <div style={{ fontSize: 10.5, color: "#A5A79F", marginTop: 4 }}>Die Namen sehen nur Gruppenführer und Admins.</div></div>
              )}
            </Abschnitt>
            {(geraeteTab || b.sonstigesMaterial) && (
              <Abschnitt titel="GERÄTE & MATERIAL">
                {geraeteTab && geraeteTab.zeilen.map((z) => <div key={z[0]} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span>{z[0]}</span><strong>{z[1]} {z[2]}</strong></div>)}
                {b.sonstigesMaterial && <div style={{ fontSize: 12.5, marginTop: 4 }}>Sonstiges: {b.sonstigesMaterial}</div>}
              </Abschnitt>
            )}
            {b.bemerkung && <Abschnitt titel="BEMERKUNGEN ZUM EINSATZ"><div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{b.bemerkung}</div></Abschnitt>}
            {b.fotos && b.fotos.length > 0 && (
              <Abschnitt titel={`FOTOS (${b.fotos.length})`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {b.fotos.map((f) => f.url && <img key={f.path} src={f.url} alt="" onClick={() => { const urls = b.fotos.map((x) => x.url).filter(Boolean); setGalerie({ urls, start: Math.max(0, urls.indexOf(f.url)) }); }} style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6", cursor: "zoom-in" }} />)}
                </div>
              </Abschnitt>
            )}
            {!b.fotos && b.fotoAnzahl > 0 && <div style={{ fontSize: 11, color: "#A5A79F", marginBottom: 10 }}>{b.fotoAnzahl} Foto(s) – sichtbar für die Einsatzabteilung.</div>}

            <div style={{ ...styles.kontrollRow, padding: 12 }}>
              {b.fotos && b.fotos.length > 0 && <label style={{ ...styles.checkboxRow, fontSize: 12.5, marginBottom: 8 }}><input type="checkbox" checked={mitFotos} onChange={(e) => setMitFotos(e.target.checked)} /> Fotos mitdrucken</label>}
              <button style={{ ...styles.exportBtn, width: "100%", justifyContent: "center" }} disabled={druckt} onClick={() => drucken(b)}><Printer size={14} /> {druckt ? "Bereite vor …" : `Drucken / PDF${b.mannschaft ? " (mit Namen)" : ""}`}</button>
              {rechte.schreiben && <button style={{ ...styles.saveBtn, width: "100%", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => bearbeiten(b)}><Pencil size={14} /> Bearbeiten</button>}
              {(isAdmin || (b.erstelltVon && b.erstelltVon === me)) && <button style={{ ...styles.deleteBtn, width: "100%", marginTop: 6, justifyContent: "center" }} onClick={() => loeschen(b)}><Trash2 size={14} /> Löschen</button>}
            </div>
            {b.erstelltVon && <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "6px 0 20px" }}>Erfasst von {b.erstelltVon}{b.geaendertVon ? `, zuletzt geändert von ${b.geaendertVon}` : ""}.</div>}
          </>
        )}
      </div>
    );
  }

  // ======================= LISTE =======================
  const aktuell = (liste || []).filter((b) => String(b.einsatzjahr) === String(einsatzjahr));
  const archivJahre = Object.keys(archivAnzahl).sort((a, b) => b.localeCompare(a, "de", { numeric: true }));
  const summeStd = aktuell.reduce((s, b) => s + minVon(b, "stunden"), 0);
  const oKraefte = aktuell.length ? Math.round((aktuell.reduce((s, b) => s + (b.kraefte || 0), 0) / aktuell.length) * 10) / 10 : 0;
  const monat = new Date().getMonth() + 1;
  const jahrSeit = config.einsatzjahr && config.einsatzjahr.beginn;
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}>{zurueck}</div>
      <div style={styles.modalTitle}>Einsatzberichte</div>
      <div style={{ fontSize: 11.5, color: "#8A8C86", margin: "2px 0 12px" }}>Einsatzjahr {einsatzjahr || "…"}{jahrSeit ? ` · seit ${fmtDate(jahrSeit)}` : ""}</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {liste === null && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86", padding: "20px 0" }}>Lädt …</div>}
      {liste !== null && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <Kpi wert={aktuell.length} label="Einsätze" />
            <Kpi wert={fmtHM(summeStd)} label="Einsatzstunden (Std:Min)" />
            <Kpi wert={fmtZahl(oKraefte)} label="Ø Einsatzkräfte" />
          </div>
          {rechte.schreiben && <button style={{ ...styles.saveBtn, width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={neu}><Plus size={16} /> Neuer Einsatzbericht</button>}
          {aktuell.length === 0 && <div style={styles.emptyState}><div style={{ fontWeight: 600, color: "#3A3D38", marginBottom: 4 }}>Noch keine Einsätze im Einsatzjahr {einsatzjahr}</div>{rechte.schreiben && <div style={{ fontSize: 13, color: "#8A8C86" }}>Leg den ersten Bericht an.</div>}</div>}
          {aktuell.map((b) => <BerichtKarte key={b.id} b={b} onClick={() => oeffnen(b.id)} />)}
          {!rechte.namen && aktuell.length > 0 && <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 10px" }}>Die Namen der Einsatzkräfte sehen nur Gruppenführer und Admins.</div>}

          {archivJahre.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6, letterSpacing: "0.04em" }}>ARCHIV</div>
              {archivJahre.map((j) => (
                <div key={j} style={{ marginBottom: 8 }}>
                  <button style={styles.advancedToggle} onClick={() => archivUmschalten(j)}>
                    <ChevronDown size={13} style={{ transform: archivOffen[j] ? "rotate(180deg)" : "none" }} /> Einsatzjahr {j} ({archivAnzahl[j]})
                  </button>
                  {archivOffen[j] && <div style={{ marginTop: 8 }}>{archivListen[j] ? archivListen[j].map((b) => <BerichtKarte key={b.id} b={b} onClick={() => oeffnen(b.id)} />) : <div style={{ fontSize: 12, color: "#8A8C86", padding: "6px 0" }}>Lädt …</div>}</div>}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div style={{ ...styles.capacityBox, marginTop: 18, marginBottom: 20, borderColor: monat >= 11 ? "#B8791A" : "#E2DFD6" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Einsatzjahr (nur Admin)</div>
              <div style={{ fontSize: 11.5, color: "#5C5F58", marginBottom: 8 }}>Das Einsatzjahr beginnt nach der Hauptversammlung. Mit dem neuen Einsatzjahr wandern alle bisherigen Berichte ins Archiv und die Nummerierung beginnt wieder bei 01.</div>
              {jahrDialog === null ? (
                <button style={styles.tinyBtn} onClick={() => setJahrDialog(String((Number(einsatzjahr) || new Date().getFullYear()) + 1))}>Neues Einsatzjahr beginnen …</button>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 3 }}>Name des neuen Einsatzjahrs</div>
                  <input style={{ ...inp, marginBottom: 8 }} value={jahrDialog} onChange={(e) => setJahrDialog(e.target.value.replace(/[^0-9/\-]/g, "").slice(0, 9))} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setJahrDialog(null)}>Abbrechen</button>
                    <button style={{ ...styles.saveBtn, flex: 1 }} onClick={neuesEinsatzjahr}>Einsatzjahr {jahrDialog} beginnen</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
