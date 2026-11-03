// Kachel „To-do“ (seit 2.36): meine Aufgaben – eigene, zugewiesene und solche aus Projekten.
// Dieselben Aufgaben stehen auch im jeweiligen Projekt; abhaken an einer Stelle gilt überall.
// Rechte prüft der Server (netlify/functions/projekte.js).
import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import { styles } from "../lib/styles";
import { useApp } from "../AppContext";
import { hole, merke } from "../lib/zwischenspeicher";
import { AufgabeFormular, AufgabeZeile, klein, sortiereAufgaben } from "../components/Aufgaben";

const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", letterSpacing: "0.05em", margin: "16px 0 4px" };

export default function TodoKachel() {
  const { me, callAuthed, flashError, closeKachelView, kachelReturnTo, ladeUmfrageStatus, oeffneProjekt } = useApp();
  const schluessel = `todo:${me}`;
  const [daten, setDaten] = useState(() => hole(schluessel));
  const [fehler, setFehler] = useState("");
  const [formular, setFormular] = useState(null);
  const [zeigeErledigt, setZeigeErledigt] = useState(false);
  const [busy, setBusy] = useState(null);

  async function laden() {
    const r = await callAuthed("projekte", { action: "todo" });
    if (!r.ok) { if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Die Aufgaben konnten nicht geladen werden."); return; }
    setFehler(""); setDaten(r.data); merke(schluessel, r.data);
  }
  // Beim Öffnen gelten neue Aufgaben als gesehen → Zahl an der Kachel neu holen (dann nur noch überfällige)
  useEffect(() => { laden().then(() => { if (ladeUmfrageStatus) ladeUmfrageStatus(); }); }, []);

  async function haken(a) {
    setBusy(a.id);
    // sofort anzeigen, dann vom Server bestätigen lassen
    setDaten((d) => d && { ...d, aufgaben: d.aufgaben.map((x) => (x.id === a.id ? { ...x, erledigt: !a.erledigt, erledigtVon: !a.erledigt ? me : "", erledigtAm: !a.erledigt ? new Date().toISOString() : "" } : x)) });
    const r = await callAuthed("projekte", { action: "aufgabeErledigt", id: a.id, erledigt: !a.erledigt });
    setBusy(null);
    if (!r.ok && r.data.error !== "abgebrochen") flashError(r.data.error || "Das hat nicht geklappt.");
    await laden();
    if (ladeUmfrageStatus) ladeUmfrageStatus();
  }
  async function nachSpeichern() { setFormular(null); await laden(); if (ladeUmfrageStatus) ladeUmfrageStatus(); }

  const alle = (daten && daten.aufgaben) || [];
  const meine = sortiereAufgaben(alle.filter((a) => a.zustaendig === me && !a.erledigt));
  const vergeben = sortiereAufgaben(alle.filter((a) => a.erstelltVon === me && a.zustaendig !== me && !a.erledigt));
  const erledigt = sortiereAufgaben(alle.filter((a) => a.erledigt));
  const darfZuweisen = !!(daten && daten.darfZuweisen);
  const zeile = (a) => (
    <AufgabeZeile key={a.id} a={a} ich={me} busy={busy === a.id} zeigeProjekt onToggle={haken}
      onEdit={(x) => setFormular(x)} onProjekt={daten && daten.kachelProjekte && oeffneProjekt ? oeffneProjekt : undefined} />
  );

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>To-do</div>
      <div style={{ ...klein, marginTop: 2 }}>Deine Aufgaben – auch die aus Projekten. Antippen zum Ändern, Kreis antippen zum Abhaken.</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      <button style={{ ...styles.saveBtn, width: "100%", margin: "12px 0 4px", gap: 6 }} data-testid="neue-aufgabe" onClick={() => setFormular({ zustaendig: me })}><Plus size={16} /> Neue Aufgabe</button>
      {!daten && !fehler && <div style={{ ...klein, marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          <div style={abschnitt}>MEINE AUFGABEN ({meine.length})</div>
          <div style={{ ...styles.kontrollRow, padding: "2px 12px" }} data-testid="meine-aufgaben">
            {meine.length === 0 ? <div style={{ ...klein, padding: "10px 0" }}>Nichts zu tun. 👍</div> : meine.map(zeile)}
          </div>
          {vergeben.length > 0 && (
            <>
              <div style={abschnitt}>VON DIR VERGEBEN ({vergeben.length})</div>
              <div style={{ ...styles.kontrollRow, padding: "2px 12px" }} data-testid="vergebene-aufgaben">{vergeben.map(zeile)}</div>
            </>
          )}
          {erledigt.length > 0 && (
            <>
              <button style={{ ...abschnitt, background: "transparent", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} data-knopf="fest" data-testid="erledigt-umschalten" onClick={() => setZeigeErledigt((v) => !v)}>
                ERLEDIGT ({erledigt.length}) <ChevronDown size={13} style={{ transform: zeigeErledigt ? "rotate(180deg)" : "none" }} />
              </button>
              {zeigeErledigt && <div style={{ ...styles.kontrollRow, padding: "2px 12px" }}>{erledigt.map(zeile)}</div>}
            </>
          )}
        </>
      )}
      {formular && (
        <AufgabeFormular start={formular} darfZuweisen={darfZuweisen} projektName={formular.projektName} onClose={() => setFormular(null)} onSaved={nachSpeichern} />
      )}
    </div>
  );
}
