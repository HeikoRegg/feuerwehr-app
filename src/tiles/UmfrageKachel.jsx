// Kachel Terminumfragen: Terminvorschläge zur Abstimmung (Ja/Nein, Namen für alle sichtbar). Beim Abschluss werden ein oder
// mehrere Termine bestätigt und in den Kalender übernommen – die Kameraden mit „Ja“ sind dort automatisch zugesagt.
// Die Rechte prüft der Server (netlify/functions/umfrage.js).
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, X } from "lucide-react";
import { BEREICHE, CATEGORIES } from "../lib/constants";
import { WEEKDAYS_SHORT } from "../lib/constants";
import { styles } from "../lib/styles";
import { hole, merke } from "../lib/zwischenspeicher";
import { useApp } from "../AppContext";

const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "18px 0 6px", letterSpacing: "0.04em" };
const klein = { fontSize: 11.5, color: "#8A8C86" };
const knopf = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, border: "1.5px solid #E2DFD6", background: "white", color: "#2C2F2A" };
const knopfRot = { ...knopf, background: "#C1272D", color: "white", border: "1.5px solid #C1272D" };
const heuteLokal = () => new Date().toLocaleDateString("sv-SE");
const datumLang = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${WEEKDAYS_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const terminText = (t) => `${datumLang(t.datum)}${t.zeit ? ` · ${t.zeit} Uhr` : ""}`;
const fristText = (u) => (u.abstimmenBis ? `Abstimmen bis ${datumLang(u.abstimmenBis)}` : "");

function Pille({ text, farbe, grund }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: farbe, background: grund, whiteSpace: "nowrap" }}>{text}</span>;
}
function BereichPille({ bereich }) {
  const b = BEREICHE[bereich]; if (!b) return null;
  return <Pille text={b.label} farbe="white" grund={b.color} />;
}
function stand(u) {
  if (u.status === "abgeschlossen") return { text: "Abgeschlossen", farbe: "#5C5F58", grund: "#EEEEEC" };
  if (!u.darfAbstimmen) return { text: u.abstimmenBis && u.abstimmenBis < heuteLokal() ? "Abstimmung beendet" : "Offen", farbe: "#5C5F58", grund: "#EEEEEC" };
  return Object.keys(u.meine || {}).length ? { text: "Abgestimmt", farbe: "#2E7D4F", grund: "#E7F2EF" } : { text: "Noch nicht abgestimmt", farbe: "#9A5B00", grund: "#FBF1E1" };
}

// ---------------- Neue Umfrage ----------------
function NeueUmfrage({ rechte, onClose, onSaved }) {
  const { callAuthed } = useApp();
  const erlaubt = rechte.anlegen || [];
  const [d, setD] = useState(() => ({ titel: "", bereich: erlaubt.includes("einsatzabteilung") ? "einsatzabteilung" : erlaubt[0] || "", kategorie: "uebung", ort: "", hinweis: "", abstimmenBis: "", modus: "normal", termine: [{ datum: "", zeit: "19:30", max: "" }, { datum: "", zeit: "19:30", max: "" }] }));
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const set = (t) => setD((x) => ({ ...x, ...t }));
  const setTermin = (i, t) => setD((x) => ({ ...x, termine: x.termine.map((a, k) => (k === i ? { ...a, ...t } : a)) }));
  async function speichern() {
    setFehler("");
    if (!d.titel.trim()) { setFehler("Bitte einen Titel eingeben."); return; }
    setBusy(true);
    const r = await callAuthed("umfrage", { action: "create", umfrage: { ...d, termine: d.termine.map((t) => ({ ...t, max: t.max === "" ? 0 : Number(t.max) })) } });
    setBusy(false);
    if (r.ok) onSaved(r.data.id); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <div style={styles.fullscreenPage} role="dialog" aria-label="Neue Terminumfrage">
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><X size={18} /> Abbrechen</button></div>
      <div style={styles.modalTitle}>Neue Terminumfrage</div>
      <label style={styles.label}>TITEL</label>
      <input style={styles.input} aria-label="Titel" maxLength={80} value={d.titel} onChange={(e) => set({ titel: e.target.value })} placeholder="z. B. Atemschutzübung Gruppe A" />
      <label style={styles.label}>BEREICH (WER STIMMT AB?)</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {erlaubt.map((b) => <button key={b} type="button" aria-pressed={d.bereich === b} onClick={() => set({ bereich: b })} style={{ ...styles.categoryChip, background: d.bereich === b ? BEREICHE[b].color : "#F3F1EC", color: d.bereich === b ? "white" : "#5C5F58", borderColor: d.bereich === b ? BEREICHE[b].color : "#E2DFD6" }}>{BEREICHE[b].label}</button>)}
      </div>
      <label style={styles.label}>ART DES TERMINS IM KALENDER</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(CATEGORIES).map(([k, c]) => <button key={k} type="button" aria-pressed={d.kategorie === k} onClick={() => set({ kategorie: k })} style={{ ...styles.categoryChip, background: d.kategorie === k ? c.color : "#F3F1EC", color: d.kategorie === k ? "white" : "#5C5F58", borderColor: d.kategorie === k ? c.color : "#E2DFD6" }}>{c.label}</button>)}
      </div>
      <label style={{ ...styles.checkboxRow, marginTop: 12, alignItems: "flex-start" }}>
        <input type="checkbox" aria-label="Jeder nur einmal einteilen" checked={d.modus === "einteilung"} onChange={(e) => set({ modus: e.target.checked ? "einteilung" : "normal" })} style={{ marginTop: 3 }} />
        <span><b>Jeder nur einmal einteilen</b> (z. B. Streckendurchgang)<br /><span style={klein}>Die Kameraden geben alle Tage an, an denen sie können. Beim Abschluss verteilt die App jeden auf genau einen Termin – du kannst den Vorschlag noch ändern.</span></span>
      </label>
      <label style={styles.label}>TERMINVORSCHLÄGE (2 BIS 10)</label>
      {d.termine.map((t, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input style={{ ...styles.input, flex: 1, marginTop: 0 }} type="date" aria-label={`Datum ${i + 1}`} min={heuteLokal()} value={t.datum} onChange={(e) => setTermin(i, { datum: e.target.value })} />
          <input style={{ ...styles.input, width: 118, marginTop: 0 }} type="time" aria-label={`Uhrzeit ${i + 1}`} value={t.zeit} onChange={(e) => setTermin(i, { zeit: e.target.value })} />
          <button type="button" style={{ ...styles.tinyBtn, padding: "9px 9px", opacity: d.termine.length <= 2 ? 0.35 : 1, display: "flex" }} aria-label={`Terminvorschlag ${i + 1} entfernen`} disabled={d.termine.length <= 2} onClick={() => set({ termine: d.termine.filter((_, k) => k !== i) })}><Trash2 size={15} color="#C1272D" /></button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
          <span style={{ ...klein, whiteSpace: "nowrap" }}>Max. Personen:</span>
          <input style={{ ...styles.input, width: 80, marginTop: 0, padding: "6px 8px" }} type="number" inputMode="numeric" min="1" max="200" aria-label={`Max. Personen ${i + 1}`} value={t.max} placeholder="–" onChange={(e) => setTermin(i, { max: e.target.value })} />
          <span style={klein}>leer = unbegrenzt</span>
        </div>
        </div>
      ))}
      {d.termine.length < 10 && <div style={{ marginBottom: 4 }}><button type="button" style={{ ...styles.tinyBtn, fontSize: 12, padding: "7px 11px", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => set({ termine: [...d.termine, { datum: "", zeit: d.termine[d.termine.length - 1].zeit || "19:30", max: d.termine[d.termine.length - 1].max || "" }] })}><Plus size={12} /> Terminvorschlag hinzufügen</button></div>}
      <label style={styles.label}>ORT (OPTIONAL)</label>
      <input style={styles.input} aria-label="Ort" maxLength={80} value={d.ort} onChange={(e) => set({ ort: e.target.value })} placeholder="z. B. Feuerwehrhaus" />
      <label style={styles.label}>HINWEIS (OPTIONAL)</label>
      <textarea style={{ ...styles.input, minHeight: 56, resize: "vertical" }} aria-label="Hinweis" maxLength={500} value={d.hinweis} onChange={(e) => set({ hinweis: e.target.value })} placeholder="z. B. Dauer ca. 2 Stunden" />
      <label style={styles.label}>ABSTIMMEN BIS (OPTIONAL)</label>
      <input style={styles.input} type="date" aria-label="Abstimmen bis" min={heuteLokal()} value={d.abstimmenBis} onChange={(e) => set({ abstimmenBis: e.target.value })} />
      <div style={{ ...klein, marginTop: 8 }}>Alle Mitglieder des Bereichs bekommen eine Benachrichtigung. Die Namen der Abstimmenden sind für alle sichtbar.</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button style={styles.saveBtn} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Umfrage starten"}</button></div>
    </div>
  );
}

// ---------------- Max. Personen ändern, Termine „nicht mehr frei“ markieren ----------------
function TermineBearbeiten({ u, onFertig }) {
  const { callAuthed, flashError } = useApp();
  const [werte, setWerte] = useState(() => u.termine.map((t) => ({ id: t.id, max: t.max ? String(t.max) : "", vergeben: !!t.vergeben })));
  const [busy, setBusy] = useState(false);
  const setW = (id, patch) => setWerte((w) => w.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  async function speichern() {
    setBusy(true);
    const r = await callAuthed("umfrage", { action: "termineAnpassen", id: u.id, termine: werte.map((w) => ({ ...w, max: w.max === "" ? 0 : Number(w.max) })) });
    setBusy(false);
    if (r.ok) onFertig(true); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <div data-testid="termine-bearbeiten" style={{ ...styles.capacityBox, marginTop: 12, borderColor: "#1F4E79" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Termine anpassen</div>
      <div style={{ ...klein, marginTop: 4 }}>Max. Personen je Termin (leer = unbegrenzt). Termine, die inzwischen nicht mehr frei sind (z. B. an eine andere Feuerwehr vergeben), abhaken – dort kann dann niemand mehr eingeteilt werden.</div>
      {u.termine.map((t) => { const w = werte.find((x) => x.id === t.id); return (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 150px", fontSize: 13, fontWeight: 600, textDecoration: w.vergeben ? "line-through" : "none" }}>{terminText(t)}</span>
          <span style={klein}>Max.</span>
          <input style={{ ...styles.input, width: 64, marginTop: 0, padding: "6px 8px" }} type="number" inputMode="numeric" min="1" max="200" aria-label={`Max. Personen ${terminText(t)}`} value={w.max} placeholder="–" onChange={(e) => setW(t.id, { max: e.target.value })} />
          <label style={{ ...klein, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" aria-label={`${terminText(t)} nicht mehr frei`} checked={w.vergeben} onChange={(e) => setW(t.id, { vergeben: e.target.checked })} /> nicht mehr frei</label>
        </div>
      ); })}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={knopfRot} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
        <button style={knopf} disabled={busy} onClick={() => onFertig(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

// ---------------- Einteilung „jeder nur einmal“: Vorschlag ansehen, von Hand ändern, übernehmen ----------------
function EinteilungPlanen({ u, busy, onZurueck, onUebernehmen, onOhne }) {
  const { callAuthed, flashError } = useApp();
  const [v, setV] = useState(null); // Antwort des Servers
  const [plan, setPlan] = useState(null); // { terminId: [Namen] }
  const [laedt, setLaedt] = useState(false);
  async function vorschlagen() {
    setLaedt(true);
    const r = await callAuthed("umfrage", { action: "einteilungVorschlag", id: u.id });
    setLaedt(false);
    if (r.ok) { setV(r.data); setPlan(r.data.plan); } else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Vorschlag nicht möglich.");
  }
  useEffect(() => { vorschlagen(); }, []);
  const frei = u.termine.filter((t) => !t.vergeben);
  if (!v || !plan) return <div style={{ ...styles.capacityBox, marginTop: 12 }}><div style={klein}>Einteilung wird berechnet …</div></div>;
  const eingeteilt = new Set(Object.values(plan).flat());
  const alle = Object.keys(v.verfuegbar || {});
  const ohne = alle.filter((n) => !eingeteilt.has(n)).sort((a, b) => a.localeCompare(b, "de"));
  const grund = (n) => ((v.ohne || []).find((x) => x.name === n) || {}).grund || "Von Hand herausgenommen.";
  const strecke = (n) => (v.strecke || {})[n] ? `Strecke zuletzt ${datumLang(v.strecke[n])}` : "noch kein Streckendurchgang eingetragen";
  const kann = (n, tid) => ((v.verfuegbar || {})[n] || []).includes(tid);
  const verschieben = (n, ziel) => setPlan((p) => {
    const neu = {}; Object.entries(p).forEach(([tid, ns]) => { neu[tid] = ns.filter((x) => x !== n); });
    if (ziel) neu[ziel] = [...(neu[ziel] || []), n].sort((a, b) => a.localeCompare(b, "de"));
    return neu;
  });
  const auswahl = (n, aktuell) => (
    <select aria-label={`${n} einteilen`} value={aktuell || ""} onChange={(e) => verschieben(n, e.target.value)} style={{ ...styles.input, marginTop: 0, padding: "4px 6px", fontSize: 12, width: "auto", maxWidth: 190 }}>
      <option value="">nicht einteilen</option>
      {frei.map((t) => <option key={t.id} value={t.id}>{datumLang(t.datum)}{kann(n, t.id) ? "" : " (nicht angegeben)"}</option>)}
    </select>
  );
  const gesamt = Object.values(plan).flat().length;
  return (
    <div data-testid="einteilung" style={{ ...styles.capacityBox, marginTop: 12, borderColor: "#1F4E79" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Einteilungsvorschlag</div>
      <div style={{ ...klein, marginTop: 4 }}>Jeder kommt nur einmal vor. Wer nur einen Tag kann, wurde zuerst eingeplant; bei Platzmangel haben die Vorrang, deren Streckendurchgang am längsten her ist. Möglichst zu zweit und bis zum Max aufgefüllt. Namen kannst du mit der Auswahl verschieben.</div>
      {(v.mehrfach || []).length > 0 && <div data-testid="mehrfach" style={{ fontSize: 12, marginTop: 8 }}><b>Mehrfach eingetragen:</b> {v.mehrfach.map((m) => `${m.name} (${m.tage} Tage)`).join(", ")}</div>}
      {(v.nurEiner || []).length > 0 && <div style={{ fontSize: 12, marginTop: 4 }}><b>Können nur an einem Tag:</b> {v.nurEiner.join(", ")}</div>}
      {frei.map((t) => {
        const ns = plan[t.id] || []; const max = Number(t.max) > 0 ? Number(t.max) : 0;
        const farbe = max && ns.length > max ? "#C1272D" : ns.length === 1 ? "#E8A33D" : ns.length ? "#2E7D4F" : "#E2DFD6";
        return (
          <div key={t.id} data-testid="einteilung-termin" style={{ border: `1.5px solid ${farbe}`, borderRadius: 8, padding: "8px 10px", marginTop: 8, background: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{terminText(t)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: farbe === "#E2DFD6" ? "#8A8C86" : farbe }}>{ns.length}{max ? ` / ${max}` : ""} {ns.length === 1 ? "Person" : "Personen"}</div>
            </div>
            {ns.length === 1 && <div style={{ fontSize: 11.5, color: "#9A5B00", marginTop: 2 }}>Nur eine Person – es ließ sich niemand dazu einteilen.</div>}
            {max > 0 && ns.length > max && <div style={{ fontSize: 11.5, color: "#C1272D", marginTop: 2 }}>Mehr als {max} Personen.</div>}
            {ns.length === 0 && <div style={{ ...klein, marginTop: 2 }}>Niemand eingeteilt – der Termin entfällt.</div>}
            {ns.map((n) => (
              <div key={n} data-testid="einteilung-name" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 120px", fontSize: 13 }}>{n}{!kann(n, t.id) && <span style={{ color: "#C1272D", fontSize: 11 }}> · hat diesen Tag nicht angegeben</span>}<br /><span style={{ ...klein, fontSize: 10.5 }}>{strecke(n)}</span></span>
                {auswahl(n, t.id)}
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>{ohne.length ? `Nicht eingeteilt (${ohne.length})` : "Alle sind eingeteilt."}</div>
      {ohne.map((n) => (
        <div key={n} data-testid="nicht-eingeteilt" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 120px", fontSize: 13 }}>{n}<br /><span style={{ ...klein, fontSize: 10.5 }}>{grund(n)}</span></span>
          {auswahl(n, "")}
        </div>
      ))}
      <div style={{ ...klein, marginTop: 10 }}>{gesamt} {gesamt === 1 ? "Person" : "Personen"} auf {Object.values(plan).filter((x) => x.length).length} Termine verteilt. Termine ohne Teilnehmer entfallen. Die Eingeteilten bekommen eine Benachrichtigung.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button style={knopfRot} disabled={busy || gesamt === 0} onClick={() => onUebernehmen(plan)}>{busy ? "Speichert …" : "In den Kalender übernehmen"}</button>
        <button style={knopf} disabled={busy || laedt} onClick={vorschlagen}>Neu vorschlagen</button>
        <button style={knopf} disabled={busy} onClick={onOhne}>Ohne Termin beenden</button>
        <button style={knopf} disabled={busy} onClick={onZurueck}>Zurück</button>
      </div>
    </div>
  );
}

// ---------------- Umfrage ansehen / abstimmen / abschließen ----------------
function Detail({ u, onBack, onNeuLaden, onGeloescht }) {
  const { callAuthed, flashError, events, persistEvents, me } = useApp();
  const [antw, setAntw] = useState(() => ({ ...(u.meine || {}) }));
  const [busy, setBusy] = useState(false);
  const [abschluss, setAbschluss] = useState(null); // null | Set der zu bestätigenden Termin-IDs
  const [loeschen, setLoeschen] = useState(false);
  const [hinweis, setHinweis] = useState("");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [planen, setPlanen] = useState(false);
  const einteilung = u.modus === "einteilung";
  useEffect(() => { setAntw({ ...(u.meine || {}) }); }, [u.id, JSON.stringify(u.meine || {})]);
  const geaendert = JSON.stringify(antw) !== JSON.stringify(u.meine || {});
  const bestaetigtIds = new Set((u.bestaetigt || []).map((b) => b.terminId));
  // Kalendertermine übernehmen (ohne Doppelte): nur die, die im Kalender noch fehlen
  async function insKalender(neue) {
    const vorhanden = new Set((events || []).map((e) => e.id));
    const fehlend = (neue || []).filter((e) => !vorhanden.has(e.id));
    if (!fehlend.length) return 0;
    await persistEvents([...(events || []), ...fehlend].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    return fehlend.length;
  }
  const fehlendImKalender = u.status === "abgeschlossen" && u.darfVerwalten ? (u.termineKalender || []).filter((e) => !(events || []).some((x) => x.id === e.id)).length : 0;

  async function speichern() {
    setBusy(true);
    const antworten = {}; u.termine.forEach((t) => { if ((antw[t.id] || null) !== ((u.meine || {})[t.id] || null)) antworten[t.id] = antw[t.id] || null; });
    const r = await callAuthed("umfrage", { action: "vote", id: u.id, antworten });
    setBusy(false);
    if (r.ok) { setHinweis("Deine Antwort ist gespeichert."); onNeuLaden(); } else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich.");
  }
  async function abschliessen(termine, plan) {
    setBusy(true);
    const r = await callAuthed("umfrage", { action: "abschliessen", id: u.id, termine, ...(plan ? { einteilung: plan } : {}) });
    if (r.ok) {
      const n = await insKalender(r.data.termineKalender);
      setBusy(false); setAbschluss(null); setPlanen(false);
      setHinweis(n ? `Abgeschlossen: ${n} ${n === 1 ? "Termin steht" : "Termine stehen"} jetzt im Kalender.` : "Umfrage beendet, kein Termin übernommen.");
      onNeuLaden();
    } else { setBusy(false); if (r.data.error !== "abgebrochen") flashError(r.data.error || "Abschließen nicht möglich."); }
  }
  async function nochmalKalender() {
    setBusy(true);
    const r = await callAuthed("umfrage", { action: "kalender", id: u.id });
    if (r.ok) { const n = await insKalender(r.data.termineKalender); setHinweis(`${n} ${n === 1 ? "Termin" : "Termine"} in den Kalender übernommen.`); onNeuLaden(); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Übernahme nicht möglich.");
    setBusy(false);
  }
  async function entfernen() {
    setBusy(true);
    const r = await callAuthed("umfrage", { action: "delete", id: u.id });
    setBusy(false);
    if (r.ok) onGeloescht(u.id); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  const s = stand(u);
  const wahlKnopf = (t, wert, text) => {
    const an = antw[t.id] === wert;
    const farbe = wert === "ja" ? "#2E7D4F" : "#C1272D";
    return <button aria-pressed={an} aria-label={`${terminText(t)}: ${wert === "ja" ? "Ja" : "Nein"}`} onClick={() => setAntw((a) => { const n = { ...a }; if (n[t.id] === wert) delete n[t.id]; else n[t.id] = wert; return n; })}
      style={{ ...knopf, flex: 1, padding: "9px 6px", background: an ? farbe : "white", color: an ? "white" : farbe, border: `1.5px solid ${farbe}` }}>{text}</button>;
  };

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Terminumfragen</button></div>
      <div style={styles.modalTitle}>{u.titel}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}><BereichPille bereich={u.bereich} />{einteilung && <Pille text="Einteilung" farbe="#1F4E79" grund="#E3EDF7" />}<Pille {...s} />{CATEGORIES[u.kategorie] && <span style={klein}>{CATEGORIES[u.kategorie].label}</span>}</div>
      <div style={{ ...klein, marginTop: 6 }}>
        {[u.ort ? `Ort: ${u.ort}` : "", fristText(u), `von ${u.erstelltVon}`, `${u.abgestimmt} von ${u.mitglieder} haben abgestimmt`].filter(Boolean).join(" · ")}
      </div>
      {u.hinweis && <div style={{ fontSize: 12.5, color: "#2C2F2A", marginTop: 6 }}>{u.hinweis}</div>}
      {hinweis && <div style={{ fontSize: 12.5, color: "#2E7D4F", marginTop: 8 }}>{hinweis}</div>}
      {einteilung && u.status === "offen" && <div data-testid="einteilung-hinweis" style={{ fontSize: 12.5, color: "#1F4E79", background: "#E3EDF7", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>Einteilung: Bitte <b>alle</b> Tage angeben, an denen du kannst. Jeder wird nur <b>einmal</b> eingeteilt – je mehr Tage, desto besser lässt sich verteilen.</div>}

      <div style={abschnitt}>{u.darfAbstimmen ? "DEINE ANTWORT" : "TERMINVORSCHLÄGE"}</div>
      {u.termine.map((t) => {
        const ja = (u.ja || {})[t.id] || [], nein = (u.nein || {})[t.id] || [], warte = (u.warte || {})[t.id] || [];
        const max = Number(t.max) > 0 ? Number(t.max) : 0;
        const voll = !einteilung && !!max && ja.length >= max;
        const meinePlatz = warte.indexOf(me) >= 0 ? warte.indexOf(me) + 1 : 0;
        const bestaetigt = bestaetigtIds.has(t.id);
        return (
          <div key={t.id} data-testid="termin-karte" style={{ ...styles.capacityBox, marginTop: 8, opacity: t.vergeben ? 0.55 : 1, borderColor: bestaetigt ? "#2E7D4F" : abschluss && abschluss.has(t.id) ? "#C1272D" : "#E2DFD6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {abschluss && <input type="checkbox" aria-label={`${terminText(t)} bestätigen`} checked={abschluss.has(t.id)} onChange={() => setAbschluss((a) => { const n = new Set(a); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} style={{ width: 20, height: 20 }} />}
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{terminText(t)}</div>
              {bestaetigt && <Pille text="Bestätigt" farbe="white" grund="#2E7D4F" />}
              {t.vergeben && <Pille text="Nicht mehr frei" farbe="#5C5F58" grund="#EEEEEC" />}
              <div style={{ fontSize: 12, fontWeight: 700 }}><span style={{ color: "#2E7D4F" }}>{einteilung ? `${ja.length} können${max ? ` · max. ${max}` : ""}` : max ? `${ja.length} von ${max} Plätzen` : `${ja.length} Ja`}</span> · <span style={{ color: "#C1272D" }}>{nein.length} Nein</span></div>
            </div>
            {max > 0 && (voll || warte.length > 0) && <div style={{ ...klein, marginTop: 4, color: "#9A5B00" }}>{voll ? "Alle Plätze belegt" : ""}{warte.length > 0 ? `${voll ? " · " : ""}${warte.length} auf der Warteliste` : ""}</div>}
            {meinePlatz > 0 && <div data-testid="meine-warteliste" style={{ fontSize: 12, fontWeight: 700, color: "#9A5B00", marginTop: 4 }}>Du stehst auf der Warteliste (Platz {meinePlatz}).</div>}
            {u.darfAbstimmen && !t.vergeben && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>{wahlKnopf(t, "ja", einteilung ? "Ich kann" : voll && ja.indexOf(me) < 0 ? "Ja (Warteliste)" : "Ja")}{wahlKnopf(t, "nein", einteilung ? "Kann nicht" : "Nein")}</div>}
            {(ja.length > 0 || nein.length > 0 || warte.length > 0) && (
              <div data-testid="termin-namen" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>
                {ja.length > 0 && <div><b style={{ color: "#2E7D4F" }}>{einteilung ? "Können:" : max ? "Dabei:" : "Ja:"}</b> {ja.join(", ")}</div>}
                {warte.length > 0 && <div><b style={{ color: "#9A5B00" }}>Warteliste:</b> {warte.map((n, k) => `${k + 1}. ${n}`).join(", ")}</div>}
                {nein.length > 0 && <div><b style={{ color: "#C1272D" }}>Nein:</b> {nein.join(", ")}</div>}
              </div>
            )}
          </div>
        );
      })}
      {u.darfAbstimmen && !abschluss && !planen && (
        <button style={{ ...knopfRot, width: "100%", marginTop: 12 }} disabled={busy || !geaendert} onClick={speichern}><Check size={16} /> {busy ? "Speichert …" : "Meine Antwort speichern"}</button>
      )}
      {u.status === "offen" && !u.darfAbstimmen && !u.darfVerwalten && <div style={{ ...klein, marginTop: 10 }}>{u.abstimmenBis && u.abstimmenBis < heuteLokal() ? "Die Abstimmung ist beendet." : "Du kannst bei dieser Umfrage nicht abstimmen."}</div>}

      {u.status === "offen" && u.darfVerwalten && !abschluss && !planen && !bearbeiten && (
        <>
          <button style={{ ...knopf, width: "100%", marginTop: 8 }} onClick={() => setBearbeiten(true)}>Max. Personen / freie Termine ändern …</button>
          {einteilung
            ? <button style={{ ...knopfRot, width: "100%", marginTop: 8 }} onClick={() => setPlanen(true)}>Einteilung vorschlagen …</button>
            : <button style={{ ...knopf, width: "100%", marginTop: 8 }} onClick={() => setAbschluss(new Set())}>Umfrage abschließen …</button>}
        </>
      )}
      {bearbeiten && <TermineBearbeiten u={u} onFertig={(ok) => { setBearbeiten(false); if (ok) { setHinweis("Termine geändert."); onNeuLaden(); } }} />}
      {planen && <EinteilungPlanen u={u} busy={busy} onZurueck={() => setPlanen(false)} onUebernehmen={(plan) => abschliessen([], plan)} onOhne={() => abschliessen([])} />}
      {abschluss && (
        <div style={{ ...styles.capacityBox, marginTop: 12, borderColor: "#C1272D" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Welche Termine finden statt?</div>
          <div style={{ ...klein, marginTop: 4 }}>Haken bei den Terminen setzen (einer oder mehrere). Sie kommen in den Kalender, die Kameraden mit „Ja“ sind dort automatisch zugesagt. Die Umfrage ist danach beendet.</div>
          {[...abschluss].length > 0 && <div style={{ fontSize: 12, marginTop: 6 }}>{[...abschluss].length} {[...abschluss].length === 1 ? "Termin" : "Termine"} gewählt, {new Set(u.termine.filter((t) => abschluss.has(t.id)).flatMap((t) => (u.ja || {})[t.id] || [])).size} Personen eingeteilt.</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button style={knopfRot} disabled={busy || abschluss.size === 0} onClick={() => abschliessen([...abschluss])}>{busy ? "Speichert …" : "In den Kalender übernehmen"}</button>
            <button style={knopf} disabled={busy} onClick={() => abschliessen([])}>Ohne Termin beenden</button>
            <button style={knopf} disabled={busy} onClick={() => setAbschluss(null)}>Zurück</button>
          </div>
        </div>
      )}

      {u.status === "abgeschlossen" && (
        <>
          <div style={abschnitt}>ERGEBNIS</div>
          {(u.bestaetigt || []).length === 0 && <div style={klein}>Es wurde kein Termin übernommen.</div>}
          {(u.bestaetigt || []).map((b) => { const t = u.termine.find((x) => x.id === b.terminId); return t ? <div key={b.terminId} style={{ fontSize: 12.5, marginBottom: 4 }}><b>{terminText(t)}</b> – eingeteilt: {b.namen.length ? b.namen.join(", ") : "niemand"}</div> : null; })}
          <div style={{ ...klein, marginTop: 4 }}>Abgeschlossen von {u.abgeschlossenVon}.</div>
          {fehlendImKalender > 0 && <button style={{ ...knopfRot, width: "100%", marginTop: 8 }} disabled={busy} onClick={nochmalKalender}>{fehlendImKalender === 1 ? "1 Termin fehlt im Kalender – jetzt übernehmen" : `${fehlendImKalender} Termine fehlen im Kalender – jetzt übernehmen`}</button>}
        </>
      )}

      {u.darfVerwalten && <div style={{ marginTop: 16 }}><button style={{ ...styles.deleteBtn, fontSize: 12.5 }} onClick={() => setLoeschen(true)}><Trash2 size={13} /> Umfrage löschen</button></div>}
      {loeschen && (
        <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={() => setLoeschen(false)}>
          <div style={styles.confirmDialog} onClick={(e) => e.stopPropagation()} className="card-enter" role="dialog" aria-label="Umfrage löschen">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Umfrage „{u.titel}“ löschen?</div>
            <div style={{ fontSize: 12, color: "#8A8C86", marginBottom: 14 }}>Die Umfrage und alle Antworten werden gelöscht. Bereits übernommene Kalendertermine bleiben erhalten.</div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setLoeschen(false)}>Abbrechen</button>
              <button style={{ ...styles.saveBtn, flex: 1 }} disabled={busy} onClick={entfernen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

// ---------------- Kachel ----------------
export default function UmfrageKachel() {
  const { me, callAuthed, closeKachelView, kachelReturnTo, ladeUmfrageStatus } = useApp();
  const cacheKey = `umfragen:${me}`;
  const [daten, setDaten] = useState(() => hole(cacheKey));
  const [fehler, setFehler] = useState("");
  const [view, setView] = useState({ name: "liste" });
  const [archiv, setArchiv] = useState(false);
  async function laden() {
    const r = await callAuthed("umfrage", { action: "list" });
    if (r.ok) { setDaten(r.data); merke(cacheKey, r.data); setFehler(""); if (ladeUmfrageStatus) ladeUmfrageStatus(); } // Zahl am Symbol „Funktionen“ aktualisieren
    else if (r.data.error === "abgebrochen") { if (!daten) closeKachelView(); }
    else setFehler(r.data.error || "Die Umfragen konnten nicht geladen werden.");
  }
  useEffect(() => { laden(); }, []);
  const umfragen = (daten && daten.umfragen) || [];
  const rechte = (daten && daten.rechte) || { anlegen: [], bereiche: [] };
  const offen = useMemo(() => umfragen.filter((u) => u.status === "offen"), [daten]);
  const zu = useMemo(() => umfragen.filter((u) => u.status !== "offen"), [daten]);

  if (view.name === "neu") return <NeueUmfrage rechte={rechte} onClose={() => setView({ name: "liste" })} onSaved={async (id) => { await laden(); setView({ name: "detail", id }); }} />;
  if (view.name === "detail") {
    const u = umfragen.find((x) => x.id === view.id);
    if (u) return <Detail u={u} onBack={() => { setView({ name: "liste" }); laden(); }} onNeuLaden={laden} onGeloescht={(id) => { setDaten((d) => ({ ...d, umfragen: d.umfragen.filter((x) => x.id !== id) })); setView({ name: "liste" }); laden(); }} />;
  }
  const zeile = (u) => {
    const s = stand(u);
    return (
      <button key={u.id} data-testid="umfrage-zeile" style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10 }} onClick={() => setView({ name: "detail", id: u.id })}>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{u.titel}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86", fontWeight: 400 }}>
            {[BEREICHE[u.bereich] ? BEREICHE[u.bereich].label : "", `${u.termine.length} Terminvorschläge`, `${u.abgestimmt}/${u.mitglieder} abgestimmt`, fristText(u)].filter(Boolean).join(" · ")}
          </span>
        </span>
        {u.modus === "einteilung" && <Pille text="Einteilung" farbe="#1F4E79" grund="#E3EDF7" />}
        <Pille {...s} />
      </button>
    );
  };
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Terminumfragen</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {!daten && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          {rechte.anlegen.length > 0 && <button style={{ ...knopfRot, width: "100%", margin: "10px 0" }} onClick={() => setView({ name: "neu" })}><Plus size={16} /> Neue Umfrage</button>}
          <div style={abschnitt}>OFFEN ({offen.length})</div>
          {offen.length === 0 && <div style={klein}>Keine offenen Umfragen.</div>}
          {offen.map(zeile)}
          {zu.length > 0 && (
            <>
              <button style={{ ...styles.tinyBtn, marginTop: 14, fontSize: 12, padding: "6px 10px" }} aria-expanded={archiv} onClick={() => setArchiv((a) => !a)}>Abgeschlossen ({zu.length}) {archiv ? "ausblenden" : "anzeigen"}</button>
              {archiv && <div style={{ marginTop: 8 }}>{zu.map(zeile)}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
