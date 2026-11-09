// Bereichswahl für Termine (seit 2.39): Ein normales Antippen wählt genau einen Bereich (wie bisher).
// Ein weiterer Bereich wird nur aktiv, wenn man ihn etwa eine Sekunde gedrückt hält – so gilt ein Termin nicht versehentlich für mehrere Bereiche.
// Antippen eines schon gewählten Bereichs nimmt ihn wieder heraus (mindestens einer bleibt).
import React, { useRef, useState } from "react";
import { BEREICHE } from "../lib/constants";
import { styles } from "../lib/styles";

export const LANGDRUCK_MS = 900;

export function BereichWahl({ erlaubt, wert, onChange }) {
  const timer = useRef(null);
  const langGedrueckt = useRef(false);
  const [druck, setDruck] = useState(null);
  const alle = [...erlaubt, ...wert.filter((b) => !erlaubt.includes(b))];
  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } setDruck(null); };
  function start(b) {
    langGedrueckt.current = false;
    if (wert.includes(b) || !erlaubt.includes(b)) return;
    setDruck(b);
    timer.current = setTimeout(() => {
      timer.current = null; langGedrueckt.current = true; setDruck(null);
      onChange([...wert, b]);
    }, LANGDRUCK_MS);
  }
  function antippen(b) {
    if (langGedrueckt.current) { langGedrueckt.current = false; return; }
    if (!erlaubt.includes(b)) return; // von jemand anderem hinzugefügt – hier nicht änderbar
    if (wert.includes(b)) { if (wert.length > 1) onChange(wert.filter((x) => x !== b)); return; }
    onChange([b]);
  }
  return (
    <div data-testid="bereich-wahl">
      <div style={styles.categoryPicker}>
        {alle.map((b) => {
          const an = wert.includes(b);
          return (
            <button key={b} type="button" data-testid={`bereich-chip-${b}`} aria-pressed={an}
              onPointerDown={() => start(b)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
              onContextMenu={(e) => e.preventDefault()} onClick={() => antippen(b)}
              style={{ ...styles.categoryChip, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation",
                transition: `transform ${druck === b ? LANGDRUCK_MS : 120}ms linear, box-shadow ${druck === b ? LANGDRUCK_MS : 120}ms linear`,
                transform: druck === b ? "scale(1.12)" : "none", boxShadow: druck === b ? `0 0 0 3px ${BEREICHE[b].color}55` : "none",
                background: an ? BEREICHE[b].color : "#F3F1EC", color: an ? "white" : "#5C5F58", borderColor: an ? BEREICHE[b].color : "#E2DFD6", opacity: erlaubt.includes(b) ? 1 : 0.6 }}>
              {BEREICHE[b].label}
            </button>
          );
        })}
      </div>
      {erlaubt.length > 1 && <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 4 }}>Einen weiteren Bereich hinzufügen: Bereich gedrückt halten.{wert.length > 1 ? ` Der Termin gilt für ${wert.length} Bereiche.` : ""}</div>}
    </div>
  );
}
