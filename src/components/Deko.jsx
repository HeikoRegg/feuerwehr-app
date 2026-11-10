// Jahreszeiten-Deko (seit 2.40): kleines Motiv am Löwen im Kopf und kurzer Schneefall beim Öffnen der App im Winter.
import React, { useEffect, useMemo, useState } from "react";

// Kleine Nikolausmütze, sitzt schräg auf dem Löwen
function Muetze() {
  return (
    <svg data-testid="deko-muetze" width="22" height="17" viewBox="0 0 44 34" style={{ position: "absolute", top: -9, left: 7, transform: "rotate(-14deg)", pointerEvents: "none" }} aria-hidden="true">
      <path d="M4 26 C10 10, 24 2, 36 6 C32 12, 34 18, 38 24 Z" fill="#C8102E" />
      <circle cx="38" cy="25" r="4.5" fill="#fff" />
      <rect x="1" y="23" width="30" height="8" rx="4" fill="#fff" />
    </svg>
  );
}

const MOTIV = {
  advent: { zeichen: "🎄", titel: "Frohe Adventszeit" },
  ostern: { zeichen: "🐰", extra: "🥚", titel: "Frohe Ostern" },
  sommer: { zeichen: "☀️", extra: "🌴", titel: "Schöne Sommerpause" },
};

// Legt sich um das Logo im Kopf; ohne Motiv nur das Logo.
export function KopfDeko({ motiv, children }) {
  const m = motiv ? MOTIV[motiv] : null;
  return (
    <span style={{ position: "relative", display: "inline-flex" }} data-testid={m ? `deko-${motiv}` : undefined} title={m ? m.titel : undefined}>
      {children}
      {motiv === "advent" && <Muetze />}
      {m && (
        <span aria-hidden="true" style={{ position: "absolute", right: -9, bottom: -4, fontSize: 13, lineHeight: 1, pointerEvents: "none", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" }}>
          {m.zeichen}{m.extra ? <span style={{ fontSize: 9, marginLeft: -2 }}>{m.extra}</span> : null}
        </span>
      )}
    </span>
  );
}

// Schneefall über der ganzen App, ein paar Sekunden lang, dann ausblenden. Blockiert keine Eingaben.
export function Schneefall({ dauer = 4500 }) {
  const ruhig = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [an, setAn] = useState(!ruhig);
  const [aus, setAus] = useState(false);
  useEffect(() => {
    if (ruhig) return undefined;
    const t1 = setTimeout(() => setAus(true), dauer - 900);
    const t2 = setTimeout(() => setAn(false), dauer);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const flocken = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    links: Math.random() * 100, groesse: 4 + Math.random() * 7, verz: Math.random() * 1.6, dauer: 2.6 + Math.random() * 2.2, drift: (Math.random() - 0.5) * 60, i,
  })), []);
  if (!an) return null;
  return (
    <div data-testid="schneefall" aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden", opacity: aus ? 0 : 1, transition: "opacity 0.9s ease", background: "linear-gradient(180deg, rgba(220,232,245,0.28), rgba(255,255,255,0))" }}>
      <style>{`@keyframes ffwSchnee { from { transform: translate3d(0,-20px,0); } to { transform: translate3d(var(--drift), 105vh, 0); } }`}</style>
      {flocken.map((f) => (
        <span key={f.i} style={{ position: "absolute", top: -12, left: `${f.links}%`, width: f.groesse, height: f.groesse, borderRadius: "50%", background: "white", boxShadow: "0 0 4px rgba(120,150,190,0.55)", opacity: 0.9,
          animation: `ffwSchnee ${f.dauer}s linear ${f.verz}s forwards`, "--drift": `${f.drift}px` }} />
      ))}
    </div>
  );
}
