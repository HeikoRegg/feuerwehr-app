import React, { useState } from "react";
import { ChevronDown, Clock, EyeOff, HandHelping, Landmark, Lock, MapPin, Pencil, Plus, RotateCcw, Search, UserCheck, UserCog, UserX, Users, X } from "lucide-react";
import { BEREICHE, BEREICH_KEYS, CATEGORIES, GRUPPENFUEHRER_CATEGORIES } from "../lib/constants";
import { BereichIcon } from "./BereichIcon";
import { currentYear, daysUntil, fmtDate, formatDateParts, todayISO, totalHeadcount } from "../lib/helpers";
import { styles } from "../lib/styles";

// Einfache Liste zum Pflegen von Auswahlwerten (Ränge, Funktionen) in den Einstellungen.
export function SimpleListEditor({ items, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => { const t = input.trim(); if (!t || items.includes(t)) return; onChange([...items, t]); setInput(""); };
  const move = (idx, dir) => { const next = [...items]; const j = idx + dir; if (j < 0 || j >= next.length) return; [next[idx], next[j]] = [next[j], next[idx]]; onChange(next); };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input style={{ ...styles.input, flex: 1 }} placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={add}><Plus size={16} /></button>
      </div>
      {items.map((it, idx) => (
        <div key={it} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #E2DFD6", borderRadius: 6, padding: "5px 8px", marginBottom: 4 }}>
          <span style={{ fontSize: 12.5 }}>{it}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={styles.tinyIconBtn} aria-label="nach oben" onClick={() => move(idx, -1)}><ChevronDown size={12} style={{ transform: "rotate(180deg)" }} /></button>
            <button style={styles.tinyIconBtn} aria-label="nach unten" onClick={() => move(idx, 1)}><ChevronDown size={12} /></button>
            <button style={styles.tinyIconBtn} aria-label="entfernen" onClick={() => onChange(items.filter((x) => x !== it))}><X size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FuehrerscheinLine({ label, icon, data, isSelf, onConfirm, onToggleHas }) {
  const ok = !data.hasLicense || data.confirmedYear === currentYear();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>{icon} {label}: {!data.hasLicense ? <span style={{ color: "#8A8C86" }}>keiner</span> : ok ? <span style={{ color: "#1F6F5C", fontWeight: 600 }}>bestätigt ({data.confirmedBy})</span> : data.problemReported ? <span style={{ color: "#C1272D", fontWeight: 600 }}>Problem: {data.problemReportedBy}</span> : <span style={{ color: "#B8791A", fontWeight: 600 }}>offen</span>}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {onToggleHas && <button style={styles.tinyBtn} onClick={onToggleHas}>{data.hasLicense ? "kein " + label : "hat " + label}</button>}
        {!isSelf && data.hasLicense && !ok && <button style={styles.tinyBtnPrimary} onClick={onConfirm}>Bestätigen</button>}
      </div>
    </div>
  );
}

export function RosterAdminRow({ r, isAdminName, onResetPin, onRequestRemove, onRequestBlock, onToggleBereich, onTogglePerm, onToggleAtemschutz, onToggleGruppenfuehrer, onToggleAusschuss, onToggleAusschussRecht }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.rosterManageItemFull}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span>{r.name} {isAdminName && <span style={styles.adminTag}>Admin</span>}{!r.hasPin && <span style={styles.pinPendingTag}>PIN offen</span>}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button style={styles.rosterRemoveBtn} title="PIN zurücksetzen" onClick={(e) => { e.stopPropagation(); onResetPin(); }}><RotateCcw size={13} /></button>
          {!isAdminName && onRequestBlock && <button style={styles.rosterRemoveBtn} title="Sperren" onClick={(e) => { e.stopPropagation(); onRequestBlock(); }}><Lock size={13} /></button>}
          {!isAdminName && <button style={styles.rosterRemoveBtn} title="Entfernen" onClick={(e) => { e.stopPropagation(); onRequestRemove(); }}><X size={13} /></button>}
          <ChevronDown size={14} color="#8A8C86" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8C86", marginBottom: 5 }}>BEREICHE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {BEREICH_KEYS.map((b) => (
              <button key={b} onClick={() => onToggleBereich(b)} style={{ ...styles.categoryChip, fontSize: 11, padding: "4px 9px", background: r.bereiche.includes(b) ? BEREICHE[b].color : "#F3F1EC", color: r.bereiche.includes(b) ? "white" : "#5C5F58", borderColor: r.bereiche.includes(b) ? BEREICHE[b].color : "#E2DFD6" }}><BereichIcon bereich={b} size={11} /> {BEREICHE[b].label}</button>
            ))}
            <button onClick={onToggleAusschuss} style={{ ...styles.categoryChip, fontSize: 11, padding: "4px 9px", background: r.ausschuss ? "#4A6670" : "#F3F1EC", color: r.ausschuss ? "white" : "#5C5F58", borderColor: r.ausschuss ? "#4A6670" : "#E2DFD6" }}><Landmark size={11} /> Ausschuss</button>
          </div>
          {r.bereiche.length > 0 && (<>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8C86", marginBottom: 5 }}>RECHTE PRO BEREICH</div>
            {r.bereiche.map((b) => (
              <div key={b} style={{ display: "flex", gap: 14, marginBottom: 4, fontSize: 11.5, color: "#5C5F58" }}>
                <span style={{ width: 90, fontWeight: 600 }}>{BEREICHE[b].short}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.rechte[b].calendar} onChange={() => onTogglePerm(b, "calendar")} /> Kalender</label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.rechte[b].news} onChange={() => onTogglePerm(b, "news")} /> Mitteilungen</label>
              </div>
            ))}
          </>)}
          {r.ausschuss && (
            <div style={{ display: "flex", gap: 14, marginBottom: 4, fontSize: 11.5, color: "#5C5F58" }}>
              <span style={{ width: 90, fontWeight: 600 }}>Ausschuss</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.ausschussRechte.calendar} onChange={() => onToggleAusschussRecht("calendar")} /> Einladung erstellen</label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={r.ausschussRechte.protokoll} onChange={() => onToggleAusschussRecht("protokoll")} /> Protokoll führen</label>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#5C5F58" }}><input type="checkbox" checked={r.atemschutz} onChange={onToggleAtemschutz} /> Atemschutzträger (G26.3-Pflicht)</label>
          {r.bereiche.includes("einsatzabteilung") && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#5C5F58" }}><input type="checkbox" checked={r.gruppenfuehrer} onChange={onToggleGruppenfuehrer} /> Kann als Gruppenführer eingeteilt werden</label>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <Search size={14} color="#A5A79F" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
      <input style={{ ...styles.input, paddingLeft: 30 }} placeholder={placeholder || "Suchen …"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ResponseButtons({ ev, me, onRespond, size = "normal" }) {
  const myStatus = (ev.responses || {})[me]; const small = size === "small";
  const locked = ev.anmeldeschluss && todayISO() > ev.anmeldeschluss;
  return (
    <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={locked} onClick={() => onRespond(ev.id, "zu")} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: myStatus === "zu" ? "#2E7D46" : "white", color: myStatus === "zu" ? "white" : "#2E7D46", borderColor: "#2E7D46" }}><UserCheck size={small ? 12 : 14} /> Zusage</button>
        <button disabled={locked} onClick={() => onRespond(ev.id, "ab")} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: myStatus === "ab" ? "#C1272D" : "white", color: myStatus === "ab" ? "white" : "#C1272D", borderColor: "#C1272D" }}><UserX size={small ? 12 : 14} /> Absage</button>
      </div>
      {locked && <span style={{ fontSize: 10.5, color: "#C1272D" }}>Anmeldeschluss ({fmtDate(ev.anmeldeschluss)}) erreicht</span>}
    </div>
  );
}
export function GuestStepper({ ev, me, onChange }) {
  if ((ev.responses || {})[me] !== "zu") return null;
  const guests = (ev.guests || {})[me] || 0;
  const locked = ev.anmeldeschluss && todayISO() > ev.anmeldeschluss;
  return (
    <div style={styles.guestStepper}>
      <span style={{ fontSize: 11, color: "#8A8C86" }}>+ Begleitung:</span>
      <button style={styles.tinyBtn} disabled={locked} onClick={() => onChange(ev.id, guests - 1)}>−</button>
      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 14, textAlign: "center" }}>{guests}</span>
      <button style={styles.tinyBtn} disabled={locked} onClick={() => onChange(ev.id, guests + 1)}>+</button>
    </div>
  );
}
export function SignupButton({ ev, me, onSignup, size = "normal" }) {
  const signups = ev.signups || {}; const count = Object.keys(signups).length; const needed = ev.capacityNeeded || 0;
  const imIn = !!signups[me]; const full = count >= needed && !imIn; const small = size === "small";
  return (
    <button onClick={() => onSignup(ev.id)} disabled={full} style={{ ...styles.respBtn, ...(small ? styles.respBtnSmall : {}), background: imIn ? "#1F6F5C" : full ? "#E2DFD6" : "white", color: imIn ? "white" : full ? "#9A9C95" : "#1F6F5C", borderColor: imIn ? "#1F6F5C" : full ? "#E2DFD6" : "#1F6F5C" }}>
      <HandHelping size={small ? 12 : 14} /> {imIn ? "Bin dabei" : full ? "Voll belegt" : "Ich bin dabei"}
    </button>
  );
}
export function CapacityCounter({ ev, canEdit }) {
  const signups = ev.signups || {}; const names = Object.keys(signups); const needed = ev.capacityNeeded || 0; const showNames = ev.namesVisible || canEdit;
  return (
    <div style={styles.capacityCounterRow}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: names.length >= needed ? "#1F6F5C" : "#B8791A" }}>{names.length} von {needed} angemeldet</span>
      {showNames && names.length > 0 && <span style={styles.capacityNames}>{names.join(", ")}</span>}
      {!showNames && <span style={styles.capacityNamesHidden}><EyeOff size={11} /> Namen ausgeblendet</span>}
    </div>
  );
}
export function EventBadge({ label }) { if (!label) return null; const bg = label === "Neu" ? "#E8A33D" : "#4A6670"; return <span style={{ fontSize: 9, fontWeight: 700, color: "white", background: bg, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase" }}>{label}</span>; }

export function GruppenfuehrerTag({ ev }) {
  const applicable = ev.bereich === "einsatzabteilung" && GRUPPENFUEHRER_CATEGORIES.includes(ev.category);
  if (!applicable) return null;
  if (ev.gruppenfuehrer) return <span style={styles.gfTagSet}><UserCog size={11} /> {ev.gruppenfuehrer}</span>;
  return <span style={styles.gfTagMissing} title="Gruppenführer noch nicht festgelegt"><UserCog size={11} /></span>;
}

export function HeroCard({ ev, me, onRespond, onSignup, onSetGuests, showBereich, badgeLabel }) {
  const { day, monthShort, weekday } = formatDateParts(ev.date); const cat = CATEGORIES[ev.category]; const diff = daysUntil(ev.date);
  const relLabel = diff === 0 ? "HEUTE" : diff === 1 ? "MORGEN" : `IN ${diff} TAGEN`;
  const responses = ev.responses || {}; const zuCount = Object.values(responses).filter((v) => v === "zu").length; const abCount = Object.values(responses).filter((v) => v === "ab").length;
  const isFeier = ev.category === "sonstiges" && !ev.capacityMode;
  return (
    <div style={styles.heroCard}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={styles.heroDateBlock}><div style={styles.heroDay}>{day}</div><div style={styles.heroMonth}>{monthShort}</div></div>
        <div style={styles.heroDivider} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={styles.heroRel}>{relLabel} · {weekday}</span>
            <EventBadge label={badgeLabel} />
            {showBereich && <span style={styles.miniBereichTagDark}><BereichIcon bereich={ev.bereich} size={11} /> {BEREICHE[ev.bereich].short}</span>}
          </div>
          <div style={styles.heroTitle}>{ev.title}</div>
          <div style={styles.heroMeta}><span style={styles.heroMetaItem}><Clock size={12} /> {ev.time} Uhr</span>{ev.location && <span style={styles.heroMetaItem}><MapPin size={12} /> {ev.location}</span>}<GruppenfuehrerTag ev={ev} /></div>
        </div>
        <span style={{ ...styles.heroBadge, background: cat.color }}>{cat.label}</span>
      </div>
      <div style={styles.heroRespRow}>
        {ev.capacityMode ? <SignupButton ev={ev} me={me} onSignup={onSignup} /> : <ResponseButtons ev={ev} me={me} onRespond={onRespond} />}
        {ev.capacityMode ? <span style={styles.heroCounts}>{Object.keys(ev.signups || {}).length} von {ev.capacityNeeded} angemeldet</span> : <span style={styles.heroCounts}>{zuCount} zugesagt · {abCount} abgesagt{isFeier ? ` · ${totalHeadcount(ev)} Personen gesamt` : ""}</span>}
      </div>
      {isFeier && <GuestStepper ev={ev} me={me} onChange={onSetGuests} />}
    </div>
  );
}

export function EventCard({ ev, me, canEdit, expanded, onToggleExpand, onRespond, onSignup, onSetGuests, onEdit, showBereich, badgeLabel, roster, onToggleAttendance, isArchived }) {
  const [showAttendance, setShowAttendance] = useState(false);
  const { day, monthShort, weekday } = formatDateParts(ev.date); const cat = CATEGORIES[ev.category];
  const responses = ev.responses || {}; const zuNames = Object.entries(responses).filter(([, v]) => v === "zu").map(([n]) => n); const abNames = Object.entries(responses).filter(([, v]) => v === "ab").map(([n]) => n);
  const anwesenheit = ev.anwesenheit || {};
  const anwesendCount = Object.values(anwesenheit).filter(Boolean).length;
  const isFeier = ev.category === "sonstiges" && !ev.capacityMode;
  const guests = ev.guests || {};
  return (
    <div className="card-enter" style={{ ...styles.eventCard, borderLeftColor: cat.color }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={styles.eventDateCol}><div style={styles.eventDay}>{day}</div><div style={styles.eventWeekday}>{weekday}</div></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.eventTitleRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={styles.eventTitle}>{ev.title}</span>
              <EventBadge label={badgeLabel} />
              {showBereich && <span style={styles.miniBereichTag}><BereichIcon bereich={ev.bereich} size={11} /> {BEREICHE[ev.bereich].short}</span>}
            </div>
            <span style={{ ...styles.eventBadge, background: cat.bg, color: cat.color }}>{cat.label}</span>
          </div>
          <div style={styles.eventMeta}><span style={styles.eventMetaItem}><Clock size={11} /> {ev.time}</span>{ev.location && <span style={styles.eventMetaItem}><MapPin size={11} /> {ev.location}</span>}<GruppenfuehrerTag ev={ev} /></div>
          {ev.notes && <div style={styles.eventNotes}>{ev.notes}</div>}
        </div>
        {canEdit && <button style={styles.editBtn} onClick={onEdit} aria-label="Bearbeiten"><Pencil size={14} color="#8A8C86" /></button>}
      </div>
      {ev.capacityMode ? (
        <div style={styles.eventRespFooter}><SignupButton ev={ev} me={me} onSignup={onSignup} size="small" /><CapacityCounter ev={ev} canEdit={canEdit} /></div>
      ) : (
        <>
          <div style={styles.eventRespFooter}>
            <ResponseButtons ev={ev} me={me} onRespond={onRespond} size="small" />
            <button style={styles.expandLink} onClick={onToggleExpand}>{zuNames.length} zugesagt{abNames.length > 0 ? ` · ${abNames.length} abgesagt` : ""}{isFeier ? ` · ${totalHeadcount(ev)} gesamt` : ""}</button>
          </div>
          {isFeier && <GuestStepper ev={ev} me={me} onChange={onSetGuests} />}
          {expanded && (
            <div style={styles.expandPanel}>
              {zuNames.length > 0 && <div style={styles.expandLine}><strong>Zugesagt:</strong> {zuNames.map((n) => guests[n] ? `${n} (+${guests[n]})` : n).join(", ")}</div>}
              {abNames.length > 0 && <div style={styles.expandLine}><strong>Abgesagt:</strong> {abNames.join(", ")}</div>}
              {zuNames.length === 0 && abNames.length === 0 && <div style={styles.expandLine}>Noch keine Rückmeldungen.</div>}
            </div>
          )}
        </>
      )}
      {canEdit && roster && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E2DFD6" }}>
          <button style={styles.expandSitzungBtn} onClick={() => setShowAttendance(!showAttendance)}>
            <Users size={12} /> Anwesenheit{anwesendCount > 0 ? ` (${anwesendCount})` : ""} <ChevronDown size={12} style={{ transform: showAttendance ? "rotate(180deg)" : "none" }} />
          </button>
          {showAttendance && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {roster.filter((r) => r.bereiche.includes(ev.bereich)).map((r) => (
                <label key={r.name} style={styles.attendanceRow}>
                  <input type="checkbox" style={styles.attendanceCheckbox} checked={!!anwesenheit[r.name]} onChange={() => onToggleAttendance(ev.id, r.name)} />
                  <span>{r.name}</span>
                </label>
              ))}
              {roster.filter((r) => r.bereiche.includes(ev.bereich)).length === 0 && <div style={{ fontSize: 11.5, color: "#8A8C86" }}>Niemand diesem Bereich zugeordnet.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TabBtn({ active, onClick, label, color, dot }) {
  return (
    <button onClick={onClick} style={{ ...styles.tabBtn, position: "relative", background: active ? (color || "#2C2F2A") : "transparent", color: active ? "white" : "#5C5F58", borderColor: active ? (color || "#2C2F2A") : "#E2DFD6" }}>
      {label}
      {dot && <span style={styles.tabDot} />}
    </button>
  );
}
