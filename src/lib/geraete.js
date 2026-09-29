// Gemeinsame Bausteine für die Geräte-Kachel: Prüfarten, Fälligkeiten, Status, QR-Link.

// typ "intervall": wird alle X Tage fällig – eingetragen wird nur „in Ordnung“ / „Mangel“.
// typ "datum": gilt bis zu einem Datum (Elektroprüfung, externe Prüfung, Verfallsdatum) – das trägt der Gerätewart ein.
export const PRUEFARTEN = [
  { key: "sicht", name: "Sichtprüfung", typ: "intervall", standard: 6, einheit: "monate", frage: "Sauber, vollständig, keine sichtbaren Schäden?" },
  { key: "funktion", name: "Funktionsprüfung", typ: "intervall", standard: 6, einheit: "monate", frage: "Gerät läuft / funktioniert einwandfrei?" },
  { key: "tank", name: "Tank / Kraftstoff", typ: "intervall", standard: 3, einheit: "monate", frage: "Tank bzw. Kanister ist gefüllt?" },
  { key: "akku", name: "Akku", typ: "intervall", standard: 3, einheit: "monate", frage: "Akku ist geladen?" },
  { key: "vollzaehlig", name: "Vollzähligkeit", typ: "intervall", standard: 6, einheit: "monate", frage: "Alles vollständig vorhanden (Menge stimmt)?" },
  { key: "elektro", name: "Elektroprüfung (DGUV V3)", typ: "datum", standard: 1, einheit: "jahre", frage: "Elektroprüfung durchgeführt – gültig bis:" },
  { key: "extern", name: "Externe Prüfung (Hersteller, TÜV …)", typ: "datum", standard: 1, einheit: "jahre", frage: "Prüfung durchgeführt – gültig bis:" },
  { key: "verfall", name: "Verfallsdatum", typ: "datum", standard: 0, einheit: "jahre", frage: "Verfällt am:" },
];
export const PRUEFART = Object.fromEntries(PRUEFARTEN.map((p) => [p.key, p]));
export const MANGEL_STATUS = { offen: "Offen", bearbeitung: "In Bearbeitung", behoben: "Behoben" };

const pad = (n) => String(n).padStart(2, "0");
export const lokalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const heuteISO = () => lokalISO(new Date());
export function plusTage(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return lokalISO(d); }
export function plusMonate(iso, n) { const d = new Date(iso + "T12:00:00"); const tag = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const ende = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(tag, ende)); return lokalISO(d); }
// Intervall als Zahl + Einheit ("monate" | "jahre"; ältere Geräte haben "tage").
export function plusIntervall(iso, p) {
  const n = Math.max(0, parseInt(p && p.intervall, 10) || 0);
  const e = (p && p.einheit) || "tage";
  return e === "jahre" ? plusMonate(iso, n * 12) : e === "monate" ? plusMonate(iso, n) : plusTage(iso, n);
}
export function intervallText(p) {
  const n = Math.max(0, parseInt(p && p.intervall, 10) || 0);
  const e = (p && p.einheit) || "tage";
  if (e === "jahre") return `${n} ${n === 1 ? "Jahr" : "Jahre"}`;
  if (e === "monate") return `${n} ${n === 1 ? "Monat" : "Monate"}`;
  return `${n} ${n === 1 ? "Tag" : "Tage"}`;
}
// Ältere Tage-Werte werden beim Bearbeiten auf Monate umgestellt (30 Tage = 1 Monat).
export function intervallNormal(p, def) {
  const e = p && p.einheit;
  if (e === "monate" || e === "jahre") return { intervall: Math.max(0, parseInt(p.intervall, 10) || 0), einheit: e };
  const tage = parseInt(p && p.intervall, 10);
  if (!tage) return { intervall: def.standard, einheit: def.einheit };
  return { intervall: Math.max(1, Math.round(tage / 30)), einheit: "monate" };
}
export function tageBis(iso) { return Math.round((new Date(iso + "T12:00:00") - new Date(heuteISO() + "T12:00:00")) / 86400000); }
export function datumDe(iso) { if (!iso) return "—"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}.${m}.${y}`; }
export function zeitDe(ts) {
  const d = new Date(ts); if (isNaN(d)) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Status einer einzelnen Prüfart eines Geräts.
// status: "ok" | "bald" | "ueberfaellig" | "nie"
export function artStatus(g, art) {
  const def = PRUEFART[art]; const stand = (g.pruefstand || {})[art];
  const einst = (g.pruefarten || []).find((p) => p.art === art) || {};
  if (!def) return { status: "ok" };
  if (def.typ === "datum") {
    if (!stand || !stand.bis) return { status: "nie", stand, faelligAm: "" };
    const tage = tageBis(stand.bis);
    return { status: tage < 0 ? "ueberfaellig" : tage <= 30 ? "bald" : "ok", stand, faelligAm: stand.bis, tage };
  }
  if (!stand) return { status: "nie", stand, faelligAm: "" };
  const eff = einst.intervall ? einst : { intervall: def.standard, einheit: def.einheit };
  const start = lokalISO(new Date(stand.ts));
  const faelligAm = plusIntervall(start, eff);
  const tage = tageBis(faelligAm);
  // „Bald fällig“: bis 30 Tage vorher, bei kurzen Intervallen höchstens ein Viertel des Intervalls.
  const gesamt = Math.round((new Date(faelligAm + "T12:00:00") - new Date(start + "T12:00:00")) / 86400000);
  const bald = Math.min(30, Math.floor(gesamt / 4));
  return { status: tage < 0 ? "ueberfaellig" : tage <= bald ? "bald" : "ok", stand, faelligAm, tage };
}

export const STATUS_INFO = {
  ok: { text: "In Ordnung", farbe: "#2E7D4F", grund: "#E6F2EA" },
  bald: { text: "Bald fällig", farbe: "#B8791A", grund: "#FBF1E1" },
  ueberfaellig: { text: "Prüfung fällig", farbe: "#C1272D", grund: "#FBEAEA" },
  mangel: { text: "Mangel offen", farbe: "#C1272D", grund: "#FBEAEA" },
  gesperrt: { text: "Nicht einsatzbereit", farbe: "#FFFFFF", grund: "#8E1B20" },
  ausgesondert: { text: "Ausgesondert", farbe: "#8A8C86", grund: "#EEEEEC" },
  ohne: { text: "Keine Prüfung festgelegt", farbe: "#8A8C86", grund: "#EEEEEC" },
};
// Gesamtstatus eines Geräts (Reihenfolge = Wichtigkeit).
export function geraetStatus(g) {
  if (g.ausgesondert) return "ausgesondert";
  if (g.nichtEinsatzbereit) return "gesperrt";
  if (g.offeneMaengel > 0) return "mangel";
  const arten = (g.pruefarten || []).map((p) => artStatus(g, p.art).status);
  if (!arten.length) return "ohne";
  if (arten.some((s) => s === "ueberfaellig" || s === "nie")) return "ueberfaellig";
  if (arten.some((s) => s === "bald")) return "bald";
  return "ok";
}
// Welche Prüfarten sind jetzt an der Reihe (für den Rundgang)? Nur Ja/Nein-Prüfungen, die jeder eintragen darf.
export function faelligeSchnellpruefungen(g) {
  return (g.pruefarten || []).filter((p) => PRUEFART[p.art] && PRUEFART[p.art].typ === "intervall").filter((p) => { const s = artStatus(g, p.art).status; return s !== "ok"; });
}

export const geraeteName = (g) => (g && (g.kurzname || g.name)) || "Gerät";

// ---- QR-Link ----
export const geraeteLink = (id) => `${window.location.origin}/?geraet=${id}`;
// Aus dem Inhalt eines gescannten QR-Codes die Geräte-Kennung holen (Link oder nackte Kennung).
export function idAusQr(text) {
  const t = String(text || "").trim();
  try { const u = new URL(t); const g = u.searchParams.get("geraet"); if (g && /^[a-z0-9]{4,20}$/i.test(g)) return g; } catch (e) { /* kein Link */ }
  const m = t.match(/[?&]geraet=([a-z0-9]{4,20})/i);
  if (m) return m[1];
  if (/^[a-z0-9]{6,20}$/i.test(t)) return t;
  return null;
}
