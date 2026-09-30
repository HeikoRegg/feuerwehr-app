// Kachel Geräte: Gerätedatenbank mit Prüfungen, Mängelmeldungen (mit Foto und Notizen), QR-Etiketten,
// Fahrzeug-Rundgang und Übersicht für den Gerätewart. Die Rechte prüft der Server (netlify/functions/geraete.js).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, Camera, Eye, EyeOff, Check, ChevronDown, ChevronRight, ClipboardCheck, MapPin, Pencil, Plus, Printer, QrCode, ScanLine, Send, Trash2, Wrench, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { compressImage, matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { bereiteFensterVor, oeffneBericht } from "../lib/bericht";
import { SearchBox } from "../components/Shared";
import QrScanner from "../components/QrScanner";
import { etikettenModell } from "../lib/etiketten";
import { MANGEL_STATUS, PRUEFART, PRUEFARTEN, STATUS_INFO, artStatus, datumDe, faelligeSchnellpruefungen, geraeteName, geraetStatus, heuteISO, idAusQr, intervallNormal, intervallText, plusIntervall, zeitDe } from "../lib/geraete";
import { EIGENE_GRUPPE, VORLAGEN_GRUPPEN, vorlagenGruppen, vorlagePruefarten } from "../lib/geraeteVorlagen";
import { sichtbereichStil, useSichtbereich } from "../lib/sichtbereich";
import { hole, merke } from "../lib/zwischenspeicher";
import { useApp } from "../AppContext";

const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "18px 0 6px", letterSpacing: "0.04em" };
const sortiere = (a, b) => (a.fach || "").localeCompare(b.fach || "", "de", { numeric: true }) || geraeteName(a).localeCompare(geraeteName(b), "de", { numeric: true });
const knopf = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, border: "1.5px solid #E2DFD6", background: "white", color: "#2C2F2A", flex: 1 };
const knopfRot = { ...knopf, background: "#C1272D", color: "white", border: "1.5px solid #C1272D" };

function Pille({ status, text }) {
  const i = STATUS_INFO[status] || STATUS_INFO.ok;
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: i.farbe, background: i.grund, whiteSpace: "nowrap" }}>{text || i.text}</span>;
}
function Dialog({ titel, onClose, children }) {
  // Unten angedocktes Blatt, das über der Tastatur bleibt (Höhe = sichtbarer Bereich).
  const vv = useSichtbereich();
  return (
    <div style={{ ...styles.modalBackdrop, ...sichtbereichStil(vv), zIndex: 80 }} onClick={onClose}>
      <div style={{ ...styles.modalSheet, maxHeight: vv ? Math.round(vv.h * 0.92) : "88vh" }} onClick={(e) => e.stopPropagation()} className="card-enter">
        <div style={styles.modalHeader}><span style={styles.modalTitle}>{titel}</span><button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={20} color="#5C5F58" /></button></div>
        {children}
      </div>
    </div>
  );
}

// Vollbild-Ebene von oben: Kopf und Fuß fest, Inhalt scrollt. Passt sich an die Tastatur an (visualViewport).
function Vollbild({ titel, onClose, kopf, fuss, children, label }) {
  const vv = useSichtbereich();
  return (
    <div role="dialog" aria-label={label || titel} style={{ ...sichtbereichStil(vv), zIndex: 85, background: "#F3F1EC", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "calc(10px + env(safe-area-inset-top)) 16px 8px", borderBottom: "1px solid #E2DFD6" }}>
        <div style={{ ...styles.modalHeader, marginBottom: 8 }}><span style={styles.modalTitle}>{titel}</span><button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={20} color="#5C5F58" /></button></div>
        {kopf}
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 12px" }} data-testid="vollbild-liste">{children}</div>
      {fuss && <div style={{ flexShrink: 0, padding: vv && vv.tastatur ? "8px 16px" : "8px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid #E2DFD6", background: "#F3F1EC" }}>{fuss}</div>}
    </div>
  );
}

// Prüfarten mit Frist (Zahl + Monat/Jahr) – im Geräteformular und bei den Vorlagen.
function PruefartenFeld({ pruefarten, onChange }) {
  const hat = (art) => pruefarten.find((p) => p.art === art);
  const toggleArt = (def) => onChange(hat(def.key) ? pruefarten.filter((p) => p.art !== def.key) : [...pruefarten, { art: def.key, intervall: def.standard, einheit: def.einheit }]);
  const setIntervall = (art, v) => onChange(pruefarten.map((p) => p.art === art ? { ...p, intervall: Math.max(0, parseInt(v, 10) || 0) } : p));
  const setEinheit = (art, e) => onChange(pruefarten.map((p) => p.art === art ? { ...p, einheit: e } : p));
  return PRUEFARTEN.map((def) => {
    const p = hat(def.key);
    return (
      <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
        <label style={{ ...styles.checkboxRow, flex: 1, alignItems: "center" }}><input type="checkbox" checked={!!p} onChange={() => toggleArt(def)} /> {def.name}</label>
        {p && def.key !== "verfall" && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#5C5F58" }}>
            {def.typ === "intervall" ? "alle" : "Vorschlag"}
            <input style={{ ...styles.input, width: 52, padding: "5px 6px", marginTop: 0 }} aria-label={`${def.name} Zahl`} type="number" min={1} inputMode="numeric" value={p.intervall} onChange={(e) => setIntervall(def.key, e.target.value)} />
            <select style={{ ...styles.input, width: "auto", padding: "5px 4px", marginTop: 0 }} aria-label={`${def.name} Einheit`} value={p.einheit === "jahre" ? "jahre" : "monate"} onChange={(e) => setEinheit(def.key, e.target.value)}>
              <option value="monate">{p.intervall === 1 ? "Monat" : "Monate"}</option>
              <option value="jahre">{p.intervall === 1 ? "Jahr" : "Jahre"}</option>
            </select>
          </span>
        )}
      </div>
    );
  });
}
const normalePruefarten = (liste) => (liste || []).filter((p) => PRUEFART[p.art]).map((p) => ({ art: p.art, ...intervallNormal(p, PRUEFART[p.art]) }));
const kurzPruefarten = (liste) => (liste || []).filter((p) => PRUEFART[p.art]).map((p) => (p.art === "verfall" ? PRUEFART[p.art].name : `${PRUEFART[p.art].name} ${intervallText(p)}`)).join(" · ");

// Foto auswählen, verkleinern und hochladen (privater Speicher, Zugriff nur über die App).
function FotoFeld({ art, wert, onChange, callAuthed, flashError, label = "Foto anhängen" }) {
  const [laed, setLaed] = useState(false);
  async function waehlen(file) {
    if (!file) return;
    setLaed(true);
    try {
      const klein = await compressImage(file);
      const r = await callAuthed("geraete", { action: "uploadUrl", art, filename: klein.name });
      if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
      const { error } = await supabase.storage.from("geraete").uploadToSignedUrl(r.data.path, r.data.uploadToken, klein);
      if (error) throw error;
      onChange({ path: r.data.path, url: URL.createObjectURL(klein) });
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setLaed(false);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
      {wert && wert.url && <img src={wert.url} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6" }} />}
      <label style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
        <Camera size={13} /> {laed ? "Lädt hoch …" : wert ? "Anderes Foto" : label}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; waehlen(f); }} />
      </label>
      {wert && <button style={styles.tinyBtn} onClick={() => onChange(null)}>Entfernen</button>}
    </div>
  );
}

// ---------------- Mangel melden ----------------
function MangelDialog({ g, onClose, onDone, callAuthed, flashError }) {
  const [text, setText] = useState(""); const [foto, setFoto] = useState(null); const [gesperrt, setGesperrt] = useState(false);
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  async function senden() {
    if (text.trim().length < 3) { setFehler("Bitte kurz beschreiben, was defekt ist oder fehlt."); return; }
    setBusy(true); setFehler("");
    const r = await callAuthed("geraete", { action: "mangel", geraet: g.id, text: text.trim(), foto: foto ? foto.path : "", nichtEinsatzbereit: gesperrt });
    setBusy(false);
    if (r.ok) onDone(); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Meldung nicht möglich.");
  }
  return (
    <Dialog titel={`Mangel melden – ${geraeteName(g)}`} onClose={onClose}>
      <div style={styles.formBody}>
        <label style={styles.label}>WAS IST DEFEKT ODER FEHLT?</label>
        <textarea style={{ ...styles.input, minHeight: 84, resize: "vertical" }} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="z. B. Starterseil gerissen, Schlauch undicht …" />
        <FotoFeld art="mangel" wert={foto} onChange={setFoto} callAuthed={callAuthed} flashError={flashError} label="Foto vom Schaden" />
        <label style={{ ...styles.checkboxRow, marginTop: 12 }}><input type="checkbox" checked={gesperrt} onChange={(e) => setGesperrt(e.target.checked)} /> Gerät ist nicht einsatzbereit</label>
        <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 4 }}>Gerätewart, Kommandant und Stellvertreter bekommen sofort eine Benachrichtigung.</div>
        {fehler && <div style={styles.errorText}>{fehler}</div>}
        <div style={styles.formActions}><button style={styles.saveBtn} disabled={busy} onClick={senden}>{busy ? "Wird gesendet …" : "Mangel melden"}</button></div>
      </div>
    </Dialog>
  );
}

// ---------------- Prüfung eintragen ----------------
function PruefDialog({ g, verwalter, onClose, onDone, callAuthed, flashError }) {
  const arten = (g.pruefarten || []).filter((p) => PRUEFART[p.art]);
  const [z, setZ] = useState(() => Object.fromEntries(arten.map((p) => [p.art, { wahl: null, text: "", foto: null, gesperrt: false, bis: PRUEFART[p.art].typ === "datum" && p.intervall > 0 ? plusIntervall(heuteISO(), { intervall: p.intervall, einheit: p.einheit || "monate" }) : "" }])));
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const set = (art, patch) => setZ((s) => ({ ...s, [art]: { ...s[art], ...patch } }));
  const alleOk = () => setZ((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, PRUEFART[k].typ === "intervall" ? { ...v, wahl: "ok" } : v])));
  async function speichern() {
    const ergebnisse = [];
    for (const p of arten) {
      const v = z[p.art]; if (!v.wahl) continue;
      const def = PRUEFART[p.art];
      if (v.wahl === "mangel" && v.text.trim().length < 3) { setFehler(`Bitte bei „${def.name}“ kurz beschreiben, was nicht stimmt.`); return; }
      if (def.typ === "datum" && v.wahl === "ok" && !v.bis) { setFehler(`Bitte bei „${def.name}“ das Datum eintragen.`); return; }
      ergebnisse.push({ art: p.art, ergebnis: v.wahl, text: v.text.trim(), bis: def.typ === "datum" ? v.bis : "", foto: v.foto ? v.foto.path : "", nichtEinsatzbereit: v.gesperrt });
    }
    if (!ergebnisse.length) { setFehler("Bitte mindestens eine Prüfung mit „In Ordnung“ oder „Mangel“ auswählen."); return; }
    setBusy(true); setFehler("");
    const r = await callAuthed("geraete", { action: "pruefen", geraet: g.id, ergebnisse });
    setBusy(false);
    if (r.ok) onDone(); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  const segment = (aktiv, farbe) => ({ flex: 1, padding: "8px 6px", fontSize: 12.5, fontWeight: 700, borderRadius: 6, border: `1.5px solid ${aktiv ? farbe : "#E2DFD6"}`, background: aktiv ? farbe : "white", color: aktiv ? "white" : "#2C2F2A" });
  return (
    <Dialog titel={`Prüfung – ${geraeteName(g)}`} onClose={onClose}>
      {arten.length === 0 && <div style={{ fontSize: 13, color: "#8A8C86" }}>Für dieses Gerät sind keine Prüfarten festgelegt. Der Gerätewart kann sie beim Bearbeiten auswählen.</div>}
      {arten.some((p) => PRUEFART[p.art].typ === "intervall") && <button style={{ ...styles.tinyBtnPrimary, marginBottom: 8 }} onClick={alleOk}><Check size={12} /> Alle Ja/Nein-Prüfungen: in Ordnung</button>}
      {arten.map((p) => {
        const def = PRUEFART[p.art]; const v = z[p.art]; const s = artStatus(g, p.art);
        const gesperrtFuerMich = def.typ === "datum" && !verwalter;
        return (
          <div key={p.art} style={{ ...styles.capacityBox, marginBottom: 8, opacity: gesperrtFuerMich ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{def.name}</div>
              <Pille status={s.status} text={s.status === "nie" ? "noch nie" : s.status === "ok" ? "aktuell" : undefined} />
            </div>
            <div style={{ fontSize: 11.5, color: "#8A8C86", margin: "2px 0 8px" }}>{def.frage}</div>
            {gesperrtFuerMich ? <div style={{ fontSize: 11.5, color: "#8A8C86" }}>Das trägt der Gerätewart ein.</div> : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={segment(v.wahl === "ok", "#2E7D4F")} onClick={() => set(p.art, { wahl: v.wahl === "ok" ? null : "ok" })}>In Ordnung</button>
                  <button style={segment(v.wahl === "mangel", "#C1272D")} onClick={() => set(p.art, { wahl: v.wahl === "mangel" ? null : "mangel" })}>Mangel</button>
                </div>
                {def.typ === "datum" && v.wahl === "ok" && (
                  <div style={{ marginTop: 8 }}><label style={{ ...styles.label, marginTop: 0 }}>{p.art === "verfall" ? "VERFÄLLT AM" : "GÜLTIG BIS"}</label><input style={styles.input} type="date" value={v.bis} onChange={(e) => set(p.art, { bis: e.target.value })} /></div>
                )}
                {v.wahl === "mangel" && (
                  <div style={{ marginTop: 8 }}>
                    <textarea style={{ ...styles.input, minHeight: 64, resize: "vertical" }} value={v.text} maxLength={1000} placeholder="Was stimmt nicht?" onChange={(e) => set(p.art, { text: e.target.value })} />
                    <FotoFeld art="mangel" wert={v.foto} onChange={(f) => set(p.art, { foto: f })} callAuthed={callAuthed} flashError={flashError} label="Foto vom Schaden" />
                    <label style={{ ...styles.checkboxRow, marginTop: 8 }}><input type="checkbox" checked={v.gesperrt} onChange={(e) => set(p.art, { gesperrt: e.target.checked })} /> Gerät ist nicht einsatzbereit</label>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      <div style={styles.formActions}><button style={styles.saveBtn} disabled={busy || !arten.length} onClick={speichern}>{busy ? "Wird gespeichert …" : "Prüfung speichern"}</button></div>
    </Dialog>
  );
}

// ---------------- Mangel mit Verlauf ----------------
function MangelKarte({ m, bearbeiter, verwalter, callAuthed, flashError, onChanged, setLightboxSrc }) {
  const [text, setText] = useState(""); const [status, setStatus] = useState(m.status); const [busy, setBusy] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const farbe = m.status === "behoben" ? "#2E7D4F" : m.nichtEinsatzbereit ? "#8E1B20" : "#C1272D";
  async function speichern() {
    if (!text.trim() && status === m.status) { flashError("Bitte eine Notiz schreiben oder den Status ändern."); return; }
    setBusy(true);
    const r = await callAuthed("geraete", { action: "notiz", mangel: m.id, text: text.trim(), status });
    setBusy(false);
    if (r.ok) { setText(""); onChanged(); } else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich.");
  }
  async function entfernen() {
    setLoeschen(false);
    const r = await callAuthed("geraete", { action: "deleteMangel", mangel: m.id });
    if (r.ok) onChanged(); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  return (
    <div style={{ ...styles.capacityBox, borderLeft: `4px solid ${farbe}`, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "white", background: farbe, borderRadius: 10, padding: "2px 8px" }}>{MANGEL_STATUS[m.status]}</span>
          {m.nichtEinsatzbereit && m.status !== "behoben" && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8E1B20" }}>nicht einsatzbereit</span>}
        </div>
        {verwalter && <button style={styles.rosterRemoveBtn} aria-label="Mangel löschen" onClick={() => setLoeschen(true)}><Trash2 size={13} /></button>}
      </div>
      <div style={{ fontSize: 13, margin: "6px 0 2px", whiteSpace: "pre-wrap" }}>{m.text}</div>
      <div style={{ fontSize: 11, color: "#8A8C86" }}>gemeldet von {m.von} · {zeitDe(m.ts)}</div>
      {m.fotoUrl && <img src={m.fotoUrl} alt="Foto vom Mangel" onClick={() => setLightboxSrc(m.fotoUrl)} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6", marginTop: 6, cursor: "zoom-in" }} />}
      {(m.verlauf || []).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #E2DFD6" }}>
          {m.verlauf.map((v) => (
            <div key={v.id} style={{ fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700 }}>{v.von}</span> <span style={{ color: "#A5A79F", fontSize: 10.5 }}>{zeitDe(v.ts)}</span>
              {v.status && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: v.status === "behoben" ? "#2E7D4F" : "#B8791A" }}>→ {MANGEL_STATUS[v.status]}</span>}
              {v.text && <div style={{ whiteSpace: "pre-wrap" }}>{v.text}</div>}
            </div>
          ))}
        </div>
      )}
      {m.status === "behoben" && m.behobenVon && <div style={{ fontSize: 11, color: "#2E7D4F", marginTop: 4 }}>behoben von {m.behobenVon} · {zeitDe(m.behobenAm)}</div>}
      {bearbeiter && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {Object.entries(MANGEL_STATUS).map(([k, t]) => (
              <button key={k} onClick={() => setStatus(k)} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "5px 4px", borderRadius: 6, border: `1.5px solid ${status === k ? "#2C2F2A" : "#E2DFD6"}`, background: status === k ? "#2C2F2A" : "white", color: status === k ? "white" : "#2C2F2A" }}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...styles.input, flex: 1, marginTop: 0 }} value={text} maxLength={600} placeholder="Kurze Notiz, z. B. Ersatzteil bestellt …" onChange={(e) => setText(e.target.value)} />
            <button style={{ ...styles.saveBtn, flex: "0 0 44px", width: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Notiz speichern" disabled={busy} onClick={speichern}><Send size={16} /></button>
          </div>
        </div>
      )}
      {loeschen && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center", zIndex: 90 }} onClick={() => setLoeschen(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Mangel löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Meldung, Foto und Notizen werden entfernt.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschen(false)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={entfernen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Gerät: Einzelansicht ----------------
function GeraetDetail({ id, rechte, orte, onBack, onChanged, onBearbeiten, onEtikett }) {
  const { callAuthed, flashError, setLightboxSrc } = useApp();
  const [d, setD] = useState(null); const [fehler, setFehler] = useState("");
  const [dialog, setDialog] = useState(null); const [alteZeigen, setAlteZeigen] = useState(false); const [verlaufZeigen, setVerlaufZeigen] = useState(false);
  async function laden() {
    const r = await callAuthed("geraete", { action: "get", id });
    if (r.ok) { setD(r.data); setFehler(""); } else if (r.data.error === "abgebrochen") onBack(); else setFehler(r.data.error || "Gerät konnte nicht geladen werden.");
  }
  useEffect(() => { laden(); }, [id]);
  const nachAenderung = () => { setDialog(null); laden(); onChanged(); };

  if (!d) return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div>
      {fehler ? <div style={styles.errorText}>{fehler}</div> : <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Lädt …</div>}
    </div>
  );
  const g0 = d.geraet;
  const offene = d.maengel.filter((m) => m.status !== "behoben"); const behoben = d.maengel.filter((m) => m.status === "behoben");
  const g = { ...g0, offeneMaengel: offene.length, nichtEinsatzbereit: offene.some((m) => m.nichtEinsatzbereit) };
  const status = geraetStatus(g);
  const ort = orte.find((o) => o.id === g.ort);
  const zeile = (l, v) => v ? <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #F0EEE8" }}><span style={{ color: "#8A8C86" }}>{l}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div> : null;
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div>
      {g.fotoUrl && <img src={g.fotoUrl} alt="" onClick={() => setLightboxSrc(g.fotoUrl)} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 10, cursor: "zoom-in" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ ...styles.modalTitle, lineHeight: 1.25 }}>{g.name}</div>
        <Pille status={status} />
      </div>
      <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 10px", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {[ort && ort.name, g.fach].filter(Boolean).join(" · ") || "Kein Standort"}{g.menge > 1 ? ` · ${g.menge} Stück` : ""}</div>

      {!g.ausgesondert && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button style={knopfRot} onClick={() => setDialog("pruefen")}><ClipboardCheck size={16} /> Prüfung eintragen</button>
          <button style={knopf} onClick={() => setDialog("mangel")}><AlertTriangle size={16} color="#C1272D" /> Mangel melden</button>
        </div>
      )}
      {rechte.verwalter && (
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button style={knopf} onClick={() => onBearbeiten(g.id)}><Pencil size={15} /> Bearbeiten</button>
          <button style={knopf} onClick={() => onEtikett(g.id)}><QrCode size={15} /> Etikett drucken</button>
        </div>
      )}

      <div style={abschnitt}>PRÜFUNGEN</div>
      {(g.pruefarten || []).length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine Prüfarten festgelegt.</div>}
      {(g.pruefarten || []).map((p) => {
        const def = PRUEFART[p.art]; if (!def) return null; const s = artStatus(g, p.art);
        return (
          <div key={p.art} style={{ ...styles.kontrollRow, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{def.name}{def.typ === "intervall" && p.intervall ? <span style={{ fontWeight: 400, color: "#8A8C86" }}> · alle {intervallText(p)}</span> : null}</div>
              <div style={{ fontSize: 11, color: "#8A8C86" }}>
                {s.stand ? `zuletzt ${zeitDe(s.stand.ts).slice(0, 10)} von ${s.stand.von}${s.stand.ergebnis === "mangel" ? " (Mangel)" : ""}` : "noch nie geprüft"}
                {s.faelligAm ? ` · ${def.typ === "datum" ? (p.art === "verfall" ? "verfällt" : "gültig bis") : "nächste"} ${datumDe(s.faelligAm)}` : ""}
              </div>
            </div>
            {s.stand && s.stand.ergebnis === "mangel" && s.status !== "ueberfaellig" && s.status !== "nie" ? <Pille status="mangel" text="Mangel gemeldet" /> : <Pille status={s.status} text={s.status === "nie" ? "offen" : undefined} />}
          </div>
        );
      })}

      <div style={abschnitt}>MÄNGEL {offene.length ? `(${offene.length} OFFEN)` : ""}</div>
      {offene.length === 0 && <div style={{ fontSize: 12, color: "#2E7D4F" }}>Keine offenen Mängel.</div>}
      {offene.map((m) => <MangelKarte key={m.id} m={m} bearbeiter={rechte.bearbeiter} verwalter={rechte.verwalter} callAuthed={callAuthed} flashError={flashError} onChanged={nachAenderung} setLightboxSrc={setLightboxSrc} />)}
      {behoben.length > 0 && (
        <>
          <button style={{ ...styles.advancedToggle, margin: "6px 0" }} onClick={() => setAlteZeigen(!alteZeigen)}>{alteZeigen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Behobene Mängel ({behoben.length})</button>
          {alteZeigen && behoben.map((m) => <MangelKarte key={m.id} m={m} bearbeiter={rechte.bearbeiter} verwalter={rechte.verwalter} callAuthed={callAuthed} flashError={flashError} onChanged={nachAenderung} setLightboxSrc={setLightboxSrc} />)}
        </>
      )}

      <div style={abschnitt}>ANGABEN</div>
      <div style={styles.capacityBox}>
        {zeile("Seriennummer", g.seriennummer)}{zeile("Inventarnummer", g.inventar)}{zeile("Hersteller", g.hersteller)}{zeile("Baujahr", g.baujahr)}{zeile("Notiz", g.notiz)}
        {!g.seriennummer && !g.inventar && !g.hersteller && !g.baujahr && !g.notiz && <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine weiteren Angaben.</div>}
      </div>

      <button style={{ ...styles.advancedToggle, margin: "14px 0 6px" }} onClick={() => setVerlaufZeigen(!verlaufZeigen)}>{verlaufZeigen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Prüfverlauf ({d.historie.length})</button>
      {verlaufZeigen && d.historie.map((h) => (
        <div key={h.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #F0EEE8" }}>
          <span style={{ color: "#8A8C86" }}>{zeitDe(h.ts)}</span> · <b>{(PRUEFART[h.art] || {}).name || h.art}</b> · {h.ergebnis === "ok" ? <span style={{ color: "#2E7D4F", fontWeight: 700 }}>in Ordnung</span> : <span style={{ color: "#C1272D", fontWeight: 700 }}>Mangel</span>}
          <span style={{ color: "#8A8C86" }}> · {h.von}{h.bis ? ` · bis ${datumDe(h.bis)}` : ""}</span>{h.text ? <div style={{ color: "#5C5F58" }}>{h.text}</div> : null}
        </div>
      ))}

      {dialog === "pruefen" && <PruefDialog g={g} verwalter={rechte.verwalter} onClose={() => setDialog(null)} onDone={nachAenderung} callAuthed={callAuthed} flashError={flashError} />}
      {dialog === "mangel" && <MangelDialog g={g} onClose={() => setDialog(null)} onDone={nachAenderung} callAuthed={callAuthed} flashError={flashError} />}
    </div>
  );
}

// ---------------- Vorschlagsliste (typische LF-8/6-Geräte + eigene Vorlagen) ----------------
function VorschlagsWaehler({ daten, einzeln, onWahl, onClose }) {
  const [suche, setSuche] = useState(""); const [wahl, setWahl] = useState({}); // schluessel -> menge
  const alleGruppen = vorlagenGruppen(daten.vorlagen);
  const gruppen = alleGruppen.map((g) => ({ ...g, eintraege: g.eintraege.filter((e) => matchesSearch(`${e.name} ${e.kurzname}`, suche)) })).filter((g) => g.eintraege.length);
  const anzahl = Object.keys(wahl).length;
  const alle = alleGruppen.flatMap((g) => g.eintraege);
  const klick = (e) => {
    if (einzeln) { onWahl([{ ...e, menge: 1 }]); return; }
    setWahl((w) => { const n = { ...w }; if (n[e.schluessel]) delete n[e.schluessel]; else n[e.schluessel] = 1; return n; });
  };
  const fuss = !einzeln && <button style={{ ...knopfRot, width: "100%", flex: "none" }} disabled={!anzahl} onClick={() => onWahl(Object.entries(wahl).map(([k, menge]) => ({ ...alle.find((x) => x.schluessel === k), menge })))}>{anzahl ? `${anzahl} übernehmen` : "Häkchen setzen zum Auswählen"}</button>;
  return (
    <Vollbild titel={einzeln ? "Gerät aus Vorschlagsliste" : "Aus Vorschlagsliste wählen"} onClose={onClose} fuss={fuss}
      kopf={<SearchBox value={suche} onChange={setSuche} placeholder="Suchen, z. B. Hohlstrahlrohr …" />}>
      {gruppen.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8C86", padding: "10px 0" }}>Nichts gefunden. Du kannst den Namen auch selbst eintippen.</div>}
      {gruppen.map((g) => (
        <div key={g.gruppe}>
          <div style={abschnitt}>{g.gruppe.toUpperCase()}</div>
          {g.eintraege.map((e) => (
            <div key={e.schluessel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #E7E4DC" }}>
              <button style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, background: "none", border: "none", padding: "4px 0", textAlign: "left", fontSize: 14, color: "#2C2F2A" }} onClick={() => klick(e)} aria-label={e.name}>
                {!einzeln && <input type="checkbox" readOnly checked={!!wahl[e.schluessel]} style={{ pointerEvents: "none" }} />}
                <span>{e.name}</span>
              </button>
              {!einzeln && wahl[e.schluessel] && <input aria-label={`Menge ${e.name}`} style={{ ...styles.input, width: 56, padding: "5px 6px", marginTop: 0 }} type="number" min={1} inputMode="numeric" value={wahl[e.schluessel]} onChange={(ev) => setWahl((w) => ({ ...w, [e.schluessel]: Math.max(1, parseInt(ev.target.value, 10) || 1) }))} />}
            </div>
          ))}
        </div>
      ))}
    </Vollbild>
  );
}

// ---------------- Vorlagen verwalten (mitgelieferte anpassen/ausblenden, eigene anlegen/ändern/löschen) ----------------
function VorlageFormular({ eintrag, onBack, onGespeichert }) {
  const { callAuthed, flashError } = useApp();
  const neu = !eintrag;
  const std = eintrag && !eintrag.eigene; // mitgelieferter Vorschlag
  const [f, setF] = useState(() => ({
    name: eintrag ? eintrag.name : "", kurzname: eintrag ? eintrag.kurzname || "" : "",
    gruppe: eintrag && eintrag.eigene ? eintrag.gruppe || EIGENE_GRUPPE : EIGENE_GRUPPE,
    pruefarten: eintrag ? normalePruefarten(vorlagePruefarten(eintrag, PRUEFART)) : [{ art: "sicht", intervall: PRUEFART.sicht.standard, einheit: PRUEFART.sicht.einheit }],
    sichtbar: !(eintrag && eintrag.ausgeblendet),
  }));
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState(""); const [frage, setFrage] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  async function speichern() {
    if (!f.name.trim()) { setFehler("Bitte einen Namen eingeben."); return; }
    setBusy(true); setFehler("");
    const vorlage = { name: f.name.trim(), kurzname: f.kurzname.trim(), pruefarten: f.pruefarten };
    if (std) { vorlage.basis = eintrag.basis; vorlage.ausgeblendet = !f.sichtbar; }
    else { vorlage.gruppe = f.gruppe === EIGENE_GRUPPE ? "" : f.gruppe; if (eintrag) vorlage.id = eintrag.id; }
    const r = await callAuthed("geraete", { action: "saveVorlage", vorlage });
    setBusy(false);
    if (r.ok) onGespeichert(r.data.vorlagen); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  async function entfernen() {
    setFrage(false);
    const r = await callAuthed("geraete", { action: "deleteVorlage", id: eintrag.id });
    if (r.ok) onGespeichert(r.data.vorlagen); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt.");
  }
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Vorlagen</button></div>
      <div style={styles.modalTitle}>{neu ? "Neue Vorlage" : std ? "Vorschlag anpassen" : "Vorlage bearbeiten"}</div>
      {std && <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 6px" }}>Mitgelieferter Vorschlag{eintrag.angepasst ? ` (ursprünglich „${eintrag.basis}“)` : ""}. Deine Änderungen gelten nur für eure Feuerwehr.</div>}
      <div style={styles.formBody}>
        <label style={styles.label}>NAME</label>
        <input style={styles.input} aria-label="Name der Vorlage" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Hohlstrahlrohr C" />
        <label style={styles.label}>KURZNAME FÜRS ETIKETT (OPTIONAL)</label>
        <input style={styles.input} aria-label="Kurzname der Vorlage" value={f.kurzname} maxLength={40} onChange={(e) => set({ kurzname: e.target.value })} />
        {!std && <>
          <label style={styles.label}>GRUPPE IN DER VORSCHLAGSLISTE</label>
          <select style={styles.input} aria-label="Gruppe" value={f.gruppe} onChange={(e) => set({ gruppe: e.target.value })}>
            {[EIGENE_GRUPPE, ...VORLAGEN_GRUPPEN.map((g) => g.gruppe)].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </>}
        <label style={styles.label}>PRÜFARTEN UND FRISTEN</label>
        <PruefartenFeld pruefarten={f.pruefarten} onChange={(pruefarten) => set({ pruefarten })} />
        {std && <label style={{ ...styles.checkboxRow, marginTop: 12 }}><input type="checkbox" checked={f.sichtbar} onChange={(e) => set({ sichtbar: e.target.checked })} /> In der Vorschlagsliste anzeigen</label>}
        {fehler && <div style={styles.errorText}>{fehler}</div>}
        <div style={styles.formActions}>
          {eintrag && (eintrag.eigene || eintrag.angepasst) && <button style={styles.deleteBtn} onClick={() => setFrage(true)}><Trash2 size={14} /> {eintrag.eigene ? "Löschen" : "Zurücksetzen"}</button>}
          <button style={styles.saveBtn} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
        </div>
      </div>
      {frage && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center", zIndex: 90 }} onClick={() => setFrage(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{eintrag.eigene ? "Vorlage löschen?" : "Auf den Original-Vorschlag zurücksetzen?"}</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Schon angelegte Geräte bleiben unverändert.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(false)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={entfernen}>{eintrag.eigene ? "Löschen" : "Zurücksetzen"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VorlagenVerwalten({ daten, onBack, onVorlagen }) {
  const { callAuthed, flashError } = useApp();
  const [suche, setSuche] = useState(""); const [bearbeite, setBearbeite] = useState(null); // null | "neu" | eintrag
  const [resetFrage, setResetFrage] = useState(false); const [hinweis, setHinweis] = useState("");
  const alleGruppen = vorlagenGruppen(daten.vorlagen, { mitAusgeblendeten: true });
  const gruppen = alleGruppen.map((g) => ({ ...g, eintraege: g.eintraege.filter((e) => matchesSearch(`${e.name} ${e.kurzname} ${e.basis || ""}`, suche)) })).filter((g) => g.eintraege.length);
  const nAngepasst = (daten.vorlagen || []).filter((x) => x && x.basis).length;
  async function sichtbarUmschalten(e) {
    const r = await callAuthed("geraete", { action: "saveVorlage", vorlage: { basis: e.basis, name: e.name, kurzname: e.kurzname || "", pruefarten: normalePruefarten(vorlagePruefarten(e, PRUEFART)), ausgeblendet: !e.ausgeblendet } });
    if (r.ok) onVorlagen(r.data.vorlagen); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt.");
  }
  async function allesZuruecksetzen() {
    setResetFrage(false);
    const r = await callAuthed("geraete", { action: "resetVorlagen" });
    if (r.ok) { onVorlagen(r.data.vorlagen); setHinweis("Alle mitgelieferten Vorschläge sind wieder im Original."); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt.");
  }
  if (bearbeite) return <VorlageFormular eintrag={bearbeite === "neu" ? null : bearbeite} onBack={() => setBearbeite(null)} onGespeichert={(v) => { onVorlagen(v); setBearbeite(null); }} />;
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div>
      <div style={styles.modalTitle}>Vorlagen verwalten</div>
      <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 8px" }}>Das steht in der Vorschlagsliste beim Anlegen von Geräten. Antippen zum Ändern; mit dem Auge blendest du einen Vorschlag aus, den es bei euch nicht gibt.</div>
      <button style={{ ...knopfRot, width: "100%", flex: "none", marginBottom: 8 }} onClick={() => setBearbeite("neu")}><Plus size={16} /> Neue Vorlage</button>
      {hinweis && <div style={{ fontSize: 12.5, color: "#2E7D4F", margin: "4px 0" }}>{hinweis}</div>}
      <SearchBox value={suche} onChange={setSuche} placeholder="Vorlage suchen …" />
      {gruppen.length === 0 && <div style={{ fontSize: 12.5, color: "#A5A79F", marginTop: 8 }}>Nichts gefunden.</div>}
      {gruppen.map((g) => (
        <div key={g.gruppe}>
          <div style={abschnitt}>{g.gruppe.toUpperCase()} · {g.eintraege.length}</div>
          {g.eintraege.map((e) => (
            <div key={e.schluessel} style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 8, opacity: e.ausgeblendet ? 0.55 : 1 }}>
              <button style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: "#2C2F2A" }} onClick={() => setBearbeite(e)} aria-label={`Vorlage ${e.name} bearbeiten`}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{e.name}{e.kurzname && e.kurzname !== e.name ? <span style={{ fontWeight: 400, color: "#8A8C86" }}> · {e.kurzname}</span> : null}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86" }}>{kurzPruefarten(vorlagePruefarten(e, PRUEFART)) || "keine Prüfarten"}</span>
                {(e.eigene || e.angepasst || e.ausgeblendet) && <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: e.ausgeblendet ? "#8A8C86" : "#B8791A", marginTop: 2 }}>{e.eigene ? "EIGENE VORLAGE" : e.ausgeblendet ? "AUSGEBLENDET" : "ANGEPASST"}</span>}
              </button>
              {!e.eigene && <button style={styles.iconBtn} aria-label={e.ausgeblendet ? `${e.name} einblenden` : `${e.name} ausblenden`} onClick={() => sichtbarUmschalten(e)}>{e.ausgeblendet ? <EyeOff size={17} color="#8A8C86" /> : <Eye size={17} color="#2C2F2A" />}</button>}
              <ChevronRight size={16} color="#A5A79F" />
            </div>
          ))}
        </div>
      ))}
      {nAngepasst > 0 && <button style={{ ...styles.tinyBtn, marginTop: 14 }} onClick={() => setResetFrage(true)}>Alle mitgelieferten Vorschläge zurücksetzen ({nAngepasst})</button>}
      {resetFrage && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center", zIndex: 90 }} onClick={() => setResetFrage(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <BookOpen size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Alle Anpassungen verwerfen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Ausgeblendete Vorschläge erscheinen wieder, geänderte Namen und Fristen gehen zurück aufs Original. Eigene Vorlagen bleiben.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setResetFrage(false)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={allesZuruecksetzen}>Zurücksetzen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Gerät anlegen / bearbeiten ----------------
function GeraetFormular({ id, daten, vorgabeOrt, onBack, onSaved, onVorlagen }) {
  const { callAuthed, flashError } = useApp();
  const vorhanden = id ? daten.geraete.find((g) => g.id === id) : null;
  const [f, setF] = useState(() => vorhanden ? { ...vorhanden, pruefarten: (vorhanden.pruefarten || []).map((p) => ({ art: p.art, ...intervallNormal(p, PRUEFART[p.art] || { standard: 1, einheit: "monate" }) })) } : { name: "", kurzname: "", ort: vorgabeOrt || "", fach: "", menge: 1, inventar: "", seriennummer: "", hersteller: "", baujahr: "", notiz: "", pruefarten: [{ art: "sicht", intervall: PRUEFART.sicht.standard, einheit: PRUEFART.sicht.einheit }], ausgesondert: false });
  const [waehlerOffen, setWaehlerOffen] = useState(false); const [vorlageHinweis, setVorlageHinweis] = useState("");
  const [foto, setFoto] = useState(null); // neues Foto (nur wenn geändert)
  const [fotoGeaendert, setFotoGeaendert] = useState(false);
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState(""); const [loeschenFrage, setLoeschenFrage] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const ort = daten.orte.find((o) => o.id === f.ort);
  const vorlagenNamen = vorlagenGruppen(daten.vorlagen).flatMap((g) => g.eintraege);
  function vorlageAnwenden(vor) {
    set({ name: vor.name, kurzname: vor.kurzname || "", pruefarten: vorlagePruefarten(vor, PRUEFART).map((p) => ({ art: p.art, intervall: p.intervall, einheit: p.einheit })) });
    setWaehlerOffen(false);
  }
  function nameAendern(v) {
    const treffer = !vorhanden && vorlagenNamen.find((x) => x.name === v);
    if (treffer) vorlageAnwenden(treffer); else set({ name: v });
  }
  async function alsVorlage() {
    if (!f.name.trim()) { setFehler("Bitte zuerst einen Gerätenamen eingeben."); return; }
    const r = await callAuthed("geraete", { action: "saveVorlage", vorlage: { name: f.name.trim(), kurzname: f.kurzname, pruefarten: f.pruefarten } });
    if (r.ok) { onVorlagen(r.data.vorlagen); setVorlageHinweis("Vorlage gespeichert – sie steht jetzt in der Vorschlagsliste unter „Eigene Vorlagen“ (ändern unter „Vorlagen verwalten“)."); setFehler(""); }
    else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Vorlage konnte nicht gespeichert werden.");
  }

  async function speichern() {
    if (!f.name.trim()) { setFehler("Bitte einen Gerätenamen eingeben."); return; }
    setBusy(true); setFehler("");
    // Neues Fach gleich im Standort merken, damit es beim nächsten Gerät zur Auswahl steht.
    if (ort && f.fach.trim() && !(ort.faecher || []).includes(f.fach.trim())) {
      await callAuthed("geraete", { action: "saveOrt", id: ort.id, name: ort.name, faecher: [...(ort.faecher || []), f.fach.trim()] });
    }
    const geraet = { ...f, id: vorhanden ? vorhanden.id : undefined };
    if (fotoGeaendert) geraet.foto = foto ? foto.path : ""; else delete geraet.foto;
    const r = await callAuthed("geraete", { action: "saveGeraet", geraet });
    setBusy(false);
    if (r.ok) onSaved(r.data.id); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  async function loeschen() {
    setLoeschenFrage(false);
    const r = await callAuthed("geraete", { action: "deleteGeraet", id: vorhanden.id });
    if (r.ok) onSaved(null); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  const feld = (label, key, extra = {}) => (<><label style={styles.label}>{label}</label><input style={styles.input} aria-label={label} value={f[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} {...extra} /></>);
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Zurück</button></div>
      <div style={styles.modalTitle}>{vorhanden ? "Gerät bearbeiten" : "Neues Gerät"}</div>
      <div style={styles.formBody}>
        {!vorhanden && <button style={{ ...knopf, width: "100%", flex: "none", marginBottom: 6 }} onClick={() => setWaehlerOffen(true)}><ClipboardCheck size={16} /> Aus Vorschlagsliste wählen</button>}
        <label style={styles.label}>NAME</label>
        <input style={styles.input} aria-label="NAME" list="geraete-vorschlaege" value={f.name} maxLength={80} placeholder="z. B. Tragkraftspritze PFPN 10-1500" onChange={(e) => nameAendern(e.target.value)} />
        <datalist id="geraete-vorschlaege">{vorlagenNamen.map((x) => <option key={x.schluessel} value={x.name} />)}</datalist>
        {feld("KURZNAME FÜRS ETIKETT (OPTIONAL)", "kurzname", { placeholder: "z. B. TS 10/1500", maxLength: 40 })}
        <label style={styles.label}>STANDORT</label>
        <select style={styles.input} value={f.ort} onChange={(e) => set({ ort: e.target.value, fach: "" })}>
          <option value="">— kein Standort —</option>
          {daten.orte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label style={styles.label}>FACH / PLATZ</label>
        <input style={styles.input} list="geraete-faecher" value={f.fach} maxLength={40} placeholder="z. B. G3 oder Regal 2" onChange={(e) => set({ fach: e.target.value })} />
        <datalist id="geraete-faecher">{((ort && ort.faecher) || []).map((x) => <option key={x} value={x} />)}</datalist>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{feld("MENGE", "menge", { type: "number", min: 1, inputMode: "numeric" })}</div>
          <div style={{ flex: 1 }}>{feld("BAUJAHR", "baujahr", { inputMode: "numeric", maxLength: 4, placeholder: "z. B. 2019" })}</div>
        </div>
        {feld("SERIENNUMMER (OPTIONAL)", "seriennummer", { maxLength: 60 })}
        {feld(vorhanden ? "INVENTARNUMMER" : "INVENTARNUMMER (LEER LASSEN = APP VERGIBT DIE NÄCHSTE)", "inventar", { maxLength: 40, placeholder: "z. B. G-0001" })}
        {feld("HERSTELLER", "hersteller", { maxLength: 60 })}
        <label style={styles.label}>NOTIZ</label>
        <textarea style={{ ...styles.input, minHeight: 60, resize: "vertical" }} value={f.notiz} maxLength={500} onChange={(e) => set({ notiz: e.target.value })} />
        <label style={styles.label}>FOTO DES GERÄTS</label>
        <FotoFeld art="geraet" wert={foto} onChange={(x) => { setFoto(x); setFotoGeaendert(true); }} callAuthed={callAuthed} flashError={flashError} label={vorhanden && vorhanden.hatFoto && !fotoGeaendert ? "Foto ersetzen" : "Foto hinzufügen"} />
        {vorhanden && vorhanden.hatFoto && !fotoGeaendert && <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 4 }}>Es ist schon ein Foto hinterlegt (in der Einzelansicht sichtbar).</div>}
        {fotoGeaendert && !foto && <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 4 }}>Das Foto wird beim Speichern entfernt.</div>}

        <label style={styles.label}>PRÜFARTEN (WAS SOLL GEPRÜFT WERDEN?)</label>
        <PruefartenFeld pruefarten={f.pruefarten} onChange={(pruefarten) => set({ pruefarten })} />
        <div style={{ fontSize: 11, color: "#8A8C86" }}>Elektroprüfung, externe Prüfung und Verfallsdatum trägt nur der Gerätewart ein („gültig bis“). Die Zahl bei „Vorschlag“ füllt das Datum vor. Geprüft wird höchstens im Monats- oder Jahresabstand.</div>
        <button style={{ ...styles.tinyBtn, marginTop: 10 }} onClick={alsVorlage}>Als Vorlage merken</button>
        {vorlageHinweis && <div style={{ fontSize: 11.5, color: "#2E7D4F", marginTop: 4 }}>{vorlageHinweis}</div>}

        {vorhanden && <label style={{ ...styles.checkboxRow, marginTop: 14 }}><input type="checkbox" checked={!!f.ausgesondert} onChange={(e) => set({ ausgesondert: e.target.checked })} /> Gerät ist ausgesondert (wird nicht mehr geprüft)</label>}
        {fehler && <div style={styles.errorText}>{fehler}</div>}
        <div style={styles.formActions}>
          {vorhanden && <button style={styles.deleteBtn} onClick={() => setLoeschenFrage(true)}><Trash2 size={14} /> Löschen</button>}
          <button style={styles.saveBtn} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
        </div>
      </div>
      {waehlerOffen && <VorschlagsWaehler daten={daten} einzeln onWahl={(l) => vorlageAnwenden(l[0])} onClose={() => setWaehlerOffen(false)} />}
      {loeschenFrage && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center", zIndex: 90 }} onClick={() => setLoeschenFrage(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Gerät löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Prüfverlauf, Mängel und Fotos dieses Geräts werden ebenfalls gelöscht. Wenn es nur nicht mehr gebraucht wird, ist „ausgesondert“ besser.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschenFrage(false)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={loeschen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Mehrere Geräte auf einmal ----------------
function MehrereAnlegen({ daten, vorgabeOrt, onBack, onSaved, onVorlagen }) {
  const { callAuthed } = useApp();
  const [ort, setOrt] = useState(vorgabeOrt || (daten.orte[0] && daten.orte[0].id) || ""); const [fach, setFach] = useState("");
  const [text, setText] = useState(""); const [sicht, setSicht] = useState(true);
  const [waehlerOffen, setWaehlerOffen] = useState(false); const vorlagenRef = useRef({}); // Name -> Vorlage (für Kurzname und Prüfarten)
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const zeilen = text.split("\n").map((z) => z.trim()).filter(Boolean).map((z) => {
    const teile = z.split(/[;\t]/).map((x) => x.trim());
    const z1 = teile.length > 1 && /^\d{1,3}$/.test(teile[teile.length - 1]) ? { name: teile.slice(0, -1).join("; "), menge: parseInt(teile[teile.length - 1], 10) } : { name: teile.join("; "), menge: 1 };
    const vor = vorlagenRef.current[z1.name];
    return vor ? { ...z1, kurzname: vor.kurzname || "", pruefarten: vorlagePruefarten(vor, PRUEFART) } : z1;
  }).filter((z) => z.name);
  function uebernehmen(liste) {
    liste.forEach((e) => { vorlagenRef.current[e.name] = e; });
    setText((t) => `${t.trim() ? t.replace(/\s+$/, "") + "\n" : ""}${liste.map((e) => (e.menge > 1 ? `${e.name}; ${e.menge}` : e.name)).join("\n")}\n`);
    setWaehlerOffen(false);
  }
  async function speichern() {
    if (!zeilen.length) { setFehler("Bitte mindestens ein Gerät eintragen."); return; }
    setBusy(true); setFehler("");
    const o = daten.orte.find((x) => x.id === ort);
    if (o && fach.trim() && !(o.faecher || []).includes(fach.trim())) await callAuthed("geraete", { action: "saveOrt", id: o.id, name: o.name, faecher: [...(o.faecher || []), fach.trim()] });
    const r = await callAuthed("geraete", { action: "anlegenMehrere", ort, fach: fach.trim(), zeilen, pruefarten: sicht ? [{ art: "sicht", intervall: PRUEFART.sicht.standard, einheit: PRUEFART.sicht.einheit }] : [] });
    setBusy(false);
    if (r.ok) onSaved(); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Zurück</button></div>
      <div style={styles.modalTitle}>Mehrere Geräte anlegen</div>
      <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 6px" }}>Ein Gerät pro Zeile. Die Menge kannst du mit Semikolon anhängen, z. B. „Kübelspritze; 2“. Die Inventarnummer vergibt die App automatisch. Alles Weitere (Seriennummer, Foto, Prüfarten) ergänzt du danach bei jedem Gerät.</div>
      <div style={styles.formBody}>
        <label style={styles.label}>STANDORT</label>
        <select style={styles.input} value={ort} onChange={(e) => { setOrt(e.target.value); setFach(""); }}>
          <option value="">— kein Standort —</option>{daten.orte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label style={styles.label}>FACH / PLATZ (FÜR ALLE DIESE GERÄTE)</label>
        <input style={styles.input} value={fach} maxLength={40} placeholder="z. B. G3" onChange={(e) => setFach(e.target.value)} />
        <button style={{ ...knopf, width: "100%", flex: "none", marginTop: 10 }} onClick={() => setWaehlerOffen(true)}><ClipboardCheck size={16} /> Aus Vorschlagsliste wählen</button>
        <label style={styles.label}>GERÄTE</label>
        <textarea style={{ ...styles.input, minHeight: 160, resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Tragkraftspritze\nStromerzeuger\nKübelspritze; 2"} />
        <label style={{ ...styles.checkboxRow, marginTop: 8 }}><input type="checkbox" checked={sicht} onChange={(e) => setSicht(e.target.checked)} /> Sichtprüfung (alle 6 Monate) für Geräte festlegen, die keine eigene Vorlage haben</label>
        <div style={{ fontSize: 12, color: "#5C5F58", marginTop: 8 }}>{zeilen.length ? `${zeilen.length} Gerät${zeilen.length === 1 ? "" : "e"} werden angelegt.` : ""}</div>
        {fehler && <div style={styles.errorText}>{fehler}</div>}
        <div style={styles.formActions}><button style={styles.saveBtn} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Geräte anlegen"}</button></div>
      </div>
      {waehlerOffen && <VorschlagsWaehler daten={daten} onWahl={uebernehmen} onClose={() => setWaehlerOffen(false)} />}
    </div>
  );
}

// ---------------- Standorte verwalten ----------------
function OrteVerwalten({ daten, onBack, onChanged }) {
  const { callAuthed, flashError, vehicles } = useApp();
  const [edit, setEdit] = useState(null); // { id?, name, faecher (Text) }
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  async function speichern() {
    setBusy(true); setFehler("");
    const faecher = edit.faecher.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean);
    const r = await callAuthed("geraete", { action: "saveOrt", id: edit.id, name: edit.name, faecher });
    setBusy(false);
    if (r.ok) { setEdit(null); onChanged(); } else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  async function loeschen(o) {
    const r = await callAuthed("geraete", { action: "deleteOrt", id: o.id });
    if (r.ok) onChanged(); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  async function fahrzeugeUebernehmen() {
    setBusy(true);
    for (const v of vehicles || []) if (v.name && !daten.orte.some((o) => o.name.toLowerCase() === v.name.toLowerCase())) await callAuthed("geraete", { action: "saveOrt", name: v.name, faecher: [] });
    setBusy(false); onChanged();
  }
  const neueFahrzeuge = (vehicles || []).filter((v) => v.name && !daten.orte.some((o) => o.name.toLowerCase() === v.name.toLowerCase()));
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div>
      <div style={styles.modalTitle}>Standorte & Fächer</div>
      <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 10px" }}>Ein Standort ist ein Fahrzeug oder ein Raum (z. B. „Geräteraum“). Fächer sind die Plätze darin (G1, G2, Regal 1 …).</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button style={{ ...knopf, flex: "0 0 auto" }} onClick={() => setEdit({ name: "", faecher: "" })}><Plus size={14} /> Standort anlegen</button>
        {!daten.orte.some((o) => o.name.toLowerCase() === "geräteraum") && <button style={{ ...knopf, flex: "0 0 auto" }} onClick={() => setEdit({ name: "Geräteraum", faecher: "" })}>Geräteraum anlegen</button>}
        {neueFahrzeuge.length > 0 && <button style={{ ...knopf, flex: "0 0 auto" }} disabled={busy} onClick={fahrzeugeUebernehmen}><Wrench size={14} /> Fahrzeuge übernehmen ({neueFahrzeuge.length})</button>}
      </div>
      {edit && (
        <div style={{ ...styles.capacityBox, marginBottom: 10 }}>
          <label style={{ ...styles.label, marginTop: 0 }}>NAME</label>
          <input style={styles.input} value={edit.name} maxLength={40} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <label style={styles.label}>FÄCHER (EINES PRO ZEILE ODER MIT KOMMA)</label>
          <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} value={edit.faecher} onChange={(e) => setEdit({ ...edit, faecher: e.target.value })} placeholder={"G1\nG2\nG3"} />
          {fehler && <div style={styles.errorText}>{fehler}</div>}
          <div style={styles.formActions}><button style={styles.deleteBtn} onClick={() => { setEdit(null); setFehler(""); }}>Abbrechen</button><button style={styles.saveBtn} disabled={busy} onClick={speichern}>Speichern</button></div>
        </div>
      )}
      {daten.orte.length === 0 && !edit && <div style={{ fontSize: 12.5, color: "#A5A79F" }}>Noch keine Standorte angelegt.</div>}
      {daten.orte.map((o) => {
        const n = daten.geraete.filter((g) => g.ort === o.id).length;
        return (
          <div key={o.id} style={{ ...styles.capacityBox, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{o.name} <span style={{ fontSize: 11, color: "#8A8C86", fontWeight: 500 }}>· {n} Gerät{n === 1 ? "" : "e"}</span></div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={styles.tinyBtn} onClick={() => setEdit({ id: o.id, name: o.name, faecher: (o.faecher || []).join("\n") })}>Bearbeiten</button>
                <button style={styles.rosterRemoveBtn} aria-label={`${o.name} löschen`} onClick={() => loeschen(o)}><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#8A8C86", marginTop: 3 }}>{(o.faecher || []).length ? (o.faecher || []).join(" · ") : "Keine Fächer angelegt"}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Etiketten drucken ----------------
function EtikettenAnsicht({ daten, ids, onBack }) {
  const { flashError } = useApp();
  const [gewaehlt, setGewaehlt] = useState(() => new Set(ids)); const [suche, setSuche] = useState("");
  const [zwei, setZwei] = useState(true); const [wappen, setWappen] = useState(true); const [start, setStart] = useState(1);
  const liste = daten.geraete.filter((g) => !g.ausgesondert).sort((a, b) => ((daten.orte.find((o) => o.id === a.ort) || {}).name || "~").localeCompare((daten.orte.find((o) => o.id === b.ort) || {}).name || "~", "de") || sortiere(a, b));
  const sichtbar = liste.filter((g) => matchesSearch(`${g.name} ${g.kurzname} ${g.seriennummer} ${g.inventar}`, suche));
  const toggle = (id) => setGewaehlt((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  function drucken() {
    const items = liste.filter((g) => gewaehlt.has(g.id)).map((g) => ({ id: g.id, name: g.name, kurzname: g.kurzname, seriennummer: g.seriennummer, inventar: g.inventar, fach: g.fach, ortName: (daten.orte.find((o) => o.id === g.ort) || {}).name || "" }));
    if (!items.length) { flashError("Bitte mindestens ein Gerät auswählen."); return; }
    const w = bereiteFensterVor();
    if (!oeffneBericht(etikettenModell(items, { zweiCodes: zwei, wappen, start }), w)) flashError("Das Druckfenster wurde vom Browser blockiert.");
  }
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Zurück</button></div>
      <div style={styles.modalTitle}>QR-Etiketten drucken</div>
      <div style={{ fontSize: 12, color: "#8A8C86", margin: "2px 0 8px" }}>A4-Bogen mit 2 × 8 Etiketten (105 × 37 mm). Zum Testen reicht normales Papier zum Ausschneiden.</div>
      <div style={{ ...styles.capacityBox, marginBottom: 8 }}>
        <label style={{ ...styles.checkboxRow, alignItems: "center" }}><input type="checkbox" checked={zwei} onChange={(e) => setZwei(e.target.checked)} /> QR-Code zweimal aufs Etikett (falls einer unleserlich wird)</label>
        <label style={{ ...styles.checkboxRow, alignItems: "center", marginTop: 6 }}><input type="checkbox" checked={wappen} onChange={(e) => setWappen(e.target.checked)} /> Löwen-Wappen und Feuerwehr-Name drucken</label>
        <label style={{ ...styles.label, marginTop: 10 }}>BEGINNEN BEI ETIKETT NR. (FÜR BEREITS BENUTZTE BÖGEN)</label>
        <select style={styles.input} value={start} onChange={(e) => setStart(Number(e.target.value))}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
      </div>
      <SearchBox value={suche} onChange={setSuche} placeholder="Gerät suchen …" />
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button style={styles.tinyBtn} onClick={() => setGewaehlt(new Set(sichtbar.map((g) => g.id)))}>Alle auswählen</button>
        <button style={styles.tinyBtn} onClick={() => setGewaehlt(new Set())}>Keine</button>
        <span style={{ fontSize: 11.5, color: "#8A8C86", alignSelf: "center" }}>{gewaehlt.size} ausgewählt</span>
      </div>
      {sichtbar.map((g) => (
        <label key={g.id} style={{ ...styles.kontrollRow, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={gewaehlt.has(g.id)} onChange={() => toggle(g.id)} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{g.name}<span style={{ display: "block", fontSize: 11, color: "#8A8C86" }}>{[(daten.orte.find((o) => o.id === g.ort) || {}).name, g.fach].filter(Boolean).join(" · ")}</span></span>
        </label>
      ))}
      <div style={{ position: "sticky", bottom: 0, background: "#F3F1EC", padding: "10px 0 4px" }}>
        <button style={{ ...styles.saveBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={drucken}><Printer size={16} /> Vorschau / Drucken</button>
      </div>
    </div>
  );
}

// ---------------- Rundgang durch einen Standort ----------------
function Rundgang({ daten, ortId, onBack, onChanged }) {
  const { callAuthed, flashError } = useApp();
  const liste = useMemo(() => daten.geraete.filter((g) => g.ort === ortId && !g.ausgesondert).sort(sortiere), []);
  const ort = daten.orte.find((o) => o.id === ortId);
  const [i, setI] = useState(0); const [haken, setHaken] = useState({}); const [busy, setBusy] = useState(false);
  const [mangel, setMangel] = useState(false); const [ergebnis, setErgebnis] = useState({ ok: 0, maengel: 0, uebersprungen: 0 });
  const g = liste[i];
  useEffect(() => {
    if (!g) return;
    const faellig = new Set(faelligeSchnellpruefungen(g).map((p) => p.art));
    setHaken(Object.fromEntries((g.pruefarten || []).filter((p) => PRUEFART[p.art] && PRUEFART[p.art].typ === "intervall").map((p) => [p.art, faellig.has(p.art)])));
  }, [i]);
  const weiter = (feld) => { setErgebnis((e) => ({ ...e, [feld]: e[feld] + 1 })); setI((x) => x + 1); onChanged(true); };
  async function inOrdnung() {
    const arten = Object.entries(haken).filter(([, v]) => v).map(([k]) => k);
    if (!arten.length) { weiter("uebersprungen"); return; }
    setBusy(true);
    const r = await callAuthed("geraete", { action: "pruefen", geraet: g.id, ergebnisse: arten.map((art) => ({ art, ergebnis: "ok" })) });
    setBusy(false);
    if (r.ok) weiter("ok"); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich.");
  }
  if (!liste.length) return (
    <div style={styles.fullscreenPage}><div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div><div style={{ fontSize: 13, color: "#8A8C86" }}>In diesem Standort sind noch keine Geräte angelegt.</div></div>
  );
  if (!g) return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Geräte</button></div>
      <div style={styles.modalTitle}>Rundgang fertig</div>
      <div style={{ ...styles.capacityBox, marginTop: 10, lineHeight: 1.7, fontSize: 13.5 }}>
        <div><b>{ergebnis.ok}</b> Gerät{ergebnis.ok === 1 ? "" : "e"} in Ordnung abgehakt</div>
        <div><b>{ergebnis.maengel}</b> Mangel-Meldung{ergebnis.maengel === 1 ? "" : "en"}</div>
        <div><b>{ergebnis.uebersprungen}</b> übersprungen / nichts fällig</div>
      </div>
      <div style={styles.formActions}><button style={styles.saveBtn} onClick={onBack}>Fertig</button></div>
    </div>
  );
  const arten = (g.pruefarten || []).filter((p) => PRUEFART[p.art] && PRUEFART[p.art].typ === "intervall");
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Rundgang beenden</button></div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em" }}>RUNDGANG {ort ? ort.name.toUpperCase() : ""} · {i + 1} VON {liste.length}</div>
      <div style={{ height: 5, background: "#E2DFD6", borderRadius: 3, margin: "6px 0 14px" }}><div style={{ height: 5, borderRadius: 3, background: "#C1272D", width: `${(i / liste.length) * 100}%` }} /></div>
      <div style={styles.capacityBox}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{g.name}</div>
          <Pille status={geraetStatus(g)} />
        </div>
        <div style={{ fontSize: 12, color: "#8A8C86", marginTop: 2 }}>{[g.fach, g.menge > 1 ? `${g.menge} Stück` : "", g.seriennummer ? `SN ${g.seriennummer}` : ""].filter(Boolean).join(" · ") || "Kein Fach angegeben"}</div>
        {g.offeneMaengel > 0 && <div style={{ fontSize: 12, color: "#C1272D", fontWeight: 600, marginTop: 6 }}>{g.offeneMaengel} offene{g.offeneMaengel === 1 ? "r" : ""} Mangel</div>}
        <div style={{ ...styles.label, marginTop: 14 }}>GEPRÜFT (HAKEN SETZEN)</div>
        {arten.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Für dieses Gerät ist keine Ja/Nein-Prüfung festgelegt.</div>}
        {arten.map((p) => {
          const s = artStatus(g, p.art);
          return (
            <label key={p.art} style={{ ...styles.checkboxRow, alignItems: "center", padding: "7px 0", fontSize: 14 }}>
              <input type="checkbox" style={{ width: 20, height: 20 }} checked={!!haken[p.art]} onChange={(e) => setHaken((h) => ({ ...h, [p.art]: e.target.checked }))} />
              <span style={{ flex: 1 }}>{PRUEFART[p.art].name}<span style={{ display: "block", fontSize: 11, color: "#8A8C86" }}>{PRUEFART[p.art].frage}</span></span>
              <Pille status={s.status} text={s.status === "nie" ? "noch nie" : s.status === "ok" ? "aktuell" : undefined} />
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={knopfRot} disabled={busy} onClick={inOrdnung}><Check size={16} /> {busy ? "Speichert …" : "In Ordnung"}</button>
        <button style={knopf} onClick={() => setMangel(true)}><AlertTriangle size={16} color="#C1272D" /> Mangel</button>
      </div>
      <button style={{ ...styles.tinyBtn, width: "100%", marginTop: 10, padding: "8px" }} onClick={() => weiter("uebersprungen")}>Überspringen</button>
      {mangel && <MangelDialog g={g} onClose={() => setMangel(false)} onDone={() => { setMangel(false); weiter("maengel"); }} callAuthed={callAuthed} flashError={flashError} />}
    </div>
  );
}

// ---------------- Hauptansicht ----------------
export default function GeraeteKachel() {
  const { me, callAuthed, flashError, closeKachelView, kachelReturnTo, geraeteStartId, setGeraeteStartId } = useApp();
  // Zuletzt geladene Liste sofort zeigen (auch nach einem Neustart der App), dann im Hintergrund auffrischen.
  const cacheKey = `geraete:${me}`;
  const [daten, setDatenRoh] = useState(() => hole(cacheKey)); const [fehler, setFehler] = useState("");
  const [frisch, setFrisch] = useState(false); // true, sobald die aktuelle Liste vom Server da ist
  const setDaten = (x) => setDatenRoh((alt) => { const neu = typeof x === "function" ? x(alt) : x; if (neu) merke(cacheKey, neu, { dauerhaft: true }); return neu; });
  const [view, setView] = useState({ name: "liste" }); const [hinweis, setHinweis] = useState("");
  const [tab, setTab] = useState("geraete"); const [suche, setSuche] = useState(""); const [scan, setScan] = useState(false);
  const ladeNr = useRef(0);

  async function laden(still) {
    const nr = ++ladeNr.current;
    const r = await callAuthed("geraete", { action: "list" });
    if (nr !== ladeNr.current) return;
    if (r.ok) { setDaten(r.data); setFehler(""); setFrisch(true); }
    else if (r.data.error === "abgebrochen") { if (!still) closeKachelView(); }
    else setFehler(r.data.error || "Geräte konnten nicht geladen werden.");
  }
  useEffect(() => { laden(); }, []);
  async function nummernVergeben() {
    const r = await callAuthed("geraete", { action: "nummernVergeben" });
    if (r.ok) { await laden(true); setHinweis(`${r.data.anzahl} Inventarnummer${r.data.anzahl === 1 ? "" : "n"} vergeben.`); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Nummern konnten nicht vergeben werden.");
  }
  const oeffneId = (id) => {
    if (daten && daten.geraete.some((g) => g.id === id)) { setView({ name: "geraet", id }); setScan(false); }
    else flashError("Dieses Gerät gibt es nicht (mehr) – ist der QR-Code veraltet?");
  };
  // Aufgerufen über einen QR-Link (?geraet=…): nach dem Laden direkt das Gerät zeigen.
  useEffect(() => {
    // erst mit der frischen Liste – ein gerade neu angelegtes Gerät fehlt sonst noch
    if (daten && geraeteStartId && (frisch || daten.geraete.some((g) => g.id === geraeteStartId))) { const id = geraeteStartId; setGeraeteStartId(null); oeffneId(id); }
  }, [daten, geraeteStartId, frisch]);

  const orte = (daten && daten.orte) || []; const geraete = (daten && daten.geraete) || []; const rechte = (daten && daten.rechte) || {};
  const status = useMemo(() => Object.fromEntries(geraete.map((g) => [g.id, geraetStatus(g)])), [daten]);

  if (view.name === "geraet") return <GeraetDetail id={view.id} rechte={rechte} orte={orte} onBack={() => { setView({ name: "liste" }); laden(true); }} onChanged={() => laden(true)} onBearbeiten={(id) => setView({ name: "form", id })} onEtikett={(id) => setView({ name: "etiketten", ids: [id], zurueck: { name: "geraet", id } })} />;
  if (view.name === "form") return <GeraetFormular id={view.id} vorgabeOrt={view.ort} daten={daten} onVorlagen={(v) => setDaten((d) => ({ ...d, vorlagen: v }))} onBack={() => setView(view.id ? { name: "geraet", id: view.id } : { name: "liste" })} onSaved={async (id) => { await laden(true); setView(id ? { name: "geraet", id } : { name: "liste" }); }} />;
  if (view.name === "mehrere") return <MehrereAnlegen daten={daten} vorgabeOrt={view.ort} onVorlagen={(v) => setDaten((d) => ({ ...d, vorlagen: v }))} onBack={() => setView({ name: "liste" })} onSaved={async () => { await laden(true); setView({ name: "liste" }); }} />;
  if (view.name === "vorlagen") return <VorlagenVerwalten daten={daten} onBack={() => setView({ name: "liste" })} onVorlagen={(v) => setDaten((d) => ({ ...d, vorlagen: v }))} />;
  if (view.name === "orte") return <OrteVerwalten daten={daten} onBack={() => setView({ name: "liste" })} onChanged={() => laden(true)} />;
  if (view.name === "etiketten") return <EtikettenAnsicht daten={daten} ids={view.ids} onBack={() => setView(view.zurueck || { name: "liste" })} />;
  if (view.name === "rundgang") return <Rundgang daten={daten} ortId={view.ort} onBack={() => { setView({ name: "liste" }); laden(true); }} onChanged={() => laden(true)} />;

  // Gruppen für die Geräteliste
  const treffer = geraete.filter((g) => matchesSearch(`${g.name} ${g.kurzname} ${g.seriennummer} ${g.inventar} ${g.hersteller} ${g.fach}`, suche));
  const gruppen = [...orte.map((o) => ({ id: o.id, name: o.name })), { id: "", name: "Ohne Standort" }].map((o) => ({ ...o, liste: treffer.filter((g) => (g.ort || "") === o.id).sort(sortiere), alle: geraete.filter((g) => (g.ort || "") === o.id).length })).filter((o) => o.liste.length || (!suche && o.id && o.alle === 0));
  const aktive = geraete.filter((g) => !g.ausgesondert);
  const nMaengel = ((daten && daten.maengel) || []).length;
  const nUeber = aktive.filter((g) => status[g.id] === "ueberfaellig").length;
  const nGesperrt = aktive.filter((g) => status[g.id] === "gesperrt").length;
  const nBald = aktive.filter((g) => status[g.id] === "bald").length;

  const tabKnopf = (k, t) => <button key={k} onClick={() => setTab(k)} style={{ ...styles.kontrollTab, ...(tab === k ? { background: "#2C2F2A", color: "white", border: "1.5px solid #2C2F2A" } : {}), flex: 1, justifyContent: "center" }}>{t}</button>;
  const geraeteZeile = (g, extra) => (
    <button key={g.id} style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10 }} onClick={() => setView({ name: "geraet", id: g.id })}>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{g.name}{g.menge > 1 ? ` (${g.menge}×)` : ""}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{extra || [g.fach, g.inventar, g.seriennummer ? `SN ${g.seriennummer}` : ""].filter(Boolean).join(" · ") || "—"}</span>
      </span>
      <Pille status={status[g.id]} />
    </button>
  );
  const grundOf = (g) => (g.pruefarten || []).map((p) => ({ p, s: artStatus(g, p.art) })).filter((x) => x.s.status !== "ok").map((x) => `${PRUEFART[x.p.art].name}${x.s.status === "nie" ? " (noch nie)" : x.s.status === "ueberfaellig" ? " (überfällig)" : ""}`).join(", ");

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Geräte</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {hinweis && <div style={{ fontSize: 12.5, color: "#2E7D4F", margin: "6px 0" }}>{hinweis}</div>}
      {!daten && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            <button style={knopfRot} onClick={() => setScan(true)}><ScanLine size={17} /> QR-Code scannen</button>
            {rechte.verwalter && <button style={knopf} onClick={() => setView({ name: "form" })}><Plus size={16} /> Gerät</button>}
          </div>
          {rechte.verwalter && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <button style={styles.tinyBtn} onClick={() => setView({ name: "orte" })}>Standorte & Fächer</button>
              <button style={styles.tinyBtn} onClick={() => setView({ name: "mehrere" })}>Mehrere Geräte anlegen</button>
              <button style={styles.tinyBtn} onClick={() => setView({ name: "vorlagen" })}>Vorlagen verwalten</button>
              <button style={styles.tinyBtn} onClick={() => setView({ name: "etiketten", ids: [] })}>QR-Etiketten drucken</button>
              {geraete.some((g) => !g.inventar) && <button style={styles.tinyBtn} onClick={nummernVergeben}>Fehlende Nummern vergeben ({geraete.filter((g) => !g.inventar).length})</button>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{tabKnopf("geraete", "Geräte")}{tabKnopf("uebersicht", `Übersicht${nMaengel + nUeber + nGesperrt ? ` (${nMaengel + nUeber})` : ""}`)}</div>

          {tab === "geraete" && (
            <>
              <SearchBox value={suche} onChange={setSuche} placeholder="Gerät, Seriennummer, Fach suchen …" />
              {geraete.length === 0 && orte.length === 0 && (
                <div style={{ ...styles.capacityBox, fontSize: 13, lineHeight: 1.5 }}>
                  {rechte.verwalter ? <>Noch nichts angelegt. Lege zuerst die <b>Standorte</b> an (Fahrzeuge, Geräteraum) und danach die Geräte – einzeln oder mehrere auf einmal.
                    <div style={{ marginTop: 10 }}><button style={knopfRot} onClick={() => setView({ name: "orte" })}>Standorte anlegen</button></div></>
                    : "Es sind noch keine Geräte angelegt. Das erledigt der Gerätewart."}
                </div>
              )}
              {gruppen.map((o) => (
                <div key={o.id || "ohne"}>
                  <div style={{ ...abschnitt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{o.name.toUpperCase()} · {o.liste.length}</span>
                    {o.id && <span style={{ display: "flex", gap: 6 }}>
                      {rechte.verwalter && <button style={styles.smallAddBtn} onClick={() => setView({ name: "form", ort: o.id })}><Plus size={12} /> Gerät</button>}
                      {o.alle > 0 && <button style={styles.smallAddBtn} onClick={() => setView({ name: "rundgang", ort: o.id })}><ClipboardCheck size={12} /> Rundgang</button>}
                      {rechte.verwalter && o.alle > 0 && <button style={styles.smallAddBtn} onClick={() => setView({ name: "etiketten", ids: geraete.filter((g) => g.ort === o.id).map((g) => g.id) })}><QrCode size={12} /> Etiketten</button>}
                    </span>}
                  </div>
                  {o.liste.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Noch keine Geräte.</div>}
                  {o.liste.map((g) => geraeteZeile(g))}
                </div>
              ))}
              {suche && treffer.length === 0 && <div style={{ fontSize: 12.5, color: "#A5A79F" }}>Kein Gerät gefunden.</div>}
            </>
          )}

          {tab === "uebersicht" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, margin: "4px 0 8px" }}>
                {[["Mängel", nMaengel, "#C1272D"], ["Gesperrt", nGesperrt, "#8E1B20"], ["Fällig", nUeber, "#C1272D"], ["Bald", nBald, "#B8791A"]].map(([t, n, c]) => (
                  <div key={t} style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: n ? c : "#A5A79F" }}>{n}</div><div style={{ fontSize: 10, color: "#8A8C86" }}>{t}</div></div>
                ))}
              </div>
              <div style={abschnitt}>OFFENE MÄNGEL</div>
              {daten.maengel.length === 0 && <div style={{ fontSize: 12, color: "#2E7D4F" }}>Keine offenen Mängel.</div>}
              {daten.maengel.map((m) => {
                const g = geraete.find((x) => x.id === m.geraet); if (!g) return null;
                return (
                  <button key={m.id} style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10, borderLeft: `4px solid ${m.nichtEinsatzbereit ? "#8E1B20" : "#C1272D"}` }} onClick={() => setView({ name: "geraet", id: g.id })}>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{geraeteName(g)}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "#5C5F58", fontWeight: 400 }}>{m.text}</span>
                      <span style={{ display: "block", fontSize: 10.5, color: "#8A8C86", fontWeight: 400 }}>{m.von} · {zeitDe(m.ts)}{m.notizen ? ` · ${m.notizen} Notiz${m.notizen === 1 ? "" : "en"}` : ""}</span>
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8C86", whiteSpace: "nowrap" }}>{MANGEL_STATUS[m.status]}</span>
                  </button>
                );
              })}
              <div style={abschnitt}>PRÜFUNG ÜBERFÄLLIG</div>
              {aktive.filter((g) => status[g.id] === "ueberfaellig").length === 0 && <div style={{ fontSize: 12, color: "#2E7D4F" }}>Nichts überfällig.</div>}
              {aktive.filter((g) => status[g.id] === "ueberfaellig").sort(sortiere).map((g) => geraeteZeile(g, grundOf(g)))}
              <div style={abschnitt}>BALD FÄLLIG</div>
              {aktive.filter((g) => status[g.id] === "bald").length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Nichts in den nächsten Tagen.</div>}
              {aktive.filter((g) => status[g.id] === "bald").sort(sortiere).map((g) => geraeteZeile(g, grundOf(g)))}
            </>
          )}
        </>
      )}
      {scan && <QrScanner onClose={() => setScan(false)} pruefe={(t) => !!idAusQr(t)} onResult={(t) => { setScan(false); oeffneId(idAusQr(t)); }} />}
    </div>
  );
}
