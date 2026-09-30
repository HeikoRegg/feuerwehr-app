import { useEffect, useState } from "react";

// Sichtbarer Bereich des Bildschirms (ohne Tastatur/Adressleiste), über window.visualViewport.
// Liefert null, wenn der Browser das nicht kennt – dann einfach die volle Höhe verwenden.
// tastatur = true, wenn der sichtbare Bereich deutlich kleiner ist als der größte bisher gemessene.
export function useSichtbereich() {
  const [vv, setVv] = useState(null);
  useEffect(() => {
    const v = typeof window !== "undefined" && window.visualViewport; if (!v) return undefined;
    let max = 0;
    const f = () => { const h = Math.round(v.height); max = Math.max(max, h, window.innerHeight || 0); setVv({ h, t: Math.round(v.offsetTop), tastatur: h < max - 120 }); };
    f(); v.addEventListener("resize", f); v.addEventListener("scroll", f);
    return () => { v.removeEventListener("resize", f); v.removeEventListener("scroll", f); };
  }, []);
  return vv;
}

// Stil für eine feste Ebene, die genau den sichtbaren Bereich ausfüllt.
export function sichtbereichStil(vv) {
  return vv ? { position: "fixed", left: 0, right: 0, top: vv.t, height: vv.h, bottom: "auto" } : { position: "fixed", inset: 0 };
}
