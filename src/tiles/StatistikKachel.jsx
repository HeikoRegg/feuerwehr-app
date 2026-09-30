// Kachel Statistik (nur Admin): Jahresfilter, vier Reiter mit Kennzahlen und Diagrammen,
// Antippen zeigt die Namen, Jahresbericht zum Drucken/PDF wahlweise mit oder ohne Namen.
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Printer } from "lucide-react";
import { styles } from "../lib/styles";
import { oeffneBericht } from "../lib/bericht";
import { STATISTIK_REITER, berechneStatistik, jahreAuswahl, pct, statistikBericht } from "../lib/statistik";
import { hole, merke } from "../lib/zwischenspeicher";
import { useApp } from "../AppContext";

function Balken({ value, max, color }) {
  const w = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ flex: 1, background: "#EEEEEC", borderRadius: 4, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, minWidth: value > 0 ? 3 : 0, height: "100%", background: color || "#4A6670", borderRadius: "0 4px 4px 0" }} />
    </div>
  );
}

function Zeile({ label, value, max, color, rechts, names, namesLabel, offen, onToggle }) {
  const klickbar = names && names.length > 0;
  return (
    <div style={{ marginBottom: 4 }}>
      <div onClick={klickbar ? onToggle : undefined} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: klickbar ? "pointer" : "default" }} title={`${label}: ${rechts}`}>
        <div style={{ width: 118, fontSize: 12, color: "#2C2F2A", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <Balken value={value} max={max} color={color} />
        <div style={{ minWidth: 58, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#2C2F2A" }}>{rechts}</div>
        {klickbar ? <ChevronDown size={12} color="#A5A79F" style={{ transform: offen ? "rotate(180deg)" : "none", flexShrink: 0 }} /> : <span style={{ width: 12, flexShrink: 0 }} />}
      </div>
      {offen && klickbar && <div style={{ fontSize: 11.5, color: "#5C5F58", background: "#F3F1EC", borderRadius: 6, padding: "6px 8px", margin: "2px 0 6px" }}>{namesLabel ? <strong>{namesLabel}: </strong> : null}{names.join(", ")}</div>}
    </div>
  );
}

function Abschnitt({ s }) {
  const [offen, setOffen] = useState(null);
  const toggle = (i) => setOffen(offen === i ? null : i);
  const max = s.type === "bars" ? Math.max(1, ...s.items.map((i) => i.value || 0)) : 0;
  return (
    <div style={styles.kontrollRow}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2F2A", marginBottom: 8 }}>{s.title}</div>
      {s.items.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>{s.empty || "Keine Daten."}</div>}
      {s.type === "bars" && s.items.map((i, idx) => (
        <Zeile key={idx} label={i.label} value={i.value || 0} max={max} color={i.color || s.color}
          rechts={`${i.value ?? "–"}${i.suffix || ""}`} names={i.names} offen={offen === idx} onToggle={() => toggle(idx)} />
      ))}
      {s.type === "ratio" && s.items.map((i, idx) => (
        <Zeile key={idx} label={i.label} value={i.value} max={i.max} color="#1F6F5C"
          rechts={`${i.value}/${i.max} · ${pct(i.value, i.max)} %`} names={i.names} namesLabel={i.namesLabel} offen={offen === idx} onToggle={() => toggle(idx)} />
      ))}
      {s.note && <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 6 }}>{s.note}</div>}
      {s.items.some((i) => i.names && i.names.length) && <div style={{ fontSize: 10.5, color: "#A5A79F", marginTop: 4 }}>Zeile antippen zeigt die Namen.</div>}
    </div>
  );
}

export default function StatistikKachel() {
  const { roster, events, sitzungen, vehicles, bewegung, callAuthed, flashError, closeKachelView, kachelReturnTo, config } = useApp();
  // Nach der Hauptversammlung im November kann das Einsatzjahr schon das nächste Kalenderjahr sein – dann zur Auswahl anbieten.
  const jahre = useMemo(() => {
    const j = jahreAuswahl(events);
    const ej = Number(config && config.einsatzjahr && config.einsatzjahr.name);
    return ej && !j.includes(ej) ? [ej, ...j].sort((x, y) => y - x) : j;
  }, [events, config]);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [reiter, setReiter] = useState("personal");
  // Beim erneuten Öffnen (gleiche Sitzung) gleich die letzten Zahlen zeigen, dann auffrischen.
  const gemerkt = hole("statistik");
  const [akten, setAkten] = useState(gemerkt ? gemerkt.akten : null);
  const [einsaetze, setEinsaetze] = useState(gemerkt ? gemerkt.einsaetze : undefined); // undefined = lädt, null = Fehler
  const [fehler, setFehler] = useState("");
  const [druckAuswahl, setDruckAuswahl] = useState(false);
  const [mitNamen, setMitNamen] = useState(false);

  useEffect(() => {
    (async () => {
      // Personalakten und Einsatzberichte gleichzeitig holen (eine gemeinsame PIN-Abfrage, falls nötig).
      const pa = callAuthed("personalakte", { action: "statistik" });
      const eb = callAuthed("einsatzbericht", { action: "statistik" });
      const [r, e] = await Promise.all([pa, eb]);
      if (r.ok) setAkten(r.data.items || []);
      else if (r.data && r.data.error === "abgebrochen") { closeKachelView(); return; }
      else { setAkten([]); setFehler((r.data && r.data.error) || "Daten aus den Personalakten konnten nicht geladen werden."); }
      setEinsaetze(e.ok ? e.data.items || [] : null);
      if (r.ok && e.ok) merke("statistik", { akten: r.data.items || [], einsaetze: e.data.items || [] });
    })();
  }, []);

  const stat = useMemo(() => (akten && einsaetze !== undefined ? berechneStatistik({ jahr, roster, events, sitzungen, vehicles, bewegung, akten, einsaetze }) : null), [akten, einsaetze, jahr, roster, events, sitzungen, vehicles, bewegung]);

  function drucken() {
    if (!oeffneBericht(statistikBericht(stat, jahr, mitNamen))) { flashError("Das Druckfenster wurde vom Browser blockiert."); return; }
    setDruckAuswahl(false);
  }


  const d = stat && stat[reiter];
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}>
        <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={styles.modalTitle}>Statistik</div>
        <select style={{ ...styles.input, width: 100, padding: "6px 8px", fontSize: 13 }} value={jahr} onChange={(e) => setJahr(Number(e.target.value))} aria-label="Jahr">
          {jahre.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
        {STATISTIK_REITER.map((t) => (
          <button key={t.key} onClick={() => setReiter(t.key)} style={{ ...styles.tabBtn, background: reiter === t.key ? "#2C2F2A" : "transparent", color: reiter === t.key ? "white" : "#5C5F58", borderColor: reiter === t.key ? "#2C2F2A" : "#E2DFD6" }}>{t.label}</button>
        ))}
      </div>

      {!stat && <div style={{ fontSize: 12.5, color: "#8A8C86", padding: "20px 0" }}>Lädt …</div>}
      {fehler && <div style={styles.errorText}>{fehler} Werte aus den Personalakten fehlen deshalb.</div>}

      {d && (
        <>
          {d.note && <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 8 }}>{d.note}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            {d.kpis.map((k) => (
              <div key={k.label} style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color: "#2C2F2A" }}>{k.value}{k.suffix || ""}</div>
                <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2, lineHeight: 1.2 }}>{k.label}</div>
              </div>
            ))}
          </div>
          {d.sections.map((s) => <Abschnitt key={`${reiter}-${jahr}-${s.id}`} s={s} />)}

          <div style={{ ...styles.kontrollRow, marginTop: 14 }}>
            {!druckAuswahl ? (
              <button style={{ ...styles.exportBtn, width: "100%", justifyContent: "center" }} onClick={() => { setMitNamen(false); setDruckAuswahl(true); }}><Printer size={14} /> Jahresbericht {jahr} drucken / PDF</button>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Jahresbericht {jahr}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {[false, true].map((m) => (
                    <button key={String(m)} onClick={() => setMitNamen(m)} style={{ ...styles.categoryChip, flex: 1, justifyContent: "center", background: mitNamen === m ? "#2C2F2A" : "#F3F1EC", color: mitNamen === m ? "white" : "#5C5F58", borderColor: mitNamen === m ? "#2C2F2A" : "#E2DFD6" }}>{m ? "Mit Namen" : "Ohne Namen"}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 10 }}>{mitNamen ? "Enthält Namen, z. B. wer nicht einsatztauglich ist, und den Übungsbesuch pro Person. Nur für den internen Gebrauch." : "Nur Zahlen und Gruppen, niemand wird namentlich genannt."}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setDruckAuswahl(false)}>Abbrechen</button>
                  <button style={{ ...styles.saveBtn, flex: 1 }} onClick={drucken}>Bericht öffnen</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 20px" }}>Gesperrte (ausgetretene) Mitglieder sind nicht mitgezählt, außer bei der Mitgliederentwicklung.</div>
        </>
      )}
    </div>
  );
}
