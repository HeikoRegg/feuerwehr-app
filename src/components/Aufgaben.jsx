// Aufgaben (seit 2.36) – gemeinsame Bausteine für die Kacheln „To-do“ und „Projekte“.
// Eine Aufgabe in einem Projekt ist dieselbe wie im To-do der zuständigen Person (Tabelle "aufgaben").
import React, { useState } from "react";
import { Circle, CircleCheckBig, FolderKanban, Trash2, X } from "lucide-react";
import { useApp } from "../AppContext";
import { styles } from "../lib/styles";
import { Avatar } from "./Profilfoto";

export const klein = { fontSize: 11.5, color: "#8A8C86" };
export const heuteIso = () => new Date().toLocaleDateString("sv-SE");
export const datumDe = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tageBis = (iso) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(heuteIso() + "T12:00:00")) / 86400000);

// Fälligkeit als kurzer Text mit Farbe: überfällig rot, heute/morgen orange, sonst grau.
export function faelligInfo(iso, erledigt) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const t = tageBis(iso);
  if (erledigt) return { text: `bis ${datumDe(iso)}`, farbe: "#A5A79F", hinter: "transparent" };
  if (t < 0) return { text: `überfällig seit ${datumDe(iso).slice(0, 6)}`, farbe: "#C1272D", hinter: "#FBEAEA" };
  if (t === 0) return { text: "heute fällig", farbe: "#9A5B00", hinter: "#FBF1E1" };
  if (t === 1) return { text: "morgen fällig", farbe: "#9A5B00", hinter: "#FBF1E1" };
  return { text: `bis ${datumDe(iso)}`, farbe: "#5C5F58", hinter: "#F3F1EC" };
}
// Sortierung: offene vor erledigten, dann nach Fälligkeit (ohne Datum zuletzt), dann nach Anlage.
export function sortiereAufgaben(liste) {
  return [...liste].sort((a, b) => (a.erledigt === b.erledigt ? 0 : a.erledigt ? 1 : -1)
    || (a.erledigt ? String(b.erledigtAm || "").localeCompare(String(a.erledigtAm || "")) : 0)
    || ((a.faellig || "9999") < (b.faellig || "9999") ? -1 : (a.faellig || "9999") > (b.faellig || "9999") ? 1 : 0)
    || String(a.erstelltAm || "").localeCompare(String(b.erstelltAm || "")));
}

// Eine Zeile: Haken, Text, Zuständiger, Fälligkeit, Projekt.
export function AufgabeZeile({ a, ich, onToggle, onEdit, zeigeProjekt = false, onProjekt, busy }) {
  const f = faelligInfo(a.faellig, a.erledigt);
  const darfHaken = a.zustaendig === ich || a.darfAendern !== false;
  return (
    <div data-testid={`aufgabe-${a.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0", borderBottom: "1px solid #F0EEE8" }}>
      <button type="button" data-knopf="fest" aria-label={a.erledigt ? `${a.text} wieder öffnen` : `${a.text} erledigt`} data-testid={`haken-${a.id}`} disabled={busy || !darfHaken}
        onClick={() => onToggle && onToggle(a)} style={{ background: "transparent", border: "none", padding: 2, marginTop: 1, cursor: darfHaken ? "pointer" : "default", flexShrink: 0, opacity: darfHaken ? 1 : 0.4 }}>
        {a.erledigt ? <CircleCheckBig size={22} color="#2E7D4F" /> : <Circle size={22} color="#8A8C86" />}
      </button>
      <div style={{ flex: 1, minWidth: 0, cursor: onEdit && a.darfAendern ? "pointer" : "default" }} onClick={() => onEdit && a.darfAendern && onEdit(a)}>
        <div style={{ fontSize: 14, lineHeight: 1.35, color: a.erledigt ? "#A5A79F" : "#2C2F2A", textDecoration: a.erledigt ? "line-through" : "none", overflowWrap: "anywhere" }}>{a.text}</div>
        {a.notiz && !a.erledigt && <div style={{ ...klein, marginTop: 2, whiteSpace: "pre-wrap" }}>{a.notiz}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#5C5F58" }}>
            <Avatar name={a.zustaendig} size={18} rand={false} />{a.zustaendig === ich ? "du" : a.zustaendig}
          </span>
          {f && <span style={{ fontSize: 11, fontWeight: 600, color: f.farbe, background: f.hinter, borderRadius: 4, padding: "1px 6px" }}>{f.text}</span>}
          {a.erstelltVon && a.erstelltVon !== a.zustaendig && <span style={klein}>· von {a.erstelltVon === ich ? "dir" : a.erstelltVon}</span>}
          {zeigeProjekt && a.projektName && (
            <button type="button" data-knopf="fest" onClick={(e) => { e.stopPropagation(); if (onProjekt && a.projektSichtbar) onProjekt(a.projekt); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#4A6670", background: "#E8EEF0", border: "none", borderRadius: 4, padding: "1px 6px", cursor: a.projektSichtbar ? "pointer" : "default" }}>
              <FolderKanban size={11} color="#4A6670" /> {a.projektName}
            </button>
          )}
          {a.erledigt && a.erledigtVon && <span style={klein}>· erledigt von {a.erledigtVon === ich ? "dir" : a.erledigtVon}</span>}
        </div>
      </div>
    </div>
  );
}

// Fenster zum Anlegen/Ändern einer Aufgabe. `start`: { id?, projekt?, text, notiz, zustaendig, faellig }
export function AufgabeFormular({ start, darfZuweisen, projektName, onClose, onSaved }) {
  const { me, roster, callAuthed } = useApp();
  const [f, setF] = useState(() => ({ text: "", notiz: "", faellig: "", ...start, zustaendig: start.zustaendig || me }));
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const [frage, setFrage] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const namen = (roster || []).map((r) => r.name).sort((a, b) => a.localeCompare(b, "de"));
  async function speichern() {
    setFehlerText("");
    if (!f.text.trim()) { setFehlerText("Bitte beschreiben, was zu tun ist."); return; }
    setBusy(true);
    const r = await callAuthed("projekte", { action: "aufgabeSave", aufgabe: { id: f.id, projekt: f.projekt || null, text: f.text, notiz: f.notiz, zustaendig: f.zustaendig, faellig: f.faellig } });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Speichern nicht möglich."); return; }
    onSaved();
  }
  async function loeschen() {
    setBusy(true);
    const r = await callAuthed("projekte", { action: "aufgabeDelete", id: f.id });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Löschen nicht möglich."); return; }
    onSaved();
  }
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 110 }} onClick={onClose} data-testid="aufgabe-formular">
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{f.id ? "Aufgabe ändern" : "Neue Aufgabe"}</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        {projektName && <div style={{ ...klein, marginTop: -6, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><FolderKanban size={12} color="#8A8C86" /> Projekt: {projektName}</div>}
        <div style={styles.formBody}>
          <label style={styles.label}>Was ist zu tun?</label>
          <input style={styles.input} data-testid="aufgabe-text" maxLength={300} placeholder="z. B. Angebot für neue Schläuche einholen" value={f.text} onChange={(e) => set("text", e.target.value)} />
          <label style={styles.label}>Zuständig</label>
          {darfZuweisen ? (
            <select style={styles.input} data-testid="aufgabe-zustaendig" value={f.zustaendig} onChange={(e) => set("zustaendig", e.target.value)}>
              {namen.map((n) => <option key={n} value={n}>{n === me ? `${n} (ich)` : n}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 13, color: "#5C5F58" }}>{f.zustaendig === me ? "Du selbst" : f.zustaendig}<div style={{ ...klein, marginTop: 2 }}>Aufgaben an andere vergeben dürfen Kommandant, stellv. Kommandant, Ausschuss, Gerätewart und Admins.</div></div>
          )}
          <label style={styles.label}>Fällig bis (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...styles.input, flex: 1 }} type="date" data-testid="aufgabe-faellig" value={f.faellig} onChange={(e) => set("faellig", e.target.value)} />
            {f.faellig && <button style={styles.tinyBtn} onClick={() => set("faellig", "")}>kein Datum</button>}
          </div>
          {f.faellig && <div style={klein}>Erinnerung kommt am Vortag ab 18 Uhr.</div>}
          <label style={styles.label}>Notiz (optional)</label>
          <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} maxLength={1000} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} />
          {fehlerText && <div style={styles.errorText}>{fehlerText}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {f.id && !frage && <button style={{ ...styles.deleteBtn, justifyContent: "center" }} disabled={busy} onClick={() => setFrage(true)} aria-label="Aufgabe löschen"><Trash2 size={15} /></button>}
            <button style={styles.saveBtn} disabled={busy} data-testid="aufgabe-speichern" onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
          </div>
          {frage && (
            <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px", marginTop: 10 }}>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>Aufgabe wirklich löschen?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(false)}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, flex: 1 }} disabled={busy} data-testid="aufgabe-loeschen-ja" onClick={loeschen}>Löschen</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
