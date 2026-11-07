// Kachel „Verbandbuch“ (seit 2.38): Dokumentation von Erste-Hilfe-Leistungen und Vorfällen (DGUV Vorschrift 1 § 24).
// Vertrauliche Gesundheitsdaten: Was wer sehen darf, entscheidet allein der Server (netlify/functions/verbandbuch.js).
// Die Daten bleiben nur im Arbeitsspeicher der App (nicht dauerhaft auf dem Handy gespeichert).
import React, { useEffect, useState } from "react";
import { ArrowLeft, ClipboardPlus, Plus, Printer, X } from "lucide-react";
import { styles } from "../lib/styles";
import { useApp } from "../AppContext";
import { hole, merke } from "../lib/zwischenspeicher";
import { bereiteFensterVor, oeffneBericht } from "../lib/bericht";

const VERLETZUNGEN = ["Schürfwunde", "Schnittwunde", "Prellung", "Verstauchung", "Fremdkörper im Auge", "Verbrennung", "Stichverletzung", "Knochenbruch (Verdacht)", "Kreislaufbeschwerden", "Hitzeerschöpfung", "Sonstiges"];
const MASSNAHMEN = ["Pflaster", "Verband", "Kühlen", "Wundreinigung", "Ruhigstellung", "Augenspülung", "Beobachtung", "Rettungsdienst gerufen", "Arzt / Krankenhaus"];
const MATERIAL = ["Pflaster", "Wundschnellverband", "Mullbinde", "Verbandpäckchen", "Dreiecktuch", "Kältepack", "Desinfektionstuch", "Einmalhandschuhe", "Rettungsdecke", "Augenspülung"];
const ARTEN = { erste_hilfe: "Erste Hilfe geleistet", vorfall: "Nur Vorfall (keine Behandlung)" };
const ANLAESSE = { uebung: "Übung", einsatz: "Einsatz", geraetehaus: "Gerätehaus / Arbeitsdienst", sonstiges: "Sonstiges" };
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const AKTIONEN = { angelegt: "angelegt", geaendert: "geändert", ergaenzt: "ergänzt", antwort: "Antwort auf Nachfrage", nachfrage: "Nachfrage", geloescht: "gelöscht" };
const aktionText = (a) => AKTIONEN[a] || a;
const klein = { fontSize: 11.5, color: "#8A8C86" };
const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.05em", margin: "16px 0 4px" };

const zeitDe = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); };
const datumKurz = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); };
const datumDe = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const jetztLokal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const lokalAusIso = (iso) => { const d = new Date(iso); if (isNaN(d)) return jetztLokal(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const jahrVon = (iso) => String(new Date(iso).getFullYear());

// ---------------- Berichte (Drucken / PDF) ----------------
const FUSS = "Vertraulich – enthält Gesundheitsdaten. Aufbewahrung 5 Jahre (DGUV Vorschrift 1 § 24).";
function eintragBericht(e, protokoll) {
  const felder = [
    { label: "Lfd. Nr.", value: String(e.nr) }, { label: "Art", value: ARTEN[e.art] || "" },
    { label: "Verletzte Person", value: e.person }, { label: "Datum / Uhrzeit", value: zeitDe(e.ts) },
    { label: "Anlass", value: ANLAESSE[e.anlass] || "" }, { label: "Ort", value: e.ort },
    { label: "Ersthelfer", value: e.ersthelfer || "–" }, { label: "Zeugen", value: e.zeugen },
    { label: "Unfallanzeige", value: e.unfallanzeige && e.unfallanzeige.erstattet ? `erstattet${e.unfallanzeige.datum ? ` am ${datumDe(e.unfallanzeige.datum)}` : ""}` : "nicht erstattet" },
  ];
  if (e.verknuepfung) felder.push({ label: "Verknüpft mit", value: `${e.verknuepfung.art === "einsatz" ? "Einsatz" : "Termin"}: ${e.verknuepfung.titel}${e.verknuepfung.datum ? ` (${datumDe(e.verknuepfung.datum)})` : ""}` });
  const blocks = [{ t: "felder", items: felder }, { t: "h3", text: "Hergang" }, { t: "text", text: e.hergang }];
  const verl = [...(e.verletzungArten || []), e.verletzung].filter(Boolean).join(" · ");
  const mass = [...(e.massnahmeArten || []), e.massnahme].filter(Boolean).join(" · ");
  blocks.push({ t: "h3", text: "Art und Umfang der Verletzung" }, { t: "text", text: verl || "– (keine Behandlung nötig)" });
  blocks.push({ t: "h3", text: "Erste-Hilfe-Maßnahmen" }, { t: "text", text: mass || "–" });
  if ((e.material || []).length) blocks.push({ t: "h3", text: "Verbrauchtes Material" }, { t: "text", text: e.material.join(", ") });
  if ((e.ergaenzungen || []).length) blocks.push({ t: "h3", text: "Ergänzungen" }, { t: "tabelle", kopf: ["Datum", "Von", "Text"], breiten: [1.6, 1.4, 5], zeilen: e.ergaenzungen.map((x) => [zeitDe(x.ts), x.von, x.text]) });
  if (protokoll && protokoll.length) blocks.push({ t: "h3", text: "Änderungsprotokoll" }, { t: "tabelle", kopf: ["Datum", "Von", "Aktion", "Einzelheiten"], breiten: [1.6, 1.3, 1.1, 4.5], zeilen: protokoll.map((p) => [zeitDe(p.ts), p.von, aktionText(p.aktion), Array.isArray(p.details) ? p.details.map((d) => `${d.feld}: ${d.alt} → ${d.neu}`).join("; ") : (p.details || "")]) });
  return { titel: `Verbandbuch Nr. ${e.nr}`, untertitel: `Dokumentation von Erste-Hilfe-Leistungen · ${e.person} · ${datumKurz(e.ts)}`, dateiname: `Verbandbuch_Nr_${e.nr}`, fuss: FUSS, blocks };
}
function auszugBericht(liste, jahr, mitNamen) {
  const zeilen = liste.map((e) => [String(e.nr), zeitDe(e.ts), mitNamen ? e.person : "", ARTEN[e.art] === ARTEN.vorfall ? "Vorfall" : "Erste Hilfe", ANLAESSE[e.anlass] || "", [...(e.verletzungArten || []), e.verletzung].filter(Boolean).join(", ") || "–", e.unfallanzeige && e.unfallanzeige.erstattet ? "ja" : ""]);
  const kopf = ["Nr.", "Datum", "Person", "Art", "Anlass", "Verletzung", "UA"];
  return { titel: `Verbandbuch ${jahr}`, untertitel: `Jahresauszug ${jahr} · ${liste.length} Einträge · Stand ${datumKurz(new Date().toISOString())}`, dateiname: `Verbandbuch_${jahr}`, fuss: FUSS, blocks: [{ t: "text", text: "UA = Unfallanzeige an die Unfallkasse erstattet.", klein: true, grau: true }, { t: "tabelle", kopf, breiten: [0.7, 1.7, 1.5, 1.2, 1.5, 2.6, 0.5], zeilen }] };
}
function auswertungBericht(a) {
  const blocks = [
    { t: "kpis", items: [{ value: String(a.gesamt), label: "Einträge" }, { value: String(a.arten.erste_hilfe), label: "Erste Hilfe" }, { value: String(a.arten.vorfall), label: "Nur Vorfall" }, { value: String(a.unfallanzeigen), label: "Unfallanzeigen" }] },
    { t: "h3", text: "Nach Anlass" },
    { t: "balken", zeilen: Object.keys(ANLAESSE).map((k) => ({ label: ANLAESSE[k], value: a.anlaesse[k] || 0, max: Math.max(1, a.gesamt), color: "#C1272D", rechts: String(a.anlaesse[k] || 0) })) },
    { t: "h3", text: "Nach Monat" },
    { t: "balken", zeilen: MONATE.map((m, i) => ({ label: m, value: a.monate[i], max: Math.max(1, ...a.monate), color: "#4A6670", rechts: String(a.monate[i]) })) },
  ];
  const verl = Object.entries(a.verletzungen).sort((x, y) => y[1] - x[1]);
  if (verl.length) blocks.push({ t: "h3", text: "Häufigste Verletzungen" }, { t: "tabelle", kopf: ["Verletzung", "Anzahl"], breiten: [4, 1], zeilen: verl.map(([k, n]) => [k, String(n)]) });
  blocks.push({ t: "text", text: `Davon Jugendfeuerwehr: ${a.jugend} · Meldungen von Beschwerden nach der Nachfrage: ${a.beschwerden}. Die Auswertung enthält keine Namen.`, klein: true, grau: true });
  return { titel: `Verbandbuch – Auswertung ${a.jahr}`, untertitel: `Zahlen ohne Namen · ${a.jahr}`, dateiname: `Verbandbuch_Auswertung_${a.jahr}`, fuss: "Auswertung ohne personenbezogene Angaben.", blocks };
}

// ---------------- Bausteine ----------------
function Chips({ liste, wert, onToggle, testId }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} data-testid={testId}>
      {liste.map((k) => {
        const an = wert.includes(k);
        return <button key={k} type="button" data-testid={`${testId}:${k}`} onClick={() => onToggle(k)} style={{ ...styles.categoryChip, fontSize: 12, padding: "5px 10px", background: an ? "#2C2F2A" : "#F3F1EC", color: an ? "white" : "#5C5F58", borderColor: an ? "#2C2F2A" : "#E2DFD6" }}>{k}</button>;
      })}
    </div>
  );
}
const umschalten = (liste, k) => (liste.includes(k) ? liste.filter((x) => x !== k) : [...liste, k]);

// Rückmeldung auf „Geht es dir gut?“
function NachfrageBox({ e, onDone }) {
  const { callAuthed, flashError } = useApp();
  const [beschwerden, setBeschwerden] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function senden(ergebnis) {
    setBusy(true);
    const r = await callAuthed("verbandbuch", { action: "nachfrageAntwort", id: e.id, ergebnis, text });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt."); return; }
    onDone();
  }
  return (
    <div data-testid={`nachfrage-${e.id}`} style={{ background: "#FFF7E6", border: "1px solid #EBC77A", borderRadius: 8, padding: "10px 12px", margin: "10px 0" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>🩹 Geht es dir gut?</div>
      <div style={{ ...klein, margin: "2px 0 8px" }}>Nachfrage zu deinem Eintrag Nr. {e.nr} vom {datumKurz(e.ts)}.</div>
      {!beschwerden ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.saveBtn, background: "#2E7D4F" }} disabled={busy} data-testid="nachfrage-gut" onClick={() => senden("gut")}>Alles gut</button>
          <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} disabled={busy} data-testid="nachfrage-beschwerden" onClick={() => setBeschwerden(true)}>Beschwerden</button>
        </div>
      ) : (
        <>
          <textarea style={{ ...styles.input, minHeight: 60 }} data-testid="nachfrage-text" maxLength={1000} placeholder="Welche Beschwerden hast du?" value={text} onChange={(x) => setText(x.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={{ ...styles.deleteBtn, justifyContent: "center" }} disabled={busy} onClick={() => setBeschwerden(false)}>Zurück</button>
            <button style={styles.saveBtn} disabled={busy || !text.trim()} data-testid="nachfrage-senden" onClick={() => senden("beschwerden")}>Senden</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Formular ----------------
function EintragFormular({ start, daten, onClose, onSaved }) {
  const { me, callAuthed, events } = useApp();
  const neu = !start.id;
  const [f, setF] = useState(() => neu ? {
    art: "erste_hilfe", person: (daten.personen || []).some((p) => p.name === me) ? me : "", ts: jetztLokal(), anlass: "", ort: "", hergang: "", zeugen: "",
    verletzungArten: [], verletzung: "", massnahmeArten: [], massnahme: "", material: [], materialText: "", ersthelfer: me,
    unfallanzeige: false, unfallanzeigeDatum: "", verknuepfung: "", nachfrage: false, benachrichtigen: false,
  } : {
    ...start, ts: lokalAusIso(start.ts), material: (start.material || []).filter((m) => MATERIAL.includes(m)), materialText: (start.material || []).filter((m) => !MATERIAL.includes(m)).join(", "),
    unfallanzeige: !!(start.unfallanzeige && start.unfallanzeige.erstattet), unfallanzeigeDatum: (start.unfallanzeige && start.unfallanzeige.datum) || "",
    verknuepfung: start.verknuepfung ? `${start.verknuepfung.art}:${start.verknuepfung.id}` : "", nachfrage: !!(start.nachfrage && start.nachfrage.aktiv), benachrichtigen: false,
  });
  const [einsaetze, setEinsaetze] = useState([]);
  const [fehlerText, setFehlerText] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const nachfrageGesperrt = !neu && !!(start.nachfrage && start.nachfrage.gefragt);
  useEffect(() => { // Einsatzberichte zum Verknüpfen (nur wer die Kachel „Einsatzberichte“ nutzen darf)
    let aktiv = true;
    callAuthed("einsatzbericht", { action: "list" }).then((r) => { if (aktiv && r.ok && r.data && Array.isArray(r.data.items)) setEinsaetze(r.data.items.slice(0, 40)); }).catch(() => {});
    return () => { aktiv = false; };
  }, []);
  const heute = new Date().toLocaleDateString("sv-SE");
  const vor120 = new Date(Date.now() - 120 * 86400000).toLocaleDateString("sv-SE");
  const termine = (events || []).filter((e) => e && e.date && e.date <= heute && e.date >= vor120).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);
  const verknuepfungOptionen = [...(start.verknuepfung && !termine.some((t) => `termin:${t.id}` === f.verknuepfung) && !einsaetze.some((t) => `einsatz:${t.id}` === f.verknuepfung) ? [start.verknuepfung] : [])];
  function waehleVerknuepfung(v) {
    set("verknuepfung", v);
    const [art, id] = [v.split(":")[0], v.slice(v.indexOf(":") + 1)];
    if (art === "termin") { const t = termine.find((x) => String(x.id) === id); if (t && !f.anlass) setF((x) => ({ ...x, verknuepfung: v, anlass: t.category === "uebung" ? "uebung" : x.anlass })); }
    if (art === "einsatz" && !f.anlass) setF((x) => ({ ...x, verknuepfung: v, anlass: "einsatz" }));
  }
  function verknuepfungObjekt() {
    if (!f.verknuepfung) return null;
    const art = f.verknuepfung.split(":")[0], id = f.verknuepfung.slice(f.verknuepfung.indexOf(":") + 1);
    if (art === "termin") { const t = termine.find((x) => String(x.id) === id); if (t) return { art, id: String(t.id), titel: t.title || "Termin", datum: t.date }; }
    if (art === "einsatz") { const t = einsaetze.find((x) => String(x.id) === id); if (t) return { art, id: String(t.id), titel: `${t.nummer || ""} ${t.einsatz || ""}`.trim(), datum: t.datum || "" }; }
    return start.verknuepfung && `${start.verknuepfung.art}:${start.verknuepfung.id}` === f.verknuepfung ? start.verknuepfung : null;
  }
  async function speichern() {
    setFehlerText("");
    const eh = f.art === "erste_hilfe";
    if (!f.person) return setFehlerText("Bitte die verletzte Person wählen.");
    if (!f.anlass) return setFehlerText("Bitte den Anlass wählen.");
    if (!f.ort.trim()) return setFehlerText("Bitte den Ort angeben.");
    if (!f.hergang.trim()) return setFehlerText("Bitte den Hergang beschreiben.");
    if (!f.zeugen.trim()) return setFehlerText("Bitte Zeugen angeben – wenn es keine gab: „keine“.");
    if (eh && !f.verletzungArten.length && !f.verletzung.trim()) return setFehlerText("Bitte Art und Umfang der Verletzung angeben.");
    if (eh && !f.massnahmeArten.length && !f.massnahme.trim()) return setFehlerText("Bitte die Erste-Hilfe-Maßnahme angeben.");
    setBusy(true);
    const eintrag = {
      id: f.id, art: f.art, person: f.person, ts: new Date(f.ts).toISOString(), anlass: f.anlass, ort: f.ort, hergang: f.hergang, zeugen: f.zeugen,
      verletzungArten: f.verletzungArten, verletzung: f.verletzung, massnahmeArten: f.massnahmeArten, massnahme: f.massnahme,
      material: [...f.material, ...f.materialText.split(",").map((m) => m.trim()).filter(Boolean)], ersthelfer: f.ersthelfer,
      unfallanzeige: { erstattet: f.unfallanzeige, datum: f.unfallanzeigeDatum }, verknuepfung: verknuepfungObjekt(), nachfrage: f.nachfrage, benachrichtigen: f.benachrichtigen,
    };
    const r = await callAuthed("verbandbuch", { action: "save", eintrag });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Speichern nicht möglich."); return; }
    onSaved(r.data);
  }
  const eh = f.art === "erste_hilfe";
  return (
    <div style={styles.modalBackdrop} onClick={onClose} data-testid="verbandbuch-formular">
      <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{neu ? "Neuer Eintrag" : `Eintrag Nr. ${start.nr} ändern`}</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        {!neu && <div style={{ ...klein, marginBottom: 6 }}>Jede Änderung wird mit Name und Zeitpunkt im Protokoll festgehalten.</div>}
        <div style={styles.formBody}>
          <label style={styles.label}>Art des Eintrags</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(ARTEN).map(([k, l]) => <button key={k} type="button" data-testid={`art-${k}`} onClick={() => set("art", k)} style={{ ...styles.categoryChip, background: f.art === k ? "#2C2F2A" : "#F3F1EC", color: f.art === k ? "white" : "#5C5F58", borderColor: f.art === k ? "#2C2F2A" : "#E2DFD6" }}>{l}</button>)}
          </div>
          {!eh && <div style={{ ...klein, marginTop: 4 }}>Zur Absicherung, falls später etwas auftritt – z. B. jemand ist gefallen, es musste aber nichts behandelt werden.</div>}
          <label style={styles.label}>Verletzte Person</label>
          {neu ? (
            <select style={styles.input} data-testid="vb-person" value={f.person} onChange={(e) => set("person", e.target.value)}>
              <option value="">– bitte wählen –</option>
              {(daten.personen || []).map((p) => <option key={p.name} value={p.name}>{p.name === me ? `${p.name} (ich)` : p.name}{p.jugend ? " · Jugendfeuerwehr" : ""}</option>)}
            </select>
          ) : <div style={{ fontSize: 13.5 }}>{f.person}</div>}
          <label style={styles.label}>Datum und Uhrzeit</label>
          <input style={styles.input} type="datetime-local" data-testid="vb-ts" max={jetztLokal()} value={f.ts} onChange={(e) => set("ts", e.target.value)} />
          <label style={styles.label}>Anlass</label>
          <select style={styles.input} data-testid="vb-anlass" value={f.anlass} onChange={(e) => set("anlass", e.target.value)}>
            <option value="">– bitte wählen –</option>
            {Object.entries(ANLAESSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label style={styles.label}>Verknüpfen mit Termin oder Einsatz (optional)</label>
          <select style={styles.input} data-testid="vb-verknuepfung" value={f.verknuepfung} onChange={(e) => waehleVerknuepfung(e.target.value)}>
            <option value="">– keine –</option>
            {verknuepfungOptionen.map((v) => <option key={`${v.art}:${v.id}`} value={`${v.art}:${v.id}`}>{v.titel}</option>)}
            {termine.length > 0 && <optgroup label="Termine (letzte 4 Monate)">{termine.map((t) => <option key={t.id} value={`termin:${t.id}`}>{datumDe(t.date)} · {t.title}</option>)}</optgroup>}
            {einsaetze.length > 0 && <optgroup label="Einsätze">{einsaetze.map((t) => <option key={t.id} value={`einsatz:${t.id}`}>{datumDe(t.datum)} · {t.nummer} {t.einsatz}</option>)}</optgroup>}
          </select>
          <label style={styles.label}>Ort</label>
          <input style={styles.input} data-testid="vb-ort" maxLength={150} placeholder="z. B. Gerätehaus, Übungsplatz …" value={f.ort} onChange={(e) => set("ort", e.target.value)} />
          <label style={styles.label}>Hergang</label>
          <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} data-testid="vb-hergang" maxLength={2000} placeholder="Was ist passiert?" value={f.hergang} onChange={(e) => set("hergang", e.target.value)} />
          <label style={styles.label}>Art und Umfang der Verletzung{eh ? "" : " (freiwillig)"}</label>
          <Chips liste={VERLETZUNGEN} wert={f.verletzungArten} onToggle={(k) => set("verletzungArten", umschalten(f.verletzungArten, k))} testId="vb-verletzung" />
          <input style={{ ...styles.input, marginTop: 6 }} data-testid="vb-verletzung-text" maxLength={1000} placeholder="Weitere Angaben (z. B. linkes Knie, ca. 3 cm)" value={f.verletzung} onChange={(e) => set("verletzung", e.target.value)} />
          <label style={styles.label}>Erste-Hilfe-Maßnahme{eh ? "" : " (freiwillig)"}</label>
          <Chips liste={MASSNAHMEN} wert={f.massnahmeArten} onToggle={(k) => set("massnahmeArten", umschalten(f.massnahmeArten, k))} testId="vb-massnahme" />
          <input style={{ ...styles.input, marginTop: 6 }} data-testid="vb-massnahme-text" maxLength={1000} placeholder="Weitere Angaben" value={f.massnahme} onChange={(e) => set("massnahme", e.target.value)} />
          <label style={styles.label}>Verbrauchtes Material (freiwillig)</label>
          <Chips liste={MATERIAL} wert={f.material} onToggle={(k) => set("material", umschalten(f.material, k))} testId="vb-material" />
          <input style={{ ...styles.input, marginTop: 6 }} data-testid="vb-material-text" maxLength={200} placeholder="Weiteres Material, mit Komma getrennt" value={f.materialText} onChange={(e) => set("materialText", e.target.value)} />
          <label style={styles.label}>Zeugen</label>
          <input style={styles.input} data-testid="vb-zeugen" maxLength={300} placeholder="Namen – wenn keine: „keine“" value={f.zeugen} onChange={(e) => set("zeugen", e.target.value)} />
          <label style={styles.label}>Ersthelfer</label>
          <input style={styles.input} data-testid="vb-ersthelfer" maxLength={100} value={f.ersthelfer} onChange={(e) => set("ersthelfer", e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 12 }}>
            <input type="checkbox" data-testid="vb-unfallanzeige" checked={f.unfallanzeige} onChange={(e) => set("unfallanzeige", e.target.checked)} /> Unfallanzeige an die Unfallkasse erstattet
          </label>
          {f.unfallanzeige && <input style={{ ...styles.input, marginTop: 6 }} type="date" data-testid="vb-unfallanzeige-datum" value={f.unfallanzeigeDatum} onChange={(e) => set("unfallanzeigeDatum", e.target.value)} />}
          {!nachfrageGesperrt && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
              <input type="checkbox" data-testid="vb-nachfrage" checked={f.nachfrage} onChange={(e) => set("nachfrage", e.target.checked)} /> Nach {daten.nachfrageTage || 3} Tagen nachfragen („Geht es dir gut?“)
            </label>
          )}
          {neu && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
              <input type="checkbox" data-testid="vb-benachrichtigen" checked={f.benachrichtigen} onChange={(e) => set("benachrichtigen", e.target.checked)} /> Kommandanten benachrichtigen
            </label>
          )}
          {neu && <div style={{ ...klein, marginTop: 8 }}>Hinweis: Nach dem Speichern sehen nur der Verletzte, Kommandant, stellv. Kommandant, Admins (bei Jugendlichen auch Jugendwart und Jugendleiter) den Eintrag.</div>}
          {fehlerText && <div data-testid="vb-fehler" style={styles.errorText}>{fehlerText}</div>}
          <button style={{ ...styles.saveBtn, marginTop: 14, flex: "none" }} disabled={busy} data-testid="vb-speichern" onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Detail ----------------
function Zeile({ label, children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 8, fontSize: 13, padding: "3px 0" }}><span style={klein}>{label}</span><span style={{ overflowWrap: "anywhere" }}>{children}</span></div>;
}
function EintragDetail({ e, daten, onClose, onChanged, onBearbeiten }) {
  const { callAuthed, flashError } = useApp();
  const [ergaenzung, setErgaenzung] = useState("");
  const [protokoll, setProtokoll] = useState(null);
  const [frage, setFrage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehlerText, setFehlerText] = useState("");
  async function ergaenzen() {
    setBusy(true); setFehlerText("");
    const r = await callAuthed("verbandbuch", { action: "ergaenzung", id: e.id, text: ergaenzung });
    setBusy(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Das hat nicht geklappt."); return; }
    setErgaenzung(""); setProtokoll(null); await onChanged();
  }
  async function protokollLaden() {
    const r = await callAuthed("verbandbuch", { action: "protokoll", id: e.id });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Das Protokoll konnte nicht geladen werden."); return null; }
    setProtokoll(r.data.protokoll); return r.data.protokoll;
  }
  async function drucken(mitProtokoll) {
    const fenster = bereiteFensterVor();
    const p = mitProtokoll ? (protokoll || await protokollLaden()) : null;
    if (!oeffneBericht(eintragBericht(e, p), fenster)) flashError("Bitte das Pop-up-Fenster zulassen.");
  }
  async function loeschen() {
    setBusy(true);
    const r = await callAuthed("verbandbuch", { action: "loeschen", id: e.id });
    setBusy(false); setFrage(false);
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehlerText(r.data.error || "Löschen nicht möglich."); return; }
    onClose(); await onChanged();
  }
  const verl = [...(e.verletzungArten || []), e.verletzung].filter(Boolean).join(" · ");
  const mass = [...(e.massnahmeArten || []), e.massnahme].filter(Boolean).join(" · ");
  return (
    <div style={styles.modalBackdrop} onClick={onClose} data-testid="verbandbuch-detail">
      <div style={styles.modalSheet} onClick={(x) => x.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Eintrag Nr. {e.nr}</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={styles.formBody}>
          <Zeile label="Art"><b>{ARTEN[e.art]}</b></Zeile>
          <Zeile label="Verletzte Person">{e.person}{e.jugend ? " · Jugendfeuerwehr" : ""}</Zeile>
          <Zeile label="Datum / Uhrzeit">{zeitDe(e.ts)}</Zeile>
          <Zeile label="Anlass">{ANLAESSE[e.anlass]}</Zeile>
          <Zeile label="Ort">{e.ort}</Zeile>
          {e.verknuepfung && <Zeile label="Verknüpft mit">{e.verknuepfung.art === "einsatz" ? "Einsatz" : "Termin"}: {e.verknuepfung.titel}{e.verknuepfung.datum ? ` (${datumDe(e.verknuepfung.datum)})` : ""}</Zeile>}
          <Zeile label="Hergang"><span style={{ whiteSpace: "pre-wrap" }}>{e.hergang}</span></Zeile>
          <Zeile label="Verletzung">{verl || "– (keine Behandlung nötig)"}</Zeile>
          <Zeile label="Maßnahme">{mass || "–"}</Zeile>
          {(e.material || []).length > 0 && <Zeile label="Material">{e.material.join(", ")}</Zeile>}
          <Zeile label="Zeugen">{e.zeugen}</Zeile>
          <Zeile label="Ersthelfer">{e.ersthelfer || "–"}</Zeile>
          <Zeile label="Unfallanzeige">{e.unfallanzeige && e.unfallanzeige.erstattet ? `erstattet${e.unfallanzeige.datum ? ` am ${datumDe(e.unfallanzeige.datum)}` : ""}` : "nicht erstattet"}</Zeile>
          <Zeile label="Eingetragen">von {e.erstelltVon} am {zeitDe(e.erstelltAm)}</Zeile>
          {e.nachfrage && e.nachfrage.aktiv && <Zeile label="Nachfrage">{e.nachfrage.antwort ? (e.nachfrage.antwort.ergebnis === "gut" ? "beantwortet: alles gut" : "beantwortet: Beschwerden") : e.nachfrage.gefragt ? "gestellt, noch keine Antwort" : `geplant nach ${daten.nachfrageTage || 3} Tagen`}</Zeile>}

          {e.nachfrageOffen && <NachfrageBox e={e} onDone={async () => { await onChanged(); }} />}

          <div style={abschnitt}>ERGÄNZUNGEN ({(e.ergaenzungen || []).length})</div>
          {(e.ergaenzungen || []).length === 0 && <div style={klein}>Keine.</div>}
          {(e.ergaenzungen || []).map((x) => (
            <div key={x.id} data-testid="ergaenzung" style={{ ...styles.kontrollRow, marginBottom: 4 }}>
              <div style={klein}>{zeitDe(x.ts)} · {x.von}{x.art === "rueckmeldung" ? " · Rückmeldung" : ""}</div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.text}</div>
            </div>
          ))}
          <textarea style={{ ...styles.input, minHeight: 56, marginTop: 6 }} data-testid="vb-ergaenzung" maxLength={2000} placeholder="Ergänzung schreiben (z. B. Beschwerden aufgetreten)" value={ergaenzung} onChange={(x) => setErgaenzung(x.target.value)} />
          <button style={{ ...styles.tinyBtn, marginTop: 6, alignSelf: "flex-start" }} disabled={busy || !ergaenzung.trim()} data-testid="vb-ergaenzung-speichern" onClick={ergaenzen}>Ergänzung speichern</button>

          {e.rechte.protokoll && (
            <>
              <div style={abschnitt}>PROTOKOLL (nur Kommando und Admins)</div>
              {protokoll === null ? <button style={{ ...styles.tinyBtn, alignSelf: "flex-start" }} data-testid="vb-protokoll" onClick={protokollLaden}>Protokoll anzeigen</button> : (
                <div data-testid="vb-protokoll-liste">
                  {protokoll.map((p) => (
                    <div key={p.id} style={{ ...styles.kontrollRow, marginBottom: 4 }}>
                      <div style={klein}>{zeitDe(p.ts)} · {p.von} · {aktionText(p.aktion)}</div>
                      <div style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{Array.isArray(p.details) ? p.details.map((d, i) => <div key={i}><b>{d.feld}:</b> {d.alt} → {d.neu}</div>) : p.details}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {fehlerText && <div data-testid="vb-detail-fehler" style={styles.errorText}>{fehlerText}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button style={{ ...styles.deleteBtn, borderColor: "#E2DFD6", color: "#5C5F58", gap: 5 }} data-testid="vb-drucken" onClick={() => drucken(false)}><Printer size={14} /> PDF / Drucken</button>
            {e.rechte.protokoll && <button style={{ ...styles.deleteBtn, borderColor: "#E2DFD6", color: "#5C5F58", gap: 5 }} data-testid="vb-drucken-protokoll" onClick={() => drucken(true)}><Printer size={14} /> mit Protokoll</button>}
            {e.rechte.bearbeiten && <button style={{ ...styles.deleteBtn, borderColor: "#E2DFD6", color: "#2C2F2A" }} data-testid="vb-bearbeiten" onClick={() => onBearbeiten(e)}>Ändern</button>}
          </div>
          {e.rechte.protokoll && (
            e.rechte.loeschen ? (
              !frage ? <button style={{ ...styles.deleteBtn, marginTop: 10, justifyContent: "center" }} data-testid="vb-loeschen" onClick={() => setFrage(true)}>Eintrag löschen (Frist abgelaufen)</button> : (
                <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px", marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>Eintrag Nr. {e.nr} endgültig löschen? Im Protokoll bleibt nur der Vermerk „gelöscht“.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(false)}>Abbrechen</button>
                    <button style={{ ...styles.saveBtn, flex: 1 }} disabled={busy} data-testid="vb-loeschen-ja" onClick={loeschen}>Löschen</button>
                  </div>
                </div>
              )
            ) : <div style={{ ...klein, marginTop: 10 }}>Löschbar frühestens am {datumKurz(e.loeschenAb)} ({daten.aufbewahrungJahre || 5} Jahre nach der letzten Eintragung).</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Kachel ----------------
export default function VerbandbuchKachel() {
  const { me, callAuthed, flashError, closeKachelView, kachelReturnTo, ladeUmfrageStatus } = useApp();
  const schluessel = `verbandbuch:${me}`;
  const [daten, setDaten] = useState(() => hole(schluessel));
  const [fehler, setFehler] = useState("");
  const [formular, setFormular] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [jahr, setJahr] = useState(String(new Date().getFullYear()));
  const [auswertung, setAuswertung] = useState(null);
  const [zeigeAuswertung, setZeigeAuswertung] = useState(false);
  const [testFrage, setTestFrage] = useState(false);
  const [meldung, setMeldung] = useState("");

  async function laden() {
    const r = await callAuthed("verbandbuch", { action: "list" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Das Verbandbuch konnte nicht geladen werden."); return; }
    setFehler(""); setDaten(r.data); merke(schluessel, r.data);
  }
  useEffect(() => { laden(); }, []);
  const nachAenderung = async () => { await laden(); if (ladeUmfrageStatus) ladeUmfrageStatus(); };

  async function auswertungLaden(j = jahr) {
    const r = await callAuthed("verbandbuch", { action: "auswertung", jahr: j });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Die Auswertung konnte nicht geladen werden."); return; }
    setAuswertung(r.data);
  }
  useEffect(() => { if (zeigeAuswertung && daten && daten.rechte.alles) auswertungLaden(jahr); }, [zeigeAuswertung, jahr]);

  async function testdatenLoeschen() {
    setTestFrage(false);
    const r = await callAuthed("verbandbuch", { action: "testphaseLeeren", bestaetigt: true });
    if (!r.ok) { if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich."); return; }
    setMeldung("Alle Testdaten wurden gelöscht."); setDetailId(null); setAuswertung(null); await nachAenderung();
  }

  const alle = (daten && daten.eintraege) || [];
  const jahre = [...new Set([String(new Date().getFullYear()), ...alle.map((e) => jahrVon(e.ts))])].sort().reverse();
  const sichtbar = alle.filter((e) => jahr === "alle" || jahrVon(e.ts) === jahr);
  const offeneNachfragen = alle.filter((e) => e.nachfrageOffen);
  const rechte = (daten && daten.rechte) || {};

  function auszugDrucken(mitNamen) {
    const fenster = bereiteFensterVor();
    const liste = [...sichtbar].sort((a, b) => (a.nr < b.nr ? -1 : 1));
    if (!oeffneBericht(auszugBericht(liste, jahr === "alle" ? "alle Jahre" : jahr, mitNamen), fenster)) flashError("Bitte das Pop-up-Fenster zulassen.");
  }
  function auswertungDrucken() {
    if (!auswertung) return;
    const fenster = bereiteFensterVor();
    if (!oeffneBericht(auswertungBericht(auswertung), fenster)) flashError("Bitte das Pop-up-Fenster zulassen.");
  }

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Verbandbuch</div>
      <div style={{ ...klein, marginTop: 2 }}>Erste-Hilfe-Leistungen und Vorfälle dokumentieren. Vertraulich: Du siehst nur, was für dich freigegeben ist.</div>

      {daten && daten.testphase && rechte.admin && (
        <div data-testid="testphase-box" style={{ background: "#FDECEC", border: "1.5px solid #E08A83", borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9A1E1E" }}>TESTPHASE – bitte nur Testdaten eintragen</div>
          <div style={{ fontSize: 12, color: "#5C5F58", margin: "3px 0 8px" }}>In der Testphase kann der Admin alles löschen, auch das Protokoll. Das Verbandbuch ist so noch nicht manipulationssicher und darf noch nicht als offizielles Verbandbuch dienen.</div>
          {!testFrage ? <button style={{ ...styles.deleteBtn, justifyContent: "center", width: "100%" }} data-testid="testphase-leeren" onClick={() => setTestFrage(true)}>Testdaten komplett löschen</button> : (
            <div>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>Wirklich alle Einträge und das gesamte Protokoll ohne Vermerk löschen?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setTestFrage(false)}>Abbrechen</button>
                <button style={{ ...styles.saveBtn, flex: 1 }} data-testid="testphase-leeren-ja" onClick={testdatenLoeschen}>Alles löschen</button>
              </div>
            </div>
          )}
        </div>
      )}
      {meldung && <div data-testid="vb-meldung" style={{ fontSize: 12.5, color: "#2E7D4F", marginTop: 8 }}>{meldung}</div>}
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      <button style={{ ...styles.saveBtn, width: "100%", flex: "none", margin: "12px 0 4px", gap: 6 }} data-testid="vb-neu" disabled={!daten} onClick={() => { setMeldung(""); setFormular({}); }}><Plus size={16} /> Neuer Eintrag</button>
      {!daten && !fehler && <div style={{ ...klein, marginTop: 12 }}>Lädt …</div>}

      {offeneNachfragen.map((e) => <NachfrageBox key={e.id} e={e} onDone={nachAenderung} />)}

      {daten && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 4px", flexWrap: "wrap" }}>
            <div style={{ ...abschnitt, margin: 0 }}>EINTRÄGE ({sichtbar.length})</div>
            <select style={{ ...styles.input, width: "auto", padding: "4px 8px", fontSize: 12.5 }} data-testid="vb-jahr" value={jahr} onChange={(e) => setJahr(e.target.value)}>
              {jahre.map((j) => <option key={j} value={j}>{j}</option>)}<option value="alle">Alle Jahre</option>
            </select>
            {sichtbar.length > 0 && <button style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 3 }} data-testid="vb-auszug" onClick={() => auszugDrucken(true)}><Printer size={11} /> Jahresauszug</button>}
          </div>
          {sichtbar.length === 0 && <div style={{ ...klein, padding: "8px 0" }}>{alle.length === 0 ? "Noch keine Einträge für dich sichtbar." : "In diesem Jahr keine Einträge."}</div>}
          {sichtbar.map((e) => (
            <button key={e.id} type="button" data-knopf="fest" data-testid={`eintrag-${e.nr}`} onClick={() => { setMeldung(""); setDetailId(e.id); }} style={{ ...styles.kontrollRow, display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Nr. {e.nr} · {e.person}</span>
                <span style={klein}>{datumKurz(e.ts)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "1px 6px", color: e.art === "vorfall" ? "#4A6670" : "#9A1E1E", background: e.art === "vorfall" ? "#E8EEF0" : "#FBEAEA" }}>{e.art === "vorfall" ? "Nur Vorfall" : "Erste Hilfe"}</span>
                <span style={klein}>{ANLAESSE[e.anlass]}</span>
                {e.jugend && <span style={klein}>· Jugendfeuerwehr</span>}
                {e.nachfrageOffen && <span style={{ fontSize: 11, fontWeight: 700, color: "#9A5B00" }}>· Antwort offen</span>}
              </div>
              <div style={{ ...klein, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.hergang}</div>
            </button>
          ))}

          {rechte.alles && (
            <>
              <button style={{ ...abschnitt, background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block" }} data-knopf="fest" data-testid="vb-auswertung-umschalten" onClick={() => setZeigeAuswertung((v) => !v)}>AUSWERTUNG OHNE NAMEN {zeigeAuswertung ? "▲" : "▼"}</button>
              {zeigeAuswertung && auswertung && (
                <div data-testid="vb-auswertung" style={styles.kontrollRow}>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                    <span><b data-testid="auswertung-gesamt">{auswertung.gesamt}</b> Einträge in {auswertung.jahr}</span>
                    <span><b>{auswertung.arten.erste_hilfe}</b> Erste Hilfe</span><span><b>{auswertung.arten.vorfall}</b> nur Vorfall</span>
                    <span><b>{auswertung.unfallanzeigen}</b> Unfallanzeigen</span>
                  </div>
                  <div style={{ ...klein, marginTop: 6 }}>{Object.keys(ANLAESSE).map((k) => `${ANLAESSE[k]}: ${auswertung.anlaesse[k] || 0}`).join(" · ")}</div>
                  <div style={{ ...klein, marginTop: 2 }}>Jugendfeuerwehr: {auswertung.jugend} · Beschwerden nach Nachfrage: {auswertung.beschwerden}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 3 }} data-testid="vb-auswertung-drucken" onClick={auswertungDrucken}><Printer size={11} /> Auswertung drucken</button>
                    <button style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 3 }} onClick={() => auszugDrucken(false)}><Printer size={11} /> Jahresauszug ohne Namen</button>
                  </div>
                </div>
              )}
            </>
          )}
          <div style={{ ...klein, marginTop: 14 }}><ClipboardPlus size={12} style={{ verticalAlign: "-2px" }} /> Aufbewahrung {daten.aufbewahrungJahre || 5} Jahre (DGUV Vorschrift 1 § 24). Einträge lassen sich nicht still ändern – jede Änderung steht im Protokoll.</div>
        </>
      )}

      {detailId && (() => {
        const e = alle.find((x) => x.id === detailId);
        if (!e) return null;
        return <EintragDetail e={e} daten={daten} onClose={() => setDetailId(null)} onChanged={nachAenderung} onBearbeiten={(x) => { setDetailId(null); setFormular(x); }} />;
      })()}
      {formular && <EintragFormular start={formular} daten={daten} onClose={() => setFormular(null)} onSaved={async (r) => { setFormular(null); setMeldung(r && r.nr && !r.unveraendert ? `Gespeichert als Nr. ${r.nr}.` : ""); await nachAenderung(); }} />}
    </div>
  );
}
