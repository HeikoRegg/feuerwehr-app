// Karte für die Hydranten-Kachel (OpenStreetMap über Leaflet). Wird erst geladen, wenn die Karte geöffnet wird.
//  modus "ansehen": alle Hydranten mit Standort als farbige Punkte, eigener Standort blau, Antippen wählt aus.
//  modus "setzen":  Fadenkreuz in der Mitte – die Karte wird verschoben, bis es auf dem Hydranten sitzt.
import React, { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ORT_MITTE, ZUSTAND, hatStandort, zustandVon } from "../lib/hydranten";

export default function HydrantenKarte({ hydranten, pos, auswahl, onAuswahl, modus = "ansehen", start, onMitte, folgen }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const ebeneRef = useRef(null);
  const posRef = useRef(null);
  const onAuswahlRef = useRef(onAuswahl); onAuswahlRef.current = onAuswahl;
  const onMitteRef = useRef(onMitte); onMitteRef.current = onMitte;
  const ersteAnsicht = useRef(false);

  // Karte einmalig anlegen
  useEffect(() => {
    const map = L.map(divRef.current, { zoomControl: true, attributionControl: true, maxZoom: 19 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map);
    ebeneRef.current = L.layerGroup().addTo(map);
    posRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const mitte = () => { const c = map.getCenter(); if (onMitteRef.current) onMitteRef.current({ lat: c.lat, lng: c.lng }); };
    map.on("moveend", mitte);
    // Startausschnitt
    const mitStandort = (hydranten || []).filter(hatStandort);
    if (start && hatStandort(start)) map.setView([start.lat, start.lng], 18);
    else if (mitStandort.length > 1) map.fitBounds(L.latLngBounds(mitStandort.map((h) => [h.lat, h.lng])), { padding: [30, 30], maxZoom: 17 });
    else if (mitStandort.length === 1) map.setView([mitStandort[0].lat, mitStandort[0].lng], 17);
    else if (pos) map.setView([pos.lat, pos.lng], 17);
    else map.setView([ORT_MITTE.lat, ORT_MITTE.lng], 15);
    ersteAnsicht.current = !!(start || mitStandort.length || pos);
    mitte();
    // Die Kachel baut sich gerade erst auf – danach die Größe neu messen.
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  // Hydranten-Punkte
  useEffect(() => {
    const ebene = ebeneRef.current; if (!ebene || modus === "setzen") return;
    ebene.clearLayers();
    (hydranten || []).filter(hatStandort).forEach((h) => {
      const z = ZUSTAND[zustandVon(h)];
      const gewaehlt = h.id === auswahl;
      const m = L.circleMarker([h.lat, h.lng], {
        radius: gewaehlt ? 12 : 8, color: gewaehlt ? "#1F2422" : "#FFFFFF", weight: gewaehlt ? 3 : 2,
        fillColor: h.typ === "schieber" ? "#5B7C99" : z.karte, fillOpacity: 1,
      });
      m.bindTooltip(String(h.nr || ""), { direction: "top", offset: [0, -8] });
      m.on("click", () => { if (onAuswahlRef.current) onAuswahlRef.current(h.id); });
      m.addTo(ebene);
    });
  }, [hydranten, auswahl, modus]);

  // Eigener Standort
  useEffect(() => {
    const ebene = posRef.current, map = mapRef.current; if (!ebene || !map) return;
    ebene.clearLayers();
    if (!pos) return;
    if (pos.genauigkeit > 0) L.circle([pos.lat, pos.lng], { radius: pos.genauigkeit, color: "#2B6CB0", weight: 1, fillColor: "#2B6CB0", fillOpacity: 0.12, interactive: false }).addTo(ebene);
    L.circleMarker([pos.lat, pos.lng], { radius: 7, color: "#FFFFFF", weight: 3, fillColor: "#2B6CB0", fillOpacity: 1, interactive: false }).addTo(ebene);
    if (!ersteAnsicht.current || folgen) { ersteAnsicht.current = true; map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 17)); }
  }, [pos, folgen]);

  // Ausgewählten Hydranten in die Mitte holen
  useEffect(() => {
    const map = mapRef.current; if (!map || !auswahl) return;
    const h = (hydranten || []).find((x) => x.id === auswahl);
    if (h && hatStandort(h)) map.panTo([h.lat, h.lng]);
  }, [auswahl]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <div ref={divRef} data-testid="hydranten-karte" style={{ width: "100%", height: "100%", background: "#E8E6DF" }} />
      {modus === "setzen" && (
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: 44, height: 44, marginLeft: -22, marginTop: -22, zIndex: 500, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 21, top: 0, width: 2, height: 44, background: "#C1272D" }} />
          <div style={{ position: "absolute", top: 21, left: 0, height: 2, width: 44, background: "#C1272D" }} />
          <div style={{ position: "absolute", left: 14, top: 14, width: 16, height: 16, borderRadius: 8, border: "2px solid #C1272D" }} />
        </div>
      )}
    </div>
  );
}
