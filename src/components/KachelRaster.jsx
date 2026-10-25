// Kachel-Raster im Menü „Funktionen“ mit eigener Reihenfolge (seit 2.28).
// Eine Kachel 1 Sekunde gedrückt halten → sie hebt sich an und lässt sich mit dem Finger an einen neuen Platz ziehen.
// Kurzes Antippen öffnet die Kachel wie bisher; Wischen zum Scrollen löst nichts aus.
import React, { useEffect, useRef, useState } from "react";
import { styles } from "../lib/styles";
import { KACHEL_FARBEN } from "../lib/constants";

const HALTEZEIT = 1000; // ms (Heiko: eine ganze Sekunde)
const TOLERANZ = 10;    // px Bewegung, die vor dem Anheben noch als „Stillhalten“ gilt

// Gespeicherte Reihenfolge auf die gerade sichtbaren Kacheln anwenden; unbekannte/neue Kacheln hinten anhängen.
export function ordne(sichtbar, reihenfolge) {
  const keys = sichtbar.map((k) => k.key);
  const gemerkt = (Array.isArray(reihenfolge) ? reihenfolge : []).filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !gemerkt.includes(k));
  const reihe = [...gemerkt, ...rest];
  return reihe.map((k) => sichtbar.find((x) => x.key === k));
}

// Hintergrund einer Kachel aus der Palette (3D: heller Verlauf, dunklere Unterkante, Schatten)
export function kachelStil(farbe) {
  const f = KACHEL_FARBEN[farbe] || KACHEL_FARBEN.goldgelb;
  return { background: `linear-gradient(180deg, ${f.von} 0%, ${f.bis} 100%)`, border: `1px solid ${f.rand}`, borderBottom: `4px solid ${f.kante}`, boxShadow: `0 6px 12px ${f.schatten}, inset 0 1px 0 rgba(255,255,255,0.7)` };
}

export default function KachelRaster({ kacheln, reihenfolge, onReihenfolge, nachKachel, farben = {} }) {
  const [liste, setListe] = useState(() => ordne(kacheln, reihenfolge));
  const [zieht, setZieht] = useState(null);
  const ziehtRef = useRef(null);
  const timer = useRef(null);
  const start = useRef(null);
  const klickSperre = useRef(false);
  const listeRef = useRef(liste);
  listeRef.current = liste;

  // Neue Kacheln/Reihenfolge von außen übernehmen (nicht während des Ziehens)
  useEffect(() => { if (!ziehtRef.current) setListe(ordne(kacheln, reihenfolge)); }, [kacheln, reihenfolge]);

  // Während des Ziehens darf die Seite nicht scrollen (iPhone): touchmove abfangen.
  useEffect(() => {
    const stop = (e) => { if (ziehtRef.current) e.preventDefault(); };
    document.addEventListener("touchmove", stop, { passive: false });
    return () => document.removeEventListener("touchmove", stop);
  }, []);

  function abbrechen() { clearTimeout(timer.current); timer.current = null; }
  function down(e, key) {
    if (e.button !== undefined && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, key, id: e.pointerId };
    abbrechen();
    timer.current = setTimeout(() => {
      ziehtRef.current = key; setZieht(key); klickSperre.current = true;
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (x) { /* egal */ }
    }, HALTEZEIT);
  }
  function move(e) {
    if (!start.current) return;
    if (!ziehtRef.current) {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > TOLERANZ) { abbrechen(); start.current = null; }
      return;
    }
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const ziel = el && el.closest ? el.closest("[data-kachel]") : null;
    const zielKey = ziel && ziel.getAttribute("data-kachel");
    const k = ziehtRef.current;
    if (!zielKey || zielKey === k) return;
    setListe((l) => {
      const von = l.findIndex((x) => x.key === k), nach = l.findIndex((x) => x.key === zielKey);
      if (von < 0 || nach < 0) return l;
      const n = l.slice(); const [x] = n.splice(von, 1); n.splice(nach, 0, x); return n;
    });
  }
  function up() {
    abbrechen();
    start.current = null;
    if (ziehtRef.current) {
      ziehtRef.current = null; setZieht(null);
      const keys = listeRef.current.map((x) => x.key);
      const alt = Array.isArray(reihenfolge) ? reihenfolge : [];
      onReihenfolge([...keys, ...alt.filter((k) => !keys.includes(k))]);
      setTimeout(() => { klickSperre.current = false; }, 50);
    }
  }
  useEffect(() => {
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); abbrechen(); };
  });

  return (
    <>
      <div style={{ ...styles.tileGrid, marginTop: 14 }} data-testid="kachel-raster">
        {liste.map((k) => {
          const aktiv = zieht === k.key;
          return (
            <button
              key={k.key}
              data-kachel={k.key}
              data-farbe={farben[k.key] || "goldgelb"}
              data-knopf="fest"
              className="k-kachel"
              style={{
                ...styles.tile, ...kachelStil(farben[k.key]), position: "relative", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none",
                ...(aktiv ? { transform: "scale(1.08)", opacity: 0.88, zIndex: 5, boxShadow: "0 14px 28px rgba(0,0,0,0.28)" } : {}),
                transition: "transform .12s, box-shadow .12s",
              }}
              onPointerDown={(e) => down(e, k.key)}
              onContextMenu={(e) => e.preventDefault()}
              onClickCapture={(e) => { if (klickSperre.current) { e.preventDefault(); e.stopPropagation(); } }}
              onClick={k.onClick}
            >
              {k.icon}
              <span style={styles.tileLabel}>{k.label}</span>
              {k.badge}
            </button>
          );
        })}
        {nachKachel}
      </div>
      <div style={{ fontSize: 11, color: "#A5A79F", textAlign: "center", marginTop: 14 }}>{zieht ? "Loslassen, um die Kachel hier abzulegen" : "Tipp: Kachel 1 Sekunde gedrückt halten, dann verschieben"}</div>
    </>
  );
}
