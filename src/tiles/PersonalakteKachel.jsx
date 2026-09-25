import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight, KeyRound, Plus, Printer, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { FUEHRERSCHEIN_KLASSEN, JUBILAEUMS_JAHRE, RUNDE_GEBURTSTAGE_EXTRA } from "../lib/constants";
import { callServer, compressImage, currentYear, dienstbeginn, dienstjahreImJahr, fmtDate, matchesSearch, todayISO, uid } from "../lib/helpers";
import { styles } from "../lib/styles";
import { LION_ICON } from "../lib/icons";
import { SearchBox } from "../components/Shared";

// ============================================================================
// Personalakte – sichtbar nur für die Person selbst und den Admin.
// Alle Daten laufen ausschließlich über die geschützte Serverfunktion
// "personalakte" (Netlify), nie direkt über die öffentliche Datenbank.
// ============================================================================
export const emptyAkte = () => ({
  strasse: "", plz: "", ort: "", email: "", telefon: "", geburtsdatum: "",
  arbeitgeber: { name: "", telefon: "", email: "" },
  notfallkontakt: { name: "", telefon: "" },
  bemerkung: "", eintrittsdatum: "",
  lehrgaenge: [], leistungsabzeichen: [], funktionen: [], mitgliedsverlauf: [],
  befoerderungen: [], ehrungen: [],
});
export function normalizeAkte(d) {
  const b = emptyAkte(); d = d || {};
  return {
    ...b, ...d,
    arbeitgeber: { ...b.arbeitgeber, ...(d.arbeitgeber || {}) },
    notfallkontakt: { ...b.notfallkontakt, ...(d.notfallkontakt || {}) },
    lehrgaenge: d.lehrgaenge || [], leistungsabzeichen: d.leistungsabzeichen || [], funktionen: d.funktionen || [],
    mitgliedsverlauf: d.mitgliedsverlauf || [], befoerderungen: d.befoerderungen || [], ehrungen: d.ehrungen || [],
  };
}
export function aktuellerRang(akte) {
  const list = [...((akte && akte.befoerderungen) || [])].filter((b) => b.rang).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  return list.length ? list[list.length - 1] : null;
}
export function nextBirthdayInfo(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date(todayISO() + "T00:00:00");
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return { days: Math.round((next - today) / 86400000), age: next.getFullYear() - y, date: next };
}

export function AkteSection({ title, children, adminOnly }) {
  return (
    <div style={styles.kontrollRow}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em", marginBottom: 8 }}>{title}{adminOnly && <span style={{ fontWeight: 600, color: "#A5A79F" }}> · nur Admin trägt ein</span>}</div>
      {children}
    </div>
  );
}
export function AkteField({ label, value, onChange, type = "text", readOnly, placeholder }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 2 }}>{label}</div>
      {readOnly ? (
        <div style={{ fontSize: 13, color: "#2C2F2A", minHeight: 18 }}>{type === "date" ? fmtDate(value) : (value || "—")}</div>
      ) : type === "textarea" ? (
        <textarea style={{ ...styles.input, minHeight: 60, resize: "vertical", fontSize: 13 }} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={{ ...styles.input, padding: "7px 9px", fontSize: 13 }} type={type} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
// Liste aus Einträgen mit Titel/Datum (Leistungsabzeichen, Ehrungen, Mitgliedsverlauf, Beförderungen)
export function AkteList({ items, onChange, readOnly, textKey = "titel", textLabel = "Bezeichnung", options, addLabel = "Eintrag hinzufügen" }) {
  const update = (id, patch) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const sorted = [...items].sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
  return (
    <div>
      {sorted.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F", marginBottom: 6 }}>Noch keine Einträge.</div>}
      {sorted.map((it) => (
        readOnly ? (
          <div key={it.id} style={{ fontSize: 12.5, color: "#2C2F2A", marginBottom: 4 }}>{it[textKey] || "—"} <span style={{ color: "#8A8C86" }}>{it.datum ? `· ${fmtDate(it.datum)}` : ""}</span></div>
        ) : (
          <div key={it.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
            {options ? (
              <select style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} value={it[textKey] || ""} onChange={(e) => update(it.id, { [textKey]: e.target.value })}>
                <option value="">— {textLabel} wählen —</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
                {it[textKey] && !options.includes(it[textKey]) && <option value={it[textKey]}>{it[textKey]}</option>}
              </select>
            ) : (
              <input style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} placeholder={textLabel} value={it[textKey] || ""} onChange={(e) => update(it.id, { [textKey]: e.target.value })} />
            )}
            <input style={{ ...styles.input, width: 140, padding: "6px 8px", fontSize: 12.5 }} type="date" value={it.datum || ""} onChange={(e) => update(it.id, { datum: e.target.value })} />
            <button style={styles.tinyIconBtn} aria-label="Entfernen" onClick={() => onChange(items.filter((x) => x.id !== it.id))}><X size={12} /></button>
          </div>
        )
      ))}
      {!readOnly && <button style={styles.smallAddBtn} onClick={() => onChange([...items, { id: uid(), [textKey]: "", datum: "" }])}><Plus size={12} /> {addLabel}</button>}
    </div>
  );
}
export function ChipPicker({ options, selected, onToggle, readOnly, emptyHint }) {
  if (!options.length) return <div style={{ fontSize: 12, color: "#A5A79F" }}>{emptyHint}</div>;
  if (readOnly) return <div style={{ fontSize: 12.5, color: "#2C2F2A" }}>{selected.length ? selected.join(", ") : "—"}</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return <button key={o} onClick={() => onToggle(o)} style={{ ...styles.categoryChip, fontSize: 11.5, padding: "4px 10px", background: on ? "#2C2F2A" : "#F3F1EC", color: on ? "white" : "#5C5F58", borderColor: on ? "#2C2F2A" : "#E2DFD6" }}>{o}</button>;
      })}
    </div>
  );
}

export default function PersonalakteView({ me, isAdmin, roster, config, callAuthed, flashError, onOpenPhoto, onSetKlassen, onClose }) {
  const [target, setTarget] = useState(isAdmin ? null : me);
  const [search, setSearch] = useState("");
  const [akte, setAkte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [errorText, setErrorText] = useState("");
  // Freischaltung für fremde Akten: gilt nur, solange diese Kachel offen ist.
  const [elevated, setElevated] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [agMode, setAgMode] = useState(false);
  const [agSelected, setAgSelected] = useState([]);
  const elevatedRef = useRef(null);
  useEffect(() => { elevatedRef.current = elevated; }, [elevated]);
  useEffect(() => () => {
    // Beim Schließen der Kachel die Freischaltung auch auf dem Server sofort beenden.
    if (elevatedRef.current) callServer("auth", { action: "dropElevation", elevatedToken: elevatedRef.current });
  }, []);

  useEffect(() => {
    if (!target) { setAkte(null); if (isAdmin && elevated) loadOverview(); return; }
    loadAkte(target);
  }, [target, elevated]);

  // Anfrage an die Personalakte-Funktion; bei fremden Akten mit Freischaltung.
  async function akteCall(body) {
    const r = await callAuthed("personalakte", { ...body, elevatedToken: elevatedRef.current });
    if (r.status === 403 && r.data && r.data.code === "PIN_NOETIG") { setElevated(null); setTarget(null); }
    return r;
  }
  async function freischalten() {
    if (!/^\d{4}$/.test(pinInput)) { setErrorText("Bitte deine 4-stellige PIN eingeben."); return; }
    setPinBusy(true); setErrorText("");
    const r = await callAuthed("auth", { action: "elevate", pin: pinInput });
    setPinBusy(false); setPinInput("");
    if (r.ok && r.data.elevatedToken) setElevated(r.data.elevatedToken);
    else if (r.data.error !== "abgebrochen") setErrorText(r.data.error || "PIN stimmt nicht.");
  }
  async function loadOverview() {
    setErrorText("");
    const r = await akteCall({ action: "list" });
    if (r.ok) setOverview(r.data.items || []);
    else if (r.data.error === "abgebrochen") onClose();
    else if (r.data.code !== "PIN_NOETIG") setErrorText(r.data.error || "Übersicht konnte nicht geladen werden.");
  }
  async function loadAkte(name) {
    setLoading(true); setErrorText("");
    const r = await akteCall({ action: "get", target: name });
    setLoading(false);
    if (r.ok) { setAkte(normalizeAkte(r.data.data)); setDirty(false); }
    else if (r.data.error === "abgebrochen") { if (isAdmin) setTarget(null); else onClose(); }
    else if (r.data.code !== "PIN_NOETIG") setErrorText(r.data.error || "Personalakte konnte nicht geladen werden.");
  }
  async function arbeitgeberlisteDrucken() {
    if (agSelected.length === 0) return;
    const w = window.open("", "_blank"); // sofort öffnen, sonst blockiert das Handy das Fenster
    const r = await akteCall({ action: "arbeitgeber", names: agSelected });
    if (!r.ok) { if (w) w.close(); if (r.data.error !== "abgebrochen" && r.data.code !== "PIN_NOETIG") flashError(r.data.error || "Liste konnte nicht erstellt werden."); return; }
    if (!w) { flashError("Das Druckfenster wurde vom Browser blockiert."); return; }
    const esc = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = (r.data.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.arbeitgeber.name) || "—"}</td><td>${esc(i.arbeitgeber.telefon) || "—"}</td><td>${esc(i.arbeitgeber.email) || "—"}</td></tr>`).join("");
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Arbeitgeberliste</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;padding:0 16px 70px;color:#2C2F2A;}table{border-collapse:collapse;width:100%;margin-top:12px;}th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left;}th{background:#F3F1EC;}.print-btn{position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;}@media print{.print-btn{display:none;}}</style></head><body><button class="no-print" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:20px;padding:9px 14px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">✕ Schließen</button><style>@media print { .no-print { display:none !important; } } @media screen { body { padding-top: 46px !important; } }</style>
<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #C1272D;padding-bottom:12px;"><img src="${LION_ICON}" style="width:44px;height:44px;object-fit:contain;"/><div><div style="font-size:19px;font-weight:700;">FEUERWEHR REGGLISWEILER</div><div style="font-size:12px;color:#8A8C86;">Arbeitgeberliste · erstellt am ${fmtDate(todayISO())}</div></div></div>
<table><thead><tr><th>Name</th><th>Arbeitgeber</th><th>Telefon</th><th>E-Mail</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:11px;color:#8A8C86;margin-top:18px;">Vertraulich – enthält personenbezogene Daten. Nur für den dienstlichen Gebrauch.</p>
<button class="print-btn" onclick="window.print()">🖨️ Drucken / Als PDF sichern</button></body></html>`);
    w.document.close();
    setAgMode(false);
  }
  function upd(patch) { setAkte((a) => ({ ...a, ...patch })); setDirty(true); }
  async function save(data) {
    setSaving(true);
    const clean = { ...data, lehrgaenge: data.lehrgaenge.map(({ photoUrl, ...rest }) => rest) };
    const r = await akteCall({ action: "save", target, data: clean });
    setSaving(false);
    if (r.ok) { setDirty(false); return true; }
    if (r.data.error !== "abgebrochen") flashError(r.data.error || "Personalakte konnte nicht gespeichert werden.");
    return false;
  }
  async function uploadLehrgangFoto(id, file) {
    if (!file) return;
    setUploadingId(id);
    try {
      file = await compressImage(file);
      const r = await akteCall({ action: "uploadUrl", target, filename: file.name });
      if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
      const { error } = await supabase.storage.from("personalakte").uploadToSignedUrl(r.data.path, r.data.uploadToken, file);
      if (error) throw error;
      const next = { ...akte, lehrgaenge: akte.lehrgaenge.map((l) => (l.id === id ? { ...l, photoPath: r.data.path } : l)) };
      if (await save(next)) await loadAkte(target);
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setUploadingId(null);
  }
  function back() {
    if (dirty && !window.confirm("Es gibt ungespeicherte Änderungen. Trotzdem zurück?")) return;
    if (isAdmin && target) setTarget(null); else onClose();
  }

  // ---------- Admin-Übersicht ----------
  if (isAdmin && !target && !elevated) {
    return (
      <div>
        <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Zurück</button></div>
        <div style={styles.modalTitle}>Personalakten</div>
        <div style={{ ...styles.kontrollRow, marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "18px 14px" }}>
          <KeyRound size={22} color="#C1272D" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Zum Öffnen der Personalakten bitte deine PIN eingeben</div>
          <div style={{ fontSize: 11.5, color: "#8A8C86", marginBottom: 12 }}>Die Freischaltung gilt, bis du diese Kachel wieder schließt.</div>
          <input style={{ ...styles.gateInput, letterSpacing: "0.5em", maxWidth: 180 }} type="password" inputMode="numeric" maxLength={4} value={pinInput} autoFocus
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && freischalten()} />
          {errorText && <div style={styles.errorText}>{errorText}</div>}
          <button style={{ ...styles.saveBtn, marginTop: 12, width: "100%", maxWidth: 220 }} disabled={pinBusy} onClick={freischalten}>{pinBusy ? "Prüfe …" : "Freischalten"}</button>
        </div>
        <button style={{ ...styles.rosterItem, marginTop: 10 }} onClick={() => setTarget(me)}><span>Nur meine eigene Akte öffnen</span><ChevronRight size={15} color="#A5A79F" /></button>
      </div>
    );
  }

  if (isAdmin && !target) {
    const gesperrtNamen = new Set(roster.filter((r) => r.gesperrt).map((r) => r.name));
    const items = (overview || []).filter((i) => !gesperrtNamen.has(i.name));
    const aktive = roster.filter((r) => !r.gesperrt);
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    const geburtstage = items.map((i) => ({ ...i, bd: nextBirthdayInfo(i.geburtsdatum) })).filter((i) => i.bd && i.bd.days <= 30).sort((a, b) => a.bd.days - b.bd.days);
    const rundeGeburtstage = items.filter((i) => i.geburtsdatum).map((i) => {
      const alter = currentYear() - Number(i.geburtsdatum.slice(0, 4));
      const datum = `${currentYear()}${i.geburtsdatum.slice(4)}`;
      return { ...i, alter, datum, vorbei: datum < todayISO() };
    }).filter((i) => RUNDE_GEBURTSTAGE_EXTRA.includes(i.alter) || (i.alter >= 20 && i.alter % 10 === 0)).sort((a, b) => a.datum.localeCompare(b.datum));
    const jubilaeen = items.filter((i) => i.eintrittsdatum).map((i) => ({ ...i, beginn: dienstbeginn(i.eintrittsdatum, i.geburtsdatum), jahre: dienstjahreImJahr(i.eintrittsdatum, i.geburtsdatum) })).filter((i) => JUBILAEUMS_JAHRE.includes(i.jahre)).sort((a, b) => b.jahre - a.jahre);
    return (
      <div>
        <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onClose}><ArrowLeft size={18} /> Zurück</button></div>
        <div style={styles.modalTitle}>Personalakten</div>
        {errorText && <div style={styles.errorText}>{errorText}</div>}
        {overview === null && !errorText && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}
        {overview !== null && (
          <div style={{ marginTop: 14 }}>
            <AkteSection title="GEBURTSTAGE (NÄCHSTE 30 TAGE)">
              {geburtstage.length === 0 ? <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine anstehenden Geburtstage.</div> : geburtstage.map((g) => (
                <div key={g.name} style={{ fontSize: 12.5, marginBottom: 3 }}><strong>{g.name}</strong> wird {g.bd.age} · {g.bd.days === 0 ? "heute 🎉" : g.bd.days === 1 ? "morgen" : `in ${g.bd.days} Tagen`} <span style={{ color: "#8A8C86" }}>({fmtDate(g.bd.date.toISOString().slice(0, 10))})</span></div>
              ))}
            </AkteSection>
            <AkteSection title={`RUNDE GEBURTSTAGE ${currentYear()}`}>
              {rundeGeburtstage.length === 0 ? <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine runden Geburtstage in diesem Jahr (bzw. Geburtsdaten noch nicht eingetragen).</div> : rundeGeburtstage.map((g) => (
                <div key={g.name} style={{ fontSize: 12.5, marginBottom: 3, color: g.vorbei ? "#A5A79F" : "#2C2F2A" }}><strong>{g.name}</strong> wird {g.alter} <span style={{ color: g.vorbei ? "#A5A79F" : "#8A8C86" }}>· {fmtDate(g.datum)}{g.vorbei ? " (war schon)" : ""}</span></div>
              ))}
            </AkteSection>
            <AkteSection title={`DIENSTJUBILÄEN ${currentYear()}`}>
              {jubilaeen.length === 0 ? <div style={{ fontSize: 12, color: "#A5A79F" }}>Keine Jubiläen in diesem Jahr (bzw. Eintrittsdaten noch nicht eingetragen).</div> : jubilaeen.map((j) => (
                <div key={j.name} style={{ fontSize: 12.5, marginBottom: 3 }}><strong>{j.name}</strong> · {j.jahre} Jahre <span style={{ color: "#8A8C86" }}>({j.beginn !== j.eintrittsdatum ? `gezählt ab 14. Geburtstag, ${fmtDate(j.beginn)}` : `Eintritt ${fmtDate(j.eintrittsdatum)}`})</span></div>
              ))}
            </AkteSection>
            <AkteSection title="ARBEITGEBERLISTE">
              {!agMode ? (
                <button style={styles.exportBtn} onClick={() => { setAgMode(true); setAgSelected([]); }}><Printer size={14} /> Arbeitgeberliste drucken</button>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <button style={styles.tinyBtn} onClick={() => setAgSelected(aktive.filter((r) => r.bereiche.includes("einsatzabteilung")).map((r) => r.name))}>Alle aus der Einsatzabteilung</button>
                    <button style={styles.tinyBtn} onClick={() => setAgSelected(aktive.map((r) => r.name))}>Alle</button>
                    <button style={styles.tinyBtn} onClick={() => setAgSelected([])}>Keine</button>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 8 }}>
                    {aktive.map((r) => (
                      <label key={r.name} style={styles.attendanceRow}>
                        <input type="checkbox" style={styles.attendanceCheckbox} checked={agSelected.includes(r.name)} onChange={() => setAgSelected((sel) => sel.includes(r.name) ? sel.filter((n) => n !== r.name) : [...sel, r.name])} />
                        <span>{r.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setAgMode(false)}>Abbrechen</button>
                    <button style={{ ...styles.saveBtn, flex: 1 }} disabled={agSelected.length === 0} onClick={arbeitgeberlisteDrucken}>Drucken ({agSelected.length})</button>
                  </div>
                </div>
              )}
            </AkteSection>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>ALLE MITGLIEDER</div>
            <SearchBox value={search} onChange={setSearch} placeholder="Name suchen …" />
            {aktive.filter((r) => matchesSearch(r.name, search)).map((r) => (
              <button key={r.name} style={{ ...styles.rosterItem, marginBottom: 6 }} onClick={() => setTarget(r.name)}>
                <span>{r.name}{byName[r.name] && byName[r.name].rang && <span style={{ fontSize: 11, color: "#8A8C86" }}> · {byName[r.name].rang}</span>}</span>
                <ChevronRight size={15} color="#A5A79F" />
              </button>
            ))}
            {roster.some((r) => r.gesperrt) && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "14px 0 6px", letterSpacing: "0.04em" }}>GESPERRTE MITGLIEDER</div>
                {roster.filter((r) => r.gesperrt).map((r) => (
                  <button key={r.name} style={{ ...styles.rosterItem, marginBottom: 6, opacity: 0.7 }} onClick={() => setTarget(r.name)}>
                    <span>{r.name}{r.gesperrtSeit && <span style={{ fontSize: 11, color: "#8A8C86" }}> · gesperrt seit {fmtDate(r.gesperrtSeit)}</span>}</span>
                    <ChevronRight size={15} color="#A5A79F" />
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------- Einzelne Akte ----------
  const entry = roster.find((r) => r.name === target);
  const klassen = (entry && entry.fuehrerscheinKlassen) || [];
  const rang = akte ? aktuellerRang(akte) : null;
  const dienstjahre = akte ? dienstjahreImJahr(akte.eintrittsdatum, akte.geburtsdatum) : null;
  const dienstbeginnDatum = akte ? dienstbeginn(akte.eintrittsdatum, akte.geburtsdatum) : null;
  return (
    <div>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={back}><ArrowLeft size={18} /> {isAdmin ? "Alle Personalakten" : "Zurück"}</button></div>
      <div style={styles.modalTitle}>Personalakte {target}</div>
      {rang && <div style={{ fontSize: 12.5, color: "#5C5F58", marginTop: 2 }}>{rang.rang}{rang.datum ? ` seit ${fmtDate(rang.datum)}` : ""}</div>}
      <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 12px" }}>Nur {isAdmin && target !== me ? `${target} und` : "du und"} der Admin können diese Akte sehen.</div>
      {errorText && <div style={styles.errorText}>{errorText}</div>}
      {loading && <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Lädt …</div>}
      {akte && !loading && (
        <>
          <AkteSection title="PERSÖNLICHES">
            <AkteField label="Geburtsdatum" type="date" value={akte.geburtsdatum} onChange={(v) => upd({ geburtsdatum: v })} />
            <AkteField label="Straße und Hausnummer" value={akte.strasse} onChange={(v) => upd({ strasse: v })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 90 }}><AkteField label="PLZ" value={akte.plz} onChange={(v) => upd({ plz: v })} /></div>
              <div style={{ flex: 1 }}><AkteField label="Ort" value={akte.ort} onChange={(v) => upd({ ort: v })} /></div>
            </div>
            <AkteField label="Telefon" type="tel" value={akte.telefon} onChange={(v) => upd({ telefon: v })} />
            <AkteField label="E-Mail" type="email" value={akte.email} onChange={(v) => upd({ email: v })} />
          </AkteSection>

          <AkteSection title="NOTFALLKONTAKT">
            <AkteField label="Name" value={akte.notfallkontakt.name} onChange={(v) => upd({ notfallkontakt: { ...akte.notfallkontakt, name: v } })} />
            <AkteField label="Telefon" type="tel" value={akte.notfallkontakt.telefon} onChange={(v) => upd({ notfallkontakt: { ...akte.notfallkontakt, telefon: v } })} />
          </AkteSection>

          <AkteSection title="ARBEITGEBER">
            <AkteField label="Name" value={akte.arbeitgeber.name} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, name: v } })} />
            <AkteField label="Telefon" type="tel" value={akte.arbeitgeber.telefon} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, telefon: v } })} />
            <AkteField label="E-Mail" type="email" value={akte.arbeitgeber.email} onChange={(v) => upd({ arbeitgeber: { ...akte.arbeitgeber, email: v } })} />
          </AkteSection>

          <AkteSection title="FEUERWEHR">
            <AkteField label="Eintrittsdatum" type="date" value={akte.eintrittsdatum} onChange={(v) => upd({ eintrittsdatum: v })} />
            {dienstjahre !== null && <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 8 }}>{dienstjahre} Dienstjahre (Stand {currentYear()}){dienstbeginnDatum !== akte.eintrittsdatum ? `, gezählt ab dem 14. Geburtstag (${fmtDate(dienstbeginnDatum)})` : ""}</div>}
            <div style={{ fontSize: 11, color: "#8A8C86", margin: "4px 0 4px" }}>Mitgliedsverlauf (Eintritt, Übertritte)</div>
            <AkteList items={akte.mitgliedsverlauf} onChange={(v) => upd({ mitgliedsverlauf: v })} textKey="text" textLabel="z. B. Übertritt Einsatzabteilung" />
            <div style={{ fontSize: 11, color: "#8A8C86", margin: "10px 0 4px" }}>Funktionen / Qualifikationen</div>
            <ChipPicker options={config.funktionen || []} selected={akte.funktionen} onToggle={(f) => upd({ funktionen: akte.funktionen.includes(f) ? akte.funktionen.filter((x) => x !== f) : [...akte.funktionen, f] })} emptyHint="Noch keine Funktionen angelegt (Admin: Einstellungen)." />
          </AkteSection>

          <AkteSection title="RANG & BEFÖRDERUNGEN" adminOnly>
            <AkteList items={akte.befoerderungen} onChange={(v) => upd({ befoerderungen: v })} readOnly={!isAdmin} textKey="rang" textLabel="Rang" options={config.raenge || []} addLabel="Beförderung eintragen" />
            {isAdmin && (config.raenge || []).length === 0 && <div style={{ fontSize: 11, color: "#B8791A", marginTop: 4 }}>Bitte zuerst die Ränge in den Einstellungen anlegen.</div>}
          </AkteSection>

          <AkteSection title="EHRUNGEN & AUSZEICHNUNGEN" adminOnly>
            <AkteList items={akte.ehrungen} onChange={(v) => upd({ ehrungen: v })} readOnly={!isAdmin} textLabel="z. B. Ehrenzeichen Silber" addLabel="Ehrung eintragen" />
          </AkteSection>

          <AkteSection title="LEISTUNGSABZEICHEN">
            <AkteList items={akte.leistungsabzeichen} onChange={(v) => upd({ leistungsabzeichen: v })} textLabel="z. B. Leistungsabzeichen Bronze" addLabel="Abzeichen eintragen" />
          </AkteSection>

          <AkteSection title="LEHRGÄNGE">
            {akte.lehrgaenge.length === 0 && <div style={{ fontSize: 12, color: "#A5A79F", marginBottom: 6 }}>Noch keine Lehrgänge.</div>}
            {akte.lehrgaenge.map((l) => (
              <div key={l.id} style={{ borderBottom: "1px dashed #E2DFD6", paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input style={{ ...styles.input, flex: 1, minWidth: 140, padding: "6px 8px", fontSize: 12.5 }} placeholder="z. B. Truppführer" value={l.titel || ""} onChange={(e) => upd({ lehrgaenge: akte.lehrgaenge.map((x) => (x.id === l.id ? { ...x, titel: e.target.value } : x)) })} />
                  <input style={{ ...styles.input, width: 140, padding: "6px 8px", fontSize: 12.5 }} type="date" value={l.datum || ""} onChange={(e) => upd({ lehrgaenge: akte.lehrgaenge.map((x) => (x.id === l.id ? { ...x, datum: e.target.value } : x)) })} />
                  <button style={styles.tinyIconBtn} aria-label="Lehrgang entfernen" onClick={() => { if (window.confirm("Lehrgang samt Nachweis-Foto entfernen?")) upd({ lehrgaenge: akte.lehrgaenge.filter((x) => x.id !== l.id) }); }}><X size={12} /></button>
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  {l.photoUrl && <img src={l.photoUrl} alt="Nachweis" style={{ width: 70, height: 50, objectFit: "cover", borderRadius: 4, border: "1px solid #E2DFD6", cursor: "zoom-in" }} onClick={() => onOpenPhoto(l.photoUrl)} />}
                  <label style={styles.smallAddBtn}>
                    {uploadingId === l.id ? "Lädt hoch …" : <><Plus size={12} /> {l.photoPath ? "Foto ersetzen" : "Nachweis-Foto"}</>}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) uploadLehrgangFoto(l.id, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            ))}
            <button style={styles.smallAddBtn} onClick={() => upd({ lehrgaenge: [...akte.lehrgaenge, { id: uid(), titel: "", datum: "", photoPath: null }] })}><Plus size={12} /> Lehrgang hinzufügen</button>
          </AkteSection>

          <AkteSection title="FÜHRERSCHEINKLASSEN">
            <ChipPicker options={FUEHRERSCHEIN_KLASSEN} selected={klassen} onToggle={(k) => onSetKlassen(target, klassen.includes(k) ? klassen.filter((x) => x !== k) : [...klassen, k])} />
            <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 6 }}>Wird sofort gespeichert. Bestimmt, ob PKW/LKW bei der Führerscheinkontrolle und den Fahrzeugeinweisungen erscheinen. FF = Feuerwehrführerschein.</div>
          </AkteSection>

          <AkteSection title="BEMERKUNG">
            <AkteField label="" type="textarea" value={akte.bemerkung} onChange={(v) => upd({ bemerkung: v })} placeholder="Freitext …" />
          </AkteSection>

          <div style={{ position: "sticky", bottom: 0, background: "#F3F1EC", padding: "10px 0 4px" }}>
            <button style={{ ...styles.saveBtn, width: "100%", opacity: dirty ? 1 : 0.6 }} disabled={saving || !dirty} onClick={() => save(akte)}>{saving ? "Speichert …" : dirty ? "Änderungen speichern" : "Alles gespeichert"}</button>
          </div>
        </>
      )}
    </div>
  );
}
