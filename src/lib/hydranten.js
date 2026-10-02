// Hilfen für die Hydranten-Kachel: Zustand, Entfernung, Navigation und die GPS-Freigabe pro Gerät.
import { useEffect, useRef, useState } from "react";

export const TYP_NAME = { unterflur: "Unterflurhydrant", ueberflur: "Überflurhydrant", schieber: "Schieber", sonstige: "Sonstige" };
export const ART_NAME = { BW: "Ausführung Baden-Württemberg (BW)", BY: "Ausführung Bayern (BY)" };
export const ZUSTAND = {
  "": { text: "Nie kontrolliert", farbe: "#6B6E66", grund: "#ECEAE4", karte: "#8A8C86" },
  ok: { text: "In Ordnung", farbe: "#1F6F5C", grund: "#E3F1EC", karte: "#2E7D4F" },
  mangel: { text: "Mangel", farbe: "#9A5B00", grund: "#FBEBD3", karte: "#E08A00" },
  defekt: { text: "Nicht funktionsfähig", farbe: "#FFFFFF", grund: "#C1272D", karte: "#C1272D" },
};
// Gängige Nennweiten der Wasserleitung (mm); andere Werte sind erlaubt.
export const DN_WERTE = [80, 100, 125, 150, 200, 250, 300];
export const dnText = (h) => (h && h.dn ? `DN ${h.dn}` : "");
export const zustandVon = (h) => (h && ZUSTAND[h.zustand] ? h.zustand : "");
export const hatStandort = (h) => !!h && typeof h.lat === "number" && typeof h.lng === "number";
// Ungefähre Mitte von Regglisweiler – nur Startausschnitt der Karte, solange kein Hydrant einen Standort hat.
export const ORT_MITTE = { lat: 48.2335, lng: 10.0700 };

export const heuteISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const datumDe = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? `${m[3]}.${m[2]}.${m[1]}` : ""; };
export const zeitDe = (ts) => { const d = new Date(ts); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); };

// Entfernung in Metern (Luftlinie).
export function entfernung(a, b) {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}
export function entfernungText(m) {
  if (!(m >= 0)) return "";
  if (m < 1000) return `${Math.max(5, Math.round(m / 5) * 5)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`;
}
const RICHTUNGEN = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
export function richtung(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  const grad = (Math.atan2(y, x) / rad + 360) % 360;
  return RICHTUNGEN[Math.round(grad / 45) % 8];
}
// Nächste Hydranten (Schieber zählen nicht), mit Entfernung.
export function naechste(hydranten, pos, anzahl = 5) {
  if (!pos) return [];
  return hydranten.filter((h) => hatStandort(h) && h.typ !== "schieber")
    .map((h) => ({ h, m: entfernung(pos, h) }))
    .sort((a, b) => a.m - b.m).slice(0, anzahl);
}

export const istIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export function navigationsLinks(h) {
  const z = `${h.lat},${h.lng}`;
  return {
    apple: `https://maps.apple.com/?daddr=${z}&dirflg=d`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${z}`,
  };
}

// Vorschlag für eine neue Nummer: HY9001, HY9002 … (die Nummern aus der Liste bleiben unberührt).
export function naechsteFreieNummer(hydranten) {
  const max = (hydranten || []).reduce((m, h) => { const x = /^HY9(\d{3})$/.exec(String(h.nr || "")); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
  return `HY9${String(max + 1).padStart(3, "0")}`;
}

// ---------- GPS-Freigabe (gilt nur für dieses Gerät) ----------
// "ja" dauerhaft im Browser; "Nicht jetzt" bzw. „zurückgenommen“ nur bis zum nächsten Start der App.
const SCHLUESSEL = "ffw_hydranten_gps";
const SPAETER = "ffw_hydranten_gps_spaeter";
export function gpsFreigabe() {
  try { if (localStorage.getItem(SCHLUESSEL) === "ja") return "ja"; } catch (e) { /* egal */ }
  try { if (sessionStorage.getItem(SPAETER) === "1") return "nein"; } catch (e) { /* egal */ }
  return null; // noch nicht gefragt
}
export function gpsErlauben() {
  try { localStorage.setItem(SCHLUESSEL, "ja"); } catch (e) { /* egal */ }
  try { sessionStorage.removeItem(SPAETER); } catch (e) { /* egal */ }
}
export function gpsNichtJetzt() {
  try { localStorage.removeItem(SCHLUESSEL); } catch (e) { /* egal */ }
  try { sessionStorage.setItem(SPAETER, "1"); } catch (e) { /* egal */ }
}

// Laufende Standortbestimmung, solange die Kachel offen und die Freigabe erteilt ist.
// fehler: "verweigert" (im iPhone/Browser gesperrt), "fehlt" (Gerät kann kein GPS), "suche" (noch keine Position)
export function useStandort(aktiv) {
  const [pos, setPos] = useState(null);
  const [fehler, setFehler] = useState("");
  const idRef = useRef(null);
  useEffect(() => {
    if (!aktiv) { setPos(null); setFehler(""); return undefined; }
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) { setFehler("fehlt"); return undefined; }
    setFehler("");
    idRef.current = geo.watchPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, genauigkeit: Math.round(p.coords.accuracy || 0), ts: p.timestamp || Date.now() }); setFehler(""); },
      (e) => { setFehler(e && e.code === 1 ? "verweigert" : "suche"); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => { if (idRef.current != null) geo.clearWatch(idRef.current); idRef.current = null; };
  }, [aktiv]);
  return { pos, fehler };
}
