import React from "react";
import { AlertTriangle, Check, Download, Pencil, Plus, RotateCcw } from "lucide-react";
import { ATEMSCHUTZ_UEBUNG_TYPES } from "../lib/constants";
import { atemschutzStatus, daysSince, fmtDate, todayISO } from "../lib/helpers";
import { styles } from "../lib/styles";
import { useApp } from "../AppContext";

// Kachel Atemschutz: G26.3, Streckendurchgang, Übung, Unterweisung, Admin-Übersicht
export default function AtemschutzKachel() {
  const { config, roster, me, setConfirmResetG26Name, g26EditOpen, setG26EditOpen, g26DateInput, setG26DateInput, setLightboxSrc, myEntry, isAdmin, canEditAtemschutzUnterweisung, persistConfig, setStreckendurchgang, resetStreckendurchgang, setAtemschutzUebung, resetAtemschutzUebung, setAtemschutzUnterweisung, resetAtemschutzUnterweisung, saveG26Date, adminConfirmG26, g26PhotoUploading, uploadG26Photo, removeG26Photo, g26ReminderActive, exportAtemschutz, adminPendingG26 } = useApp();
  return (
              <div>
                {myEntry && myEntry.atemschutz && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine G26.3-Untersuchung</div>
                    <div style={{ fontSize: 13, color: "#5C5F58", marginBottom: 8 }}>Nächster Termin: <strong>{fmtDate(myEntry.g26.dueDate)}</strong>{myEntry.g26.pendingConfirmation && <span style={styles.pinPendingTag}> wartet auf Bestätigung</span>}</div>
                    {!g26EditOpen ? (
                      <button style={styles.smallAddBtn} onClick={() => { setG26EditOpen(true); setG26DateInput(myEntry.g26.dueDate || ""); }}><Pencil size={12} /> Neuen Termin eintragen</button>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={{ ...styles.input, flex: 1 }} type="date" value={g26DateInput} onChange={(e) => setG26DateInput(e.target.value)} />
                        <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => g26DateInput && saveG26Date(g26DateInput)}><Check size={15} /></button>
                      </div>
                    )}
                    {g26ReminderActive(myEntry) && config && (config.doctorName || config.doctorAddress || config.doctorPhone) && (
                      <div style={styles.reminderDoctor}>{config.doctorName} {config.doctorAddress && `· ${config.doctorAddress}`} {config.doctorPhone && `· Tel. ${config.doctorPhone}`}</div>
                    )}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>NACHWEIS-FOTO (nur du und Admin sehen das)</div>
                      {myEntry.g26.photoUrl ? (
                        <div>
                          <img src={myEntry.g26.photoUrl} alt="G26-Nachweis" style={{ maxWidth: 160, borderRadius: 6, border: "1px solid #E2DFD6", display: "block", marginBottom: 6, cursor: "zoom-in" }} onClick={() => setLightboxSrc(myEntry.g26.photoUrl)} />
                          <button style={styles.tinyBtn} onClick={removeG26Photo}>Foto entfernen</button>
                        </div>
                      ) : (
                        <label style={styles.smallAddBtn}>
                          {g26PhotoUploading ? "Lädt hoch …" : <><Plus size={12} /> Foto hochladen</>}
                          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) uploadG26Photo(e.target.files[0]); }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {myEntry && myEntry.atemschutz && (() => {
                  const st = atemschutzStatus(myEntry);
                  return (
                    <div style={styles.kontrollRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: st.allValid ? "#1F6F5C" : "#C1272D", flexShrink: 0 }} />
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{st.allValid ? `Einsatztauglich bis ${fmtDate(st.bis)}` : "Nicht einsatztauglich"}</div>
                      </div>
                      <div style={{ fontSize: 12, color: st.g26Valid ? "#1F6F5C" : "#C1272D", marginBottom: 8 }}>G26.3: {st.g26Valid ? "aktuell" : "abgelaufen/fehlt"}</div>

                      <div style={{ fontSize: 12, color: st.streckeValid ? "#1F6F5C" : "#C1272D", marginBottom: 4 }}>Streckendurchgang: {myEntry.streckendurchgang.date ? `${fmtDate(myEntry.streckendurchgang.date)}${st.streckeValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                        <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 12 }} type="date" defaultValue={myEntry.streckendurchgang.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== myEntry.streckendurchgang.date) setStreckendurchgang(me, e.target.value); }} />
                        {myEntry.streckendurchgang.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetStreckendurchgang(me)}><RotateCcw size={12} /></button>}
                      </div>

                      <div style={{ fontSize: 12, color: st.uebungValid ? "#1F6F5C" : "#C1272D", marginBottom: 4 }}>Übung (Container/Warmer Einsatz/Einsatznah): {myEntry.atemschutzUebung.date ? `${ATEMSCHUTZ_UEBUNG_TYPES[myEntry.atemschutzUebung.type] || ""} am ${fmtDate(myEntry.atemschutzUebung.date)}${st.uebungValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                        <select style={{ ...styles.input, width: 150, padding: "6px 9px", fontSize: 12 }} defaultValue={myEntry.atemschutzUebung.type || ""} onChange={(e) => { const type = e.target.value; if (type) setAtemschutzUebung(me, type, myEntry.atemschutzUebung.date || todayISO()); }}>
                          <option value="">— Art wählen —</option>
                          {Object.entries(ATEMSCHUTZ_UEBUNG_TYPES).map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
                        </select>
                        <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 12 }} type="date" defaultValue={myEntry.atemschutzUebung.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== myEntry.atemschutzUebung.date) setAtemschutzUebung(me, myEntry.atemschutzUebung.type || "einsatznah", e.target.value); }} />
                        {myEntry.atemschutzUebung.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUebung(me)}><RotateCcw size={12} /></button>}
                      </div>

                      <div style={{ fontSize: 12, color: st.unterweisungValid ? "#1F6F5C" : "#C1272D" }}>
                        Atemschutzunterweisung: {myEntry.atemschutzUnterweisung && myEntry.atemschutzUnterweisung.date ? `${fmtDate(myEntry.atemschutzUnterweisung.date)}${st.unterweisungValid ? "" : " (abgelaufen)"}` : "noch nicht eingetragen"}
                        <span style={{ fontSize: 10.5, color: "#8A8C86", display: "block", marginTop: 2 }}>(wird von Admin/Berechtigten eingetragen)</span>
                      </div>
                    </div>
                  );
                })()}

                {canEditAtemschutzUnterweisung && roster.filter((r) => r.atemschutz).length > 0 && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Atemschutzunterweisung eintragen</div>
                    {roster.filter((r) => r.atemschutz).map((r) => {
                      const u = r.atemschutzUnterweisung || {};
                      const valid = !!(u.date && daysSince(u.date) <= 365);
                      return (
                        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 110 }}>{r.name}:</span>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={u.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== u.date) setAtemschutzUnterweisung(r.name, e.target.value); }} />
                          <span style={{ fontSize: 11, color: valid ? "#1F6F5C" : "#C1272D", fontWeight: 600 }}>{u.date ? (valid ? "gültig" : "abgelaufen") : "offen"}</span>
                          {u.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUnterweisung(r.name)}><RotateCcw size={12} /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  <>
                    <button style={styles.exportBtn} onClick={exportAtemschutz}><Download size={14} /> Als Excel-Liste exportieren</button>
                    {adminPendingG26.length > 0 && (
                      <div style={styles.reminderCard}><AlertTriangle size={14} color="#B8791A" /><div style={{ fontSize: 12, color: "#5C5F58" }}>{adminPendingG26.length} Bestätigung(en) offen — bitte Nachweis zeigen lassen.</div></div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ARZT-KONTAKT PFLEGEN</div>
                    <input key={`docname-${config.doctorName}`} style={styles.input} placeholder="Name des Arztes" defaultValue={config.doctorName || ""} onBlur={(e) => { if (e.target.value !== config.doctorName) persistConfig({ ...config, doctorName: e.target.value }); }} />
                    <input key={`docaddr-${config.doctorAddress}`} style={{ ...styles.input, marginTop: 6 }} placeholder="Adresse" defaultValue={config.doctorAddress || ""} onBlur={(e) => { if (e.target.value !== config.doctorAddress) persistConfig({ ...config, doctorAddress: e.target.value }); }} />
                    <input key={`docphone-${config.doctorPhone}`} style={{ ...styles.input, marginTop: 6 }} placeholder="Telefonnummer" defaultValue={config.doctorPhone || ""} onBlur={(e) => { if (e.target.value !== config.doctorPhone) persistConfig({ ...config, doctorPhone: e.target.value }); }} />
                    <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 4 }}>Wird beim Verlassen des Feldes gespeichert.</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "16px 0 6px", letterSpacing: "0.04em" }}>ATEMSCHUTZTRÄGER ÜBERSICHT</div>
                    {roster.filter((r) => r.atemschutz).map((r) => {
                      const st = atemschutzStatus(r);
                      return (
                      <div key={r.name} style={styles.kontrollRow}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: st.allValid ? "#1F6F5C" : "#C1272D", flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: "#8A8C86" }}>{st.allValid ? `tauglich bis ${fmtDate(st.bis)}` : "nicht tauglich"}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {r.g26.pendingConfirmation && <button style={styles.tinyIconBtn} aria-label="G26 zurücksetzen" onClick={() => setConfirmResetG26Name(r.name)}><RotateCcw size={12} /></button>}
                            {r.g26.pendingConfirmation && <button style={styles.smallAddBtn} onClick={() => adminConfirmG26(r.name)}><Check size={12} /> G26 bestätigen</button>}
                          </div>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#5C5F58", marginBottom: 6 }}>G26.3: {fmtDate(r.g26.dueDate)}{r.g26.pendingConfirmation && <span style={styles.pinPendingTag}>offen</span>}</div>
                        {r.g26.photoUrl && <img src={r.g26.photoUrl} alt="Nachweis" style={{ maxWidth: 100, borderRadius: 6, border: "1px solid #E2DFD6", display: "block", marginBottom: 6, cursor: "zoom-in" }} onClick={() => setLightboxSrc(r.g26.photoUrl)} />}

                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 130 }}>Streckendurchgang:</span>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.streckendurchgang.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== r.streckendurchgang.date) setStreckendurchgang(r.name, e.target.value); }} />
                          {r.streckendurchgang.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetStreckendurchgang(r.name)}><RotateCcw size={12} /></button>}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "#5C5F58", width: 130 }}>Übung:</span>
                          <select style={{ ...styles.input, width: 140, padding: "5px 8px", fontSize: 11.5 }} defaultValue={r.atemschutzUebung.type || ""} onChange={(e) => { const type = e.target.value; if (type) setAtemschutzUebung(r.name, type, r.atemschutzUebung.date || todayISO()); }}>
                            <option value="">— wählen —</option>
                            {Object.entries(ATEMSCHUTZ_UEBUNG_TYPES).map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
                          </select>
                          <input style={{ ...styles.input, width: 130, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.atemschutzUebung.date || ""} onBlur={(e) => { if (e.target.value && e.target.value !== r.atemschutzUebung.date) setAtemschutzUebung(r.name, r.atemschutzUebung.type || "einsatznah", e.target.value); }} />
                          {r.atemschutzUebung.date && <button style={styles.tinyIconBtn} aria-label="zurücksetzen" onClick={() => resetAtemschutzUebung(r.name)}><RotateCcw size={12} /></button>}
                        </div>
                      </div>
                      );
                    })}
                  </>
                )}
              </div>
  );
}
