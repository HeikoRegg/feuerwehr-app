// Aufgaben (seit 2.36) – gemeinsame Bausteine für die Kacheln „To-do“ und „Projekte“.
// Eine Aufgabe in einem Projekt ist dieselbe wie im To-do der zuständigen Person (Tabelle "aufgaben").
import React, { useState } from "react";
import { Bell, Circle, CircleCheckBig, FolderKanban, MessageSquare, Pencil, Trash2, X } from "lucide-react";
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
// Erinnerung: { art: "keine" | "tage" | "datum", tage, datum }. Aufgaben ohne Feld: 1 Tag vor Fälligkeit.
// Seit 2.38 frei einstellbar: Zahl „Tage vorher“ (0 = am Fälligkeitstag, nur mit Fälligkeit) ODER ein Datum – leer = keine.
const istIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const tagMinus = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
export function erinnerungsTag(a) {
  const e = a.erinnerung;
  if (!e) return istIso(a.faellig) ? tagMinus(a.faellig, 1) : "";
  if (e.art === "datum") return istIso(e.datum) ? e.datum : "";
  if (e.art === "tage" && istIso(a.faellig)) return tagMinus(a.faellig, Number(e.tage) || 0);
  return "";
}
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const tagKurz = (iso) => (istIso(iso) ? `${WOCHENTAG[new Date(iso + "T12:00:00").getDay()]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : "");

// Sortierung: offene vor erledigten, dann nach Fälligkeit (ohne Datum zuletzt), dann nach Anlage.
export function sortiereAufgaben(liste) {
  return [...liste].sort((a, b) => (a.erledigt === b.erledigt ? 0 : a.erledigt ? 1 : -1)
    || (a.erledigt ? String(b.erledigtAm || "").localeCompare(String(a.erledigtAm || "")) : 0)
    || ((a.faellig || "9999") < (b.faellig || "9999") ? -1 : (a.faellig || "9999") > (b.faellig || "9999") ? 1 : 0)
    || String(a.erstelltAm || "").localeCompare(String(b.erstelltAm || "")));
}

// Eine Zeile: Haken, Text, Zuständiger, Fälligkeit, Projekt.
export function AufgabeZeile({ a, ich, onToggle, onOpen, zeigeProjekt = false, onProjekt, busy }) {
  const f = faelligInfo(a.faellig, a.erledigt);
  const darfHaken = a.zustaendig === ich || a.darfAendern !== false;
  const darfOeffnen = !!onOpen && (a.zustaendig === ich || a.erstelltVon === ich || !!a.darfAendern);
  return (
    <div data-testid={`aufgabe-${a.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0", borderBottom: "1px solid #F0EEE8" }}>
      <button type="button" data-knopf="fest" aria-label={a.erledigt ? `${a.text} wieder öffnen` : `${a.text} erledigt`} data-testid={`haken-${a.id}`} disabled={busy || !darfHaken}
        onClick={() => onToggle && onToggle(a)} style={{ background: "transparent", border: "none", padding: 2, marginTop: 1, cursor: darfHaken ? "pointer" : "default", flexShrink: 0, opacity: darfHaken ? 1 : 0.4 }}>
        {a.erledigt ? <CircleCheckBig size={22} color="#2E7D4F" /> : <Circle size={22} color="#8A8C86" />}
      </button>
      <div data-testid={`aufgabe-oeffnen-${a.id}`} style={{ flex: 1, minWidth: 0, cursor: darfOeffnen ? "pointer" : "default" }} onClick={() => darfOeffnen && onOpen(a)}>
        <div style={{ fontSize: 14, lineHeight: 1.35, color: a.erledigt ? "#A5A79F" : "#2C2F2A", textDecoration: a.erledigt ? "line-through" : "none", overflowWrap: "anywhere" }}>{a.text}</div>
        {a.notiz && !a.erledigt && <div style={{ ...klein, marginTop: 2, whiteSpace: "pre-wrap" }}>{a.notiz}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#5C5F58" }}>
            <Avatar name={a.zustaendig} size={18} rand={false} />{a.zustaendig === ich ? "du" : a.zustaendig}
          </span>
          {f && <span style={{ fontSize: 11, fontWeight: 600, color: f.farbe, background: f.hinter, borderRadius: 4, padding: "1px 6px" }}>{f.text}</span>}
          {!a.erledigt && erinnerungsTag(a) && erinnerungsTag(a) >= heuteIso() && <span data-testid={`erinnerung-${a.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, ...klein }}><Bell size={11} color="#8A8C86" /> {tagKurz(erinnerungsTag(a))}</span>}
          {a.erstelltVon && a.erstelltVon !== a.zustaendig && <span style={klein}>· von {a.erstelltVon === ich ? "dir" : a.erstelltVon}</span>}
          {!a.erledigt && a.status === "bearbeitung" && <span data-testid={`status-${a.id}`} style={{ fontSize: 11, fontWeight: 600, color: "#2F5F8A", background: "#E6EEF6", borderRadius: 4, padding: "1px 6px" }}>in Bearbeitung</span>}
          {!a.erledigt && a.zNotiz && <span data-testid={`znotiz-${a.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, ...klein }}><MessageSquare size={11} color="#8A8C86" /> Notiz</span>}
          {zeigeProjekt && a.projektName && (
            <button type="button" data-knopf="fest" onClick={(e) => { e.stopPropagation(); if (onProjekt && a.projektSichtbar) onProjekt(a.projekt); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#4A6670", background: "#E8EEF0", border: "none", borderRadius: 4, padding: "1px 6px", cursor: a.projektSichtbar ? "pointer" : "default" }}>
              <FolderKanban size={11} color="#4A6670" /> {a.projektName}
            </button>
          )}
          {a.erledigt && a.status === "verworfen" ? <span data-testid={`verworfen-${a.id}`} style={{ fontSize: 11, fontWeight: 600, color: "#8A4B2A", background: "#FBF3EE", borderRadius: 4, padding: "1px 6px" }}>verworfen{a.verworfenVon ? ` von ${a.verworfenVon === ich ? "dir" : a.verworfenVon}` : ""}</span>
            : a.erledigt && a.erledigtVon && <span style={klein}>· erledigt von {a.erledigtVon === ich ? "dir" : a.erledigtVon}</span>}
        </div>
      </div>
    </div>
  );
}

// Erinnerung einstellen: entweder „Tage vorher“ (Zahl, 0 = am Fälligkeitstag) oder ein Datum. Leer = keine Erinnerung. Immer um 18 Uhr.
// `wert` = { art, tage, datum }; `onChange` bekommt immer ein sauberes Objekt.
export function ErinnerungsFeld({ faellig, wert, onChange, testPrefix = "" }) {
  const [tage, setTage] = useState(() => (wert && wert.art === "tage" ? String(wert.tage) : ""));
  const [datum, setDatum] = useState(() => (wert && wert.art === "datum" ? wert.datum || "" : ""));
  const ohneFaellig = !faellig;
  const tageGueltig = tage !== "" && /^\d{1,3}$/.test(tage) && Number(tage) <= 365;
  function meldeTage(t) {
    setTage(t); setDatum("");
    onChange(t !== "" && /^\d{1,3}$/.test(t) && Number(t) <= 365 && faellig ? { art: "tage", tage: Number(t) } : { art: "keine" });
  }
  function meldeDatum(d) {
    setDatum(d); setTage("");
    onChange(d ? { art: "datum", datum: d } : { art: "keine" });
  }
  function leeren() { setTage(""); setDatum(""); onChange({ art: "keine" }); }
  const aktuell = tage !== "" && tageGueltig && faellig ? { art: "tage", tage: Number(tage) } : datum ? { art: "datum", datum } : { art: "keine" };
  const tag = erinnerungsTag({ faellig, erinnerung: aktuell });
  return (
    <div data-testid={`${testPrefix}erinnerung-feld`}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...styles.input, width: 92, opacity: ohneFaellig ? 0.5 : 1 }} type="number" inputMode="numeric" min={0} max={365} step={1} placeholder="Tage" disabled={ohneFaellig}
          data-testid={`${testPrefix}erinnerung-tage`} aria-label="Tage vorher" value={ohneFaellig ? "" : tage} onChange={(e) => meldeTage(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
        <span style={{ fontSize: 12.5, color: "#5C5F58" }}>Tage vorher</span>
        <span style={{ ...klein, margin: "0 2px" }}>oder</span>
        <input style={{ ...styles.input, flex: 1, minWidth: 140 }} type="date" data-testid={`${testPrefix}erinnerung-datum`} aria-label="Erinnerung am Datum" value={datum} onChange={(e) => meldeDatum(e.target.value)} />
        {(tage !== "" || datum) && <button type="button" style={styles.tinyBtn} data-testid={`${testPrefix}erinnerung-keine`} onClick={leeren}>keine</button>}
      </div>
      <div style={{ ...klein, marginTop: 4 }}>{ohneFaellig ? "„Tage vorher“ geht nur mit Fälligkeitsdatum – ein Datum geht immer. " : "0 = am Fälligkeitstag. "}Beides leer = keine Erinnerung.</div>
      {tage !== "" && !tageGueltig && <div style={{ ...klein, marginTop: 4, color: "#C1272D" }}>Bitte eine ganze Zahl von 0 bis 365 eingeben.</div>}
      {tag ? <div data-testid={`${testPrefix}erinnerung-hinweis`} style={{ ...klein, marginTop: 4, color: tag < heuteIso() ? "#C1272D" : "#8A8C86" }}>{tag < heuteIso() ? "Dieser Tag ist schon vorbei – es kommt keine Erinnerung mehr." : `Erinnerung am ${tagKurz(tag)}${tag.slice(0, 4)} um 18 Uhr.`}</div> : null}
    </div>
  );
}

const STATUS = [["offen", "Offen"], ["bearbeitung", "In Bearbeitung"], ["erledigt", "Abgeschlossen"], ["verworfen", "Verworfen"]];
const statusVon = (a) => (a.erledigt ? (a.status === "verworfen" ? "verworfen" : "erledigt") : a.status === "bearbeitung" ? "bearbeitung" : "offen");

// Ansicht einer Aufgabe: lesen, Status setzen, Notiz (nur der Zuständige) und Erinnerung (Zuständiger). Text, Beschreibung,
// Fälligkeit und Zuständigkeit ändert nur, wer die Aufgabe ändern darf (Knopf „Bearbeiten“).
export function AufgabeDetail({ a, ich, projektName, gesperrt = false, onClose, onChanged, onBearbeiten }) {
  const { callAuthed, flashError } = useApp();
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const [notiz, setNotiz] = useState(a.zNotiz || "");
  const [erinnerung, setErinnerung] = useState(() => a.erinnerung || (a.faellig ? { art: "tage", tage: 1 } : { art: "keine" }));
  const [gespeichert, setGespeichert] = useState("");
  const [grundOffen, setGrundOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [loeschFrage, setLoeschFrage] = useState(false);
  const istZustaendig = a.zustaendig === ich;
  // Seit 2.40: Zuständiger löscht abgeschlossene Aufgaben selbst; verworfene löscht nur der Ersteller (bzw. Verwalter).
  const darfLoeschen = !gesperrt && (!!a.darfAendern || (istZustaendig && !!a.erledigt && a.status !== "verworfen"));
  const darfStatus = !gesperrt && (istZustaendig || !!a.darfAendern);
  const darfErinnerung = darfStatus;
  async function aktion(body, ok) {
    setBusy(true); setFehlerText(""); setGespeichert("");
    const r = await callAuthed("projekte", body);
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Das hat nicht geklappt."); return false; }
    if (ok) setGespeichert(ok);
    if (onChanged) await onChanged();
    return true;
  }
  const status = statusVon(a);
  const erinnerungGeaendert = JSON.stringify(erinnerung) !== JSON.stringify(a.erinnerung || (a.faellig ? { art: "tage", tage: 1 } : { art: "keine" }));
  const zeile = { display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, fontSize: 13, alignItems: "center", padding: "3px 0" };
  const f = faelligInfo(a.faellig, a.erledigt);
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 110 }} onClick={onClose} data-testid="aufgabe-detail">
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Aufgabe</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={styles.formBody}>
          <div data-testid="detail-text" style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere" }}>{a.text}</div>
          {a.notiz && <div data-testid="detail-beschreibung" style={{ fontSize: 13, color: "#5C5F58", whiteSpace: "pre-wrap", marginTop: 6, overflowWrap: "anywhere" }}>{a.notiz}</div>}
          <div style={{ marginTop: 10 }}>
            <div style={zeile}><span style={klein}>Zuständig</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name={a.zustaendig} size={20} rand={false} />{istZustaendig ? "du" : a.zustaendig}</span></div>
            {a.erstelltVon && <div style={zeile}><span style={klein}>Vergeben von</span><span>{a.erstelltVon === ich ? "dir" : a.erstelltVon}</span></div>}
            <div style={zeile}><span style={klein}>Fällig bis</span><span>{f ? <span style={{ fontWeight: 600, color: f.farbe }}>{f.text}</span> : "kein Datum"}</span></div>
            {projektName && <div style={zeile}><span style={klein}>Projekt</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FolderKanban size={13} color="#4A6670" />{projektName}</span></div>}
          </div>

          <label style={styles.label}>Status</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} data-testid="status-auswahl">
            {STATUS.map(([k, l]) => (
              <button key={k} type="button" data-testid={`status-${k}`} disabled={busy || !darfStatus || status === k}
                onClick={() => { if (k === "verworfen") { setGrundOffen(true); setGrund(""); return; } setGrundOffen(false); aktion({ action: "aufgabeStatus", id: a.id, status: k }, k === "erledigt" ? "Als abgeschlossen gespeichert." : "Status gespeichert."); }}
                style={{ ...styles.categoryChip, fontSize: 12.5, padding: "7px 12px", opacity: !darfStatus && status !== k ? 0.5 : 1, background: status === k ? (k === "erledigt" ? "#2E7D4F" : k === "verworfen" ? "#8A4B2A" : "#2C2F2A") : "#F3F1EC", color: status === k ? "white" : "#5C5F58", borderColor: status === k ? "transparent" : "#E2DFD6" }}>{l}</button>
            ))}
          </div>
          {grundOffen && (
            <div data-testid="verwerfen-box" style={{ background: "#FBF3EE", border: "1px solid #E5C7B4", borderRadius: 8, padding: "9px 10px", marginTop: 8 }}>
              <div style={{ fontSize: 12.5, marginBottom: 6 }}>Warum wird die Aufgabe verworfen (nicht machbar / nicht mehr nötig)? {a.erstelltVon && a.erstelltVon !== ich ? `${a.erstelltVon} bekommt eine Nachricht mit der Begründung.` : ""}</div>
              <textarea style={{ ...styles.input, minHeight: 60, resize: "vertical" }} data-testid="verwerfen-grund" maxLength={1000} placeholder="Begründung (Pflicht)" value={grund} onChange={(e) => setGrund(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setGrundOffen(false)}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="verwerfen-ja" disabled={busy || !grund.trim()} onClick={async () => { if (await aktion({ action: "aufgabeStatus", id: a.id, status: "verworfen", grund }, "Als verworfen gespeichert.")) setGrundOffen(false); }}>Verwerfen</button>
              </div>
            </div>
          )}
          {a.erledigt && a.status === "verworfen" ? (
            <div data-testid="detail-verworfen" style={{ fontSize: 12.5, marginTop: 6, background: "#FBF3EE", borderRadius: 6, padding: "6px 9px", color: "#6B3A20", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              <b>Verworfen</b>{a.verworfenVon ? ` von ${a.verworfenVon === ich ? "dir" : a.verworfenVon}` : ""}: {a.verworfenGrund || "–"}
            </div>
          ) : a.erledigt && a.erledigtVon && <div style={{ ...klein, marginTop: 4 }}>Abgeschlossen von {a.erledigtVon === ich ? "dir" : a.erledigtVon}.</div>}

          <label style={styles.label}>{istZustaendig ? "Deine Notiz" : `Notiz von ${a.zustaendig}`}</label>
          {istZustaendig && !gesperrt ? (
            <>
              <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} data-testid="detail-notiz" maxLength={1000} placeholder="z. B. Angebot angefragt, Rückmeldung bis Freitag" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
              <button style={{ ...styles.tinyBtn, marginTop: 6 }} data-testid="detail-notiz-speichern" disabled={busy || notiz === (a.zNotiz || "")} onClick={() => aktion({ action: "aufgabeNotiz", id: a.id, text: notiz }, "Notiz gespeichert.")}>Notiz speichern</button>
            </>
          ) : (
            <div data-testid="detail-notiz-lesen" style={{ fontSize: 13, color: a.zNotiz ? "#2C2F2A" : "#8A8C86", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{a.zNotiz || "Noch keine Notiz."}</div>
          )}

          <label style={styles.label}>Erinnerung (um 18 Uhr)</label>
          {darfErinnerung ? (
            <>
              <ErinnerungsFeld faellig={a.faellig} wert={erinnerung} onChange={setErinnerung} testPrefix="detail-" />
              <button style={{ ...styles.tinyBtn, marginTop: 6 }} data-testid="detail-erinnerung-speichern" disabled={busy || !erinnerungGeaendert} onClick={() => aktion({ action: "aufgabeErinnerung", id: a.id, erinnerung }, "Erinnerung gespeichert.")}>Erinnerung speichern</button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#5C5F58" }}>{erinnerungsTag(a) ? `${tagKurz(erinnerungsTag(a))}${erinnerungsTag(a).slice(0, 4)} um 18 Uhr` : "keine"}</div>
          )}

          {gesperrt && <div style={{ ...klein, marginTop: 8 }}>Das Projekt ist archiviert – zum Ändern zuerst aus dem Archiv holen.</div>}
          {gespeichert && <div data-testid="detail-gespeichert" style={{ fontSize: 12.5, color: "#2E7D4F", marginTop: 8 }}>{gespeichert}</div>}
          {fehlerText && <div data-testid="detail-fehler" style={styles.errorText}>{fehlerText}</div>}
          {darfLoeschen && !loeschFrage && (
            <button style={{ ...styles.deleteBtn, width: "100%", justifyContent: "center", gap: 6, marginTop: 14 }} data-testid="detail-loeschen" onClick={() => setLoeschFrage(true)}><Trash2 size={14} /> Aufgabe löschen</button>
          )}
          {loeschFrage && (
            <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px", marginTop: 10 }}>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>Aufgabe „{a.text}“ wirklich löschen?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschFrage(false)}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, flex: 1 }} disabled={busy} data-testid="detail-loeschen-ja" onClick={async () => { if (await aktion({ action: "aufgabeDelete", id: a.id })) onClose(); }}>Löschen</button>
              </div>
            </div>
          )}
          {!a.erledigt && istZustaendig && !a.darfAendern && !gesperrt && <div style={{ ...klein, marginTop: 10 }}>Löschen kannst du die Aufgabe, sobald sie abgeschlossen ist.</div>}
          {a.darfAendern && !gesperrt && (
            <button style={{ ...styles.deleteBtn, width: "100%", justifyContent: "center", gap: 6, marginTop: 14 }} data-testid="detail-bearbeiten" onClick={() => onBearbeiten && onBearbeiten(a)}><Pencil size={14} /> Text, Beschreibung, Datum oder Zuständigen ändern</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Fenster zum Anlegen/Ändern einer Aufgabe. `start`: { id?, projekt?, text, notiz, zustaendig, faellig }
export function AufgabeFormular({ start, darfZuweisen, projektName, onClose, onSaved }) {
  const { me, roster, callAuthed } = useApp();
  const [f, setF] = useState(() => ({ text: "", notiz: "", faellig: "", ...start, zustaendig: start.zustaendig || me,
    // neue Aufgaben: 1 Tag vorher; alte Aufgaben ohne Feld: so wie bisher (1 Tag vorher, wenn fällig)
    erinnerung: start.erinnerung || (start.id && !start.faellig ? { art: "keine" } : { art: "tage", tage: 1 }) }));
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const [frage, setFrage] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const namen = (roster || []).map((r) => r.name).sort((a, b) => a.localeCompare(b, "de"));
  async function speichern() {
    setFehlerText("");
    if (!f.text.trim()) { setFehlerText("Bitte beschreiben, was zu tun ist."); return; }
    if (f.erinnerung.art === "datum" && !/^\d{4}-\d{2}-\d{2}$/.test(f.erinnerung.datum || "")) { setFehlerText("Bitte ein Datum für die Erinnerung wählen."); return; }
    setBusy(true);
    const erinnerung = f.erinnerung.art === "tage" && !f.faellig ? { art: "keine" } : f.erinnerung;
    const r = await callAuthed("projekte", { action: "aufgabeSave", aufgabe: { id: f.id, projekt: f.projekt || null, text: f.text, notiz: f.notiz, zustaendig: f.zustaendig, faellig: f.faellig, erinnerung } });
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
          <label style={styles.label}>Erinnerung (um 18 Uhr)</label>
          <ErinnerungsFeld faellig={f.faellig} wert={f.erinnerung} onChange={(e) => set("erinnerung", e)} />
          <label style={styles.label}>Beschreibung (optional)</label>
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
