// Kalender-Abo: persönlicher Link, mit dem alle Termine der eigenen Bereiche automatisch im Handy-Kalender erscheinen
// (iPhone: „Abonnieren“, Google/Android und Outlook: Link kopieren und dort „Kalender per URL hinzufügen“).
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { styles } from "../lib/styles";

const klein = { fontSize: 12, color: "#5C5F58", lineHeight: 1.5 };
const knopf = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", borderRadius: 8, padding: "11px 12px", fontSize: 14, fontWeight: 700, textDecoration: "none", border: "none", marginTop: 8 };

export default function KalenderAbo({ callAuthed, flashError, isAdmin, roster, onClose }) {
  const [link, setLink] = useState(null);
  const [kopiert, setKopiert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [neuFrage, setNeuFrage] = useState(false);
  const [sperrName, setSperrName] = useState("");
  const [hinweis, setHinweis] = useState("");
  async function laden(action = "abo") {
    setBusy(true);
    const r = await callAuthed("kalender", { action });
    setBusy(false);
    if (r.ok) { setLink(r.data); if (action === "neu") setHinweis("Neuer Link erstellt – der alte funktioniert nicht mehr. Bitte den Kalender mit dem neuen Link neu abonnieren."); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Link konnte nicht geladen werden.");
    else onClose();
  }
  useEffect(() => { laden(); }, []);
  async function kopieren() {
    try { await navigator.clipboard.writeText(link.https); setKopiert(true); setTimeout(() => setKopiert(false), 2500); }
    catch (e) { window.prompt("Link kopieren:", link.https); }
  }
  async function sperren() {
    if (!sperrName) return;
    setBusy(true);
    const r = await callAuthed("kalender", { action: "sperren", name: sperrName });
    setBusy(false);
    if (r.ok) { setHinweis(`Der Kalender-Link von ${sperrName} ist jetzt ungültig.`); setSperrName(""); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Nicht möglich.");
  }
  return (
    <div style={{ ...styles.modalBackdrop, alignItems: "center" }} onClick={onClose}>
      <div style={{ ...styles.confirmDialog, maxWidth: 420, textAlign: "left", alignItems: "stretch" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kalender abonnieren" className="card-enter">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>📅 Termine im Handy-Kalender</div>
          <button style={styles.iconBtn} onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div style={klein}>Mit dem Abo stehen alle Termine deiner Bereiche in deinem Kalender – als eigener Kalender „Feuerwehr Regglisweiler“. Neue, geänderte und gelöschte Termine kommen von selbst nach. Zu- und Absagen bitte weiter in der App.</div>
        {!link && <div style={{ ...klein, marginTop: 10 }}>Link wird geladen …</div>}
        {link && (
          <>
            <a href={link.webcal} data-knopf="fest" style={{ ...knopf, background: "linear-gradient(180deg, #F39A2E 0%, #D9750F 100%)", color: "white", borderBottom: "3px solid #A85808", boxShadow: "0 3px 6px rgba(0,0,0,0.2)" }}>📅 Kalender abonnieren (iPhone)</a>
            <button data-knopf="fest" style={{ ...knopf, background: "white", color: "#C46A0C", border: "1.5px solid #E58A1F", borderBottom: "3px solid #E58A1F", boxShadow: "0 3px 6px rgba(0,0,0,0.12)" }} onClick={kopieren}>{kopiert ? "✓ Link kopiert" : "🔗 Link kopieren (Google / Outlook)"}</button>
            <div style={{ ...klein, fontSize: 11.5, marginTop: 10 }}>
              <b>iPhone:</b> „Kalender abonnieren“ antippen und „Abonnieren“ bestätigen.<br />
              <b>Android / Google-Kalender:</b> Link kopieren, am PC calendar.google.com öffnen → links bei „Weitere Kalender“ auf „+“ → „Per URL“ → Link einfügen. Google aktualisiert Abos nur alle paar Stunden.<br />
              <b>Outlook:</b> Kalender hinzufügen → „Aus dem Internet abonnieren“ → Link einfügen.
            </div>
            <div style={{ ...klein, fontSize: 11, color: "#9A5B00", marginTop: 8 }}>Der Link ist persönlich – bitte nicht weitergeben.</div>
            {hinweis && <div style={{ fontSize: 12, color: "#2E7D4F", marginTop: 8 }}>{hinweis}</div>}
            {!neuFrage
              ? <button style={{ ...styles.tinyBtn, marginTop: 10, fontSize: 11.5, padding: "5px 10px" }} onClick={() => setNeuFrage(true)}>Neuen Link erstellen …</button>
              : <div style={{ marginTop: 10, fontSize: 12 }}>Der alte Link (und damit das alte Abo) funktioniert danach nicht mehr. <button style={{ ...styles.tinyBtn, fontSize: 11.5 }} disabled={busy} onClick={() => { setNeuFrage(false); laden("neu"); }}>Ja, neuen Link</button> <button style={{ ...styles.tinyBtn, fontSize: 11.5 }} onClick={() => setNeuFrage(false)}>Abbrechen</button></div>}
            {isAdmin && (
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed #E2DFD6" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.04em" }}>ADMIN: LINK EINES KAMERADEN UNGÜLTIG MACHEN</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <select aria-label="Kamerad" style={{ ...styles.input, marginTop: 0, flex: 1 }} value={sperrName} onChange={(e) => setSperrName(e.target.value)}>
                    <option value="">Kamerad wählen …</option>
                    {(roster || []).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                  <button style={{ ...styles.saveBtn, flex: "none", padding: "0 12px", fontSize: 13 }} disabled={busy || !sperrName} onClick={sperren}>Ungültig</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
