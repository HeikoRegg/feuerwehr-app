import React from "react";
import { AlertTriangle, Car, Check, Download, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { currentYear, daysUntil, fmtDate, matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { FuehrerscheinLine, SearchBox } from "../components/Shared";
import { useApp } from "../AppContext";

// Kachel Führerschein: eigene Führerscheine, Fahrzeugeinweisungen, Admin-Übersicht, Fahrzeuge verwalten
export default function FuehrerscheinKachel() {
  const { roster, me, confirmTargetSearch, setConfirmTargetSearch, confirmTargetType, setConfirmTargetType, confirmVehicleSearch, setConfirmVehicleSearch, confirmVehicleTarget, setConfirmVehicleTarget, newVehicleName, setNewVehicleName, newVehicleType, setNewVehicleType, setConfirmDeleteVehicleId, editVehicleId, setEditVehicleId, editVehicleName, setEditVehicleName, editVehicleType, setEditVehicleType, vehicles, myEntry, isAdmin, inEinsatzabteilung, requestFuehrerscheinConfirmation, cancelFuehrerscheinRequest, confirmFuehrerschein, dismissFuehrerscheinProblem, toggleHasLicense, setLkwAblauf, addVehicle, renameVehicle, getVehicleStatus, requestVehicleConfirmation, cancelVehicleRequest, confirmVehicleInstruction, exportFuehrerschein, myRelevantVehicles } = useApp();
  return (
              <div>
                {myEntry && inEinsatzabteilung && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine Führerscheine</div>
                    {["pkw", "lkw"].map((type) => {
                      const data = myEntry.fuehrerschein[type];
                      const ok = !data.hasLicense || data.confirmedYear === currentYear();
                      return (
                        <div key={type} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                              {type === "pkw" ? <Car size={13} /> : <Truck size={13} />} {type.toUpperCase()}: {!data.hasLicense ? <span style={{ color: "#8A8C86" }}>keiner</span> : ok ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>bestätigt ({data.confirmedBy})</span> : data.problemReported ? <span style={{ color: "#C1272D", fontWeight: 600 }}>Problem gemeldet</span> : data.confirmRequestTo ? <span style={{ color: "#4A6670", fontWeight: 600 }}>Anfrage an {data.confirmRequestTo}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}
                            </div>
                            <button style={styles.tinyBtn} onClick={() => toggleHasLicense(me, type)}>{data.hasLicense ? "kein " + type.toUpperCase() : "hat " + type.toUpperCase()}</button>
                          </div>
                          {type === "lkw" && data.hasLicense && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                              <span style={{ fontSize: 11.5, color: "#5C5F58" }}>Gültig bis:</span>
                              <input key={`lkwab-${data.ablaufDatum || ""}`} style={{ ...styles.input, width: 145, padding: "5px 8px", fontSize: 12 }} type="date" defaultValue={data.ablaufDatum || ""} onBlur={(e) => { if (e.target.value !== (data.ablaufDatum || "")) setLkwAblauf(me, e.target.value); }} />
                              {data.ablaufDatum && daysUntil(data.ablaufDatum) < 0 && <span style={{ fontSize: 11, color: "#C1272D", fontWeight: 700 }}>abgelaufen</span>}
                            </div>
                          )}
                          {data.problemReported && (
                            <div style={styles.problemBanner}>
                              <AlertTriangle size={13} color="#C1272D" style={{ flexShrink: 0 }} />
                              <span>{data.problemReportedBy} hat gemeldet: nicht vorhanden/nicht gültig. Bitte mit dem Admin klären.</span>
                              <button style={styles.tinyBtn} onClick={() => dismissFuehrerscheinProblem(type)}>OK</button>
                            </div>
                          )}
                          {data.hasLicense && !ok && !data.problemReported && (
                            data.confirmRequestTo ? (
                              <button style={{ ...styles.tinyBtn, marginTop: 4 }} onClick={() => cancelFuehrerscheinRequest(type)}>Anfrage zurückziehen</button>
                            ) : (
                              <button style={{ ...styles.smallAddBtn, marginTop: 4 }} onClick={() => { setConfirmTargetType(type); setConfirmTargetSearch(""); }}><Search size={12} /> Kameraden zur Bestätigung auswählen</button>
                            )
                          )}
                          {confirmTargetType === type && (
                            <div style={{ marginTop: 6, background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: 8 }}>
                              <SearchBox value={confirmTargetSearch} onChange={setConfirmTargetSearch} placeholder="Name suchen …" />
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                                {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && r.name !== me && matchesSearch(r.name, confirmTargetSearch)).map((r) => (
                                  <button key={r.name} style={styles.rosterItem} onClick={() => requestFuehrerscheinConfirmation(type, r.name)}>{r.name}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {myEntry && inEinsatzabteilung && myRelevantVehicles.length > 0 && (
                  <div style={styles.kontrollRow}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Meine Fahrzeugeinweisungen</div>
                    {myRelevantVehicles.map((v) => {
                      const status = getVehicleStatus(myEntry, v.id);
                      const eingewiesen = !!status.confirmedBy;
                      return (
                        <div key={v.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                              <Truck size={13} /> {v.name}: {eingewiesen ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>eingewiesen ({status.confirmedBy})</span> : status.confirmRequestTo ? <span style={{ color: "#4A6670", fontWeight: 600 }}>Anfrage an {status.confirmRequestTo}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}
                            </div>
                          </div>
                          {!eingewiesen && (
                            status.confirmRequestTo ? (
                              <button style={{ ...styles.tinyBtn, marginTop: 4 }} onClick={() => cancelVehicleRequest(v.id)}>Anfrage zurückziehen</button>
                            ) : (
                              <button style={{ ...styles.smallAddBtn, marginTop: 4 }} onClick={() => { setConfirmVehicleTarget(v.id); setConfirmVehicleSearch(""); }}><Search size={12} /> Kameraden zur Bestätigung auswählen</button>
                            )
                          )}
                          {confirmVehicleTarget === v.id && (
                            <div style={{ marginTop: 6, background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: 8 }}>
                              <SearchBox value={confirmVehicleSearch} onChange={setConfirmVehicleSearch} placeholder="Name suchen …" />
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                                {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && r.name !== me && matchesSearch(r.name, confirmVehicleSearch)).map((r) => (
                                  <button key={r.name} style={styles.rosterItem} onClick={() => requestVehicleConfirmation(v.id, r.name)}>{r.name}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  <>
                    <button style={styles.exportBtn} onClick={exportFuehrerschein}><Download size={14} /> Als Excel-Liste exportieren</button>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ADMIN-ÜBERSICHT EINSATZABTEILUNG</div>
                    {roster.filter((r) => r.bereiche.includes("einsatzabteilung")).map((r) => (
                      <div key={r.name} style={styles.kontrollRow}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{r.name}</div>
                        <FuehrerscheinLine label="PKW" icon={<Car size={13} />} data={r.fuehrerschein.pkw} isSelf={r.name === me} onConfirm={() => confirmFuehrerschein(r.name, "pkw")} onToggleHas={() => toggleHasLicense(r.name, "pkw")} />
                        <FuehrerscheinLine label="LKW" icon={<Truck size={13} />} data={r.fuehrerschein.lkw} isSelf={r.name === me} onConfirm={() => confirmFuehrerschein(r.name, "lkw")} onToggleHas={() => toggleHasLicense(r.name, "lkw")} />
                        {r.fuehrerschein.lkw.hasLicense && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11.5, color: "#5C5F58" }}>LKW gültig bis:</span>
                            <input key={`lkwab-${r.name}-${r.fuehrerschein.lkw.ablaufDatum || ""}`} style={{ ...styles.input, width: 140, padding: "5px 8px", fontSize: 11.5 }} type="date" defaultValue={r.fuehrerschein.lkw.ablaufDatum || ""} onBlur={(e) => { if (e.target.value !== (r.fuehrerschein.lkw.ablaufDatum || "")) setLkwAblauf(r.name, e.target.value); }} />
                            {r.fuehrerschein.lkw.ablaufDatum && daysUntil(r.fuehrerschein.lkw.ablaufDatum) < 0 && <span style={{ fontSize: 11, color: "#C1272D", fontWeight: 700 }}>abgelaufen</span>}
                            {r.fuehrerschein.lkw.ablaufDatum && daysUntil(r.fuehrerschein.lkw.ablaufDatum) >= 0 && daysUntil(r.fuehrerschein.lkw.ablaufDatum) <= 122 && <span style={{ fontSize: 11, color: "#B8791A", fontWeight: 700 }}>läuft bald ab</span>}
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "16px 0 6px", letterSpacing: "0.04em" }}>FAHRZEUGE VERWALTEN</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input style={{ ...styles.input, flex: 1 }} placeholder="Neues Fahrzeug (z. B. LF 20)" value={newVehicleName} onChange={(e) => setNewVehicleName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newVehicleName.trim()) { addVehicle(newVehicleName, newVehicleType); setNewVehicleName(""); } }} />
                      <select style={{ ...styles.input, width: 88 }} value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)}>
                        <option value="pkw">PKW</option>
                        <option value="lkw">LKW</option>
                      </select>
                      <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => { if (newVehicleName.trim()) { addVehicle(newVehicleName, newVehicleType); setNewVehicleName(""); } }}><Plus size={16} /></button>
                    </div>
                    {vehicles.map((v) => (
                      <div key={v.id} style={styles.kontrollRow}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          {editVehicleId === v.id ? (
                            <div style={{ display: "flex", gap: 6, flex: 1 }}>
                              <input style={{ ...styles.input, flex: 1, padding: "6px 9px", fontSize: 13 }} value={editVehicleName} onChange={(e) => setEditVehicleName(e.target.value)} autoFocus />
                              <select style={{ ...styles.input, width: 80, padding: "6px 9px", fontSize: 13 }} value={editVehicleType} onChange={(e) => setEditVehicleType(e.target.value)}>
                                <option value="pkw">PKW</option>
                                <option value="lkw">LKW</option>
                              </select>
                              <button style={styles.tinyBtnPrimary} onClick={() => { if (editVehicleName.trim()) { renameVehicle(v.id, editVehicleName.trim(), editVehicleType); setEditVehicleId(null); } }}><Check size={13} /></button>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.name} <span style={{ fontSize: 10, fontWeight: 700, color: "#8A8C86" }}>({v.type === "lkw" ? "LKW" : "PKW"})</span></div>
                          )}
                          <div style={{ display: "flex", gap: 4 }}>
                            {editVehicleId !== v.id && <button style={styles.rosterRemoveBtn} onClick={() => { setEditVehicleId(v.id); setEditVehicleName(v.name); setEditVehicleType(v.type || "pkw"); }}><Pencil size={13} /></button>}
                            <button style={styles.rosterRemoveBtn} onClick={() => setConfirmDeleteVehicleId(v.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {roster.filter((r) => r.bereiche.includes("einsatzabteilung") && (v.type === "lkw" ? r.fuehrerschein.lkw.hasLicense : r.fuehrerschein.pkw.hasLicense)).map((r) => {
                          const status = getVehicleStatus(r, v.id);
                          return (
                            <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: status.confirmedBy ? "#1F6F5C" : "#8A8C86", marginBottom: 2 }}>
                              <span>{r.name}: {status.confirmedBy ? `eingewiesen (${status.confirmedBy}, ${fmtDate(status.confirmedDate)})` : "offen"}</span>
                              {!status.confirmedBy && <button style={styles.tinyBtn} onClick={() => confirmVehicleInstruction(r.name, v.id)}>direkt bestätigen</button>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
  );
}
