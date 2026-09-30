// Zuletzt geladene Listen merken, damit eine Kachel sofort etwas zeigt und im Hintergrund auffrischt.
// „dauerhaft“ = zusätzlich im Browser-Speicher (übersteht einen Neustart der App); nur für unkritische Listen.
// Beim Abmelden wird alles gelöscht.
const PRAEFIX = "ffw_cache:";
const speicher = new Map();

export function merke(schluessel, wert, { dauerhaft = false } = {}) {
  speicher.set(schluessel, wert);
  if (dauerhaft) { try { localStorage.setItem(PRAEFIX + schluessel, JSON.stringify(wert)); } catch (e) { /* voll/gesperrt – egal */ } }
}

export function hole(schluessel) {
  if (speicher.has(schluessel)) return speicher.get(schluessel);
  try {
    const t = localStorage.getItem(PRAEFIX + schluessel);
    if (t) { const w = JSON.parse(t); speicher.set(schluessel, w); return w; }
  } catch (e) { /* egal */ }
  return null;
}

export function allesVergessen() {
  speicher.clear();
  try { Object.keys(localStorage).filter((k) => k.startsWith(PRAEFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* egal */ }
}
