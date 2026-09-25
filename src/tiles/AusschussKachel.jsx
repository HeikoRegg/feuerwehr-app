import React from "react";
import { ArrowLeft, Check, ChevronDown, HandHelping, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { fmtDate, todayISO } from "../lib/helpers";
import { styles } from "../lib/styles";
import { useApp } from "../AppContext";

// Kachel Ausschuss: Sitzungen, Anwesenheit, Protokoll, Abstimmungen
export default function AusschussKachel() {
  const { roster, me, setConfirmDeleteSitzungId, sitzungen, expandedSitzung, setExpandedSitzung, showSitzungArchiv, setShowSitzungArchiv, setConfirmResetVote, voteStartDraft, setVoteStartDraft, kachelReturnTo, canEditSitzung, canEditProtokoll, closeKachelView, openNewSitzung, openEditSitzung, setAnwesenheit, saveProtokollText, eligibleVoters, voteResult, startAbstimmung, castVote, finalizeAbstimmung, exportSitzungFile } = useApp();
        const upcoming = sitzungen.filter((s) => s.date >= todayISO()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const past = sitzungen.filter((s) => s.date < todayISO()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        const renderSitzung = (s) => (
          <div key={s.id} style={styles.kontrollRow}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpandedSitzung(expandedSitzung === s.id ? null : s.id)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#8A8C86" }}>{fmtDate(s.date)} · {s.time} Uhr{s.location && ` · ${s.location}`}</div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {canEditSitzung && <button style={styles.rosterRemoveBtn} title="Termin bearbeiten" onClick={(e) => { e.stopPropagation(); openEditSitzung(s); }}><Pencil size={13} /></button>}
                <button style={styles.expandSitzungBtn} onClick={(e) => { e.stopPropagation(); setExpandedSitzung(expandedSitzung === s.id ? null : s.id); }}>
                  Protokoll & Anwesenheit <ChevronDown size={13} style={{ transform: expandedSitzung === s.id ? "rotate(180deg)" : "none" }} />
                </button>
              </div>
            </div>
            {expandedSitzung === s.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>ANWESENHEIT</div>
                {roster.filter((r) => r.ausschuss).map((r) => {
                  const status = (s.anwesenheit || {})[r.name];
                  return (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, color: "#2C2F2A" }}>{r.name}</span>
                      {canEditProtokoll ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => setAnwesenheit(s.id, r.name, "anwesend")} style={{ ...styles.tinyBtn, background: status === "anwesend" ? "#1F6F5C" : "#F3F1EC", color: status === "anwesend" ? "white" : "#5C5F58", borderColor: status === "anwesend" ? "#1F6F5C" : "#E2DFD6" }}>Anwesend</button>
                          <button onClick={() => setAnwesenheit(s.id, r.name, "entschuldigt")} style={{ ...styles.tinyBtn, background: status === "entschuldigt" ? "#B8791A" : "#F3F1EC", color: status === "entschuldigt" ? "white" : "#5C5F58", borderColor: status === "entschuldigt" ? "#B8791A" : "#E2DFD6" }}>Entschuldigt</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: status === "anwesend" ? "#1F6F5C" : status === "entschuldigt" ? "#B8791A" : "#A5A79F", fontWeight: 600 }}>{status === "anwesend" ? "Anwesend" : status === "entschuldigt" ? "Entschuldigt" : "—"}</span>
                      )}
                    </div>
                  );
                })}
                {roster.filter((r) => r.ausschuss).length === 0 && <div style={{ fontSize: 11.5, color: "#8A8C86" }}>Noch niemand dem Ausschuss zugeordnet.</div>}

                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px" }}>TAGESORDNUNG & PROTOKOLL</div>
                {s.tagesordnung.map((point, idx) => {
                  const ab = (s.abstimmungen || {})[idx];
                  const eligible = eligibleVoters(s);
                  const iVoted = ab && ab.votes[me];
                  const canVote = ab && ab.active && eligible.includes(me);
                  const result = ab && ab.finalized ? voteResult(ab) : null;
                  return (
                    <div key={idx} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2F2A", marginBottom: 4 }}>{idx + 1}. {point}</div>
                      {canEditProtokoll ? (
                        <textarea key={`protokoll-${s.id}-${idx}-${s.protokoll[idx] || ""}`} style={{ ...styles.input, minHeight: 50, resize: "vertical", fontSize: 12.5 }} placeholder="Protokolltext …" defaultValue={s.protokoll[idx] || ""} onBlur={(e) => { if (e.target.value !== (s.protokoll[idx] || "")) saveProtokollText(s.id, idx, e.target.value); }} />
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#5C5F58", lineHeight: 1.4 }}>{s.protokoll[idx] || <span style={{ color: "#A5A79F" }}>Noch kein Protokoll.</span>}</div>
                      )}

                      <div style={styles.voteBox}>
                        {!ab && canEditProtokoll && voteStartDraft && voteStartDraft.sitzungId === s.id && voteStartDraft.idx === idx && (
                          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <input style={{ ...styles.input, flex: 1, fontSize: 12.5 }} placeholder="Kurzer Text zur Abstimmung (optional)" value={voteStartDraft.text} onChange={(e) => setVoteStartDraft({ ...voteStartDraft, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { startAbstimmung(s.id, idx, voteStartDraft.text); setVoteStartDraft(null); } }} autoFocus />
                            <button style={{ ...styles.saveBtn, flex: "none", padding: "0 12px" }} onClick={() => { startAbstimmung(s.id, idx, voteStartDraft.text); setVoteStartDraft(null); }}><Check size={14} /></button>
                          </div>
                        )}
                        {!ab && canEditProtokoll && !(voteStartDraft && voteStartDraft.sitzungId === s.id && voteStartDraft.idx === idx) && (
                          <button style={styles.smallAddBtn} onClick={() => setVoteStartDraft({ sitzungId: s.id, idx, text: "" })}><HandHelping size={12} /> Abstimmung starten</button>
                        )}
                        {ab && ab.text && <div style={styles.voteAntrag}>„{ab.text}"</div>}
                        {ab && ab.active && (
                          <>
                            {canVote && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button style={{ ...styles.respBtnSmall, ...styles.respBtn, background: iVoted === "dafuer" ? "#1F6F5C" : "white", color: iVoted === "dafuer" ? "white" : "#1F6F5C", borderColor: "#1F6F5C" }} onClick={() => castVote(s.id, idx, "dafuer")}>Dafür</button>
                                <button style={{ ...styles.respBtnSmall, ...styles.respBtn, background: iVoted === "dagegen" ? "#C1272D" : "white", color: iVoted === "dagegen" ? "white" : "#C1272D", borderColor: "#C1272D" }} onClick={() => castVote(s.id, idx, "dagegen")}>Dagegen</button>
                              </div>
                            )}
                            {iVoted && <div style={styles.voteNote}>Du hast abgestimmt: <strong>{iVoted === "dafuer" ? "Dafür" : "Dagegen"}</strong> — kannst du noch ändern, bis alle abgestimmt haben.</div>}
                            {!eligible.includes(me) && !iVoted && <div style={styles.voteNote}>Nur anwesende Ausschussmitglieder können abstimmen.</div>}
                            {canEditProtokoll && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                <span style={styles.voteNote}>{Object.keys(ab.votes).length} von {eligible.length} Stimmen abgegeben</span>
                                <button style={styles.tinyBtn} onClick={() => finalizeAbstimmung(s.id, idx)}>Jetzt auswerten</button>
                              </div>
                            )}
                          </>
                        )}
                        {result && (
                          <div style={styles.voteResultBox}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: result.label === "angenommen" ? "#1F6F5C" : result.label === "abgelehnt" ? "#C1272D" : "#5C5F58" }}>
                              Ergebnis: {result.dafuer} dafür · {result.dagegen} dagegen — {result.label}
                            </div>
                            <div style={{ fontSize: 11, color: "#8A8C86", marginTop: 3 }}>
                              {Object.entries(ab.votes).map(([n, v]) => `${n}: ${v === "dafuer" ? "dafür" : "dagegen"}`).join(" · ")}
                            </div>
                            {canEditProtokoll && (
                              <button style={{ ...styles.tinyBtn, marginTop: 5 }} onClick={() => setConfirmResetVote({ sitzungId: s.id, idx })}>Abstimmung zurücksetzen</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {s.links && <div style={{ fontSize: 11.5, color: "#4A6670", marginTop: 4, wordBreak: "break-all" }}>Link: {s.links}</div>}
                {(s.attachments || []).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {s.attachments.map((a, idx) => (
                      <a key={idx} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11.5, color: "#4A6670", marginBottom: 3 }}>📎 {a.name}</a>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button style={styles.exportBtn} onClick={() => exportSitzungFile(s.id)}><Printer size={14} /> Als PDF anzeigen / drucken</button>
                  {canEditSitzung && <button style={styles.deleteBtn} onClick={() => setConfirmDeleteSitzungId(s.id)}><Trash2 size={14} /> Löschen</button>}
                </div>
              </div>
            )}
          </div>
        );
        return (
          <div style={styles.fullscreenPage}>
            <div style={styles.fullscreenHeader}>
              <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
            </div>
            <div style={styles.modalTitle}>Ausschuss</div>
            <div style={{ marginTop: 14 }}>
              {canEditSitzung && <button style={styles.smallAddBtn} onClick={openNewSitzung}><Plus size={13} /> Neue Sitzung</button>}
              <div style={{ marginTop: 12 }}>
                {upcoming.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8C86", marginBottom: 10 }}>Keine anstehenden Sitzungen.</div>}
                {upcoming.map(renderSitzung)}

                {past.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button style={styles.advancedToggle} onClick={() => setShowSitzungArchiv(!showSitzungArchiv)}>
                      <ChevronDown size={13} style={{ transform: showSitzungArchiv ? "rotate(180deg)" : "none" }} /> Archiv ({past.length})
                    </button>
                    {showSitzungArchiv && <div style={{ marginTop: 10 }}>{past.map(renderSitzung)}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
}
