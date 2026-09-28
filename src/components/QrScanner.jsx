// QR-Scanner in der App: öffnet die Kamera und liest QR-Codes (auch auf dem iPhone, ohne Extra-App).
// Die Erkennung (jsQR) wird erst beim Öffnen geladen, damit die App beim Start nicht langsamer wird.
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function QrScanner({ onResult, onClose, pruefe }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [fehler, setFehler] = useState("");
  const [hinweis, setHinweis] = useState("");
  const fertigRef = useRef(false);

  useEffect(() => {
    let stream = null, timer = null, weg = false;
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("keine Kamera-Funktion");
        const [jsqrModul, s] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false }),
        ]);
        stream = s;
        if (weg) { s.getTracks().forEach((t) => t.stop()); return; }
        const jsQR = jsqrModul.default || jsqrModul;
        const v = videoRef.current; v.srcObject = s; v.setAttribute("playsinline", "true"); v.muted = true;
        await v.play();
        const cv = canvasRef.current; const ctx = cv.getContext("2d", { willReadFrequently: true });
        const takt = () => {
          if (weg || fertigRef.current) return;
          if (v.videoWidth > 0) {
            const f = Math.min(1, 640 / v.videoWidth);
            cv.width = Math.round(v.videoWidth * f); cv.height = Math.round(v.videoHeight * f);
            ctx.drawImage(v, 0, 0, cv.width, cv.height);
            const bild = ctx.getImageData(0, 0, cv.width, cv.height);
            const code = jsQR(bild.data, bild.width, bild.height, { inversionAttempts: "dontInvert" });
            if (code && code.data) {
              const ok = pruefe ? pruefe(code.data) : true;
              if (ok) { fertigRef.current = true; onResult(code.data); return; }
              setHinweis("Das ist kein Geräte-Etikett dieser App.");
            }
          }
          timer = setTimeout(takt, 140);
        };
        takt();
      } catch (e) {
        const n = e && e.name;
        setFehler(n === "NotAllowedError" || n === "SecurityError"
          ? "Die Kamera ist für diese App gesperrt. Bitte in den Einstellungen des Handys den Kamerazugriff erlauben."
          : n === "NotFoundError" || n === "OverconstrainedError" ? "Es wurde keine Kamera gefunden."
          : "Die Kamera konnte nicht gestartet werden. Du kannst den QR-Code auch mit der normalen Kamera-App scannen.");
      }
    })();
    return () => { weg = true; if (timer) clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", color: "white" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>QR-Code scannen</div>
        <button onClick={onClose} aria-label="Schließen" style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", color: "white", border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 13, fontWeight: 700 }}><X size={15} /> Schließen</button>
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {!fehler && <div style={{ position: "absolute", width: "62%", aspectRatio: "1", maxWidth: 300, border: "3px solid rgba(255,255,255,0.9)", borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />}
      </div>
      <div style={{ padding: "14px 18px calc(18px + env(safe-area-inset-bottom))", color: "white", fontSize: 13, textAlign: "center", lineHeight: 1.4 }}>
        {fehler ? <span style={{ color: "#FFB4B4" }}>{fehler}</span> : hinweis ? <span style={{ color: "#FFD98A" }}>{hinweis}</span> : "Halte die Kamera auf den QR-Code am Gerät."}
      </div>
    </div>
  );
}
