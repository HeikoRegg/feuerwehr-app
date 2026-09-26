// Kachel Bewegungsfahrten: monatliche Einteilung der Maschinisten, Abfahrtskontrolle,
// Mängelmeldung an Admins und Gerätewarte, Übersicht und Verlauf.
import React, { useState } from "react";
import { ArrowLeft, Check, AlertTriangle, ChevronDown, RefreshCw, Truck } from "lucide-react";
import { styles } from "../lib/styles";
import { bewegungKandidaten, erstelleMonatsplan, fmtDate, monatKey, monatLabel, todayISO, uid } from "../lib/helpers";
import { useApp } from "../AppContext";

export default function BewegungsfahrtenKachel() {
  const { me, isAdmin, isGeraetewart, bewegung, persistBewegung, notifyPersons, lkwFahrzeuge, config, roster, closeKachelView, kachelReturnTo } = useApp();
  const key = monatKey();
  const monatAktiv = (config.bewegung.monate || []).includes(Number(key.slice(5)));
  const plan = bewegung.plan[key];
  const ausgesetzt = plan && plan.status === "ausgesetzt";
  const checklisteVor = config.bewegung.checklisteVor || [];
  const checklisteNach = config.bewegung.checklisteNach || [];
  const alleChecks = [...checklisteVor.map((t) => "V:" + t), ...checklisteNach.map((t) => "N:" + t)];

  const [offen, setOffen] = useState(null); // Fahrzeug-ID, für das die Checkliste offen ist
  const [checks, setChecks] = useState({});
  const [km, setKm] = useState("");
  const [mangel, setMangel] = useState("");
  const [zeigeBehoben, setZeigeBehoben] = useState(false);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);

  const empfaengerMaengel = () => [...new Set([...(config.adminNames || []), ...roster.filter((r) => r.geraetewart).map((r) => r.name)])].filter((n) => n !== me);
  const speichernPlan = (neuerPlan, extra = {}) => persistBewegung({ ...bewegung, ...extra, plan: { ...bewegung.plan, [key]: neuerPlan } });

  function checklisteOeffnen(vid) { setOffen(vid); setChecks({}); setKm(""); setMangel(""); }
  function abschliessen(vid) {
    const f = plan.fahrzeuge[vid];
    const v = lkwFahrzeuge.find((x) => x.id === vid);
    const text = mangel.trim();
    const erledigt = { datum: todayISO(), km: km.trim(), von: me, personen: f.personen, maengel: text };
    let maengel = bewegung.maengel || [];
    if (text) {
      maengel = [{ id: uid(), fahrzeugId: vid, fahrzeugName: v ? v.name : "Fahrzeug", text, gemeldetVon: me, datum: todayISO(), monat: key, behoben: null }, ...maengel];
      notifyPersons(empfaengerMaengel(), `⚠️ Mangel an ${v ? v.name : "Fahrzeug"}`, text);
    }
    speichernPlan({ ...plan, fahrzeuge: { ...plan.fahrzeuge, [vid]: { ...f, erledigt } } }, { maengel });
    setOffen(null);
  }
  function neuEinteilen() {
    const neu = erstelleMonatsplan(bewegung, roster, lkwFahrzeuge, config.bewegung.personen || 2, key);
    const fahrzeuge = { ...neu.fahrzeuge };
    Object.entries((plan && plan.fahrzeuge) || {}).forEach(([vid, f]) => { if (f.erledigt) fahrzeuge[vid] = f; }); // Erledigte bleiben
    speichernPlan({ ...neu, fahrzeuge });
    lkwFahrzeuge.forEach((v) => {
      const f = fahrzeuge[v.id];
      if (f && !f.erledigt) notifyPersons(f.personen, `Bewegungsfahrt ${monatLabel(key)}`, `Du bist für ${v.name} eingeteilt${f.personen.length > 1 ? ` (mit ${f.personen.join(", ")})` : ""}.`);
    });
  }
  function aussetzen(an) {
    if (an) speichernPlan({ ...(plan || { fahrzeuge: {} }), status: "ausgesetzt" });
    else if (plan && Object.keys(plan.fahrzeuge || {}).length) speichernPlan({ ...plan, status: "geplant" });
    else neuEinteilen();
  }
  function tauschen(vid, idx, name) {
    const f = plan.fahrzeuge[vid];
    const personen = [...f.personen]; personen[idx] = name;
    speichernPlan({ ...plan, fahrzeuge: { ...plan.fahrzeuge, [vid]: { ...f, personen } } });
    const v = lkwFahrzeuge.find((x) => x.id === vid);
    notifyPersons([name], `Bewegungsfahrt ${monatLabel(key)}`, `Du bist für ${v ? v.name : "ein Fahrzeug"} eingeteilt.`);
  }
  function behoben(id) {
    persistBewegung({ ...bewegung, maengel: bewegung.maengel.map((m) => (m.id === id ? { ...m, behoben: { von: me, datum: todayISO() } } : m)) });
  }

  const offeneMaengel = (bewegung.maengel || []).filter((m) => !m.behoben);
  const behobeneMaengel = (bewegung.maengel || []).filter((m) => m.behoben);
  const meineOffenen = plan && !ausgesetzt ? lkwFahrzeuge.filter((v) => { const f = plan.fahrzeuge[v.id]; return f && !f.erledigt && (f.personen || []).includes(me); }) : [];
  const verlauf = Object.keys(bewegung.plan).filter((k) => k < key).sort().reverse().slice(0, 12);
  const darfBeheben = isAdmin || isGeraetewart;

  const Check_ = ({ id, label }) => (
    <label style={{ ...styles.attendanceRow, padding: "6px 4px", fontSize: 13 }}>
      <input type="checkbox" style={styles.attendanceCheckbox} checked={!!checks[id]} onChange={() => setChecks((c) => ({ ...c, [id]: !c[id] }))} />
      <span>{label}</span>
    </label>
  );

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}>
        <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
      </div>
      <div style={styles.modalTitle}>Bewegungsfahrten</div>
      <div style={{ fontSize: 12.5, color: "#5C5F58", margin: "2px 0 14px" }}>{monatLabel(key)}</div>

      {lkwFahrzeuge.length === 0 && <div style={styles.kontrollRow}><div style={{ fontSize: 12.5, color: "#8A8C86" }}>Noch keine LKW-Fahrzeuge angelegt (Führerschein-Kachel → Fahrzeuge verwalten).</div></div>}
      {lkwFahrzeuge.length > 0 && !plan && !monatAktiv && <div style={styles.kontrollRow}><div style={{ fontSize: 12.5, color: "#8A8C86" }}>In diesem Monat finden keine Bewegungsfahrten statt.</div></div>}
      {lkwFahrzeuge.length > 0 && !plan && monatAktiv && <div style={styles.kontrollRow}><div style={{ fontSize: 12.5, color: "#8A8C86" }}>Die Einteilung für diesen Monat wird gerade erstellt …</div></div>}
      {ausgesetzt && <div style={{ ...styles.reminderCard }}><AlertTriangle size={15} color="#B8791A" style={{ flexShrink: 0 }} /><div style={styles.reminderText}>Diesen Monat ausgesetzt. Die Eingeteilten kommen im nächsten Monat dran.</div></div>}

      {/* Meine Fahrten mit Checkliste */}
      {meineOffenen.map((v) => (
        <div key={v.id} style={{ ...styles.kontrollRow, borderLeft: "3.5px solid #C1272D" }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Truck size={15} /> Deine Fahrt: {v.name}</div>
          {plan.fahrzeuge[v.id].personen.length > 1 && <div style={{ fontSize: 12, color: "#5C5F58", marginTop: 2 }}>zusammen mit {plan.fahrzeuge[v.id].personen.filter((n) => n !== me).join(", ")}</div>}
          {offen !== v.id && <button style={{ ...styles.saveBtn, marginTop: 10, width: "100%" }} onClick={() => checklisteOeffnen(v.id)}>Abfahrtskontrolle starten</button>}
          {offen === v.id && renderCheckliste(v.id)}
        </div>
      ))}

      {/* Monatsübersicht */}
      {plan && !ausgesetzt && lkwFahrzeuge.length > 0 && (
        <div style={styles.kontrollRow}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em", marginBottom: 8 }}>EINTEILUNG {monatLabel(key).toUpperCase()}</div>
          {lkwFahrzeuge.map((v) => {
            const f = plan.fahrzeuge[v.id];
            const kandidaten = bewegungKandidaten(roster, v.id).map((r) => r.name);
            return (
              <div key={v.id} style={{ borderBottom: "1px dashed #E2DFD6", padding: "7px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</span>
                  {f && f.erledigt ? <span style={{ fontSize: 11.5, color: "#1F6F5C", fontWeight: 700 }}>✓ erledigt {fmtDate(f.erledigt.datum)}</span> : <span style={{ fontSize: 11.5, color: "#B8791A", fontWeight: 700 }}>offen</span>}
                </div>
                {!f && <div style={{ fontSize: 12, color: "#8A8C86" }}>Noch nicht eingeteilt.</div>}
                {f && f.personen.length === 0 && <div style={{ fontSize: 12, color: "#C1272D" }}>Niemand geeignet (Maschinist + gültiger LKW-Führerschein + Einweisung auf diesem Fahrzeug).</div>}
                {f && f.personen.map((n, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{n}</span>
                    {isAdmin && !f.erledigt && (
                      <select style={{ ...styles.input, width: 150, padding: "4px 6px", fontSize: 11.5 }} value="" onChange={(e) => e.target.value && tauschen(v.id, idx, e.target.value)}>
                        <option value="">tauschen …</option>
                        {kandidaten.filter((k) => !f.personen.includes(k)).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {f && f.erledigt && (
                  <div style={{ fontSize: 11.5, color: "#5C5F58", marginTop: 3 }}>abgehakt von {f.erledigt.von}{f.erledigt.km ? ` · ${f.erledigt.km} km` : ""}{f.erledigt.maengel ? " · Mangel gemeldet" : ""}</div>
                )}
                {isAdmin && f && !f.erledigt && !f.personen.includes(me) && offen !== v.id && (
                  <button style={{ ...styles.tinyBtn, marginTop: 5 }} onClick={() => checklisteOeffnen(v.id)}>Für die Kameraden abhaken</button>
                )}
                {isAdmin && offen === v.id && !f.personen.includes(me) && renderCheckliste(v.id)}
              </div>
            );
          })}
          {isAdmin && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button style={styles.tinyBtn} onClick={neuEinteilen}><RefreshCw size={11} style={{ verticalAlign: -1 }} /> Neu einteilen</button>
              <button style={styles.tinyBtn} onClick={() => { if (window.confirm("Bewegungsfahrten diesen Monat aussetzen? Die Eingeteilten kommen im nächsten Monat dran.")) aussetzen(true); }}>Diesen Monat aussetzen</button>
            </div>
          )}
        </div>
      )}
      {isAdmin && (ausgesetzt || (!plan && lkwFahrzeuge.length > 0 && !monatAktiv)) && (
        <button style={{ ...styles.smallAddBtn, marginBottom: 10 }} onClick={() => aussetzen(false)}>{ausgesetzt ? "Wieder aufnehmen" : "Trotzdem für diesen Monat einteilen"}</button>
      )}

      {/* Mängel */}
      <div style={styles.kontrollRow}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em", marginBottom: 8 }}>OFFENE MÄNGEL</div>
        {offeneMaengel.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine offenen Mängel.</div>}
        {offeneMaengel.map((m) => (
          <div key={m.id} style={{ background: "#FBEAEA", border: "1px solid #E2A9A9", borderRadius: 6, padding: "7px 9px", marginBottom: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A2A2A" }}>{m.fahrzeugName}</div>
            <div style={{ fontSize: 12.5, color: "#2C2F2A", margin: "2px 0" }}>{m.text}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8A8C86" }}>{m.gemeldetVon} · {fmtDate(m.datum)}</span>
              {darfBeheben && <button style={styles.tinyBtnPrimary} onClick={() => behoben(m.id)}><Check size={11} style={{ verticalAlign: -1 }} /> behoben</button>}
            </div>
          </div>
        ))}
        {behobeneMaengel.length > 0 && (
          <>
            <button style={{ ...styles.advancedToggle, marginTop: 6 }} onClick={() => setZeigeBehoben(!zeigeBehoben)}><ChevronDown size={13} style={{ transform: zeigeBehoben ? "rotate(180deg)" : "none" }} /> Behobene Mängel ({behobeneMaengel.length})</button>
            {zeigeBehoben && behobeneMaengel.slice(0, 30).map((m) => (
              <div key={m.id} style={{ fontSize: 12, color: "#5C5F58", padding: "5px 0", borderBottom: "1px dashed #E2DFD6" }}>
                <strong>{m.fahrzeugName}:</strong> {m.text} <span style={{ color: "#8A8C86" }}>· gemeldet {fmtDate(m.datum)} · behoben von {m.behoben.von} am {fmtDate(m.behoben.datum)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Verlauf */}
      {verlauf.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button style={styles.advancedToggle} onClick={() => setZeigeVerlauf(!zeigeVerlauf)}><ChevronDown size={13} style={{ transform: zeigeVerlauf ? "rotate(180deg)" : "none" }} /> Verlauf der letzten Monate</button>
          {zeigeVerlauf && verlauf.map((k) => {
            const m = bewegung.plan[k];
            return (
              <div key={k} style={{ ...styles.kontrollRow, marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{monatLabel(k)}{m.status === "ausgesetzt" ? " – ausgesetzt" : ""}</div>
                {m.status !== "ausgesetzt" && Object.entries(m.fahrzeuge || {}).map(([vid, f]) => {
                  const v = lkwFahrzeuge.find((x) => x.id === vid);
                  return (
                    <div key={vid} style={{ fontSize: 12, color: f.erledigt ? "#1F6F5C" : "#C1272D", marginBottom: 2 }}>
                      {v ? v.name : "Fahrzeug"}: {f.personen.join(", ") || "—"} · {f.erledigt ? `erledigt ${fmtDate(f.erledigt.datum)}${f.erledigt.km ? `, ${f.erledigt.km} km` : ""}` : "nicht erledigt"}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function renderCheckliste(vid) {
    const alleAbgehakt = alleChecks.every((id) => checks[id]);
    return (
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
        {checklisteVor.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "4px 0" }}>VOR DER FAHRT</div>}
        {checklisteVor.map((t) => <Check_ key={"V:" + t} id={"V:" + t} label={t} />)}
        {checklisteNach.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "10px 0 4px" }}>NACH DER FAHRT</div>}
        {checklisteNach.map((t) => <Check_ key={"N:" + t} id={"N:" + t} label={t} />)}
        <div style={{ fontSize: 11.5, color: "#5C5F58", margin: "10px 0 4px" }}>Kilometerstand (optional)</div>
        <input style={{ ...styles.input, width: 160 }} inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="z. B. 48250" />
        <div style={{ fontSize: 11.5, color: "#5C5F58", margin: "10px 0 4px" }}>Mängel (falls etwas aufgefallen ist)</div>
        <textarea style={{ ...styles.input, minHeight: 56, resize: "vertical", fontSize: 13 }} value={mangel} onChange={(e) => setMangel(e.target.value)} placeholder="z. B. Blinker hinten links defekt" />
        {mangel.trim() && <div style={{ fontSize: 10.5, color: "#B8791A", marginTop: 3 }}>Admin und Gerätewart werden sofort benachrichtigt.</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setOffen(null)}>Abbrechen</button>
          <button style={{ ...styles.saveBtn, flex: 1 }} disabled={!alleAbgehakt} onClick={() => abschliessen(vid)}>{alleAbgehakt ? "Fahrt abschließen" : `Noch ${alleChecks.filter((id) => !checks[id]).length} Punkte`}</button>
        </div>
      </div>
    );
  }
}
