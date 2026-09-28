import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, ChevronRight, Landmark, MessageCircle, Plus, Send, Shield, Trash2, Wrench } from "lucide-react";
import { matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { SearchBox } from "../components/Shared";
import { useApp } from "../AppContext";

// Kachel Nachrichten: Direktnachrichten Kamerad ↔ Ausschuss / Kommandantschaft / Entwickler.
// Jeder Kamerad hat pro Gruppe seine eigene Unterhaltung; untereinander schreiben ist nicht möglich.
const GRUPPEN = ["ausschuss", "kommando", "entwickler"];
const NAME = { ausschuss: "Ausschuss", kommando: "Kommandantschaft", entwickler: "Entwickler" };
const AN = { ausschuss: "An den Ausschuss", kommando: "An die Kommandantschaft", entwickler: "An den Entwickler" };
const BESCHREIBUNG = {
  ausschuss: "Alle Ausschussmitglieder lesen mit und können antworten.",
  kommando: "Kommandant und Stellvertreter lesen mit und können antworten.",
  entwickler: "Fragen, Fehler oder Wünsche zur App.",
};
function GruppenIcon({ gruppe, size = 17 }) {
  const c = "#2C2F2A";
  if (gruppe === "ausschuss") return <Landmark size={size} color={c} />;
  if (gruppe === "kommando") return <Shield size={size} color={c} />;
  return <Wrench size={size} color={c} />;
}
function zeitText(ts) {
  const d = new Date(ts); if (isNaN(d)) return "";
  const heute = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === heute.toDateString()) return hm;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}. ${hm}`;
}
const zahl = { minWidth: 18, height: 18, borderRadius: 9, background: "#C1272D", color: "white", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" };
const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "18px 0 6px", letterSpacing: "0.04em" };

export default function NachrichtenKachel() {
  const { me, roster, callAuthed, flashError, closeKachelView, kachelReturnTo, ladeChatStatus } = useApp();
  const [liste, setListe] = useState(null); // { ich, gruppen, threads }
  const [fehler, setFehler] = useState("");
  const [offen, setOffen] = useState(null); // { gruppe, kamerad }
  const [waehle, setWaehle] = useState(null); // Gruppe, für die ein Kamerad ausgewählt wird
  const [suche, setSuche] = useState("");

  async function ladeListe() {
    const r = await callAuthed("chat", { action: "list" });
    if (r.ok) { setListe(r.data); setFehler(""); }
    else if (r.data.error === "abgebrochen") closeKachelView();
    else setFehler(r.data.error || "Nachrichten konnten nicht geladen werden.");
  }
  useEffect(() => { ladeListe(); }, []);
  // Übersicht alle 30 Sekunden auffrischen, solange sie sichtbar ist.
  useEffect(() => {
    if (offen) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") ladeListe(); }, 30000);
    return () => clearInterval(t);
  }, [offen]);

  function schliessen() { if (ladeChatStatus) ladeChatStatus(); closeKachelView(); }
  function zurueckZurListe() { setOffen(null); ladeListe(); if (ladeChatStatus) ladeChatStatus(); }

  if (offen) return <Unterhaltung gruppe={offen.gruppe} kamerad={offen.kamerad} ich={me} onBack={zurueckZurListe} callAuthed={callAuthed} flashError={flashError} />;

  const threads = (liste && liste.threads) || [];
  const gruppen = (liste && liste.gruppen) || {};
  const eigene = (g) => threads.find((t) => t.gruppe === g && t.seite === "kamerad");

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}>
        <button style={styles.fullscreenBackBtn} onClick={schliessen}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
      </div>
      <div style={styles.modalTitle}>Nachrichten</div>
      <div style={{ fontSize: 11.5, color: "#8A8C86", margin: "2px 0 4px" }}>Schreib direkt an den Ausschuss, die Kommandantschaft oder den Entwickler der App. Es lesen nur die jeweiligen Empfänger mit.</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {!liste && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}

      {waehle && (
        <div style={{ ...styles.capacityBox, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Kameraden anschreiben ({NAME[waehle]})</div>
            <button style={styles.tinyBtn} onClick={() => { setWaehle(null); setSuche(""); }}>Abbrechen</button>
          </div>
          <SearchBox value={suche} onChange={setSuche} placeholder="Name suchen …" />
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {roster.filter((r) => r.name !== me && !((gruppen[waehle] && gruppen[waehle].mitglieder) || []).includes(r.name) && matchesSearch(r.name, suche)).map((r) => (
              <button key={r.name} style={{ ...styles.rosterItem, marginBottom: 6 }} onClick={() => { setOffen({ gruppe: waehle, kamerad: r.name }); setWaehle(null); setSuche(""); }}>
                <span>{r.name}</span><ChevronRight size={15} color="#A5A79F" />
              </button>
            ))}
          </div>
        </div>
      )}

      {liste && (
        <>
          {GRUPPEN.some((g) => !gruppen[g] || !gruppen[g].mitglied) && <div style={abschnitt}>MEINE NACHRICHTEN</div>}
          {GRUPPEN.filter((g) => !gruppen[g] || !gruppen[g].mitglied).map((g) => {
            const t = eigene(g);
            const moeglich = gruppen[g] && gruppen[g].verfuegbar;
            return (
              <button key={g} disabled={!moeglich && !t} style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10 }} onClick={() => setOffen({ gruppe: g, kamerad: me })}>
                <GruppenIcon gruppe={g} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{AN[g]}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t ? `${t.letzteVon === me ? "Du" : t.letzteVon}: ${t.letzteText}` : moeglich ? BESCHREIBUNG[g] : "Noch niemand eingetragen"}
                  </span>
                </span>
                {t && t.ungelesen > 0 ? <span style={zahl}>{t.ungelesen}</span> : <ChevronRight size={15} color="#A5A79F" />}
              </button>
            );
          })}

          {GRUPPEN.filter((g) => gruppen[g] && gruppen[g].mitglied).map((g) => {
            const ts = threads.filter((t) => t.gruppe === g && t.seite === "fuehrung");
            return (
              <div key={g}>
                <div style={{ ...abschnitt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><GruppenIcon gruppe={g} size={13} /> {NAME[g].toUpperCase()} – UNTERHALTUNGEN</span>
                  <button style={styles.smallAddBtn} onClick={() => { setWaehle(g); setSuche(""); }}><Plus size={12} /> Anschreiben</button>
                </div>
                {ts.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Noch keine Nachrichten.</div>}
                {ts.map((t) => (
                  <button key={t.id} style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10 }} onClick={() => setOffen({ gruppe: t.gruppe, kamerad: t.kamerad })}>
                    <MessageCircle size={16} color={t.ungelesen > 0 ? "#C1272D" : "#A5A79F"} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: t.ungelesen > 0 ? 700 : 600 }}>{t.kamerad}</span>
                        <span style={{ fontSize: 10.5, color: "#A5A79F", fontWeight: 400 }}>{zeitText(t.letzte)}</span>
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.letzteVon === me ? "Du" : t.letzteVon}: {t.letzteText}</span>
                    </span>
                    {t.ungelesen > 0 && <span style={zahl}>{t.ungelesen}</span>}
                  </button>
                ))}
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: "#A5A79F", marginTop: 18 }}>Unterhaltungen werden 6 Monate nach der letzten Nachricht automatisch gelöscht. Jeder Beteiligte kann eine Unterhaltung vorher für alle löschen.</div>
        </>
      )}
    </div>
  );
}

// Eine einzelne Unterhaltung (Kamerad + Gruppe).
function Unterhaltung({ gruppe, kamerad, ich, onBack, callAuthed, flashError }) {
  const [daten, setDaten] = useState(null); // { thread, teilnehmer, nachrichten }
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [loeschenFrage, setLoeschenFrage] = useState(false);
  const endeRef = useRef(null);
  const anzahlRef = useRef(0);
  const ladeNrRef = useRef(0); // verwirft Antworten, die von neueren Abfragen/Sendungen überholt wurden
  const alsKamerad = kamerad === ich;

  async function laden() {
    const nr = ++ladeNrRef.current;
    const r = await callAuthed("chat", { action: "get", gruppe, kamerad });
    if (nr !== ladeNrRef.current) return;
    if (r.ok) { setDaten(r.data); setFehler(""); }
    else if (r.status === 404) onBack();
    else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Unterhaltung konnte nicht geladen werden.");
  }
  useEffect(() => { laden(); }, []);
  // Solange die Unterhaltung offen ist, alle 6 Sekunden nach neuen Nachrichten schauen.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") laden(); }, 6000);
    return () => clearInterval(t);
  }, []);
  // Bei neuen Nachrichten nach unten scrollen.
  useEffect(() => {
    const n = daten ? daten.nachrichten.length : 0;
    if (n !== anzahlRef.current && endeRef.current) endeRef.current.scrollIntoView({ block: "end" });
    anzahlRef.current = n;
  }, [daten]);

  async function senden() {
    const t = text.trim(); if (!t || sendet) return;
    setSendet(true); setFehler("");
    ladeNrRef.current++; // laufende Abfragen sind danach veraltet
    const r = await callAuthed("chat", { action: "send", gruppe, kamerad, text: t });
    setSendet(false);
    if (r.ok) {
      setText("");
      setDaten((d) => ({ ...(d || { teilnehmer: [] }), thread: (d && d.thread) || { id: r.data.id, gruppe, kamerad }, nachrichten: [...((d && d.nachrichten) || []).filter((m) => m.id !== r.data.nachricht.id), r.data.nachricht] }));
      laden();
    } else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Nachricht konnte nicht gesendet werden.");
  }
  async function loeschen() {
    setLoeschenFrage(false);
    if (!daten || !daten.thread) { onBack(); return; }
    const r = await callAuthed("chat", { action: "delete", id: daten.thread.id });
    if (r.ok) onBack();
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Unterhaltung konnte nicht gelöscht werden.");
  }

  const nachrichten = (daten && daten.nachrichten) || [];
  const gelesenBis = (daten && daten.andereGelesenTs) || 0; // ✓✓ = mindestens ein anderer Beteiligter hat gelesen
  const mitleser = ((daten && daten.teilnehmer) || []).filter((n) => n !== ich);
  const titel = alsKamerad ? NAME[gruppe] : kamerad;
  const untertitel = alsKamerad
    ? (mitleser.length ? `Es lesen mit: ${mitleser.join(", ")}` : "")
    : `Unterhaltung ${gruppe === "entwickler" ? "mit dem Entwickler" : gruppe === "ausschuss" ? "mit dem Ausschuss" : "mit der Kommandantschaft"}${mitleser.length ? ` · es lesen mit: ${mitleser.join(", ")}` : ""}`;

  return (
    <div style={{ ...styles.fullscreenPage, display: "flex", flexDirection: "column", padding: 0 }}>
      <div style={{ padding: "20px 18px 10px", borderBottom: "1px solid #E2DFD6", background: "#F3F1EC" }}>
        <div style={{ ...styles.fullscreenHeader, justifyContent: "space-between" }}>
          <button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Alle Nachrichten</button>
          {daten && daten.thread && <button style={styles.rosterRemoveBtn} aria-label="Unterhaltung löschen" title="Unterhaltung löschen" onClick={() => setLoeschenFrage(true)}><Trash2 size={14} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {alsKamerad && <GruppenIcon gruppe={gruppe} size={18} />}
          <div style={{ ...styles.modalTitle, margin: 0 }}>{titel}</div>
        </div>
        {untertitel && <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 2 }}>{untertitel}</div>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {!daten && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Lädt …</div>}
        {daten && nachrichten.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#8A8C86", textAlign: "center", marginTop: 30 }}>
            {alsKamerad ? BESCHREIBUNG[gruppe] : `Noch keine Nachrichten mit ${kamerad}.`}<br />Schreib die erste Nachricht.
          </div>
        )}
        {nachrichten.map((m, i) => {
          const eigen = m.von === ich;
          const nameZeigen = !eigen && (i === 0 || nachrichten[i - 1].von !== m.von);
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: eigen ? "flex-end" : "flex-start", marginBottom: 6 }}>
              {nameZeigen && <div style={{ fontSize: 10.5, color: "#8A8C86", margin: "4px 6px 2px" }}>{m.von}</div>}
              <div style={{ maxWidth: "82%", padding: "8px 11px", borderRadius: 12, borderBottomRightRadius: eigen ? 3 : 12, borderBottomLeftRadius: eigen ? 12 : 3, background: eigen ? "#C1272D" : "white", color: eigen ? "white" : "#2C2F2A", border: eigen ? "none" : "1px solid #E2DFD6", fontSize: 13.5, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {m.text}
                <div style={{ fontSize: 9.5, marginTop: 3, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, color: eigen ? "rgba(255,255,255,0.75)" : "#A5A79F" }}>
                  <span>{zeitText(m.ts)}</span>
                  {eigen && (Date.parse(m.ts) <= gelesenBis
                    ? <span aria-label="gelesen" title="Gelesen" style={{ display: "inline-flex" }}><CheckCheck size={13} color="#9BE7FF" strokeWidth={2.6} /></span>
                    : <span aria-label="gesendet" title="Gesendet" style={{ display: "inline-flex" }}><Check size={13} color="rgba(255,255,255,0.8)" strokeWidth={2.4} /></span>)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endeRef} />
      </div>

      <div style={{ borderTop: "1px solid #E2DFD6", background: "#F3F1EC", padding: "10px 12px calc(10px + env(safe-area-inset-bottom))" }}>
        {fehler && <div style={{ ...styles.errorText, marginTop: 0, marginBottom: 6 }}>{fehler}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea style={{ ...styles.input, flex: 1, minHeight: 42, maxHeight: 140, resize: "none", marginTop: 0 }} rows={Math.min(5, Math.max(1, text.split("\n").length))} placeholder="Nachricht schreiben …" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <button style={{ ...styles.saveBtn, flex: "0 0 46px", width: 46, height: 42, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Senden" disabled={sendet || !text.trim()} onClick={senden}><Send size={18} color="white" /></button>
        </div>
      </div>

      {loeschenFrage && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setLoeschenFrage(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter">
            <Trash2 size={22} color="#C1272D" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Unterhaltung für alle löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Alle Nachrichten verschwinden – auch bei den anderen Beteiligten. Das kann nicht rückgängig gemacht werden.</div>
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
