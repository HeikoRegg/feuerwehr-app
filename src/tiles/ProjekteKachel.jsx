// Kachel „Projekte“ (seit 2.36): Projekte planen, dokumentieren und verfolgen.
// Aufgaben (mit Zuständigem und Termin), Phase und Fortschritt, Dokumente/Fotos, Verlauf/Notizen, optional Budget, Archiv.
// Aufgaben eines Projekts erscheinen automatisch im To-do der zuständigen Person.
// Rechte prüft der Server (netlify/functions/projekte.js).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, ChevronDown, ChevronRight, FileText, FolderKanban, Paperclip, Pencil, Plus, Printer, Trash2, Upload, Users, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { compressImage, matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { useApp } from "../AppContext";
import { hole, merke } from "../lib/zwischenspeicher";
import { bereiteFensterVor, oeffneBericht } from "../lib/bericht";
import { SearchBox } from "../components/Shared";
import { Avatar } from "../components/Profilfoto";
import { AufgabeDetail, AufgabeFormular, AufgabeZeile, datumDe, faelligInfo, heuteIso, klein, sortiereAufgaben } from "../components/Aufgaben";

export const PHASEN = [
  ["idee", "Idee", "#5C5F58", "#EEEDE8"],
  ["planung", "Planung", "#2F5F8A", "#E4EEF8"],
  ["laeuft", "Läuft", "#9A5B00", "#FBF1E1"],
  ["erledigt", "Erledigt", "#2E7D4F", "#E6F2EA"],
];
const PHASE = Object.fromEntries(PHASEN.map(([k, l, c, bg]) => [k, { label: l, color: c, bg }]));
const SICHT = { alle: "Alle Mitglieder", ausschuss: "Ausschuss", personen: "Beteiligte Personen" };
// Seit 2.40: mehrere Gruppen wählbar (Liste). Alte Einzelwerte: "ausschuss" = Ausschuss + Beteiligte.
const SICHT_KEYS = ["alle", "ausschuss", "personen"];
export function sichtListe(s) {
  const roh = Array.isArray(s) ? s : [s || "alle"];
  const l = [...new Set(roh.filter((x) => SICHT_KEYS.includes(x)))];
  if (!l.length || l.includes("alle")) return ["alle"];
  if (l.includes("ausschuss") && !Array.isArray(s)) l.push("personen");
  return SICHT_KEYS.filter((x) => l.includes(x));
}
const sichtText = (s) => sichtListe(s).map((k) => SICHT[k]).join(" + ");
function sichtUmschalten(alt, k) {
  const l = sichtListe(alt);
  if (k === "alle") return ["alle"];
  const ohne = l.filter((x) => x !== "alle");
  const neu = ohne.includes(k) ? ohne.filter((x) => x !== k) : [...ohne, k];
  return neu.length ? SICHT_KEYS.filter((x) => neu.includes(x)) : ["personen"];
}
const MAX_BYTES = 10 * 1024 * 1024;
const istBild = (typ, name) => /^image\//.test(typ || "") || /\.(jpe?g|png|webp|heic|heif)$/i.test(name || "");
const euro = (n) => (n === null || n === undefined || n === "" ? "" : Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" }));
const zeitDe = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); };

function PhasePille({ phase }) {
  const p = PHASE[phase] || PHASE.idee;
  return <span data-testid="phase" style={{ fontSize: 10.5, fontWeight: 700, color: p.color, background: p.bg, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{p.label}</span>;
}
function Fortschritt({ erledigt, gesamt }) {
  const pz = gesamt ? Math.round((erledigt / gesamt) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} data-testid="fortschritt">
      <div style={{ flex: 1, height: 7, background: "#EEEDE8", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pz}%`, height: "100%", background: pz === 100 ? "#2E7D4F" : "#E5B416" }} /></div>
      <span style={{ fontSize: 11, color: "#5C5F58", whiteSpace: "nowrap" }}>{gesamt ? `${erledigt}/${gesamt} Aufgaben` : "keine Aufgaben"}</span>
    </div>
  );
}
function Abschnitt({ titel, rechts, children, testId }) {
  return (
    <div style={{ ...styles.kontrollRow, padding: "11px 12px", marginBottom: 10 }} data-testid={testId}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.05em" }}>{titel}</div>
        {rechts}
      </div>
      {children}
    </div>
  );
}

// ---------------- Formular ----------------
const leer = () => ({ name: "", beschreibung: "", phase: "idee", verantwortlich: "", start: "", ziel: "", sicht: "alle", beteiligte: [], budget: "", kosten: "" });

function Formular({ start, onClose, onSaved }) {
  const { me, roster, callAuthed } = useApp();
  // Neues Projekt: man selbst ist zunächst verantwortlich (änderbar); beim Bearbeiten bleibt der gespeicherte Wert.
  const [f, setF] = useState(() => ({ ...leer(), ...start, verantwortlich: start.id ? (start.verantwortlich || "") : (start.verantwortlich || me), budget: start.budget ?? "", kosten: start.kosten ?? "" }));
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const namen = (roster || []).map((r) => r.name).sort((a, b) => a.localeCompare(b, "de"));
  const toggleBeteiligt = (n) => set("beteiligte", f.beteiligte.includes(n) ? f.beteiligte.filter((x) => x !== n) : [...f.beteiligte, n]);
  async function speichern() {
    setFehlerText("");
    if (!f.name.trim()) { setFehlerText("Bitte einen Namen für das Projekt eingeben."); return; }
    if (f.start && f.ziel && f.ziel < f.start) { setFehlerText("Das Ziel-Datum liegt vor dem Start."); return; }
    setBusy(true);
    const r = await callAuthed("projekte", { action: "save", projekt: f });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Speichern nicht möglich."); return; }
    onSaved(r.data.id);
  }
  return (
    <div style={styles.fullscreenPage} data-testid="projekt-formular">
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Abbrechen</button></div>
      {f.eltern && !f.id && <div data-testid="unterprojekt-hinweis" style={{ fontSize: 12.5, color: "#4A6670", background: "#EEF2F3", borderRadius: 6, padding: "6px 9px", margin: "6px 0" }}>Unterprojekt von „{f.elternName || "Hauptprojekt"}“. Die Beteiligten des Hauptprojekts dürfen es automatisch sehen und mitarbeiten.</div>}
      <div style={styles.modalTitle}>{f.id ? "Projekt bearbeiten" : "Neues Projekt"}</div>
      <div style={styles.formBody}>
        <label style={styles.label}>Name</label>
        <input style={styles.input} data-testid="projekt-name" maxLength={120} placeholder="z. B. Beschaffung neue Einsatzjacken" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <label style={styles.label}>Beschreibung / Ziel</label>
        <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} maxLength={3000} placeholder="Worum geht es, was soll am Ende stehen?" value={f.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} />
        <label style={styles.label}>Phase</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PHASEN.map(([k, l, c, bg]) => (
            <button key={k} data-testid={`phase-${k}`} onClick={() => set("phase", k)} style={{ ...styles.categoryChip, background: f.phase === k ? c : bg, color: f.phase === k ? "white" : c, borderColor: c }}>{l}</button>
          ))}
        </div>
        <label style={styles.label}>Verantwortlich</label>
        <select style={styles.input} data-testid="projekt-verantwortlich" value={f.verantwortlich} onChange={(e) => set("verantwortlich", e.target.value)}>
          <option value="">– niemand –</option>
          {namen.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><label style={styles.label}>Start</label><input style={styles.input} type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={styles.label}>Ziel (fertig bis)</label><input style={styles.input} type="date" data-testid="projekt-ziel" value={f.ziel} onChange={(e) => set("ziel", e.target.value)} /></div>
        </div>
        <label style={styles.label}>Wer sieht das Projekt?</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(SICHT).map(([k, l]) => {
            const an = sichtListe(f.sicht).includes(k);
            return <button key={k} data-testid={`sicht-${k}`} aria-pressed={an} onClick={() => set("sicht", sichtUmschalten(f.sicht, k))} style={{ ...styles.categoryChip, background: an ? "#2C2F2A" : "#F3F1EC", color: an ? "white" : "#5C5F58", borderColor: an ? "#2C2F2A" : "#E2DFD6" }}>{an && k !== "alle" ? "✓ " : ""}{l}</button>;
          })}
        </div>
        <div style={{ ...klein, marginTop: 4 }}>„Ausschuss“ und „Beteiligte Personen“ lassen sich zusammen anhaken. Verantwortlicher, Ersteller, Beteiligte und Admins sehen das Projekt immer.</div>
        <label style={styles.label}>Beteiligte ({f.beteiligte.length}) – dürfen Aufgaben, Notizen und Dokumente eintragen</label>
        {f.beteiligte.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {f.beteiligte.map((n) => <button key={n} onClick={() => toggleBeteiligt(n)} style={{ ...styles.categoryChip, background: "#2C2F2A", color: "white", borderColor: "#2C2F2A", fontSize: 12 }}>{n} <X size={11} /></button>)}
          </div>
        )}
        <SearchBox value={suche} onChange={setSuche} placeholder="Person suchen und antippen …" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
          {namen.filter((n) => !f.beteiligte.includes(n) && matchesSearch(n, suche)).map((n) => (
            <button key={n} data-testid={`beteiligt-${n}`} onClick={() => toggleBeteiligt(n)} style={{ ...styles.categoryChip, fontSize: 12, background: "#F3F1EC", color: "#5C5F58", borderColor: "#E2DFD6" }}><Plus size={11} /> {n}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><label style={styles.label}>Budget € (optional)</label><input style={styles.input} inputMode="decimal" data-testid="projekt-budget" placeholder="leer lassen" value={f.budget} onChange={(e) => set("budget", e.target.value.replace(/[^0-9,.]/g, ""))} /></div>
          <div style={{ flex: 1 }}><label style={styles.label}>Kosten bisher € (optional)</label><input style={styles.input} data-testid="projekt-kosten" inputMode="decimal" placeholder="leer lassen" value={f.kosten} onChange={(e) => set("kosten", e.target.value.replace(/[^0-9,.]/g, ""))} /></div>
        </div>
        {fehlerText && <div style={styles.errorText}>{fehlerText}</div>}
        <button style={{ ...styles.saveBtn, marginTop: 16 }} disabled={busy} data-testid="projekt-speichern" onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
      </div>
    </div>
  );
}

// ---------------- Bericht (Drucken / PDF) ----------------
function projektBericht(d) {
  const p = d.projekt;
  const aufgaben = sortiereAufgaben(d.aufgaben || []);
  const erledigt = aufgaben.filter((a) => a.erledigt).length;
  const felder = [
    { label: "Phase", value: (PHASE[p.phase] || PHASE.idee).label + (p.archiviert ? " (archiviert)" : "") },
    { label: "Verantwortlich", value: p.verantwortlich || "–" },
    { label: "Zeitraum", value: [p.start && `ab ${datumDe(p.start)}`, p.ziel && `bis ${datumDe(p.ziel)}`].filter(Boolean).join(" ") || "–" },
    { label: "Fortschritt", value: aufgaben.length ? `${erledigt} von ${aufgaben.length} Aufgaben erledigt` : "keine Aufgaben" },
  ];
  if (p.budget !== null && p.budget !== undefined) felder.push({ label: "Budget", value: euro(p.budget) });
  if (p.kosten !== null && p.kosten !== undefined) felder.push({ label: "Kosten bisher", value: euro(p.kosten) });
  if (p.beteiligte && p.beteiligte.length) felder.push({ label: "Beteiligte", value: p.beteiligte.join(", ") });
  const blocks = [{ t: "felder", items: felder }];
  if (p.beschreibung) blocks.push({ t: "h3", text: "Beschreibung" }, { t: "text", text: p.beschreibung });
  blocks.push({ t: "h3", text: `Aufgaben (${aufgaben.length})` });
  if (aufgaben.length) blocks.push({ t: "tabelle", kopf: ["Aufgabe", "Zuständig", "Fällig", "Erledigt"], breiten: [5, 2, 1.5, 1.5], zeilen: aufgaben.map((a) => [a.text + (a.notiz ? ` – ${a.notiz}` : ""), a.zustaendig || "", datumDe(a.faellig), a.erledigt ? `✓ ${datumDe(String(a.erledigtAm || "").slice(0, 10))}` : ""]) });
  else blocks.push({ t: "text", text: "Noch keine Aufgaben.", grau: true });
  const doks = (d.eintraege || []).filter((e) => e.art === "dokument");
  if (doks.length) blocks.push({ t: "h3", text: `Dokumente (${doks.length})` }, { t: "liste", items: doks.map((e) => e.name + (e.text ? ` – ${e.text}` : "")) });
  const verlauf = (d.eintraege || []).filter((e) => e.art !== "dokument");
  if (verlauf.length) blocks.push({ t: "h3", text: "Verlauf" }, { t: "tabelle", kopf: ["Datum", "Von", "Eintrag"], breiten: [1.6, 1.4, 5], zeilen: verlauf.map((e) => [zeitDe(e.ts), e.von || "", e.text || ""]) });
  return { titel: `Projekt ${p.name}`, untertitel: `Projektstand · ${p.name} · Stand ${datumDe(heuteIso())}`, dateiname: `Projekt_${p.name}`, blocks };
}

// ---------------- Detail ----------------
function Detail({ id, onBack, onEdit, onChanged, onOpen, onNeuUnter }) {
  const { me, callAuthed, flashError, ladeUmfrageStatus } = useApp();
  const [d, setD] = useState(null);
  const [fehler, setFehler] = useState("");
  const [aufgabe, setAufgabe] = useState(null);
  const [detailAufgabe, setDetailAufgabe] = useState(null);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [frage, setFrage] = useState(null); // "archiv" | "loeschen"
  const [zeigeErledigt, setZeigeErledigt] = useState(false);
  const dateiRef = useRef(null);

  async function laden() {
    const r = await callAuthed("projekte", { action: "get", id });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Das Projekt konnte nicht geladen werden."); return null; }
    setFehler(""); setD(r.data); return r.data;
  }
  useEffect(() => { laden(); }, [id]);

  if (!d) return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Alle Projekte</button></div>
      {fehler ? <div style={styles.errorText}>{fehler}</div> : <div style={klein}>Lädt …</div>}
    </div>
  );
  const p = d.projekt;
  const r = d.rechte || {};
  const aktiv = !p.archiviert;
  const aufgaben = sortiereAufgaben((d.aufgaben || []).map((a) => ({ ...a, darfAendern: aktiv && (a.erstelltVon === me || !!r.verwalter) })));
  const offen = aufgaben.filter((a) => !a.erledigt);
  const fertig = aufgaben.filter((a) => a.erledigt);
  const doks = (d.eintraege || []).filter((e) => e.art === "dokument");
  const verlauf = (d.eintraege || []).filter((e) => e.art !== "dokument");
  const unter = d.unterprojekte || [];
  const unterOffen = unter.filter((k) => !k.archiviert).length;

  async function aktion(body, meldung) {
    setBusy(true);
    const x = await callAuthed("projekte", body);
    setBusy(false);
    if (!x.ok) { if (x.data.error !== "abgebrochen") flashError(x.data.error || meldung); return false; }
    return true;
  }
  async function haken(a) {
    if (!aktiv) return;
    if (await aktion({ action: "aufgabeErledigt", id: a.id, erledigt: !a.erledigt }, "Das hat nicht geklappt.")) { await laden(); onChanged(); if (ladeUmfrageStatus) ladeUmfrageStatus(); }
  }
  async function notizSpeichern() {
    if (!notiz.trim()) return;
    if (await aktion({ action: "notiz", projekt: p.id, text: notiz }, "Notiz konnte nicht gespeichert werden.")) { setNotiz(""); await laden(); }
  }
  async function eintragLoeschen(e) { if (await aktion({ action: "eintragDelete", id: e.id }, "Löschen nicht möglich.")) await laden(); }
  async function hochladen(liste) {
    const dateien = Array.from(liste || []);
    if (!dateien.length) return;
    setBusy(true);
    try {
      for (const original of dateien) {
        let datei = original;
        if (istBild(original.type, original.name)) datei = await compressImage(original);
        if (datei.size > MAX_BYTES) { flashError(`„${original.name}“ ist größer als 10 MB.`); continue; }
        const u = await callAuthed("projekte", { action: "uploadUrl", projekt: p.id, filename: datei.name || original.name });
        if (!u.ok) throw new Error(u.data.error || "Upload nicht möglich.");
        const { error } = await supabase.storage.from("projekte").uploadToSignedUrl(u.data.path, u.data.uploadToken, datei);
        if (error) throw error;
        const s = await callAuthed("projekte", { action: "dokument", projekt: p.id, pfad: u.data.path, name: original.name || datei.name, typ: datei.type || original.type || "", groesse: datei.size });
        if (!s.ok) throw new Error(s.data.error || "Speichern nicht möglich.");
      }
    } catch (e) { flashError(e && e.message && !/fetch|network/i.test(e.message) ? e.message : "Hochladen fehlgeschlagen. Erlaubt sind Bilder, PDF, Word und Excel (max. 10 MB)."); }
    setBusy(false);
    await laden();
  }
  async function archivieren() {
    setFrage(null);
    if (await aktion({ action: "archivieren", id: p.id, archiviert: aktiv }, "Das hat nicht geklappt.")) { await laden(); onChanged(); if (ladeUmfrageStatus) ladeUmfrageStatus(); }
  }
  async function loeschen() {
    setFrage(null);
    if (await aktion({ action: "delete", id: p.id }, "Löschen nicht möglich.")) { onChanged(); if (ladeUmfrageStatus) ladeUmfrageStatus(); onBack(); }
  }
  function drucken() {
    const fenster = bereiteFensterVor();
    if (!oeffneBericht(projektBericht(d), fenster)) flashError("Bitte das Pop-up-Fenster zulassen.");
  }
  const zeile = (a) => <AufgabeZeile key={a.id} a={a} ich={me} busy={busy} onToggle={haken} onOpen={(x) => setDetailAufgabe(x.id)} />;

  return (
    <div style={styles.fullscreenPage} data-testid="projekt-detail">
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Alle Projekte</button></div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={styles.modalTitle}>{p.name}</div>
        <PhasePille phase={p.phase} />
      </div>
      {d.eltern && <button data-knopf="fest" data-testid="zum-hauptprojekt" disabled={!d.eltern.sichtbar} onClick={() => onOpen(d.eltern.id)} style={{ ...klein, background: "transparent", border: "none", padding: "2px 0", cursor: d.eltern.sichtbar ? "pointer" : "default", textAlign: "left" }}>Unterprojekt von <b>{d.eltern.name}</b>{d.eltern.sichtbar ? " ›" : ""}</button>}
      {p.archiviert && <div data-testid="archiviert-hinweis" style={{ fontSize: 12, color: "#5C5F58", background: "#EEEDE8", borderRadius: 6, padding: "6px 9px", margin: "6px 0" }}>Abgeschlossen und archiviert{p.archiviertAm ? ` am ${datumDe(String(p.archiviertAm).slice(0, 10))}` : ""}. Zum Ändern zuerst aus dem Archiv holen.</div>}
      {p.beschreibung && <div style={{ fontSize: 13.5, color: "#2C2F2A", whiteSpace: "pre-wrap", margin: "8px 0", lineHeight: 1.45 }}>{p.beschreibung}</div>}
      <div style={{ margin: "8px 0 12px" }}><Fortschritt erledigt={fertig.length} gesamt={aufgaben.length} /></div>

      <Abschnitt titel="ANGABEN">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 12px", fontSize: 13, alignItems: "center" }}>
          <span style={klein}>Verantwortlich</span><span style={{ display: "flex", alignItems: "center", gap: 6 }}>{p.verantwortlich ? <><Avatar name={p.verantwortlich} size={22} />{p.verantwortlich}</> : "–"}</span>
          <span style={klein}>Zeitraum</span><span>{[p.start && `ab ${datumDe(p.start)}`, p.ziel && `bis ${datumDe(p.ziel)}`].filter(Boolean).join(" ") || "–"}</span>
          <span style={klein}>Sichtbar für</span><span data-testid="sicht-anzeige">{sichtText(p.sicht)}</span>
          {p.beteiligte.length > 0 && <><span style={klein}>Beteiligte</span><span>{p.beteiligte.join(", ")}</span></>}
          {p.budget !== null && p.budget !== undefined && <><span style={klein}>Budget</span><span>{euro(p.budget)}</span></>}
          {p.kosten !== null && p.kosten !== undefined && <><span style={klein}>Kosten bisher</span><span style={{ color: p.budget !== null && p.budget !== undefined && p.kosten > p.budget ? "#C1272D" : "inherit" }}>{euro(p.kosten)}{p.budget !== null && p.budget !== undefined ? ` (${Math.round((p.kosten / (p.budget || 1)) * 100)} %)` : ""}</span></>}
          {unter.length > 0 && <><span style={klein}>Kosten gesamt</span><span data-testid="kosten-summe" style={{ fontWeight: 600 }}>{euro(d.kostenSumme)} <span style={{ ...klein, fontWeight: 400 }}>(mit Unterprojekten)</span></span></>}
          <span style={klein}>Angelegt</span><span>{p.erstelltVon}{p.erstelltAm ? `, ${datumDe(String(p.erstelltAm).slice(0, 10))}` : ""}</span>
        </div>
      </Abschnitt>

      {!p.eltern && (unter.length > 0 || (aktiv && r.verwalter)) && (
        <Abschnitt titel={`UNTERPROJEKTE (${unter.length})`} testId="projekt-unterprojekte"
          rechts={aktiv && r.verwalter && <button style={styles.smallAddBtn} data-testid="unterprojekt-anlegen" onClick={() => onNeuUnter(p)}><Plus size={12} /> Unterprojekt</button>}>
          {unter.length === 0 && <div style={{ ...klein, padding: "4px 0" }}>Noch keine Unterprojekte – zum Beispiel für einzelne Bauabschnitte.</div>}
          {unter.map((k) => (
            <button key={k.id} data-testid={`unterprojekt-${k.id}`} onClick={() => onOpen(k.id)} style={{ ...styles.rosterItem, flexDirection: "column", alignItems: "stretch", gap: 5, marginBottom: 6, opacity: k.archiviert ? 0.7 : 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</span>
                <PhasePille phase={k.phase} />
                <ChevronRight size={14} color="#A5A79F" />
              </span>
              <Fortschritt erledigt={k.aufgaben.erledigt} gesamt={k.aufgaben.gesamt} />
              {(k.kosten !== null && k.kosten !== undefined) && <span style={klein}>Kosten bisher {euro(k.kosten)}</span>}
            </button>
          ))}
        </Abschnitt>
      )}

      <Abschnitt titel={`AUFGABEN (${offen.length} offen)`} testId="projekt-aufgaben"
        rechts={aktiv && r.mitarbeiter && <button style={styles.smallAddBtn} data-testid="projekt-neue-aufgabe" onClick={() => setAufgabe({ projekt: p.id, zustaendig: me })}><Plus size={12} /> Aufgabe</button>}>
        {offen.length === 0 && <div style={{ ...klein, padding: "4px 0" }}>{aufgaben.length ? "Alle Aufgaben erledigt." : "Noch keine Aufgaben."}</div>}
        {offen.map(zeile)}
        {fertig.length > 0 && (
          <>
            <button data-knopf="fest" style={{ ...klein, background: "transparent", border: "none", padding: "8px 0 2px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: 600 }} onClick={() => setZeigeErledigt((v) => !v)}>
              {fertig.length} erledigt <ChevronDown size={12} style={{ transform: zeigeErledigt ? "rotate(180deg)" : "none" }} />
            </button>
            {zeigeErledigt && fertig.map(zeile)}
          </>
        )}
      </Abschnitt>

      <Abschnitt titel={`DOKUMENTE UND FOTOS (${doks.length})`} testId="projekt-dokumente"
        rechts={aktiv && r.mitarbeiter && <button style={styles.smallAddBtn} disabled={busy} onClick={() => dateiRef.current && dateiRef.current.click()}><Upload size={12} /> Hochladen</button>}>
        <input ref={dateiRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf" style={{ display: "none" }} data-testid="projekt-datei" onChange={(e) => { const l = e.target.files; hochladen(l).finally(() => { if (dateiRef.current) dateiRef.current.value = ""; }); }} />
        {doks.length === 0 && <div style={{ ...klein, padding: "4px 0" }}>Angebote, Pläne, Fotos … – Bilder, PDF, Word und Excel bis 10 MB.</div>}
        {doks.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F0EEE8" }}>
            {istBild(e.typ, e.name) ? <Paperclip size={15} color="#8A8C86" /> : <FileText size={15} color="#8A8C86" />}
            <a href={e.url || undefined} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#2F5F8A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</a>
            <span style={klein}>{e.von}</span>
            {aktiv && (e.von === me || r.verwalter) && <button style={styles.tinyIconBtn} aria-label={`${e.name} löschen`} disabled={busy} onClick={() => eintragLoeschen(e)}><Trash2 size={12} /></button>}
          </div>
        ))}
      </Abschnitt>

      <Abschnitt titel="VERLAUF UND NOTIZEN" testId="projekt-verlauf">
        {aktiv && r.mitarbeiter && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
            <textarea style={{ ...styles.input, flex: 1, minHeight: 44, resize: "vertical", marginTop: 0 }} data-testid="notiz-text" maxLength={2000} placeholder="Notiz, Entscheidung, Stand …" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
            <button style={{ ...styles.saveBtn, flex: "none", padding: "10px 14px" }} disabled={busy || !notiz.trim()} data-testid="notiz-speichern" onClick={notizSpeichern}>Speichern</button>
          </div>
        )}
        {verlauf.length === 0 && <div style={klein}>Noch keine Einträge.</div>}
        {verlauf.map((e) => (
          <div key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid #F0EEE8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...klein }}>
              {e.art !== "system" && <Avatar name={e.von} size={18} rand={false} />}<span style={{ fontWeight: 600, color: "#5C5F58" }}>{e.von}</span> · {zeitDe(e.ts)}
              {aktiv && e.art === "notiz" && (e.von === me || r.verwalter) && <button style={{ ...styles.tinyIconBtn, marginLeft: "auto" }} aria-label="Notiz löschen" disabled={busy} onClick={() => eintragLoeschen(e)}><Trash2 size={11} /></button>}
            </div>
            <div style={{ fontSize: 13, color: e.art === "system" ? "#8A8C86" : "#2C2F2A", fontStyle: e.art === "system" ? "italic" : "normal", whiteSpace: "pre-wrap", marginTop: 2 }}>{e.text}</div>
          </div>
        ))}
      </Abschnitt>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {aktiv && r.verwalter && <button style={{ ...styles.saveBtn, gap: 6 }} data-testid="projekt-bearbeiten" onClick={() => onEdit(p)}><Pencil size={15} /> Bearbeiten</button>}
        <button style={{ ...styles.exportBtn, justifyContent: "center", padding: "11px 14px", marginBottom: 0 }} onClick={drucken}><Printer size={15} /> Drucken / PDF</button>
        {r.verwalter && frage !== "archiv" && <button style={{ ...styles.deleteBtn, justifyContent: "center", color: "#5C5F58", borderColor: "#D5D2C8" }} data-testid="projekt-archivieren" disabled={busy} onClick={() => (aktiv && (offen.length || unterOffen) ? setFrage("archiv") : archivieren())}>{aktiv ? <><Archive size={15} /> Abschließen und archivieren</> : <><ArchiveRestore size={15} /> Aus dem Archiv holen</>}</button>}
        {frage === "archiv" && (
          <div style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "10px 11px" }} data-testid="archiv-frage">
            <div style={{ fontSize: 12.5, marginBottom: 8 }}>{offen.length > 0 ? `Es sind noch ${offen.length} Aufgabe${offen.length === 1 ? "" : "n"} offen. Sie verschwinden aus dem To-do der Zuständigen. ` : ""}{unterOffen > 0 ? `Die ${unterOffen} Unterprojekt${unterOffen === 1 ? "" : "e"} werden mit archiviert. ` : ""}Trotzdem abschließen?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="archiv-ja" onClick={archivieren}>Abschließen</button>
            </div>
          </div>
        )}
        {r.loeschen && frage !== "loeschen" && <button style={{ ...styles.deleteBtn, justifyContent: "center" }} data-testid="projekt-loeschen" disabled={busy} onClick={() => setFrage("loeschen")}><Trash2 size={15} /> Projekt löschen</button>}
        {frage === "loeschen" && (
          <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px" }}>
            <div data-testid="loeschen-text" style={{ fontSize: 12.5, marginBottom: 8 }}>Projekt „{p.name}“ {unter.length > 0 ? <b>und seine {unter.length} Unterprojekt{unter.length === 1 ? "" : "e"} </b> : null}mit allen Aufgaben, Notizen und Dokumenten endgültig löschen? Das kann nicht rückgängig gemacht werden.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(null)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="loeschen-ja" onClick={loeschen}>Endgültig löschen</button>
            </div>
          </div>
        )}
      </div>
      {detailAufgabe && (() => {
        const a = aufgaben.find((x) => x.id === detailAufgabe);
        if (!a) return null;
        return <AufgabeDetail a={a} ich={me} projektName={p.name} gesperrt={!aktiv} onClose={() => setDetailAufgabe(null)}
          onChanged={async () => { await laden(); onChanged(); if (ladeUmfrageStatus) ladeUmfrageStatus(); }}
          onBearbeiten={(x) => { setDetailAufgabe(null); setAufgabe({ ...x }); }} />;
      })()}
      {aufgabe && <AufgabeFormular start={aufgabe} darfZuweisen={!!r.zuweisen} projektName={p.name} onClose={() => setAufgabe(null)} onSaved={async () => { setAufgabe(null); await laden(); onChanged(); if (ladeUmfrageStatus) ladeUmfrageStatus(); }} />}
    </div>
  );
}

// ---------------- Kachel ----------------
export default function ProjekteKachel() {
  const { me, callAuthed, closeKachelView, kachelReturnTo, projektStartId, setProjektStartId } = useApp();
  const [daten, setDaten] = useState(() => hole("projekte"));
  const [fehler, setFehler] = useState("");
  const [offen, setOffen] = useState(() => projektStartId || null);
  const [formular, setFormular] = useState(null);
  const [nurMeine, setNurMeine] = useState(false);
  const [zeigeArchiv, setZeigeArchiv] = useState(false);
  const [zu, setZu] = useState(() => new Set());
  const umschalten = (id) => setZu((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function laden() {
    const r = await callAuthed("projekte", { action: "list" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Die Projekte konnten nicht geladen werden."); return; }
    setFehler(""); setDaten(r.data); merke("projekte", r.data);
  }
  useEffect(() => { laden(); if (projektStartId && setProjektStartId) setProjektStartId(null); }, []);

  const alle = (daten && daten.projekte) || [];
  const gefiltert = alle.filter((p) => !nurMeine || p.beteiligt || p.aufgaben.meine > 0);
  const laufend = useMemo(() => gefiltert.filter((p) => !p.archiviert).sort((a, b) => (a.ziel || "9999").localeCompare(b.ziel || "9999") || a.name.localeCompare(b.name, "de")), [gefiltert]);
  const archiv = useMemo(() => gefiltert.filter((p) => p.archiviert).sort((a, b) => String(b.archiviertAm || "").localeCompare(String(a.archiviertAm || ""))), [gefiltert]);

  if (formular) return <Formular start={formular} onClose={() => setFormular(null)} onSaved={async (id) => { setFormular(null); await laden(); setOffen(id); }} />;
  if (offen) return <Detail id={offen} onBack={() => { setOffen(null); laden(); }} onEdit={(p) => setFormular({ ...p })} onChanged={laden} onOpen={setOffen} onNeuUnter={(h) => setFormular({ ...leer(), eltern: h.id, elternName: h.name, sicht: h.sicht || "alle", verantwortlich: "" })} />;

  // Unterprojekte eingerückt unter ihrem Hauptprojekt (einklappbar); ohne sichtbares Hauptprojekt erscheinen sie einzeln.
  const gruppe = (liste) => {
    const ids = new Set(liste.map((p) => p.id));
    return liste.filter((p) => !p.eltern || !ids.has(p.eltern)).map((p) => {
      const kinder = liste.filter((k) => k.eltern === p.id).sort((a, b) => a.name.localeCompare(b.name, "de"));
      return (
        <div key={p.id}>
          {karte(p)}
          {kinder.length > 0 && (
            <>
              <button data-knopf="fest" data-testid={`unter-umschalten-${p.id}`} onClick={() => umschalten(p.id)} style={{ ...klein, background: "transparent", border: "none", padding: "0 0 6px 14px", marginTop: -2, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: 600 }}>
                {kinder.length} Unterprojekt{kinder.length === 1 ? "" : "e"} <ChevronDown size={12} style={{ transform: zu.has(p.id) ? "none" : "rotate(180deg)" }} />
              </button>
              {!zu.has(p.id) && <div style={{ marginLeft: 16, borderLeft: "2px solid #D9D6CC", paddingLeft: 8 }}>{kinder.map(karte)}</div>}
            </>
          )}
        </div>
      );
    });
  };
  const karte = (p) => {
    const zielInfo = !p.archiviert && p.ziel && p.phase !== "erledigt" ? faelligInfo(p.ziel, false) : null;
    return (
      <button key={p.id} data-testid={`projekt-${p.id}`} onClick={() => setOffen(p.id)} style={{ ...styles.rosterItem, flexDirection: "column", alignItems: "stretch", gap: 6, marginBottom: 8, opacity: p.archiviert ? 0.75 : 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FolderKanban size={16} color="#4A6670" />
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
          <PhasePille phase={p.phase} />
          <ChevronRight size={15} color="#A5A79F" />
        </span>
        <Fortschritt erledigt={p.aufgaben.erledigt} gesamt={p.aufgaben.gesamt} />
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, ...klein }}>
          {p.verantwortlich && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Avatar name={p.verantwortlich} size={18} rand={false} />{p.verantwortlich}</span>}
          {zielInfo && <span style={{ fontWeight: 600, color: zielInfo.farbe }}>Ziel {zielInfo.text.replace(/ fällig$/, "")}</span>}
          {!sichtListe(p.sicht).includes("alle") && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Users size={11} /> {sichtText(p.sicht)}</span>}
          {p.aufgaben.meine > 0 && <span data-testid={`projekt-meine-${p.id}`} style={{ fontWeight: 700, color: "#C1272D" }}>{p.aufgaben.meine} für dich</span>}
        </span>
      </button>
    );
  };

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Projekte</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {!daten && !fehler && <div style={{ ...klein, marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          {daten.darfAnlegen && <button style={{ ...styles.saveBtn, width: "100%", margin: "12px 0 6px", gap: 6 }} data-testid="neues-projekt" onClick={() => setFormular(leer())}><Plus size={16} /> Neues Projekt</button>}
          <div style={{ display: "flex", gap: 6, margin: "8px 0 10px" }}>
            {[[false, "Alle"], [true, "Meine"]].map(([v, l]) => (
              <button key={l} onClick={() => setNurMeine(v)} style={{ ...styles.categoryChip, background: nurMeine === v ? "#2C2F2A" : "#F3F1EC", color: nurMeine === v ? "white" : "#5C5F58", borderColor: nurMeine === v ? "#2C2F2A" : "#E2DFD6" }}>{l}</button>
            ))}
          </div>
          {laufend.length === 0 && <div style={{ ...klein, margin: "10px 0" }}>{nurMeine ? "Du bist an keinem laufenden Projekt beteiligt." : daten.darfAnlegen ? "Noch keine Projekte – leg das erste an." : "Noch keine Projekte, die du sehen darfst."}</div>}
          {gruppe(laufend)}
          {archiv.length > 0 && (
            <>
              <button data-knopf="fest" data-testid="archiv-umschalten" style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.05em", background: "transparent", border: "none", padding: 0, margin: "14px 0 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={() => setZeigeArchiv((v) => !v)}>
                ARCHIV ({archiv.length}) <ChevronDown size={13} style={{ transform: zeigeArchiv ? "rotate(180deg)" : "none" }} />
              </button>
              {zeigeArchiv && gruppe(archiv)}
            </>
          )}
        </>
      )}
    </div>
  );
}
