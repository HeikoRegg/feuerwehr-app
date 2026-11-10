// Kachel „Adventskalender“ (seit 2.40): 24 Türchen mit Spruch, Foto und Quizfrage, Punkte und Ranglisten
// (Einsatzabteilung / Jugendfeuerwehr). Die Regeln prüft der Server (netlify/functions/advent.js) – die Lösung kommt
// erst nach der Antwort aufs Handy. Pflegen (Inhalte, Fotos, Fragen, Rangliste löschen) darf nur der Admin.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Gift, Info, Lock, Pencil, Plus, RefreshCw, Trash2, Trophy, X } from "lucide-react";
import { useApp } from "../AppContext";
import { styles } from "../lib/styles";
import { compressImage } from "../lib/helpers";
import { supabase } from "../supabaseClient";

const klein = { fontSize: 12, color: "#8A8C86" };
const GRUEN = "#1F5E3B";
const ROT = "#B3202A";
const GOLD = "#E8A33D";
const STUFE_FARBE = { leicht: "#2E7D4F", mittel: "#C77A2A", schwer: ROT };
const STUFE_NAME = { leicht: "leicht", mittel: "mittel", schwer: "anspruchsvoll" };
const BUCHSTABE = ["A", "B", "C"];

// Feste, gemischte Anordnung der Türchen (wie bei einem echten Adventskalender)
const ANORDNUNG = [13, 4, 20, 9, 1, 17, 22, 6, 11, 24, 3, 15, 8, 19, 2, 12, 23, 7, 16, 5, 21, 10, 18, 14];

function Regeln({ text, onClose }) {
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 112 }} onClick={onClose} data-testid="advent-regeln">
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>🎄 So funktioniert’s</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={{ ...styles.formBody, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
        <button style={{ ...styles.saveBtn, marginTop: 12 }} data-testid="advent-regeln-ok" onClick={onClose}>Alles klar – los geht’s!</button>
      </div>
    </div>
  );
}

// Countdown-Balken; meldet sich bei 0
function Zeitbalken({ rest, sekunden, onEnde }) {
  const [bleibt, setBleibt] = useState(rest);
  const ende = useRef(Date.now() + rest * 1000);
  const gemeldet = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((ende.current - Date.now()) / 1000));
      setBleibt(s);
      if (s <= 0 && !gemeldet.current) { gemeldet.current = true; clearInterval(t); onEnde(); }
    }, 250);
    return () => clearInterval(t);
  }, []);
  const anteil = Math.max(0, Math.min(1, bleibt / sekunden));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: bleibt <= 10 ? ROT : "#5C5F58" }}>
        <span>Zeit</span><span data-testid="quiz-rest">{bleibt} s</span>
      </div>
      <div style={{ height: 8, background: "#EDEAE2", borderRadius: 4, overflow: "hidden", marginTop: 3 }}>
        <div style={{ width: `${anteil * 100}%`, height: "100%", background: bleibt <= 10 ? ROT : GRUEN, transition: "width 0.25s linear" }} />
      </div>
    </div>
  );
}

function Quiz({ tag, quiz, setQuiz, vorschau }) {
  const { callAuthed, flashError } = useApp();
  const [busy, setBusy] = useState(false);
  const [frageStart, setFrageStart] = useState(false);
  async function rufe(body) {
    setBusy(true);
    const r = await callAuthed("advent", { ...body, tag });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt."); return null; }
    return r.data;
  }
  async function starten() { setFrageStart(false); const d = await rufe({ action: "starten" }); if (d) setQuiz(d.quiz); }
  async function antworten(i) { const d = await rufe({ action: "antworten", antwort: i }); if (d) setQuiz(d.quiz); }
  async function zeitUm() { const d = await rufe({ action: "tuer" }); if (d && d.quiz) setQuiz(d.quiz); }
  const kopf = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "white", background: STUFE_FARBE[quiz.stufe] || GRUEN, borderRadius: 4, padding: "2px 7px" }}>{STUFE_NAME[quiz.stufe] || quiz.stufe}</span>
      <span style={klein}>{quiz.sekunden} Sekunden · {quiz.punkte} {quiz.punkte === 1 ? "Punkt" : "Punkte"}</span>
      <span style={klein}>· {quiz.kat === "weihnachten" ? "Weihnachten" : "Feuerwehr"}</span>
    </div>
  );
  if (quiz.zustand === "neu") {
    return (
      <div data-testid="quiz-neu">
        {kopf}
        {vorschau ? <div style={{ ...klein, marginTop: 8 }}>Vorschau – starten lässt sich die Frage erst am Tag des Türchens.</div> : (
          <>
            <div style={{ fontSize: 12.5, color: "#5C5F58", marginTop: 8 }}>
              Die Frage erscheint erst nach dem Start, dann läuft die Zeit. <b>Nur ein Versuch.</b>{" "}
              {quiz.mitPunkten ? "Heute gibt’s Punkte." : "Dieses Türchen ist von einem früheren Tag – du kannst die Frage noch beantworten, aber ohne Punkte."}
            </div>
            {!frageStart
              ? <button style={{ ...styles.saveBtn, marginTop: 10 }} data-testid="quiz-starten" disabled={busy} onClick={() => setFrageStart(true)}>Frage starten</button>
              : (
                <div style={{ background: "#FFF8E8", border: "1px solid #F0D79A", borderRadius: 8, padding: "9px 10px", marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>Bereit? Die Zeit läuft sofort und lässt sich nicht anhalten.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrageStart(false)}>Noch nicht</button>
                    <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="quiz-starten-ja" disabled={busy} onClick={starten}>Los!</button>
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    );
  }
  if (quiz.zustand === "laeuft") {
    return (
      <div data-testid="quiz-laeuft">
        {kopf}
        <Zeitbalken rest={quiz.rest} sekunden={quiz.sekunden} onEnde={zeitUm} />
        <div data-testid="quiz-frage" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: "12px 0 8px" }}>{quiz.frage}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {quiz.antworten.map((a, i) => (
            <button key={i} data-testid={`quiz-antwort-${i}`} disabled={busy} onClick={() => antworten(i)}
              style={{ ...styles.categoryChip, textAlign: "left", fontSize: 14, padding: "11px 12px", background: "white", color: "#2C2F2A", borderColor: "#D9D6CC", display: "flex", gap: 9, alignItems: "flex-start", borderRadius: 10 }}>
              <b style={{ color: GRUEN }}>{BUCHSTABE[i]}</b><span>{a}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  // fertig
  return (
    <div data-testid="quiz-fertig">
      {kopf}
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: "10px 0 8px" }}>{quiz.frage}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {quiz.antworten.map((a, i) => {
          const richtig = i === quiz.loesung, meine = i === quiz.meine;
          return (
            <div key={i} data-testid={`quiz-ergebnis-${i}`} style={{ fontSize: 13.5, padding: "8px 11px", borderRadius: 9, display: "flex", gap: 8, alignItems: "flex-start",
              background: richtig ? "#E3F2E6" : meine ? "#FBE4E4" : "#F6F4EF", border: `1px solid ${richtig ? "#86C091" : meine ? "#E2A9A9" : "#E6E3DA"}` }}>
              <b>{BUCHSTABE[i]}</b><span style={{ flex: 1 }}>{a}</span>{richtig ? <Check size={16} color="#2E7D4F" /> : meine ? <X size={16} color={ROT} /> : null}
            </div>
          );
        })}
      </div>
      <div data-testid="quiz-auswertung" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 10, color: quiz.richtig ? "#2E7D4F" : ROT }}>
        {quiz.zuSpaet ? "⏰ Die Zeit ist abgelaufen – diesmal keine Punkte." : quiz.richtig
          ? (quiz.punkteBekommen > 0 ? `🎉 Richtig! +${quiz.punkteBekommen} ${quiz.punkteBekommen === 1 ? "Punkt" : "Punkte"}` : "🎉 Richtig! (ohne Punkte – Türchen von einem früheren Tag)")
          : "Leider falsch – morgen gibt’s die nächste Chance."}
      </div>
      {quiz.info && <div style={{ ...klein, marginTop: 4 }}>{quiz.info}</div>}
    </div>
  );
}

function TuerAnsicht({ tag, onClose }) {
  const { callAuthed, flashError } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => {
    (async () => {
      const r = await callAuthed("advent", { action: "tuer", tag });
      if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Türchen konnte nicht geöffnet werden."); onClose(); return; }
      setD(r.data);
    })();
  }, [tag]);
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 110 }} onClick={onClose} data-testid="advent-tuer">
      <div style={{ ...styles.modalSheet, background: "linear-gradient(180deg,#FFFDF8,#FFFFFF)" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>🎁 {tag}. Dezember</div>
          <button style={styles.iconBtn} aria-label="Schließen" data-testid="advent-tuer-zu" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={styles.formBody}>
          {!d ? <div style={{ ...klein, padding: "18px 0", textAlign: "center" }}>Türchen wird geöffnet …</div> : (
            <>
              {d.vorschau && <div style={{ ...klein, background: "#EEF2F3", borderRadius: 6, padding: "5px 8px", marginBottom: 8 }}>Admin-Vorschau – für alle anderen ist dieses Türchen noch zu.</div>}
              {d.spruch && <div data-testid="advent-spruch" style={{ fontSize: 15.5, fontStyle: "italic", lineHeight: 1.45, color: GRUEN, textAlign: "center", padding: "6px 4px 12px" }}>„{d.spruch}“</div>}
              {d.foto && (
                <figure style={{ margin: "0 0 12px" }}>
                  <img data-testid="advent-foto" src={d.foto} alt={d.fotoText || "Foto"} style={{ width: "100%", borderRadius: 10, display: "block", maxHeight: 360, objectFit: "cover" }} />
                  {d.fotoText && <figcaption style={{ ...klein, marginTop: 4, textAlign: "center" }}>{d.fotoText}</figcaption>}
                </figure>
              )}
              {d.quiz ? <div style={{ borderTop: "1px dashed #E2DFD6", paddingTop: 10 }}><Quiz tag={tag} quiz={d.quiz} setQuiz={(q) => setD((x) => ({ ...x, quiz: q }))} vorschau={d.vorschau} /></div>
                : <div style={{ ...klein, textAlign: "center" }}>Heute ohne Quizfrage – genieß den Tag!</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Rangliste({ daten, ich, gewinner }) {
  const [tab, setTab] = useState(daten.gruppe === "jf" ? "jf" : "ea");
  const liste = daten.ranglisten[tab] || [];
  const sieger = gewinner ? gewinner[tab] || [] : [];
  return (
    <div data-testid="advent-rangliste" style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, color: "#5C5F58" }}><Trophy size={15} color={GOLD} /> RANGLISTE</div>
      <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
        {[["ea", "Einsatzabteilung"], ["jf", "Jugendfeuerwehr"]].map(([k, l]) => (
          <button key={k} data-testid={`rangliste-${k}`} onClick={() => setTab(k)} style={{ ...styles.categoryChip, background: tab === k ? GRUEN : "#F3F1EC", color: tab === k ? "white" : "#5C5F58", borderColor: tab === k ? GRUEN : "#E2DFD6" }}>{l}</button>
        ))}
      </div>
      {sieger.length > 0 && (
        <div data-testid={`gewinner-${tab}`} style={{ background: "linear-gradient(135deg,#FFF3C9,#FFE08A)", border: "1px solid #E8C04A", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 14 }}>
          🏆 <b>{sieger.length > 1 ? "Gewinner (punktgleich):" : "Gewinner:"}</b> {sieger.join(", ")}
        </div>
      )}
      {gewinner && sieger.length === 0 && <div style={{ ...klein, marginBottom: 6 }}>Kein Gewinner – niemand hat Punkte gesammelt.</div>}
      {liste.length === 0 ? <div style={klein}>Noch niemand auf der Liste – sei die oder der Erste!</div> : (
        <div>
          {liste.map((z) => (
            <div key={z.name} data-testid={`platz-${z.name}`} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 8, alignItems: "center", padding: "6px 4px", borderBottom: "1px solid #F0EEE8", fontWeight: z.name === ich ? 700 : 400, background: z.name === ich ? "#F2F8F3" : "transparent" }}>
              <span style={{ color: z.platz <= 3 ? GOLD : "#8A8C86", fontWeight: 700 }}>{z.platz === 1 ? "🥇" : z.platz === 2 ? "🥈" : z.platz === 3 ? "🥉" : `${z.platz}.`}</span>
              <span>{z.name === ich ? `${z.name} (du)` : z.name}</span>
              <span>{z.punkte} P</span>
            </div>
          ))}
        </div>
      )}
      {daten.ranglisten.ausserWertung && daten.ranglisten.ausserWertung.length > 0 && (
        <div style={{ ...klein, marginTop: 8 }}>Außer Wertung (Admins kennen die Lösungen): {daten.ranglisten.ausserWertung.map((z) => `${z.name} ${z.punkte} P`).join(", ")}</div>
      )}
    </div>
  );
}

// ---------- Admin: Türchen pflegen ----------
function FrageFormular({ start, onClose, onSaved }) {
  const { callAuthed } = useApp();
  const [f, setF] = useState(() => ({ kat: "feuerwehr", stufe: "leicht", frage: "", antworten: ["", "", ""], richtig: 0, info: "", ...start }));
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function speichern() {
    setBusy(true); setFehlerText("");
    const r = await callAuthed("advent", { action: "frageSpeichern", frage: f });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Speichern nicht möglich."); return; }
    onSaved(r.data.frage);
  }
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 114 }} onClick={onClose} data-testid="advent-frage-formular">
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{start && start.id ? "Frage ändern" : "Eigene Frage"}</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={styles.formBody}>
          <label style={styles.label}>Thema und Schwierigkeit</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...styles.input, flex: 1 }} value={f.kat} onChange={(e) => set("kat", e.target.value)}><option value="feuerwehr">Feuerwehr</option><option value="weihnachten">Weihnachten</option></select>
            <select style={{ ...styles.input, flex: 1 }} data-testid="frage-stufe" value={f.stufe} onChange={(e) => set("stufe", e.target.value)}><option value="leicht">leicht (40 s, 1 P)</option><option value="mittel">mittel (60 s, 2 P)</option><option value="schwer">anspruchsvoll (80 s, 3 P)</option></select>
          </div>
          <label style={styles.label}>Frage</label>
          <textarea style={{ ...styles.input, minHeight: 60 }} data-testid="frage-text" maxLength={400} value={f.frage} onChange={(e) => set("frage", e.target.value)} />
          <label style={styles.label}>Antworten – die richtige antippen</label>
          {f.antworten.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <button data-knopf="fest" data-testid={`frage-richtig-${i}`} onClick={() => set("richtig", i)} aria-label={`Antwort ${BUCHSTABE[i]} ist richtig`}
                style={{ width: 30, height: 30, borderRadius: 15, border: `2px solid ${f.richtig === i ? "#2E7D4F" : "#D9D6CC"}`, background: f.richtig === i ? "#2E7D4F" : "white", color: f.richtig === i ? "white" : "#5C5F58", fontWeight: 700, flexShrink: 0 }}>{f.richtig === i ? "✓" : BUCHSTABE[i]}</button>
              <input style={{ ...styles.input, flex: 1 }} data-testid={`frage-antwort-${i}`} maxLength={200} value={a} onChange={(e) => set("antworten", f.antworten.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <label style={styles.label}>Erklärung nach der Antwort (optional)</label>
          <input style={styles.input} maxLength={300} value={f.info} onChange={(e) => set("info", e.target.value)} />
          <div style={{ ...klein, marginTop: 6 }}>Die Reihenfolge der Antworten wird in der App gemischt.</div>
          {fehlerText && <div style={styles.errorText}>{fehlerText}</div>}
          <button style={{ ...styles.saveBtn, marginTop: 12 }} data-testid="frage-speichern" disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Frage speichern"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminPflege({ onClose, onGespeichert }) {
  const { callAuthed, flashError } = useApp();
  const [d, setD] = useState(null);
  const [tueren, setTueren] = useState(null);
  const [regeln, setRegeln] = useState("");
  const [offen, setOffen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [frageForm, setFrageForm] = useState(null);
  const [geaendert, setGeaendert] = useState(false);
  async function laden() {
    const r = await callAuthed("advent", { action: "adminGet" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Laden nicht möglich."); onClose(); return; }
    setD(r.data); setTueren(r.data.tueren); setRegeln(r.data.regeln);
  }
  useEffect(() => { laden(); }, []);
  const fragen = useMemo(() => Object.fromEntries((d ? d.fragen : []).map((q) => [q.id, q])), [d]);
  const setTuer = (t, patch) => { setTueren((x) => ({ ...x, [t]: { ...x[t], ...patch } })); setGeaendert(true); };
  async function speichern() {
    setBusy(true);
    const ohneLinks = Object.fromEntries(Object.entries(tueren).map(([t, x]) => [t, { spruch: x.spruch, frageId: x.frageId, fotoPath: x.fotoPath, fotoText: x.fotoText }]));
    const r = await callAuthed("advent", { action: "adminSave", tueren: ohneLinks, regeln });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich."); return; }
    setGeaendert(false); onGespeichert();
    await laden();
  }
  async function neuAuslosen() {
    if (!window.confirm("Alle 24 Fragen und Sprüche neu auslosen? Fotos werden dabei entfernt. (Gespeichert wird erst mit „Speichern“.)")) return;
    const r = await callAuthed("advent", { action: "auslosen" });
    if (r.ok) { setTueren(r.data.tueren); setGeaendert(true); }
  }
  async function fotoHochladen(t, datei) {
    if (!datei) return;
    setBusy(true);
    try {
      const bild = await compressImage(datei);
      const u = await callAuthed("advent", { action: "fotoUpload", tag: t, filename: bild.name || datei.name || "foto.jpg" });
      if (!u.ok) throw new Error(u.data.error || "Hochladen nicht möglich.");
      const { error } = await supabase.storage.from("projekte").uploadToSignedUrl(u.data.path, u.data.uploadToken, bild);
      if (error) throw error;
      setTuer(t, { fotoPath: u.data.path, foto: URL.createObjectURL(bild) });
    } catch (e) { flashError(e && e.message && !/fetch|network/i.test(e.message) ? e.message : "Foto konnte nicht hochgeladen werden."); }
    setBusy(false);
  }
  if (!d || !tueren) return <div style={styles.fullscreenPage}><div style={{ ...klein, padding: 30, textAlign: "center" }}>Lädt …</div></div>;
  const gruppiert = ["feuerwehr", "weihnachten"].flatMap((kat) => ["leicht", "mittel", "schwer"].map((st) => [kat, st, d.fragen.filter((q) => q.kat === kat && q.stufe === st)]));
  const benutzt = new Set(Object.values(tueren).map((x) => x.frageId).filter(Boolean));
  return (
    <div style={{ ...styles.fullscreenPage, zIndex: 105 }} data-testid="advent-pflege">
      <div style={styles.fullscreenHeader}>
        <button style={styles.fullscreenBackBtn} onClick={() => { if (!geaendert || window.confirm("Änderungen verwerfen?")) onClose(); }}><ArrowLeft size={18} /> Adventskalender</button>
      </div>
      <div style={styles.modalTitle}>Türchen {d.jahr} pflegen</div>
      <div style={{ ...klein, marginBottom: 8 }}>{d.gespeichert ? "Gespeichert – so sehen es alle ab dem jeweiligen Tag." : "Noch nicht gespeichert: Diese Auswahl wurde automatisch ausgelost (ohne Fragen vom Vorjahr). Du kannst alles ändern."}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button style={styles.smallAddBtn} data-testid="advent-auslosen" onClick={neuAuslosen}><RefreshCw size={12} /> Neu auslosen</button>
        <button style={styles.smallAddBtn} data-testid="advent-eigene-frage" onClick={() => setFrageForm({})}><Plus size={12} /> Eigene Frage</button>
      </div>
      {Array.from({ length: 24 }, (_, i) => i + 1).map((t) => {
        const x = tueren[t] || {};
        const q = x.frageId ? fragen[x.frageId] : null;
        const auf = offen === t;
        return (
          <div key={t} data-testid={`pflege-tuer-${t}`} style={{ border: "1px solid #E6E3DA", borderRadius: 10, marginBottom: 7, background: "white" }}>
            <button data-knopf="fest" onClick={() => setOffen(auf ? null : t)} style={{ width: "100%", background: "transparent", border: "none", padding: "9px 11px", display: "flex", gap: 9, alignItems: "center", textAlign: "left", cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: GRUEN, color: "white", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q ? q.frage : <i style={{ color: "#8A8C86" }}>ohne Quizfrage</i>}</span>
                <span style={klein}>{q ? `${q.kat === "weihnachten" ? "Weihnachten" : "Feuerwehr"} · ${STUFE_NAME[q.stufe]}` : ""}{x.fotoPath ? " · 📷 Foto" : ""}</span>
              </span>
              <Pencil size={14} color="#8A8C86" />
            </button>
            {auf && (
              <div style={{ padding: "0 11px 11px" }}>
                <label style={styles.label}>Spruch</label>
                <textarea style={{ ...styles.input, minHeight: 50 }} data-testid={`pflege-spruch-${t}`} maxLength={400} value={x.spruch || ""} onChange={(e) => setTuer(t, { spruch: e.target.value })} />
                <label style={styles.label}>Quizfrage</label>
                <select style={styles.input} data-testid={`pflege-frage-${t}`} value={x.frageId || ""} onChange={(e) => setTuer(t, { frageId: e.target.value || null })}>
                  <option value="">— ohne Quizfrage —</option>
                  {gruppiert.map(([kat, st, liste]) => liste.length > 0 && (
                    <optgroup key={kat + st} label={`${kat === "weihnachten" ? "Weihnachten" : "Feuerwehr"} – ${STUFE_NAME[st]}`}>
                      {liste.map((qq) => <option key={qq.id} value={qq.id}>{benutzt.has(qq.id) && qq.id !== x.frageId ? "• " : ""}{qq.vorjahr ? "(Vorjahr) " : ""}{qq.eigen ? "★ " : ""}{qq.frage.slice(0, 70)}</option>)}
                    </optgroup>
                  ))}
                </select>
                {q && (
                  <div style={{ fontSize: 12, background: "#F6F4EF", borderRadius: 7, padding: "7px 9px", marginTop: 6 }}>
                    {q.antworten.map((a, i) => <div key={i} style={{ color: i === q.richtig ? "#2E7D4F" : "#5C5F58", fontWeight: i === q.richtig ? 700 : 400 }}>{i === q.richtig ? "✓ " : "· "}{a}</div>)}
                    <button style={{ ...styles.tinyBtn, marginTop: 6 }} data-testid={`pflege-frage-aendern-${t}`} onClick={() => setFrageForm({ ...q })}><Pencil size={11} /> Frage ändern</button>
                  </div>
                )}
                <div style={{ ...klein, marginTop: 4 }}>• = schon an einem anderen Tag gewählt · (Vorjahr) = war letztes Jahr dran · ★ = eigene Frage</div>
                <label style={styles.label}>Foto (optional)</label>
                {x.fotoPath && x.foto && <img src={x.foto} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 6 }} />}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ ...styles.smallAddBtn, cursor: "pointer" }}>
                    <Plus size={12} /> {x.fotoPath ? "Foto ersetzen" : "Foto wählen"}
                    <input type="file" accept="image/*" data-testid={`pflege-foto-${t}`} style={{ display: "none" }} onChange={(e) => { fotoHochladen(t, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  {x.fotoPath && <button style={styles.tinyBtn} onClick={() => setTuer(t, { fotoPath: "", foto: "", fotoText: "" })}><Trash2 size={11} /> Foto entfernen</button>}
                </div>
                {x.fotoPath && <input style={{ ...styles.input, marginTop: 6 }} maxLength={200} placeholder="Bildunterschrift (optional)" value={x.fotoText || ""} onChange={(e) => setTuer(t, { fotoText: e.target.value })} />}
              </div>
            )}
          </div>
        );
      })}
      <label style={styles.label}>Spielregeln („So funktioniert’s“)</label>
      <textarea style={{ ...styles.input, minHeight: 150 }} data-testid="pflege-regeln" maxLength={4000} value={regeln} onChange={(e) => { setRegeln(e.target.value); setGeaendert(true); }} />
      <button style={{ ...styles.tinyBtn, marginTop: 6 }} onClick={() => { setRegeln(d.regelnStandard); setGeaendert(true); }}>Standardtext wiederherstellen</button>
      <div style={{ position: "sticky", bottom: 0, background: "#F7F5F0", padding: "10px 0", marginTop: 12 }}>
        <button style={styles.saveBtn} data-testid="pflege-speichern" disabled={busy || !geaendert} onClick={speichern}>{busy ? "Speichert …" : geaendert ? "Speichern" : "Gespeichert"}</button>
      </div>
      {frageForm && <FrageFormular start={frageForm} onClose={() => setFrageForm(null)} onSaved={async (q) => { setFrageForm(null); const alt = tueren; await laden(); setTueren(alt); if (offen && !frageForm.id) setTuer(offen, { frageId: q.id }); }} />}
    </div>
  );
}

export default function AdventKachel() {
  const { me, callAuthed, flashError, closeKachelView, kachelReturnTo } = useApp();
  const [d, setD] = useState(null);
  const [tuer, setTuer] = useState(null);
  const [regeln, setRegeln] = useState(false);
  const [pflege, setPflege] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState(false);
  async function laden() {
    const r = await callAuthed("advent", { action: "kalender" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Adventskalender konnte nicht geladen werden."); return; }
    setD(r.data);
    // Spielregeln beim ersten Öffnen im Jahr einmal zeigen
    try { const k = `ffw_advent_regeln_${r.data.jahr}_${me}`; if (!localStorage.getItem(k)) { localStorage.setItem(k, "1"); setRegeln(true); } } catch (e) { /* egal */ }
  }
  useEffect(() => { laden(); }, []);
  async function ranglisteLoeschen() {
    const r = await callAuthed("advent", { action: "ranglisteLoeschen" });
    setLoeschFrage(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich."); return; }
    await laden();
  }
  const tage = d ? Object.fromEntries(d.tage.map((x) => [x.tag, x])) : {};
  return (
    <div style={styles.fullscreenPage} data-testid="advent-kachel">
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ ...styles.modalTitle, flex: 1 }}>🎄 Adventskalender{d ? ` ${d.jahr}` : ""}</div>
        <button style={styles.iconBtn} aria-label="So funktioniert’s" data-testid="advent-info" onClick={() => setRegeln(true)}><Info size={19} color="#5C5F58" /></button>
      </div>
      {!d ? <div style={{ ...klein, padding: 24, textAlign: "center" }}>Lädt …</div> : (
        <>
          <div style={{ ...klein, marginBottom: 10 }}>
            {d.heute === 0 ? "Der Kalender startet am 1. Dezember." : d.heute > 24 ? "Alle Türchen sind offen – frohe Weihnachten!" : `Heute ist Türchen ${d.heute} dran.`}
            {" "}Deine Punkte: <b data-testid="advent-meine-punkte">{d.meinePunkte}</b>
          </div>
          <div data-testid="advent-raster" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: 10, borderRadius: 14,
            background: "radial-gradient(circle at 20% 10%, #2F7A50 0%, #1F5E3B 55%, #17462C 100%)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08)" }}>
            {ANORDNUNG.map((t) => {
              const x = tage[t] || {};
              const heute = t === d.heute;
              const zu = !x.offen;
              const kannSehen = x.offen || d.admin;
              return (
                <button key={t} data-knopf="fest" data-testid={`tuer-${t}`} disabled={!kannSehen} onClick={() => kannSehen && setTuer(t)}
                  style={{ aspectRatio: "1 / 1", borderRadius: 10, border: heute ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.25)", cursor: kannSehen ? "pointer" : "default", position: "relative",
                    background: x.geoeffnet ? "rgba(255,255,255,0.92)" : zu ? "rgba(255,255,255,0.10)" : "linear-gradient(145deg,#C8102E,#8E0C21)",
                    color: x.geoeffnet ? GRUEN : "white", fontWeight: 800, fontSize: 19, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    boxShadow: heute && !x.geoeffnet ? "0 0 12px rgba(232,163,61,0.8)" : "none", opacity: zu && !d.admin ? 0.7 : 1 }}>
                  <span>{t}</span>
                  {zu ? <Lock size={11} color="rgba(255,255,255,0.7)" /> : x.beantwortet ? <span style={{ fontSize: 10, fontWeight: 700, color: x.richtig ? "#2E7D4F" : ROT }}>{x.richtig ? (x.punkte ? `+${x.punkte}` : "✓") : "✗"}</span>
                    : x.geoeffnet ? <Gift size={11} color={GRUEN} /> : x.hatQuiz ? <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.85 }}>Quiz</span> : null}
                </button>
              );
            })}
          </div>
          <Rangliste daten={d} ich={me} gewinner={d.gewinner} />
          {d.admin && (
            <div style={{ marginTop: 20, borderTop: "1px solid #E6E3DA", paddingTop: 12 }}>
              <div style={{ ...klein, fontWeight: 700, marginBottom: 6 }}>NUR ADMIN</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={styles.smallAddBtn} data-testid="advent-pflegen" onClick={() => setPflege(true)}><Pencil size={12} /> Türchen pflegen</button>
                <button style={{ ...styles.smallAddBtn, color: ROT }} data-testid="advent-rangliste-loeschen" onClick={() => setLoeschFrage(true)}><Trash2 size={12} /> Rangliste löschen</button>
              </div>
              {loeschFrage && (
                <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px", marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>Rangliste und alle Antworten dieses Jahres endgültig löschen? Alle fangen wieder bei 0 an.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschFrage(false)}>Abbrechen</button>
                    <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="advent-rangliste-loeschen-ja" onClick={ranglisteLoeschen}>Löschen</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {tuer && <TuerAnsicht tag={tuer} onClose={() => { setTuer(null); laden(); }} />}
      {regeln && d && <Regeln text={d.regeln} onClose={() => setRegeln(false)} />}
      {pflege && <AdminPflege onClose={() => setPflege(false)} onGespeichert={laden} />}
    </div>
  );
}
