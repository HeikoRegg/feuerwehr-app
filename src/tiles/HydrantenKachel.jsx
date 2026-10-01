// Kachel Hydranten: Liste mit Kontrollgruppen und Filtern, Kontrolle eintragen (wie die Papierliste),
// Standort per GPS erfassen oder auf der Karte setzen, Karte, „Nächster Hydrant“ mit Navigation.
// Die GPS-Freigabe fragt die App beim ersten Öffnen selbst ab und sie kann jederzeit zurückgenommen werden.
// Die Rechte prüft der Server (netlify/functions/hydranten.js).
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Crosshair, LocateFixed, Map as KarteIcon, MapPin, Navigation, Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { compressImage, matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { SearchBox } from "../components/Shared";
import { sichtbereichStil, useSichtbereich } from "../lib/sichtbereich";
import { hole, merke } from "../lib/zwischenspeicher";
import {
  ART_NAME, TYP_NAME, ZUSTAND, datumDe, entfernung, entfernungText, gpsErlauben, gpsFreigabe, gpsNichtJetzt, hatStandort, heuteISO,
  istIOS, naechste, naechsteFreieNummer, navigationsLinks, richtung, useStandort, zeitDe, zustandVon,
} from "../lib/hydranten";
import { useApp } from "../AppContext";

const HydrantenKarte = lazy(() => import("../components/HydrantenKarte"));

const abschnitt = { fontSize: 11, fontWeight: 700, color: "#8A8C86", margin: "18px 0 6px", letterSpacing: "0.04em" };
const knopf = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, border: "1.5px solid #E2DFD6", background: "white", color: "#2C2F2A", flex: 1, textDecoration: "none" };
const knopfRot = { ...knopf, background: "#C1272D", color: "white", border: "1.5px solid #C1272D" };
const klein = { fontSize: 11.5, color: "#8A8C86" };
// Hydranten nach Nummer, Schieber ans Ende.
const nrSort = (a, b) => (a.typ === "schieber") - (b.typ === "schieber") || String(a.nr || "").localeCompare(String(b.nr || ""), "de", { numeric: true });

function Pille({ h }) {
  if (h.typ === "schieber" && !h.zustand) return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: "#3E5A73", background: "#E4ECF3", whiteSpace: "nowrap" }}>Schieber</span>;
  const z = ZUSTAND[zustandVon(h)];
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: z.farbe, background: z.grund, whiteSpace: "nowrap" }}>{z.text}</span>;
}
function Dialog({ titel, onClose, children }) {
  const vv = useSichtbereich();
  return (
    <div style={{ ...styles.modalBackdrop, ...sichtbereichStil(vv), zIndex: 90 }} onClick={onClose}>
      <div role="dialog" aria-label={titel} style={{ ...styles.modalSheet, maxHeight: vv ? Math.round(vv.h * 0.92) : "88vh" }} onClick={(e) => e.stopPropagation()} className="card-enter">
        <div style={styles.modalHeader}><span style={styles.modalTitle}>{titel}</span><button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={20} color="#5C5F58" /></button></div>
        {children}
      </div>
    </div>
  );
}
// Vollbild-Ebene: Kopf und Fuß fest, Inhalt scrollt (passt sich an die Tastatur an).
function Vollbild({ titel, onClose, fuss, children, ohnePolster }) {
  const vv = useSichtbereich();
  return (
    <div role="dialog" aria-label={titel} style={{ ...sichtbereichStil(vv), zIndex: 85, background: "#F3F1EC", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "calc(10px + env(safe-area-inset-top)) 16px 8px", borderBottom: "1px solid #E2DFD6" }}>
        <div style={{ ...styles.modalHeader, marginBottom: 0 }}><span style={styles.modalTitle}>{titel}</span><button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={20} color="#5C5F58" /></button></div>
      </div>
      <div style={ohnePolster ? { flex: "1 1 auto", minHeight: 0, position: "relative" } : { flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 12px" }}>{children}</div>
      {fuss && <div style={{ flexShrink: 0, padding: vv && vv.tastatur ? "8px 16px" : "8px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid #E2DFD6", background: "#F3F1EC" }}>{fuss}</div>}
    </div>
  );
}
// Auswahl mit großen Knöpfen (wie Ankreuzen auf der Papierliste).
function Wahl({ label, wert, optionen, onChange, hinweis }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...styles.label, marginTop: 0 }}>{label}{hinweis && <span style={{ fontWeight: 500, color: "#B8791A", letterSpacing: 0 }}> {hinweis}</span>}</div>
      <div role="group" aria-label={label} style={{ display: "flex", gap: 6 }}>
        {optionen.map(([v, t]) => {
          const an = wert === v;
          return <button key={String(v)} type="button" aria-pressed={an} onClick={() => onChange(an ? null : v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${an ? "#2C2F2A" : "#E2DFD6"}`, background: an ? "#2C2F2A" : "white", color: an ? "white" : "#2C2F2A" }}>{t}</button>;
        })}
      </div>
    </div>
  );
}
class KartenFehler extends React.Component {
  constructor(p) { super(p); this.state = { fehler: false }; }
  static getDerivedStateFromError() { return { fehler: true }; }
  render() { return this.state.fehler ? <div style={{ padding: 20, fontSize: 13, color: "#5C5F58" }}>Die Karte konnte nicht geladen werden. Besteht eine Internetverbindung? Bitte die Kachel schließen und neu öffnen.</div> : this.props.children; }
}
const KarteLaden = () => <div style={{ padding: 20, fontSize: 13, color: "#8A8C86" }}>Karte lädt …</div>;

function FotoFeld({ wert, onChange, callAuthed, flashError }) {
  const [laed, setLaed] = useState(false);
  async function waehlen(file) {
    if (!file) return;
    setLaed(true);
    try {
      const k = await compressImage(file);
      const r = await callAuthed("hydranten", { action: "uploadUrl", filename: k.name });
      if (!r.ok) throw new Error(r.data.error || "Upload nicht möglich.");
      const { error } = await supabase.storage.from("hydranten").uploadToSignedUrl(r.data.path, r.data.uploadToken, k);
      if (error) throw error;
      onChange({ path: r.data.path, url: URL.createObjectURL(k) });
    } catch (e) { flashError("Foto-Upload fehlgeschlagen."); }
    setLaed(false);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
      {wert && wert.url && <img src={wert.url} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6" }} />}
      <label style={{ ...styles.tinyBtn, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
        <Camera size={13} /> {laed ? "Lädt hoch …" : wert ? "Anderes Foto" : "Foto anhängen"}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; waehlen(f); }} />
      </label>
      {wert && <button style={styles.tinyBtn} onClick={() => onChange(null)}>Entfernen</button>}
    </div>
  );
}

// ---------------- GPS: Freigabe-Frage und Statuszeile ----------------
function GpsFrage({ onErlauben, onNichtJetzt }) {
  return (
    <Dialog titel="Standort benutzen?" onClose={onNichtJetzt}>
      <div style={{ ...styles.formBody, fontSize: 13.5, lineHeight: 1.5, color: "#2C2F2A" }}>
        <div>Die Hydranten-Kachel kann deinen <b>Standort (GPS)</b> benutzen, um</div>
        <ul style={{ margin: "6px 0 8px", paddingLeft: 20 }}>
          <li>dir den nächsten Hydranten zu zeigen,</li>
          <li>dich auf der Karte anzuzeigen,</li>
          <li>bei der Kontrolle den Standort eines Hydranten zu speichern.</li>
        </ul>
        <div style={{ fontSize: 12.5, color: "#5C5F58" }}>Dein Standort wird nur benutzt, solange die Kachel offen ist. Gespeichert wird er nur, wenn du ihn ausdrücklich als Standort eines Hydranten speicherst. Du kannst die Freigabe jederzeit mit dem Knopf „Standort-Freigabe zurücknehmen“ wieder zurücknehmen.</div>
        <div style={{ fontSize: 12, color: "#8A8C86", marginTop: 8 }}>Nach „Erlauben“ fragt dein Handy noch einmal selbst nach – dort bitte auch erlauben.</div>
        <div style={styles.formActions}>
          <button style={{ ...knopf, flex: 1 }} onClick={onNichtJetzt}>Nicht jetzt</button>
          <button style={{ ...styles.saveBtn }} onClick={onErlauben}><LocateFixed size={16} style={{ marginRight: 6 }} /> Erlauben</button>
        </div>
      </div>
    </Dialog>
  );
}
function GpsLeiste({ gps }) {
  const { freigabe, pos, fehler, fragen, zuruecknehmen } = gps;
  if (freigabe !== "ja") {
    return (
      <div data-testid="gps-leiste" style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "7px 10px", margin: "8px 0", fontSize: 12.5, color: "#5C5F58" }}>
        <MapPin size={15} color="#8A8C86" /> <span style={{ flex: 1 }}>Standort aus</span>
        <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "5px 9px" }} onClick={fragen}>Standort benutzen</button>
      </div>
    );
  }
  return (
    <div data-testid="gps-leiste" style={{ background: "white", border: `1px solid ${fehler === "verweigert" ? "#C1272D" : "#E2DFD6"}`, borderRadius: 8, padding: "7px 10px", margin: "8px 0", fontSize: 12.5, color: "#5C5F58" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LocateFixed size={15} color={pos ? "#2B6CB0" : "#8A8C86"} />
        <span style={{ flex: 1 }}>{fehler === "verweigert" ? "Standort ist gesperrt" : fehler === "fehlt" ? "Dieses Gerät hat kein GPS" : pos ? `Standort an (± ${pos.genauigkeit} m)` : "Standort wird gesucht …"}</span>
        <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "5px 9px" }} onClick={zuruecknehmen}>Standort-Freigabe zurücknehmen</button>
      </div>
      {fehler === "verweigert" && (
        <div style={{ fontSize: 11.5, color: "#C1272D", marginTop: 6, lineHeight: 1.45 }}>
          Das Handy erlaubt der App den Standort nicht. iPhone: Einstellungen → Datenschutz &amp; Sicherheit → Ortungsdienste → „Safari-Websites“ → „Beim Verwenden der App“. Danach die App schließen und neu öffnen.
        </div>
      )}
    </div>
  );
}

// ---------------- Navigation ----------------
function NaviKnoepfe({ h }) {
  if (!hatStandort(h)) return null;
  const l = navigationsLinks(h);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      {istIOS() && <a style={knopf} href={l.apple} target="_blank" rel="noopener noreferrer"><Navigation size={15} /> Apple Karten</a>}
      <a style={knopf} href={l.google} target="_blank" rel="noopener noreferrer"><Navigation size={15} /> Google Maps</a>
    </div>
  );
}

// ---------------- Karte (Vollbild) ----------------
function KartenAnsicht({ hydranten, gps, startId, onOeffnen, onClose }) {
  const [auswahl, setAuswahl] = useState(startId || null);
  const [folgen, setFolgen] = useState(false);
  const h = hydranten.find((x) => x.id === auswahl);
  const ohne = hydranten.filter((x) => !hatStandort(x)).length;
  return (
    <Vollbild titel="Hydranten-Karte" onClose={onClose} ohnePolster>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
          <KartenFehler><Suspense fallback={<KarteLaden />}>
            <HydrantenKarte hydranten={hydranten} pos={gps.pos} auswahl={auswahl} onAuswahl={setAuswahl} folgen={folgen} start={h} />
          </Suspense></KartenFehler>
        </div>
        <div style={{ flexShrink: 0, background: "#F3F1EC", borderTop: "1px solid #E2DFD6", padding: "8px 14px calc(12px + env(safe-area-inset-bottom))" }}>
          {h ? (
            <div data-testid="karte-auswahl">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{h.nr} · {h.lage}</span>
                  <span style={{ display: "block", ...klein }}>{h.letzteKontrolle ? `zuletzt kontrolliert ${datumDe(h.letzteKontrolle.datum)}` : "noch nie kontrolliert"}{gps.pos ? ` · ${entfernungText(entfernung(gps.pos, h))}` : ""}</span>
                </span>
                <Pille h={h} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button style={knopfRot} onClick={() => onOeffnen(h.id)}>Öffnen</button>
                <button style={knopf} onClick={() => setAuswahl(null)}>Schließen</button>
              </div>
              <NaviKnoepfe h={h} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, ...klein }}>Hydrant antippen für Details.{ohne ? ` ${ohne} ohne Standort sind nicht auf der Karte.` : ""}</span>
              {gps.pos && <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => setFolgen((f) => !f)}>{folgen ? "Mitführen aus" : "Mich zeigen"}</button>}
            </div>
          )}
        </div>
      </div>
    </Vollbild>
  );
}

// ---------------- Nächster Hydrant ----------------
function NaechsterHydrant({ hydranten, gps, onOeffnen, onKarte, onBack }) {
  const liste = naechste(hydranten, gps.pos, 5);
  const mitStandort = hydranten.filter((h) => hatStandort(h) && h.typ !== "schieber").length;
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Hydranten</button></div>
      <div style={styles.modalTitle}>Nächster Hydrant</div>
      <GpsLeiste gps={gps} />
      {gps.freigabe !== "ja" && <div style={{ fontSize: 13, color: "#5C5F58", marginTop: 10 }}>Für den nächsten Hydranten braucht die App deinen Standort.</div>}
      {gps.freigabe === "ja" && mitStandort === 0 && <div style={{ ...styles.capacityBox, fontSize: 13 }}>Es hat noch kein Hydrant einen Standort. Standorte werden bei der Kontrolle mit „Standort erfassen“ gespeichert.</div>}
      {gps.freigabe === "ja" && mitStandort > 0 && !gps.pos && !gps.fehler && <div style={{ fontSize: 13, color: "#8A8C86", marginTop: 10 }}>Standort wird gesucht …</div>}
      {liste.map(({ h, m }, i) => (
        <div key={h.id} data-testid="naechster" style={{ ...styles.capacityBox, marginTop: 10, borderLeft: `4px solid ${ZUSTAND[zustandVon(h)].karte}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, minWidth: 74 }}>{entfernungText(m)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{h.nr} · {h.lage}</span>
              <span style={{ display: "block", ...klein }}>Richtung {richtung(gps.pos, h)}{h.letzteKontrolle ? ` · kontrolliert ${datumDe(h.letzteKontrolle.datum)}` : " · nie kontrolliert"}</span>
            </span>
            {i === 0 && <Pille h={h} />}{i > 0 && h.zustand && h.zustand !== "ok" && <Pille h={h} />}
          </div>
          {h.zustand === "defekt" && <div style={{ fontSize: 12, color: "#C1272D", fontWeight: 700, marginTop: 6 }}>Achtung: zuletzt als nicht funktionsfähig gemeldet ({h.zustandText}).</div>}
          <NaviKnoepfe h={h} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "5px 9px" }} onClick={() => onOeffnen(h.id)}>Details</button>
            <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "5px 9px" }} onClick={() => onKarte(h.id)}>Auf der Karte</button>
          </div>
        </div>
      ))}
      <div style={{ ...klein, marginTop: 12 }}>Entfernung = Luftlinie. Hydranten ohne Standort fehlen hier.</div>
    </div>
  );
}

// ---------------- Standort per GPS erfassen ----------------
function StandortDialog({ h, gps, onClose, onSaved }) {
  const { callAuthed } = useApp();
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const p = gps.pos;
  const abstand = p && hatStandort(h) ? entfernung(p, h) : null;
  async function speichern() {
    if (!p) return;
    setBusy(true); setFehler("");
    const r = await callAuthed("hydranten", { action: "standort", hydrant: h.id, lat: p.lat, lng: p.lng, genauigkeit: p.genauigkeit, quelle: "gps" });
    setBusy(false);
    if (r.ok) onSaved(r.data.hydrant); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <Dialog titel={`Standort erfassen – ${h.nr}`} onClose={onClose}>
      <div style={{ ...styles.formBody, fontSize: 13, lineHeight: 1.5 }}>
        {gps.freigabe !== "ja" ? (
          <>
            <div>Dafür braucht die App deinen Standort.</div>
            <div style={styles.formActions}><button style={styles.saveBtn} onClick={gps.fragen}>Standort benutzen</button></div>
          </>
        ) : (
          <>
            <div>Stell dich direkt an den Hydranten (auf den Deckel) und warte, bis die Genauigkeit unter 10 m liegt.</div>
            <div data-testid="gps-genauigkeit" style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 2px", color: !p ? "#8A8C86" : p.genauigkeit <= 10 ? "#1F6F5C" : p.genauigkeit <= 30 ? "#B8791A" : "#C1272D" }}>
              {gps.fehler === "verweigert" ? "Standort gesperrt" : p ? `± ${p.genauigkeit} m` : "Suche …"}
            </div>
            {p && p.genauigkeit > 30 && <div style={{ fontSize: 12, color: "#C1272D" }}>Noch ungenau – kurz warten oder ins Freie gehen.</div>}
            {abstand != null && <div style={{ fontSize: 12, color: abstand > 30 ? "#C1272D" : "#5C5F58", marginTop: 4 }}>Der bisherige Standort liegt {entfernungText(abstand)} entfernt und wird ersetzt.</div>}
            {fehler && <div style={styles.errorText}>{fehler}</div>}
            <div style={styles.formActions}><button style={styles.saveBtn} disabled={!p || busy} onClick={speichern}>{busy ? "Speichert …" : "Diesen Standort speichern"}</button></div>
          </>
        )}
      </div>
    </Dialog>
  );
}

// ---------------- Standort auf der Karte setzen ----------------
function KarteSetzen({ h, hydranten, gps, onClose, onSaved }) {
  const { callAuthed } = useApp();
  const mitteRef = useRef(null);
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  async function speichern() {
    const c = mitteRef.current; if (!c) return;
    setBusy(true); setFehler("");
    const r = await callAuthed("hydranten", { action: "standort", hydrant: h.id, lat: c.lat, lng: c.lng, quelle: "karte" });
    setBusy(false);
    if (r.ok) onSaved(r.data.hydrant); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <Vollbild titel={`Standort setzen – ${h.nr}`} onClose={onClose} ohnePolster>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
          <KartenFehler><Suspense fallback={<KarteLaden />}>
            <HydrantenKarte modus="setzen" hydranten={hydranten} pos={gps.pos} start={hatStandort(h) ? h : null} onMitte={(c) => { mitteRef.current = c; }} />
          </Suspense></KartenFehler>
        </div>
        <div style={{ flexShrink: 0, background: "#F3F1EC", borderTop: "1px solid #E2DFD6", padding: "8px 14px calc(12px + env(safe-area-inset-bottom))" }}>
          <div style={{ ...klein, marginBottom: 6 }}>Karte verschieben und hineinzoomen, bis das rote Kreuz genau auf dem Hydranten ({h.lage}) sitzt.</div>
          {fehler && <div style={styles.errorText}>{fehler}</div>}
          <button style={{ ...styles.saveBtn, width: "100%" }} disabled={busy} onClick={speichern}><Crosshair size={16} style={{ marginRight: 6 }} />{busy ? "Speichert …" : "Hier speichern"}</button>
        </div>
      </div>
    </Vollbild>
  );
}

// ---------------- Kontrolle eintragen ----------------
function KontrolleFormular({ h, gps, onClose, onSaved }) {
  const { callAuthed, flashError } = useApp();
  const [k, setK] = useState({ datum: heuteISO(), funktionsfaehig: null, art: h.art || null, oeffnen: h.oeffnen || null, standrohr: h.standrohr || null, schildVorhanden: null, lesbar: null, bemassung: null, laengs: "", quer: "", text: "", mangel: false });
  const [foto, setFoto] = useState(null);
  const ohneStandort = !hatStandort(h);
  const [standortMit, setStandortMit] = useState(ohneStandort);
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const set = (teil) => setK((x) => ({ ...x, ...teil }));
  const pruefen = h.vorbelegt ? "(aus Liste 2018 – bitte prüfen)" : "";
  const p = gps.pos;
  async function speichern() {
    if (k.funktionsfaehig === null) { setFehler("Bitte angeben, ob der Hydrant funktionsfähig ist."); return; }
    if ((k.funktionsfaehig === false || k.mangel) && k.text.trim().length < 3) { setFehler("Bitte kurz beschreiben, was nicht in Ordnung ist."); return; }
    setBusy(true); setFehler("");
    const kontrolle = {
      datum: k.datum, funktionsfaehig: k.funktionsfaehig, art: k.art || "", oeffnen: k.oeffnen || "", standrohr: k.standrohr || "",
      schild: { vorhanden: k.schildVorhanden, lesbar: k.lesbar, bemassung: k.bemassung }, abweichung: { laengs: k.laengs, quer: k.quer },
      text: k.text.trim(), mangel: k.mangel, foto: foto ? foto.path : "",
      standort: ohneStandort && standortMit && gps.freigabe === "ja" && p ? { lat: p.lat, lng: p.lng, genauigkeit: p.genauigkeit } : null,
    };
    const r = await callAuthed("hydranten", { action: "kontrolle", hydrant: h.id, kontrolle });
    setBusy(false);
    if (r.ok) onSaved(r.data.hydrant);
    else if (r.data.error !== "abgebrochen") { setFehler(r.data.error || "Speichern nicht möglich."); flashError(r.data.error || "Speichern nicht möglich."); }
  }
  const jn = [[true, "Ja"], [false, "Nein"]];
  return (
    <Vollbild titel={`Kontrolle – ${h.nr}`} onClose={onClose} fuss={<>
      {fehler && <div style={{ ...styles.errorText, marginTop: 0, marginBottom: 6 }}>{fehler}</div>}
      <button style={{ ...styles.saveBtn, width: "100%" }} disabled={busy} onClick={speichern}><Check size={16} style={{ marginRight: 6 }} />{busy ? "Speichert …" : "Kontrolle speichern"}</button>
    </>}>
      <div style={{ fontSize: 13, color: "#5C5F58", marginTop: 10 }}>{h.lage}{h.gruppe ? ` · Gruppe ${h.gruppe}` : ""}</div>
      <label style={styles.label}>KONTROLLDATUM</label>
      <input style={styles.input} type="date" aria-label="Kontrolldatum" value={k.datum} max={heuteISO()} onChange={(e) => set({ datum: e.target.value })} />
      <Wahl label="FUNKTIONSFÄHIG?" wert={k.funktionsfaehig} optionen={jn} onChange={(v) => set({ funktionsfaehig: v })} />
      <Wahl label="AUSFÜHRUNG" hinweis={pruefen} wert={k.art} optionen={[["BW", "BW"], ["BY", "BY"]]} onChange={(v) => set({ art: v })} />
      <Wahl label="ÖFFNEN" hinweis={pruefen} wert={k.oeffnen} optionen={[["links", "links"], ["rechts", "rechts"]]} onChange={(v) => set({ oeffnen: v })} />
      <Wahl label="LÄNGE STANDROHR" hinweis={pruefen} wert={k.standrohr} optionen={[["kurz", "kurz"], ["lang", "lang"]]} onChange={(v) => set({ standrohr: v })} />
      <Wahl label="SCHILD VORHANDEN?" wert={k.schildVorhanden} optionen={jn} onChange={(v) => set({ schildVorhanden: v })} />
      {k.schildVorhanden !== false && (<>
        <Wahl label="SCHILD LESBAR?" wert={k.lesbar} optionen={jn} onChange={(v) => set({ lesbar: v })} />
        <Wahl label="SCHILD-BEMASSUNG KORREKT?" wert={k.bemassung} optionen={jn} onChange={(v) => set({ bemassung: v })} />
        {k.bemassung === false && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={styles.label}>ABWEICHUNG LÄNGS [m]</label><input style={styles.input} inputMode="decimal" aria-label="Abweichung längs" value={k.laengs} onChange={(e) => set({ laengs: e.target.value })} placeholder="z. B. 4,5" /></div>
            <div style={{ flex: 1 }}><label style={styles.label}>ABWEICHUNG QUER [m]</label><input style={styles.input} inputMode="decimal" aria-label="Abweichung quer" value={k.quer} onChange={(e) => set({ quer: e.target.value })} placeholder="z. B. 0,5" /></div>
          </div>
        )}
      </>)}
      <label style={styles.label}>DEFEKTE / BEMERKUNG</label>
      <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} aria-label="Defekte / Bemerkung" maxLength={1000} value={k.text} onChange={(e) => set({ text: e.target.value })} placeholder="z. B. Schacht voll Wasser, Deckel klemmt …" />
      <label style={{ ...styles.checkboxRow, marginTop: 10 }}><input type="checkbox" checked={k.mangel} onChange={(e) => set({ mangel: e.target.checked })} /> Mangel – muss behoben werden</label>
      <div style={{ ...klein, marginTop: 4 }}>Bei „nicht funktionsfähig“, Mangel oder Schild-Problem bekommen Kommandant, Stellvertreter, Hydranten-Verantwortliche und Admins eine Benachrichtigung.</div>
      <FotoFeld wert={foto} onChange={setFoto} callAuthed={callAuthed} flashError={flashError} />
      {ohneStandort && (
        <div style={{ ...styles.capacityBox, fontSize: 12.5 }}>
          <b>Dieser Hydrant hat noch keinen Standort.</b>
          {gps.freigabe !== "ja" ? (
            <div style={{ marginTop: 6 }}><button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "5px 9px" }} onClick={gps.fragen}>Standort benutzen</button></div>
          ) : (
            <label style={{ ...styles.checkboxRow, marginTop: 6 }}>
              <input type="checkbox" checked={standortMit} onChange={(e) => setStandortMit(e.target.checked)} />
              <span>Meinen jetzigen Standort als Standort des Hydranten speichern {p ? `(± ${p.genauigkeit} m)` : "(Standort wird gesucht …)"}
                {p && p.genauigkeit > 30 && <span style={{ display: "block", color: "#C1272D" }}>Noch ungenau – besser kurz warten.</span>}</span>
            </label>
          )}
        </div>
      )}
      <div style={{ height: 16 }} />
    </Vollbild>
  );
}

// ---------------- Hydrant anlegen / bearbeiten ----------------
function HydrantFormular({ h, hydranten, onClose, onSaved }) {
  const { callAuthed } = useApp();
  const [d, setD] = useState(() => ({ nr: h ? h.nr || "" : "", lage: h ? h.lage || "" : "", gruppe: h && h.gruppe ? String(h.gruppe) : "", typ: (h && h.typ) || "unterflur", art: (h && h.art) || null, oeffnen: (h && h.oeffnen) || null, standrohr: (h && h.standrohr) || null, bemerkung: (h && h.bemerkung) || "" }));
  const [busy, setBusy] = useState(false); const [fehler, setFehler] = useState("");
  const set = (t) => setD((x) => ({ ...x, ...t }));
  const vorschlag = useMemo(() => naechsteFreieNummer(hydranten), [hydranten]);
  async function speichern() {
    if (!d.lage.trim()) { setFehler("Bitte die Lage eingeben (Straße / Hausnummer)."); return; }
    setBusy(true); setFehler("");
    const r = await callAuthed("hydranten", { action: "save", hydrant: { ...d, id: h ? h.id : undefined, gruppe: d.gruppe ? parseInt(d.gruppe, 10) : null, art: d.art || "", oeffnen: d.oeffnen || "", standrohr: d.standrohr || "" } });
    setBusy(false);
    if (r.ok) onSaved(r.data.id); else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Speichern nicht möglich.");
  }
  return (
    <Vollbild titel={h ? `Bearbeiten – ${h.nr}` : "Neuer Hydrant"} onClose={onClose} fuss={<>
      {fehler && <div style={{ ...styles.errorText, marginTop: 0, marginBottom: 6 }}>{fehler}</div>}
      <button style={{ ...styles.saveBtn, width: "100%" }} disabled={busy} onClick={speichern}>{busy ? "Speichert …" : "Speichern"}</button>
    </>}>
      <label style={styles.label}>NUMMER</label>
      <input style={styles.input} aria-label="Nummer" value={d.nr} maxLength={20} onChange={(e) => set({ nr: e.target.value.toUpperCase() })} placeholder={`leer lassen = ${vorschlag}`} />
      {!h && <div style={{ ...klein, marginTop: 3 }}>Ohne Nummer vergibt die App die nächste freie ({vorschlag}).</div>}
      <label style={styles.label}>LAGE</label>
      <input style={styles.input} aria-label="Lage" value={d.lage} maxLength={120} onChange={(e) => set({ lage: e.target.value })} placeholder="z. B. Sandberg 22" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><label style={styles.label}>KONTROLLGRUPPE</label>
          <select style={styles.input} aria-label="Kontrollgruppe" value={d.gruppe} onChange={(e) => set({ gruppe: e.target.value })}>
            <option value="">keine</option>{[1, 2, 3, 4].map((g) => <option key={g} value={String(g)}>Gruppe {g}</option>)}
          </select></div>
        <div style={{ flex: 1 }}><label style={styles.label}>TYP</label>
          <select style={styles.input} aria-label="Typ" value={d.typ} onChange={(e) => set({ typ: e.target.value })}>
            {Object.entries(TYP_NAME).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select></div>
      </div>
      <Wahl label="AUSFÜHRUNG" wert={d.art} optionen={[["BW", "BW"], ["BY", "BY"]]} onChange={(v) => set({ art: v })} />
      <Wahl label="ÖFFNEN" wert={d.oeffnen} optionen={[["links", "links"], ["rechts", "rechts"]]} onChange={(v) => set({ oeffnen: v })} />
      <Wahl label="LÄNGE STANDROHR" wert={d.standrohr} optionen={[["kurz", "kurz"], ["lang", "lang"]]} onChange={(v) => set({ standrohr: v })} />
      <label style={styles.label}>BEMERKUNG</label>
      <textarea style={{ ...styles.input, minHeight: 60, resize: "vertical" }} aria-label="Bemerkung" maxLength={500} value={d.bemerkung} onChange={(e) => set({ bemerkung: e.target.value })} placeholder="z. B. hinter der Hecke, Zufahrt über Hof" />
      <div style={{ ...klein, marginTop: 8 }}>Den Standort erfasst du danach im Hydranten mit „Standort erfassen“ (GPS) oder „Auf Karte setzen“.</div>
      <div style={{ height: 16 }} />
    </Vollbild>
  );
}

// ---------------- Detail ----------------
function VerlaufEintrag({ e, verwalter, onLoeschen, setLightboxSrc }) {
  let titel, inhalt = null;
  if (e.art === "kontrolle") {
    const z = e.funktionsfaehig === false ? "defekt" : e.befunde.length ? "mangel" : "ok";
    titel = <>Kontrolle {datumDe(e.datum)} <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 10, color: ZUSTAND[z].farbe, background: ZUSTAND[z].grund }}>{ZUSTAND[z].text}</span></>;
    const s = e.schild || {};
    const abw = e.abweichung && (e.abweichung.laengs != null || e.abweichung.quer != null) ? ` (${[e.abweichung.laengs, e.abweichung.quer].map((x) => (x == null ? "–" : String(x).replace(".", ","))).join(" / ")} m)` : "";
    const schild = s.vorhanden === false ? "Schild fehlt" : [s.vorhanden === true ? "Schild vorhanden" : "", s.lesbar === false ? "nicht lesbar" : s.lesbar === true ? "lesbar" : "", s.bemassung === false ? `Bemaßung falsch${abw}` : s.bemassung === true ? "Bemaßung korrekt" : ""].filter(Boolean).join(", ");
    const angaben = [e.funktionsfaehig ? "funktionsfähig" : "nicht funktionsfähig", e.ausfuehrung, e.oeffnen ? `öffnen ${e.oeffnen}` : "", e.standrohr ? `Standrohr ${e.standrohr}` : "", schild].filter(Boolean).join(" · ");
    inhalt = (
      <>
        {e.text && <div style={{ fontSize: 12.5, color: "#2C2F2A", marginTop: 3 }}>{e.mangel ? <b>Mangel: </b> : null}{e.text}</div>}
        <div style={{ ...klein, marginTop: 2 }}>{angaben}</div>
        {e.fotoUrl && <img src={e.fotoUrl} alt="Foto" onClick={() => setLightboxSrc(e.fotoUrl)} style={{ width: 90, height: 68, objectFit: "cover", borderRadius: 5, border: "1px solid #E2DFD6", marginTop: 6, cursor: "pointer" }} />}
      </>
    );
  } else if (e.art === "behoben") {
    titel = <>Mangel behoben {datumDe(e.datum)}</>;
    inhalt = <div style={{ fontSize: 12.5, color: "#2C2F2A", marginTop: 3 }}>{e.text}</div>;
  } else {
    titel = e.entfernt ? "Standort entfernt" : e.quelle === "karte" ? "Standort auf der Karte gesetzt" : `Standort per GPS erfasst${e.genauigkeit ? ` (± ${e.genauigkeit} m)` : ""}`;
  }
  return (
    <div data-testid="verlauf-eintrag" style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{titel}</span>
        {verwalter && e.art !== "standort" && <button style={styles.rosterRemoveBtn} aria-label="Eintrag löschen" onClick={() => onLoeschen(e)}><Trash2 size={13} /></button>}
      </div>
      {inhalt}
      <div style={{ fontSize: 10.5, color: "#A5A79F", marginTop: 3 }}>{e.von} · eingetragen {zeitDe(e.ts)}</div>
    </div>
  );
}

function HydrantDetail({ id, liste, rechte, gps, onBack, onAktualisiert, onGeloescht, onKarte }) {
  const { callAuthed, flashError, setLightboxSrc } = useApp();
  const [h, setH] = useState(() => liste.find((x) => x.id === id) || null);
  const [verlauf, setVerlauf] = useState(null); const [fehler, setFehler] = useState("");
  const [ebene, setEbene] = useState(null); // kontrolle | standort | setzen | bearbeiten | loeschen | behoben | eintrag
  const [behobenText, setBehobenText] = useState(""); const [busy, setBusy] = useState(false);
  async function laden() {
    const r = await callAuthed("hydranten", { action: "get", id });
    if (r.ok) { setH(r.data.hydrant); setVerlauf(r.data.verlauf); setFehler(""); onAktualisiert(r.data.hydrant); }
    else if (r.data.error !== "abgebrochen") setFehler(r.data.error || "Laden nicht möglich.");
  }
  useEffect(() => { laden(); }, [id]);
  const fertig = (neu) => { setEbene(null); if (neu) { setH((alt) => ({ ...alt, ...neu })); onAktualisiert(neu); } laden(); };
  async function loeschen() {
    setBusy(true);
    const r = await callAuthed("hydranten", { action: "delete", id });
    setBusy(false);
    if (r.ok) onGeloescht(id); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  async function behoben() {
    if (behobenText.trim().length < 3) { flashError("Bitte kurz eintragen, was gemacht wurde."); return; }
    setBusy(true);
    const r = await callAuthed("hydranten", { action: "behoben", hydrant: id, text: behobenText.trim() });
    setBusy(false);
    if (r.ok) { setBehobenText(""); fertig(r.data.hydrant); } else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Speichern nicht möglich.");
  }
  async function eintragLoeschen() {
    const e = ebene && ebene.eintrag; if (!e) return;
    setBusy(true);
    const r = await callAuthed("hydranten", { action: "deleteEintrag", eintrag: e.id });
    setBusy(false);
    if (r.ok) fertig(null); else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Löschen nicht möglich.");
  }
  async function standortEntfernen() {
    const r = await callAuthed("hydranten", { action: "standortEntfernen", hydrant: id });
    if (r.ok) { const { lat, lng, genauigkeit, ...rest } = h; setH(rest); onAktualisiert({ ...rest, lat: null, lng: null }); setEbene(null); laden(); }
    else if (r.data.error !== "abgebrochen") flashError(r.data.error || "Nicht möglich.");
  }

  if (!h) return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Hydranten</button></div>
      <div style={{ fontSize: 13, color: "#8A8C86" }}>{fehler || "Lädt …"}</div>
    </div>
  );
  if (ebene === "kontrolle") return <KontrolleFormular h={h} gps={gps} onClose={() => setEbene(null)} onSaved={fertig} />;
  if (ebene === "bearbeiten") return <HydrantFormular h={h} hydranten={liste} onClose={() => setEbene(null)} onSaved={() => fertig(null)} />;
  if (ebene === "setzen") return <KarteSetzen h={h} hydranten={liste} gps={gps} onClose={() => setEbene(null)} onSaved={fertig} />;

  const z = zustandVon(h);
  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={onBack}><ArrowLeft size={18} /> Hydranten</button></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...styles.modalTitle, flex: 1 }}>{h.nr}</span><Pille h={h} /></div>
      <div style={{ fontSize: 14, color: "#2C2F2A", marginTop: 2 }}>{h.lage}</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}

      <div style={{ ...styles.capacityBox, borderLeft: `4px solid ${ZUSTAND[z].karte}` }}>
        <div style={{ fontSize: 13 }}>{h.letzteKontrolle ? <>Zuletzt kontrolliert am <b>{datumDe(h.letzteKontrolle.datum)}</b> von {h.letzteKontrolle.von}</> : <b>Noch nie kontrolliert</b>}</div>
        {h.zustandText && z !== "ok" && <div style={{ fontSize: 12.5, color: z === "defekt" ? "#C1272D" : "#9A5B00", fontWeight: 600, marginTop: 4 }}>{h.zustandText}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button style={knopfRot} onClick={() => setEbene("kontrolle")}><Check size={16} /> Kontrolle eintragen</button>
      </div>
      {rechte.verwalter && (z === "mangel" || z === "defekt") && <button style={{ ...knopf, width: "100%", marginTop: 6 }} onClick={() => setEbene("behoben")}><Wrench size={15} /> Mangel als behoben eintragen</button>}

      <div style={abschnitt}>STANDORT</div>
      {hatStandort(h) ? (
        <div style={{ fontSize: 12.5, color: "#5C5F58" }}>
          {h.standortQuelle === "karte" ? "Auf der Karte gesetzt" : `Per GPS erfasst${h.genauigkeit ? ` (± ${h.genauigkeit} m)` : ""}`}{h.standortVon ? ` von ${h.standortVon}` : ""}{h.standortAm ? ` am ${datumDe(String(h.standortAm).slice(0, 10))}` : ""}
          {gps.pos && <span> · {entfernungText(entfernung(gps.pos, h))} von dir</span>}
        </div>
      ) : <div style={{ fontSize: 12.5, color: "#B8791A", fontWeight: 600 }}>Noch kein Standort – er fehlt auf der Karte und bei „Nächster Hydrant“.</div>}
      <NaviKnoepfe h={h} />
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {hatStandort(h) && <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => onKarte(h.id)}><KarteIcon size={12} /> Auf der Karte</button>}
        <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => setEbene("standort")}><LocateFixed size={12} /> Standort erfassen (GPS)</button>
        <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => setEbene("setzen")}><Crosshair size={12} /> Auf Karte setzen</button>
        {rechte.verwalter && hatStandort(h) && <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => setEbene("standortWeg")}>Standort entfernen</button>}
      </div>

      <div style={abschnitt}>ANGABEN{h.vorbelegt && <span style={{ fontWeight: 500, color: "#B8791A", letterSpacing: 0 }}> · aus Liste 2018, bei der nächsten Kontrolle bestätigen</span>}</div>
      <div style={{ background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.7 }}>
        <div>Typ: <b>{TYP_NAME[h.typ] || "–"}</b></div>
        <div>Kontrollgruppe: <b>{h.gruppe ? `Gruppe ${h.gruppe}` : "keine"}</b></div>
        <div>Ausführung: <b>{ART_NAME[h.art] || "–"}</b></div>
        <div>Öffnen: <b>{h.oeffnen || "–"}</b> · Standrohr: <b>{h.standrohr || "–"}</b></div>
        {h.bemerkung && <div>Bemerkung: {h.bemerkung}</div>}
      </div>
      {rechte.verwalter && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px" }} onClick={() => setEbene("bearbeiten")}><Pencil size={12} /> Bearbeiten</button>
          <button style={{ ...styles.tinyBtn, fontSize: 11.5, padding: "6px 9px", color: "#C1272D" }} onClick={() => setEbene("loeschen")}><Trash2 size={12} /> Löschen</button>
        </div>
      )}

      <div style={abschnitt}>VERLAUF</div>
      {!verlauf && <div style={klein}>Lädt …</div>}
      {verlauf && verlauf.length === 0 && <div style={klein}>Noch keine Einträge.</div>}
      {(verlauf || []).map((e) => <VerlaufEintrag key={e.id} e={e} verwalter={rechte.verwalter} setLightboxSrc={setLightboxSrc} onLoeschen={(x) => setEbene({ eintrag: x })} />)}

      {ebene === "standort" && <StandortDialog h={h} gps={gps} onClose={() => setEbene(null)} onSaved={fertig} />}
      {ebene === "behoben" && (
        <Dialog titel={`Mangel behoben – ${h.nr}`} onClose={() => setEbene(null)}>
          <div style={styles.formBody}>
            <div style={{ fontSize: 12.5, color: "#5C5F58" }}>{h.zustandText}</div>
            <label style={styles.label}>WAS WURDE GEMACHT?</label>
            <textarea style={{ ...styles.input, minHeight: 70 }} aria-label="Was wurde gemacht" value={behobenText} maxLength={600} onChange={(e) => setBehobenText(e.target.value)} placeholder="z. B. Schild erneuert durch Bauhof" />
            <div style={styles.formActions}><button style={styles.saveBtn} disabled={busy} onClick={behoben}>{busy ? "Speichert …" : "Als behoben eintragen"}</button></div>
          </div>
        </Dialog>
      )}
      {ebene === "loeschen" && (
        <Dialog titel="Hydrant löschen?" onClose={() => setEbene(null)}>
          <div style={styles.formBody}>
            <div style={{ fontSize: 13 }}><b>{h.nr}</b> ({h.lage}) mit allen Kontrollen und Fotos löschen? Das kann nicht rückgängig gemacht werden.</div>
            <div style={styles.formActions}><button style={knopf} onClick={() => setEbene(null)}>Abbrechen</button><button style={styles.saveBtn} disabled={busy} onClick={loeschen}>Löschen</button></div>
          </div>
        </Dialog>
      )}
      {ebene === "standortWeg" && (
        <Dialog titel="Standort entfernen?" onClose={() => setEbene(null)}>
          <div style={styles.formBody}>
            <div style={{ fontSize: 13 }}>Den gespeicherten Standort von <b>{h.nr}</b> entfernen? Der Hydrant verschwindet dann von der Karte.</div>
            <div style={styles.formActions}><button style={knopf} onClick={() => setEbene(null)}>Abbrechen</button><button style={styles.saveBtn} onClick={standortEntfernen}>Entfernen</button></div>
          </div>
        </Dialog>
      )}
      {ebene && ebene.eintrag && (
        <Dialog titel="Eintrag löschen?" onClose={() => setEbene(null)}>
          <div style={styles.formBody}>
            <div style={{ fontSize: 13 }}>Diesen Eintrag vom {datumDe(ebene.eintrag.datum)} ({ebene.eintrag.von}) löschen? Der Stand des Hydranten wird danach neu berechnet.</div>
            <div style={styles.formActions}><button style={knopf} onClick={() => setEbene(null)}>Abbrechen</button><button style={styles.saveBtn} disabled={busy} onClick={eintragLoeschen}>Löschen</button></div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Kachel ----------------
export default function HydrantenKachel() {
  const { me, callAuthed, closeKachelView, kachelReturnTo } = useApp();
  // Zuletzt geladene Liste sofort zeigen (auch ohne Netz), dann im Hintergrund auffrischen.
  const cacheKey = `hydranten:${me}`;
  const [daten, setDatenRoh] = useState(() => hole(cacheKey));
  const setDaten = (x) => setDatenRoh((alt) => { const neu = typeof x === "function" ? x(alt) : x; if (neu) merke(cacheKey, neu, { dauerhaft: true }); return neu; });
  const [fehler, setFehler] = useState("");
  const [view, setView] = useState({ name: "liste" });
  const [suche, setSuche] = useState(""); const [filter, setFilter] = useState("alle"); const [gruppe, setGruppe] = useState(""); const [sortierung, setSortierung] = useState("nr");
  const [hinweis, setHinweis] = useState("");

  // GPS-Freigabe: beim ersten Öffnen fragen, jederzeit zurücknehmbar.
  const [freigabe, setFreigabe] = useState(() => gpsFreigabe());
  const [frage, setFrage] = useState(() => gpsFreigabe() === null);
  const { pos, fehler: gpsFehler } = useStandort(freigabe === "ja");
  const gps = {
    freigabe, pos, fehler: gpsFehler,
    fragen: () => setFrage(true),
    zuruecknehmen: () => { gpsNichtJetzt(); setFreigabe("nein"); setHinweis("Standort-Freigabe zurückgenommen – die App benutzt deinen Standort nicht mehr. (Die Erlaubnis im Handy selbst kannst du in den Einstellungen des Handys ändern.)"); },
  };

  const ladeNr = useRef(0);
  async function laden(still) {
    const nr = ++ladeNr.current;
    const r = await callAuthed("hydranten", { action: "list" });
    if (nr !== ladeNr.current) return;
    if (r.ok) { setDaten(r.data); setFehler(""); }
    else if (r.data.error === "abgebrochen") { if (!still) closeKachelView(); }
    else setFehler(r.data.error || "Hydranten konnten nicht geladen werden.");
  }
  useEffect(() => { laden(); }, []);
  // Einzelnen Hydranten in der Liste aktualisieren (nach Kontrolle, Standort …)
  const aktualisiere = (h) => setDaten((d) => (d ? { ...d, hydranten: d.hydranten.map((x) => (x.id === h.id ? { ...x, ...h } : x)) } : d));

  const hydranten = (daten && daten.hydranten) || [];
  const rechte = (daten && daten.rechte) || {};
  const zaehler = useMemo(() => ({
    nie: hydranten.filter((h) => !h.letzteKontrolle && h.typ !== "schieber").length,
    mangel: hydranten.filter((h) => h.zustand === "mangel" || h.zustand === "defekt").length,
    ohne: hydranten.filter((h) => !hatStandort(h)).length,
  }), [daten]);

  const freigabeDialog = frage && (
    <GpsFrage
      onErlauben={() => { gpsErlauben(); setFreigabe("ja"); setFrage(false); setHinweis(""); }}
      onNichtJetzt={() => { if (freigabe !== "ja") { gpsNichtJetzt(); setFreigabe("nein"); } setFrage(false); }}
    />
  );
  const zurListe = () => setView({ name: "liste" });

  if (view.name === "detail") return <>
    <HydrantDetail key={view.id} id={view.id} liste={hydranten} rechte={rechte} gps={gps} onBack={() => { setView(view.zurueck || { name: "liste" }); laden(true); }}
      onAktualisiert={aktualisiere} onGeloescht={(id) => { setDaten((d) => ({ ...d, hydranten: d.hydranten.filter((x) => x.id !== id) })); zurListe(); }}
      onKarte={(id) => setView({ name: "karte", id, zurueck: view })} />
    {freigabeDialog}
  </>;
  if (view.name === "karte") return <>
    <KartenAnsicht hydranten={hydranten} gps={gps} startId={view.id} onOeffnen={(id) => setView({ name: "detail", id, zurueck: { ...view, id } })} onClose={() => setView(view.zurueck || { name: "liste" })} />
    {freigabeDialog}
  </>;
  if (view.name === "naechste") return <>
    <NaechsterHydrant hydranten={hydranten} gps={gps} onBack={zurListe} onOeffnen={(id) => setView({ name: "detail", id, zurueck: view })} onKarte={(id) => setView({ name: "karte", id, zurueck: view })} />
    {freigabeDialog}
  </>;
  if (view.name === "neu") return <HydrantFormular h={null} hydranten={hydranten} onClose={zurListe} onSaved={async (id) => { await laden(true); setView({ name: "detail", id }); }} />;

  // Liste filtern und sortieren
  let liste = hydranten.filter((h) => matchesSearch(`${h.nr} ${h.lage} ${h.bemerkung || ""}`, suche));
  if (filter === "nie") liste = liste.filter((h) => !h.letzteKontrolle && h.typ !== "schieber");
  if (filter === "mangel") liste = liste.filter((h) => h.zustand === "mangel" || h.zustand === "defekt");
  if (filter === "ohne") liste = liste.filter((h) => !hatStandort(h));
  if (gruppe === "keine") liste = liste.filter((h) => !h.gruppe);
  else if (gruppe) liste = liste.filter((h) => String(h.gruppe) === gruppe);
  const abstand = (h) => (pos && hatStandort(h) ? entfernung(pos, h) : Infinity);
  if (sortierung === "kontrolle") liste = liste.slice().sort((a, b) => String((a.letzteKontrolle || {}).datum || "").localeCompare(String((b.letzteKontrolle || {}).datum || "")) || nrSort(a, b));
  else if (sortierung === "entfernung" && pos) liste = liste.slice().sort((a, b) => abstand(a) - abstand(b) || nrSort(a, b));
  else liste = liste.slice().sort(nrSort);

  const chip = (k, t) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} style={{ ...styles.kontrollTab, ...(filter === k ? { background: "#2C2F2A", color: "white", border: "1.5px solid #2C2F2A" } : {}), fontSize: 12, padding: "5px 10px" }}>{t}</button>;

  return (
    <div style={styles.fullscreenPage}>
      <div style={styles.fullscreenHeader}><button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button></div>
      <div style={styles.modalTitle}>Hydranten</div>
      {fehler && <div style={styles.errorText}>{fehler}</div>}
      {hinweis && <div style={{ fontSize: 12, color: "#2E7D4F", margin: "6px 0" }}>{hinweis}</div>}
      <GpsLeiste gps={gps} />
      {!daten && !fehler && <div style={{ fontSize: 12.5, color: "#8A8C86", marginTop: 12 }}>Lädt …</div>}
      {daten && (
        <>
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <button style={knopfRot} onClick={() => { setView({ name: "naechste" }); if (freigabe !== "ja") setFrage(true); }}><Navigation size={16} /> Nächster Hydrant</button>
            <button style={knopf} onClick={() => setView({ name: "karte" })}><KarteIcon size={16} /> Karte</button>
          </div>
          {rechte.verwalter && <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><button style={styles.tinyBtn} onClick={() => setView({ name: "neu" })}><Plus size={11} /> Hydrant anlegen</button></div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {chip("alle", `Alle (${hydranten.length})`)}
            {chip("nie", `Nie kontrolliert (${zaehler.nie})`)}
            {chip("mangel", `Mängel (${zaehler.mangel})`)}
            {chip("ohne", `Ohne Standort (${zaehler.ohne})`)}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <select style={{ ...styles.input, flex: 1, padding: "7px 8px", fontSize: 13 }} aria-label="Kontrollgruppe" value={gruppe} onChange={(e) => setGruppe(e.target.value)}>
              <option value="">Alle Gruppen</option>{[1, 2, 3, 4].map((g) => <option key={g} value={String(g)}>Gruppe {g}</option>)}<option value="keine">Ohne Gruppe</option>
            </select>
            <select style={{ ...styles.input, flex: 1, padding: "7px 8px", fontSize: 13 }} aria-label="Sortierung" value={sortierung} onChange={(e) => setSortierung(e.target.value)}>
              <option value="nr">Nach Nummer</option>
              <option value="kontrolle">Am längsten nicht kontrolliert</option>
              <option value="entfernung" disabled={!pos}>Nach Entfernung{pos ? "" : " (Standort aus)"}</option>
            </select>
          </div>
          <SearchBox value={suche} onChange={setSuche} placeholder="Nummer oder Straße suchen …" />
          {hydranten.length === 0 && (
            <div style={{ ...styles.capacityBox, fontSize: 13, lineHeight: 1.5 }}>
              Es sind noch keine Hydranten angelegt.{rechte.verwalter ? " Die Liste aus der Kontrolle 2018 wird mit dem SQL aus der Update-Anleitung eingespielt – oder lege Hydranten einzeln an." : ""}
            </div>
          )}
          <div style={{ ...klein, margin: "4px 0 6px" }}>{liste.length} {liste.length === 1 ? "Eintrag" : "Einträge"}</div>
          {liste.map((h) => (
            <button key={h.id} data-testid="hydrant-zeile" style={{ ...styles.rosterItem, marginBottom: 6, alignItems: "center", gap: 10 }} onClick={() => setView({ name: "detail", id: h.id })}>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{h.nr} · {h.lage}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#8A8C86", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[h.gruppe ? `Gruppe ${h.gruppe}` : "", h.letzteKontrolle ? `kontrolliert ${datumDe(h.letzteKontrolle.datum)}` : "", !hatStandort(h) ? "ohne Standort" : pos ? entfernungText(abstand(h)) : "", h.zustand && h.zustand !== "ok" ? h.zustandText : ""].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <Pille h={h} />
            </button>
          ))}
          {suche && liste.length === 0 && <div style={{ fontSize: 12.5, color: "#A5A79F" }}>Kein Hydrant gefunden.</div>}
        </>
      )}
      {freigabeDialog}
    </div>
  );
}
