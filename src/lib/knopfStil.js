// Einheitliche Knopf-Optik (seit 2.23): Knöpfe erhaben, Kacheln 3D.
//  - Ja / Zusage / „Ich kann“ bleiben grün, Nein / Absage / Löschen bleiben rot (behalten ihre Farbe, werden nur erhaben)
//  - Anrufen / E-Mail: hellblau (direkt in Shared.jsx gestaltet, hier ausgenommen)
//  - alle anderen Knöpfe: goldgelb seit 2.24 (gefüllte Knöpfe gelb gefüllt mit dunkler Schrift, helle Knöpfe weiß mit gelbem Rand)
//  - Auswahl-Chips (runde Filter-/Kategorie-/Bereichsknöpfe), Symbol- und Textknöpfe ohne Rahmen bleiben unverändert
// Die App hat hunderte Knöpfe mit eigenen Stilen. Statt jeden einzeln umzubauen, ordnet diese Datei jeden Knopf beim
// Erscheinen anhand seiner Farbe und Beschriftung einer Klasse zu (CSS mit !important überschreibt nur die Farbe).
const CSS = `
button[style*="rgb(249, 203, 144)"] {
  background: linear-gradient(180deg, #FFEDA8 0%, #FFD452 100%) !important;
  border: 1px solid #E5B416 !important; border-bottom: 4px solid #C28F00 !important;
  box-shadow: 0 6px 12px rgba(120,90,0,0.22), inset 0 1px 0 rgba(255,255,255,0.7) !important;
  transition: transform .08s, box-shadow .08s;
}
button[style*="rgb(249, 203, 144)"]:active { transform: translateY(3px); box-shadow: 0 2px 4px rgba(120,90,0,0.2) !important; }
button.k-or {
  background: linear-gradient(180deg, #FFD452 0%, #F2B70F 100%) !important; color: #3A2C00 !important;
  border: none !important; border-bottom: 3px solid #C28F00 !important;
  box-shadow: 0 3px 6px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.45) !important;
}
button.k-or *:not(svg):not(path):not(line):not(circle):not(polyline):not(rect) { color: #3A2C00 !important; }
button.k-or svg { color: #3A2C00; }
button.k-or2 {
  background: linear-gradient(180deg, #FFFFFF 0%, #FFF8DC 100%) !important; color: #8A6500 !important;
  border: 1.5px solid #E5B416 !important; border-bottom: 3px solid #E5B416 !important;
  box-shadow: 0 2px 5px rgba(0,0,0,0.12) !important;
}
button.k-or2 *:not(svg):not(path):not(line):not(circle):not(polyline):not(rect) { color: #8A6500 !important; }
button.k-kachel:active { transform: translateY(3px); }
button.k-3d { box-shadow: 0 3px 0 rgba(0,0,0,0.16), 0 4px 8px rgba(0,0,0,0.10) !important; }
button.k-or, button.k-or2, button.k-3d { transition: transform .08s; }
button.k-or:active:not(:disabled), button.k-or2:active:not(:disabled), button.k-3d:active:not(:disabled), a[data-knopf]:active { transform: translateY(2px); }
button.k-or:disabled, button.k-or2:disabled { opacity: 0.5; }
`;
const GRUEN = /^(✓\s*)?(ja|zusage|zusagen|zugesagt|ich kann|ich bin dabei|bin dabei)\b/i;
const ROT = /^(✕\s*)?(nein|absage|absagen|abgesagt|kann nicht)\b|löschen|ungültig/i;

function farbe(s) {
  const m = String(s || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(",").map((x) => parseFloat(x));
  return { r, g, b, a };
}
export function knopfKlasse(b) {
  if (!b || b.tagName !== "BUTTON") return null;
  if (b.dataset.knopf === "fest" || b.closest("header") || b.closest("[data-knopf-aus]")) return null;
  const st = b.style;
  if (String(b.getAttribute("style") || "").includes("249, 203, 144")) return null; // Kachel (eigene CSS-Regel)
  const radius = parseFloat(st.borderRadius) || 0;
  if (radius >= 16) return null; // Auswahl-Chips
  const bg = farbe(st.backgroundColor) || (st.background && /gradient/.test(st.background) ? { r: 0, g: 0, b: 0, a: 1, verlauf: true } : null);
  const rahmen = st.borderTopStyle && st.borderTopStyle !== "none" && (parseFloat(st.borderTopWidth) || 1) > 0;
  if ((!bg || bg.a < 0.5) && !rahmen) return null; // Symbol- und Textknöpfe
  if (bg && bg.verlauf) return null;
  const text = (b.innerText || "").trim();
  if (GRUEN.test(text) || ROT.test(text)) return "k-3d";
  if (bg && bg.a >= 0.5) {
    const { r, g, b: bl } = bg;
    const hell = (r + g + bl) / 3;
    if (g > r + 15 && g >= bl) return "k-3d";                 // grün = Zustand / Zusage
    if (hell < 70) return "k-3d";                              // dunkel = ausgewählt
    if (hell < 215) return "k-or";                             // gefüllt (rot, petrol, braun …) → goldgelb
  }
  return "k-or2";                                              // hell / nur Rahmen → weiß mit gelbem Rand
}
function anwenden(b) {
  const k = knopfKlasse(b);
  b.classList.remove("k-or", "k-or2", "k-3d");
  if (k) b.classList.add(k);
}
let laeuft = false;
export function starteKnopfStil() {
  if (laeuft || typeof document === "undefined") return;
  laeuft = true;
  const st = document.createElement("style"); st.id = "knopf-stil"; st.textContent = CSS; document.head.appendChild(st);
  let offen = new Set(); let geplant = false;
  const plane = () => { if (geplant) return; geplant = true; requestAnimationFrame(() => { geplant = false; const l = offen; offen = new Set(); l.forEach(anwenden); }); };
  const sammeln = (n) => { if (n.nodeType !== 1) return; if (n.tagName === "BUTTON") offen.add(n); n.querySelectorAll && n.querySelectorAll("button").forEach((x) => offen.add(x)); };
  new MutationObserver((liste) => {
    liste.forEach((m) => {
      if (m.type === "childList") { m.addedNodes.forEach(sammeln); if (m.target && m.target.closest) { const bt = m.target.closest("button"); if (bt) offen.add(bt); } }
      else if (m.target.tagName === "BUTTON") offen.add(m.target);
    });
    if (offen.size) plane();
  }).observe(document.body, { childList: true, subtree: true, characterData: false, attributes: true, attributeFilter: ["style", "aria-pressed", "disabled"] });
  document.querySelectorAll("button").forEach((x) => offen.add(x)); plane();
}
