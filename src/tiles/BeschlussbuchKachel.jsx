// Kachel Beschlussbuch: Beschlüsse des Ausschusses auffindbar halten (Datum, Titel, Text, Thema, Status, Sitzung/Abstimmung, Anhänge).
// Die Rechte prüft der Server (netlify/functions/beschluesse.js): Ausschuss + Admins sehen alles, die anderen nur Beschlüsse mit
// dem Häkchen "für alle sichtbar"; eintragen dürfen Admins und Ausschuss-Mitglieder mit Sitzungs- bzw. Protokoll-Recht.
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, FileText, Paperclip, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { styles } from "../lib/styles";
import { compressImage } from "../lib/helpers";
import { oeffneBericht } from "../lib/bericht";
import { supabase } from "../supabaseClient";
import { useApp } from "../AppContext";

const STATUS = { gueltig: "Gültig", aufgehoben: "Aufgehoben", ersetzt: "Ersetzt" };
const STATUS_FARBE = { gueltig: ["#1F6F5C", "#E7F2EF"], aufgehoben: ["#C1272D", "#FBEAEA"], ersetzt: ["#9A5B00", "#FBF1E1"] };
const MAX_ANHAENGE = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "16px 0 6px", letterSpacing: "0.04em" };
const klein = { fontSize: 11.5, color: "#8A8C86" };
const knopfRot = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, border: "1.5px solid #C1272D", background: "#C1272D", color: "white", cursor: "pointer", fontFamily: "inherit" };

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const neueId = () => Array.from(crypto.getRandomValues(new Uint8Array(5))).map((b) => b.toString(16).padStart(2, "0")).join("");
const heute = () => new Date().toLocaleDateString("sv-SE");
const datumDe = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const groesseText = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const istBild = (typ, name) => /^image\//.test(typ || "") || /\.(jpe?g|png|gif|webp)$/i.test(name || "");
const leer = () => ({ id: neueId(), datum: heute(), titel: "", text: "", thema: "", status: "gueltig", ersetztDurch: "", fuerAlle: false, anhaenge: [], sitzung: null, ergebnis: null });

function Pille({ text, farbe, grund }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: farbe, background: grund, whiteSpace: "nowrap" }}>{text}</span>;
}
function ergebnisText(e) { return e ? `${e.dafuer} dafür · ${e.dagegen} dagegen — ${e.label}` : ""; }

// Suche: alle Wörter müssen vorkommen (Titel, Text, Thema, Beschreibung der Anhänge). Gibt zusätzlich an, welche Anhänge getroffen wurden.
function suchTreffer(b, woerter) {
  if (!woerter.length) return { ok: true, anhaenge: [] };
  const grund = norm(`${b.titel} ${b.text} ${b.thema}`);
  const anh = (b.anhaenge || []).map((a) => ({ a, t: norm(a.beschreibung) }));
  const alles = grund + " " + anh.map((x) => x.t).join(" ");
  if (!woerter.every((w) => alles.includes(w))) return { ok: false, anhaenge: [] };
  const getroffen = anh.filter((x) => x.t && woerter.some((w) => x.t.includes(w) && !grund.includes(w))).map((x) => x.a);
  return { ok: true, anhaenge: getroffen };
}

function beschlussBericht(liste, titelZusatz) {
  const blocks = [];
  liste.forEach((b) => {
    blocks.push({ t: "h3", text: `${datumDe(b.datum)} – ${b.titel}` });
    const meta = [b.thema, STATUS[b.status] || "", b.sitzung ? `Sitzung: ${b.sitzung.titel}${b.sitzung.datum ? ` (${datumDe(b.sitzung.datum)})` : ""}` : "", b.ergebnis ? `Abstimmung: ${ergebnisText(b.ergebnis)}` : ""].filter(Boolean).join(" · ");
    blocks.push({ t: "text", text: meta, grau: true, klein: true });
    if (b.text) blocks.push({ t: "text", text: b.text });
    if ((b.anhaenge || []).length) blocks.push({ t: "text", text: "Anhänge: " + b.anhaenge.map((a) => a.name + (a.beschreibung ? ` (${a.beschreibung})` : "")).join("; "), klein: true, grau: true });
    blocks.push({ t: "linie" });
  });
  if (!liste.length) blocks.push({ t: "text", text: "Keine Beschlüsse in dieser Auswahl." });
  const stand = datumDe(heute());
  return { titel: "Beschlussbuch", untertitel: `Beschlussbuch${titelZusatz ? " – " + titelZusatz : ""} · Stand ${stand}`, dateiname: "Beschlussbuch", blocks };
}

// ---------------- Formular ----------------
function Formular({ start, themen, andere, onClose, onSaved }) {
  const { callAuthed, flashError } = useApp();
  const [f, setF] = useState(() => ({ ...start, thema: start.thema || themen[themen.length - 1] || "Sonstiges" }));
  const [laed, setLaed] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setAnh = (i, k, v) => setF((x) => ({ ...x, anhaenge: x.anhaenge.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }));

  async function dateiWaehlen(liste) {
    const dateien = Array.from(liste || []);
    if (!dateien.length) return;
    if (f.anhaenge.length + dateien.length > MAX_ANHAENGE) { flashError(`Höchstens ${MAX_ANHAENGE} Anhänge je Beschluss.`); return; }
    setLaed(true);
    try {
      for (const original of dateien) {
        let datei = original;
        if (istBild(original.type, original.name)) datei = await compressImage(original);
        if (datei.size > MAX_BYTES) { flashError(`„${original.name}“ ist größer als 10 MB.`); continue; }
        const r = await callAuthed("beschluesse", { action: "uploadUrl", id: f.id, filename: datei.name || original.name });
        if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
        const { error } = await supabase.storage.from("beschluesse").uploadToSignedUrl(r.data.path, r.data.uploadToken, datei);
        if (error) throw error;
        const a = { pfad: r.data.path, name: original.name || datei.name, typ: datei.type || original.type || "", groesse: datei.size, beschreibung: "", url: istBild(datei.type, original.name) ? URL.createObjectURL(datei) : null };
        setF((x) => ({ ...x, anhaenge: [...x.anhaenge, a] }));
      }
    } catch (e) { flashError("Hochladen fehlgeschlagen. Ist die Dateiart erlaubt (Bild, PDF, Word, Excel, PowerPoint, Text)?"); }
    setLaed(false);
  }
  async function speichern() {
    setFehlerText("");
    if (!f.titel.trim()) { setFehlerText("Bitte einen Titel eingeben."); return; }
    if (f.status === "ersetzt" && !f.ersetztDurch) { setFehlerText("Bitte wählen, durch welchen Beschluss dieser ersetzt wurde."); return; }
    setSpeichert(true);
    const r = await callAuthed("beschluesse", { action: "save", beschluss: { ...f, anhaenge: f.anhaenge.map(({ url, ...rest }) => rest) } });
    setSpeichert(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Speichern nicht möglich."); return; }
    onSaved(r.data.id);
  }
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Abbrechen</button></div>
      <div style={styles.modalTitle}>{start.angelegt ? "Beschluss bearbeiten" : "Neuer Beschluss"}</div>
      {f.sitzung && <div style={{ ...klein, marginBottom: 8 }}>Aus der Sitzung „{f.sitzung.titel}“{f.sitzung.datum ? ` vom ${datumDe(f.sitzung.datum)}` : ""}{f.ergebnis ? ` · Abstimmung: ${ergebnisText(f.ergebnis)}` : ""}</div>}
      <label style={styles.label}>Datum</label>
      <input style={styles.input} type="date" value={f.datum} onChange={(e) => set("datum", e.target.value)} />
      <label style={styles.label}>Titel</label>
      <input style={styles.input} placeholder="z. B. Neue Einsatzhelme beschafft" maxLength={160} value={f.titel} onChange={(e) => set("titel", e.target.value)} />
      <label style={styles.label}>Beschluss (Text)</label>
      <textarea style={{ ...styles.input, minHeight: 110, resize: "vertical" }} placeholder="Was wurde genau beschlossen?" value={f.text} onChange={(e) => set("text", e.target.value)} />
      <label style={styles.label}>Thema</label>
      <select style={styles.input} value={f.thema} onChange={(e) => set("thema", e.target.value)}>
        {[...new Set([...themen, f.thema].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <label style={styles.label}>Status</label>
      <select style={styles.input} data-testid="status-wahl" value={f.status} onChange={(e) => set("status", e.target.value)}>
        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {f.status === "ersetzt" && (
        <>
          <label style={styles.label}>Ersetzt durch</label>
          <select style={styles.input} value={f.ersetztDurch} onChange={(e) => set("ersetztDurch", e.target.value)}>
            <option value="">– bitte wählen –</option>
            {andere.filter((b) => b.id !== f.id).map((b) => <option key={b.id} value={b.id}>{datumDe(b.datum)} – {b.titel}</option>)}
          </select>
        </>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 4px", fontSize: 13.5, cursor: "pointer" }}>
        <input type="checkbox" checked={f.fuerAlle} onChange={(e) => set("fuerAlle", e.target.checked)} style={{ width: 18, height: 18 }} />
        Für alle Mitglieder sichtbar
      </label>
      <div style={klein}>Ohne Häkchen sehen den Beschluss nur Admins und der Ausschuss.</div>

      <div style={abschnitt}>ANHÄNGE ({f.anhaenge.length}/{MAX_ANHAENGE})</div>
      {f.anhaenge.map((a, i) => (
        <div key={a.pfad} style={{ ...styles.kontrollRow, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {a.url && istBild(a.typ, a.name) ? <img src={a.url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} /> : <FileText size={22} color="#8A8C86" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
              <div style={klein}>{groesseText(a.groesse)}</div>
            </div>
            <button style={styles.rosterRemoveBtn} aria-label="Anhang entfernen" onClick={() => set("anhaenge", f.anhaenge.filter((_, j) => j !== i))}><X size={14} /></button>
          </div>
          <input style={{ ...styles.input, marginTop: 6, fontSize: 12.5 }} data-testid={`anhang-beschreibung-${i}`} placeholder="Beschreibung / Stichwörter (damit man es später findet)" maxLength={300} value={a.beschreibung} onChange={(e) => setAnh(i, "beschreibung", e.target.value)} />
        </div>
      ))}
      {f.anhaenge.length < MAX_ANHAENGE && (
        <label style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}>
          <Paperclip size={14} /> {laed ? "Lädt hoch …" : "Datei oder Foto anhängen"}
          <input data-testid="anhang-datei" type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" style={{ display: "none" }} onChange={(e) => { const l = e.target.files; dateiWaehlen(l).finally(() => { try { e.target.value = ""; } catch (x) { /* egal */ } }); }} />
        </label>
      )}
      <div style={{ ...klein, marginTop: 6 }}>Tipp: Schreibe zu jedem Anhang ein paar Stichwörter, z. B. „Angebot Helme Firma X“. Die Suche durchsucht diese Beschreibung. Bis 10 MB je Datei.</div>
      {fehlerText && <div style={{ ...styles.errorText, marginTop: 10 }}>{fehlerText}</div>}
      <button style={{ ...knopfRot, width: "100%", marginTop: 16, opacity: speichert || laed ? 0.6 : 1 }} disabled={speichert || laed} onClick={speichern}><Check size={16} /> {speichert ? "Speichert …" : "Speichern"}</button>
    </div>
  );
}

// ---------------- Themen verwalten (Admin) ----------------
function ThemenVerwalten({ themen, onClose, onSaved }) {
  const { callAuthed, flashError } = useApp();
  const [liste, setListe] = useState(themen);
  const [neu, setNeu] = useState("");
  async function speichern() {
    const r = await callAuthed("beschluesse", { action: "themenSpeichern", themen: liste });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich."); return; }
    onSaved(r.data.themen);
  }
  const hinzu = () => { const t = neu.trim(); if (t && !liste.includes(t)) setListe([...liste, t]); setNeu(""); };
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Abbrechen</button></div>
      <div style={styles.modalTitle}>Themen verwalten</div>
      <div style={{ ...klein, marginBottom: 8 }}>Bestehende Beschlüsse behalten ihr Thema, auch wenn es hier entfernt wird.</div>
      {liste.map((t, i) => (
        <div key={t} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
          <div style={{ flex: 1, ...styles.kontrollRow, padding: "8px 10px", fontSize: 13.5 }}>{t}</div>
          <button style={styles.rosterRemoveBtn} aria-label={`${t} entfernen`} disabled={liste.length <= 1} onClick={() => setListe(liste.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input style={{ ...styles.input, flex: 1 }} placeholder="Neues Thema" maxLength={60} value={neu} onChange={(e) => setNeu(e.target.value)} onKeyDown={(e) => e.key === "Enter" && hinzu()} />
        <button style={{ ...styles.tinyBtn, padding: "0 12px" }} onClick={hinzu} aria-label="Thema hinzufügen"><Plus size={16} /></button>
      </div>
      <button style={{ ...knopfRot, width: "100%", marginTop: 16 }} onClick={speichern}><Check size={16} /> Speichern</button>
    </div>
  );
}

// ---------------- Kachel ----------------
export default function BeschlussbuchKachel() {
  const { callAuthed, flashError, closeKachelView, kachelReturnTo, setLightboxSrc, sitzungen, canSeeAusschuss, beschlussVorlage, setBeschlussVorlage, beschlussZurSitzung } = useApp();
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState("");
  const [suche, setSuche] = useState("");
  const [thema, setThema] = useState("");
  const [jahr, setJahr] = useState("");
  const [status, setStatus] = useState("");
  const [offen, setOffen] = useState(null);
  const [detail, setDetail] = useState({});
  const [formular, setFormular] = useState(null);
  const [themenDialog, setThemenDialog] = useState(false);
  const [loeschen, setLoeschen] = useState(null);

  async function laden() {
    const r = await callAuthed("beschluesse", { action: "list" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Das Beschlussbuch konnte nicht geladen werden."); return null; }
    setFehler(""); setDaten(r.data); return r.data;
  }
  useEffect(() => { laden(); }, []);
  // Aus einer Sitzung mit „Beschluss festhalten“ gekommen: Formular vorbefüllt öffnen
  useEffect(() => {
    if (beschlussVorlage) { setFormular({ ...leer(), ...beschlussVorlage }); setBeschlussVorlage(null); }
  }, [beschlussVorlage]);

  const rechte = (daten && daten.rechte) || {};
  const alle = (daten && daten.beschluesse) || [];
  const themen = (daten && daten.themen) || [];
  const woerter = useMemo(() => norm(suche).split(/\s+/).filter(Boolean), [suche]);
  const jahre = useMemo(() => [...new Set(alle.map((b) => (b.datum || "").slice(0, 4)).filter(Boolean))].sort().reverse(), [alle]);
  const themenVorhanden = useMemo(() => [...new Set([...themen, ...alle.map((b) => b.thema)].filter(Boolean))], [themen, alle]);
  const liste = useMemo(() => alle
    .map((b) => ({ b, t: suchTreffer(b, woerter) }))
    .filter(({ b, t }) => t.ok && (!thema || b.thema === thema) && (!jahr || (b.datum || "").startsWith(jahr)) && (!status || b.status === status))
    .sort((x, y) => (y.b.datum || "").localeCompare(x.b.datum || "") || (y.b.angelegtAm || "").localeCompare(x.b.angelegtAm || "")), [alle, woerter, thema, jahr, status]);
  const titelVon = (id) => { const b = alle.find((x) => x.id === id); return b ? b.titel : ""; };

  async function oeffnen(id) {
    if (offen === id) { setOffen(null); return; }
    setOffen(id);
    if (!detail[id]) {
      const r = await callAuthed("beschluesse", { action: "get", id });
      if (r.ok) setDetail((d) => ({ ...d, [id]: r.data.beschluss }));
      else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Der Beschluss konnte nicht geladen werden.");
    }
  }
  async function bearbeiten(b) {
    const r = await callAuthed("beschluesse", { action: "get", id: b.id });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Der Beschluss konnte nicht geladen werden."); return; }
    setFormular({ ...leer(), ...r.data.beschluss, angelegt: true });
  }
  async function nachSpeichern(id) {
    setFormular(null);
    setDetail((d) => { const n = { ...d }; delete n[id]; return n; });
    await laden();
    setOffen(null); setTimeout(() => oeffnen(id), 0);
  }
  async function endgueltigLoeschen() {
    const id = loeschen; setLoeschen(null);
    const r = await callAuthed("beschluesse", { action: "delete", id });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich."); return; }
    setOffen(null); setDetail({}); await laden();
  }
  function drucken() {
    const teile = [suche.trim() && `Suche „${suche.trim()}“`, thema, jahr, status && STATUS[status]].filter(Boolean).join(", ");
    if (!oeffneBericht(beschlussBericht(liste.map((x) => x.b), teile))) flashError("Bitte das Pop-up-Fenster zulassen.");
  }

  if (formular) return <Formular start={formular} themen={themen} andere={alle} onClose={() => setFormular(null)} onSaved={nachSpeichern} />;
  if (themenDialog) return <ThemenVerwalten themen={themen} onClose={() => setThemenDialog(false)} onSaved={(t) => { setThemenDialog(false); setDaten((d) => ({ ...d, themen: t })); }} />;

  const filterAktiv = !!(suche.trim() || thema || jahr || status);
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Beschlussbuch</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {!daten && !fehler && <div style={{ ...klein, marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          {rechte.bearbeiter && <button style={{ ...knopfRot, width: "100%", margin: "10px 0" }} data-testid="neuer-beschluss" onClick={() => setFormular(leer())}><Plus size={16} /> Neuer Beschluss</button>}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={14} color="#A5A79F" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input style={{ ...styles.input, paddingLeft: 30 }} data-testid="beschluss-suche" placeholder="Suchen: Titel, Text, Thema, Anhang-Beschreibung" value={suche} onChange={(e) => setSuche(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select style={{ ...styles.input, flex: "1 1 120px", minWidth: 0, fontSize: 12.5 }} aria-label="Thema" value={thema} onChange={(e) => setThema(e.target.value)}>
              <option value="">Alle Themen</option>
              {themenVorhanden.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={{ ...styles.input, flex: "1 1 80px", minWidth: 0, fontSize: 12.5 }} aria-label="Jahr" value={jahr} onChange={(e) => setJahr(e.target.value)}>
              <option value="">Alle Jahre</option>
              {jahre.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
            <select style={{ ...styles.input, flex: "1 1 100px", minWidth: 0, fontSize: 12.5 }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Alle Status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0 2px", flexWrap: "wrap" }}>
            <span style={klein} data-testid="beschluss-zahl">{liste.length} {liste.length === 1 ? "Beschluss" : "Beschlüsse"}{filterAktiv ? " gefunden" : ""}</span>
            <span style={{ flex: 1 }} />
            {filterAktiv && <button style={styles.tinyBtn} onClick={() => { setSuche(""); setThema(""); setJahr(""); setStatus(""); }}>Filter zurücksetzen</button>}
            <button style={styles.tinyBtn} data-testid="beschluss-pdf" onClick={drucken}><Printer size={12} /> PDF / Drucken</button>
            {rechte.admin && <button style={styles.tinyBtn} onClick={() => setThemenDialog(true)}>Themen</button>}
          </div>
          {liste.length === 0 && <div style={{ ...klein, marginTop: 14 }}>{alle.length === 0 ? "Noch kein Beschluss eingetragen." : "Nichts gefunden."}</div>}
          {liste.map(({ b, t }) => {
            const [fc, bg] = STATUS_FARBE[b.status] || STATUS_FARBE.gueltig;
            const d = detail[b.id];
            const istOffen = offen === b.id;
            return (
              <div key={b.id} style={{ ...styles.kontrollRow, marginTop: 8 }} data-testid="beschluss-karte">
                <button type="button" data-knopf="fest" aria-expanded={istOffen} onClick={() => oeffnen(b.id)} style={{ all: "unset", display: "block", width: "100%", cursor: "pointer", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.titel}</div>
                      <div style={klein}>{datumDe(b.datum)}</div>
                    </div>
                    <ChevronDown size={15} color="#8A8C86" style={{ flex: "none", marginTop: 3, transform: istOffen ? "rotate(180deg)" : "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    <Pille text={b.thema || "Sonstiges"} farbe="#4A6670" grund="#EAF0F2" />
                    <Pille text={b.status === "ersetzt" && titelVon(b.ersetztDurch) ? `Ersetzt durch: ${titelVon(b.ersetztDurch)}` : STATUS[b.status] || "Gültig"} farbe={fc} grund={bg} />
                    {b.fuerAlle && <Pille text="Für alle sichtbar" farbe="#5C5F58" grund="#EEEEEC" />}
                    {(b.anhaenge || []).length > 0 && <Pille text={`📎 ${b.anhaenge.length}`} farbe="#5C5F58" grund="#EEEEEC" />}
                  </div>
                  {t.anhaenge.length > 0 && <div style={{ ...klein, marginTop: 5, color: "#9A5B00" }}>Treffer in der Beschreibung des Anhangs: {t.anhaenge.map((a) => a.name).join(", ")}</div>}
                </button>
                {istOffen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                    {b.text ? <div style={{ fontSize: 13, color: "#2C2F2A", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{b.text}</div> : <div style={klein}>Kein Text.</div>}
                    {b.sitzung && (
                      <div style={{ ...klein, marginTop: 10 }}>
                        Sitzung: {b.sitzung.titel}{b.sitzung.datum ? ` (${datumDe(b.sitzung.datum)})` : ""}{b.sitzung.punkt && b.sitzung.punkt !== b.titel ? ` · Punkt: ${b.sitzung.punkt}` : ""}
                        {canSeeAusschuss && (sitzungen || []).some((s) => s.id === b.sitzung.id) && <button style={{ ...styles.tinyBtn, marginLeft: 8 }} data-testid="zur-sitzung" onClick={() => beschlussZurSitzung(b.sitzung.id)}>Zur Sitzung</button>}
                      </div>
                    )}
                    {b.ergebnis && <div style={{ ...klein, marginTop: 4 }}>Abstimmung: {ergebnisText(b.ergebnis)}</div>}
                    {(b.anhaenge || []).length > 0 && <div style={abschnitt}>ANHÄNGE</div>}
                    {(b.anhaenge || []).map((a) => {
                      const u = d && (d.anhaenge || []).find((x) => x.pfad === a.pfad);
                      const url = u && u.url;
                      const bild = istBild(a.typ, a.name);
                      return (
                        <div key={a.pfad} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }} data-testid="anhang-zeile">
                          {bild && url ? <img src={url} alt={a.name} onClick={() => setLightboxSrc(url)} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, cursor: "zoom-in", border: "1px solid #E2DFD6" }} /> : <FileText size={26} color="#8A8C86" />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {bild || !url ? <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div> : <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1F4E79", wordBreak: "break-all" }}>{a.name}</a>}
                            {a.beschreibung && <div style={klein}>{a.beschreibung}</div>}
                          </div>
                        </div>
                      );
                    })}
                    {rechte.bearbeiter && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button style={styles.exportBtn} data-testid="beschluss-bearbeiten" onClick={() => bearbeiten(b)}><Pencil size={14} /> Bearbeiten</button>
                        <button style={styles.deleteBtn} onClick={() => setLoeschen(b.id)}><Trash2 size={14} /> Löschen</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      {loeschen && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setLoeschen(null)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter" role="dialog" aria-label="Beschluss löschen">
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Beschluss löschen?</div>
            <div style={{ fontSize: 12.5, color: "#5C5F58", marginBottom: 14 }}>„{titelVon(loeschen)}“ und alle Anhänge werden endgültig gelöscht. Wenn der Beschluss nur nicht mehr gilt, setze lieber den Status auf „Aufgehoben“.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.exportBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschen(null)}>Abbrechen</button>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} data-testid="loeschen-ja" onClick={endgueltigLoeschen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
