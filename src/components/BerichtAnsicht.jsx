// Vorschau eines Berichts am Handy mit Knopf "Als PDF teilen / drucken".
// Die PDF-Datei wird schon beim Öffnen im Hintergrund erzeugt, damit das Teilen-Menü
// beim Antippen sofort aufgeht (iPhone erlaubt das Teilen nur direkt nach einem Fingertipp).
import React, { useEffect, useRef, useState } from "react";
import { X, Share2, Download } from "lucide-react";
import { berichtHtml, berichtPdf } from "../lib/bericht";

export default function BerichtAnsicht({ modell, onClose }) {
  const [datei, setDatei] = useState(null);
  const [fehler, setFehler] = useState("");
  const [hinweis, setHinweis] = useState("");
  const iframeRef = useRef(null);
  const [hoehe, setHoehe] = useState(600);

  useEffect(() => {
    let aktiv = true;
    setDatei(null); setFehler(""); setHinweis("");
    (modell.pdfFn ? modell.pdfFn() : berichtPdf(modell)).then((f) => { if (aktiv) setDatei(f); }).catch(() => { if (aktiv) setFehler("Die PDF-Datei konnte nicht erstellt werden."); });
    return () => { aktiv = false; };
  }, [modell]);

  const kannTeilen = !!(datei && navigator.canShare && navigator.canShare({ files: [datei] }));

  async function teilen() {
    if (!datei) return;
    if (kannTeilen) {
      try { await navigator.share({ files: [datei], title: modell.titel }); }
      catch (e) { if (e && e.name !== "AbortError") setHinweis("Teilen hat nicht geklappt. Bitte noch einmal antippen."); }
      return;
    }
    // Ohne Teilen-Funktion: Datei herunterladen bzw. öffnen
    const url = URL.createObjectURL(datei);
    const a = document.createElement("a");
    a.href = url; a.download = datei.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function hoeheAnpassen() {
    try { const d = iframeRef.current.contentDocument; setHoehe(Math.max(300, d.documentElement.scrollHeight + 10)); } catch (e) {}
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "#F3F1EC", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid #E2DFD6", background: "white" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#2C2F2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 10 }}>{modell.titel}</div>
        <button onClick={onClose} aria-label="Schließen" style={{ display: "flex", alignItems: "center", gap: 4, background: "#2C2F2A", color: "white", border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 13, fontWeight: 700, flexShrink: 0 }}><X size={14} /> Schließen</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", background: "white" }}>
        <iframe ref={iframeRef} title="Vorschau" srcDoc={modell.htmlFn ? modell.htmlFn({ vorschau: true }) : berichtHtml(modell, { vorschau: true })} onLoad={hoeheAnpassen}
          style={{ width: "100%", height: hoehe, border: "none", display: "block" }} />
      </div>
      <div style={{ padding: "10px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid #E2DFD6", background: "#F3F1EC" }}>
        {fehler && <div style={{ color: "#C1272D", fontSize: 12.5, marginBottom: 6 }}>{fehler}</div>}
        {hinweis && <div style={{ color: "#B8791A", fontSize: 12, marginBottom: 6 }}>{hinweis}</div>}
        <button onClick={teilen} disabled={!datei}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#C1272D", color: "white", border: "none", borderRadius: 8, padding: "13px 14px", fontSize: 15, fontWeight: 700, opacity: datei ? 1 : 0.6 }}>
          {!datei && !fehler ? "PDF wird erstellt …" : kannTeilen ? <><Share2 size={17} /> Als PDF teilen / drucken</> : <><Download size={17} /> PDF herunterladen</>}
        </button>
        {kannTeilen && <div style={{ fontSize: 11, color: "#8A8C86", textAlign: "center", marginTop: 6 }}>Im Teilen-Menü findest du Drucken, In Dateien sichern, Mail usw.</div>}
      </div>
    </div>
  );
}
