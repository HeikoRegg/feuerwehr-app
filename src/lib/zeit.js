// Zeiten im Einsatzbericht: minutengenau als „Std:Min“ (z. B. 1:23). Alte Berichte hatten Dezimalstunden (1,5) – die werden
// beim Lesen exakt auf Minuten umgerechnet (1,5 = 1:30).
export function zuMin(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [h, m] = s.split(":");
    const min = (Number(h) || 0) * 60 + (Number(m) || 0);
    return Number.isFinite(min) && min > 0 ? Math.round(min) : 0;
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}
export const fmtHM = (min) => { const m = Math.max(0, Math.round(min || 0)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
// Eingegebenen/alten Wert als „h:mm“ schreiben (leer bleibt leer)
export const normHM = (v) => { const m = zuMin(v); return m ? fmtHM(m) : ""; };
// Beim Tippen nur Ziffern und einen Doppelpunkt zulassen
export const zeitEingabe = (v) => { const s = String(v ?? "").replace(/[^0-9:]/g, ""); const i = s.indexOf(":"); return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/:/g, "").slice(0, 2); };
// Statistik: je Person und Einsatz auf die nächste Viertelstunde aufrunden
export const aufViertel = (min) => (min > 0 ? Math.ceil(min / 15) * 15 : 0);
