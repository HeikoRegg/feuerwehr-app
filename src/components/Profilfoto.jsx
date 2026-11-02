// Profilfoto (seit 2.35): rundes Bild eines Mitglieds, sonst das Feuerwehr-Gesicht mit Helm.
// Die Foto-Links holt die App gesammelt (App.jsx → `profilfotos`), hier wird nur angezeigt.
// Jugendliche (nur Jugendfeuerwehr) und Gesperrte haben kein Profilfoto – das prüft auch der Server.
import React, { useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import { useApp } from "../AppContext";
import { styles } from "../lib/styles";

// Standardbild ohne Foto: Feuerwehr-Gesicht mit rotem Helm (eigene Zeichnung).
export function HelmGesicht({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: "block" }}>
      <rect width="64" height="64" fill="#F2C9C7" />
      <path d="M6 64 Q8 47 32 47 Q56 47 58 64 Z" fill="#2C2F2A" />
      <rect x="27" y="40" width="10" height="9" fill="#E3B58E" />
      <ellipse cx="32" cy="35" rx="11" ry="13" fill="#F1C9A5" />
      <circle cx="27.5" cy="36" r="1.5" fill="#2C2F2A" />
      <circle cx="36.5" cy="36" r="1.5" fill="#2C2F2A" />
      <path d="M28 42 Q32 45.5 36 42" fill="none" stroke="#2C2F2A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 31 Q16 10 32 10 Q48 10 48 31 Z" fill="#C1272D" />
      <path d="M27 11 Q32 5 37 11 L37 28 L27 28 Z" fill="#A11E24" />
      <rect x="12" y="28" width="40" height="5" rx="2.5" fill="#8F1B20" />
      <path d="M27 15 L37 15 L37 22 Q32 26 27 22 Z" fill="#F9CB90" stroke="#E9AC62" strokeWidth="1" />
    </svg>
  );
}

// Rundes Profilbild. `fotos` kommt aus dem App-Zustand (Name → { url, am }).
export function Avatar({ name, size = 32, onClick, rand = true, testId }) {
  const app = useApp() || {};
  const foto = name && app.profilfotos ? app.profilfotos[name] : null;
  const [kaputt, setKaputt] = useState("");
  const zeigeFoto = foto && foto.url && kaputt !== foto.url;
  const inhalt = zeigeFoto
    ? <img src={foto.url} alt="" onError={() => setKaputt(foto.url)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    : <HelmGesicht size={size} />;
  const stil = { width: size, height: size, minWidth: size, borderRadius: "50%", overflow: "hidden", display: "inline-block", flexShrink: 0, boxShadow: rand ? "0 0 0 1.5px rgba(193,39,45,0.35)" : "none", background: "#F2C9C7", verticalAlign: "middle", padding: 0, border: "none" };
  const tid = testId || (name ? `avatar-${name}` : undefined);
  if (onClick) {
    return <button type="button" data-knopf="fest" aria-label={name ? `Profilfoto ${name}` : "Profilfoto"} data-testid={tid} data-foto={zeigeFoto ? "ja" : "nein"} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ ...stil, cursor: "pointer" }}>{inhalt}</button>;
  }
  return <span data-testid={tid} data-foto={zeigeFoto ? "ja" : "nein"} style={stil}>{inhalt}</span>;
}

// Foto quadratisch aus der Mitte zuschneiden und klein speichern (JPEG, 320 × 320).
export async function profilfotoZuschneiden(file, kante = 320, qualitaet = 0.85) {
  let bild;
  try { bild = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (e) {
    bild = await new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
  }
  const w = bild.width, h = bild.height, s = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = kante; canvas.height = kante;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, kante, kante);
  ctx.drawImage(bild, (w - s) / 2, (h - s) / 2, s, s, 0, 0, kante, kante);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualitaet));
  if (!blob) throw new Error("Foto konnte nicht gelesen werden.");
  return new File([blob], "profilfoto.jpg", { type: "image/jpeg" });
}

// Fenster zum Ansehen, Ändern und Entfernen eines Profilfotos.
// Eigenes Foto: aufnehmen/auswählen und entfernen. Fremdes Foto: nur Admins können es entfernen.
export function ProfilfotoDialog({ name, onClose }) {
  const app = useApp() || {};
  const { me, isAdmin, profilfotos, darfProfilfoto, profilfotoHochladen, profilfotoEntfernen, profilfotoBusy } = app;
  const eigen = name === me;
  const hatFoto = !!(profilfotos && profilfotos[name] && profilfotos[name].url);
  const erlaubt = darfProfilfoto ? darfProfilfoto(name) : false;
  const [frage, setFrage] = useState(false);
  const dateiRef = useRef(null);
  return (
    <div style={{ ...styles.modalBackdrop, zIndex: 120, alignItems: "center", justifyContent: "center", padding: 18 }} onClick={onClose} data-testid="profilfoto-dialog">
      <div style={{ background: "#F3F1EC", borderRadius: 14, padding: "16px 18px 20px", width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={styles.modalTitle}>{eigen ? "Dein Profilfoto" : `Profilfoto ${name}`}</div>
          <button style={styles.iconBtn} aria-label="Schließen" onClick={onClose}><X size={18} color="#5C5F58" /></button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Avatar name={name} size={140} testId="profilfoto-gross" /></div>
        {!erlaubt && (
          <div data-testid="profilfoto-nicht-erlaubt" style={{ fontSize: 12.5, color: "#5C5F58", background: "white", border: "1px solid #E2DFD6", borderRadius: 8, padding: "9px 11px", marginBottom: 10, lineHeight: 1.45 }}>
            {eigen
              ? "Für die Jugendfeuerwehr gibt es kein Profilfoto. Sobald du in die Einsatzabteilung übertrittst, kannst du eins einstellen."
              : "Für dieses Mitglied wird kein Profilfoto angezeigt (Jugendfeuerwehr oder gesperrt)."}
          </div>
        )}
        {eigen && erlaubt && (
          <>
            <input ref={dateiRef} type="file" accept="image/*" style={{ display: "none" }} data-testid="profilfoto-datei"
              onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) await profilfotoHochladen(f); }} />
            <button style={{ ...styles.saveBtn, width: "100%", gap: 6, marginBottom: 8 }} disabled={profilfotoBusy} onClick={() => dateiRef.current && dateiRef.current.click()} data-testid="profilfoto-waehlen">
              <Camera size={16} /> {profilfotoBusy ? "Wird gespeichert …" : hatFoto ? "Anderes Foto wählen" : "Foto aufnehmen oder auswählen"}
            </button>
            <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 8, lineHeight: 1.4 }}>Das Foto sehen alle angemeldeten Mitglieder, z. B. in der Personalakte, im Chat und im Einsatzbericht. Es wird quadratisch zugeschnitten.</div>
          </>
        )}
        {hatFoto && (eigen || isAdmin) && (
          !frage
            ? <button style={{ ...styles.deleteBtn, width: "100%", justifyContent: "center" }} disabled={profilfotoBusy} onClick={() => setFrage(true)} data-testid="profilfoto-entfernen"><Trash2 size={15} /> Foto entfernen</button>
            : (
              <div style={{ background: "white", border: "1px solid #E2A9A9", borderRadius: 8, padding: "10px 11px" }}>
                <div style={{ fontSize: 12.5, color: "#2C2F2A", marginBottom: 8 }}>{eigen ? "Dein Profilfoto wirklich entfernen?" : `Profilfoto von ${name} wirklich löschen?`}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...styles.deleteBtn, flex: 1, justifyContent: "center" }} onClick={() => setFrage(false)}>Abbrechen</button>
                  <button style={{ ...styles.saveBtn, flex: 1 }} disabled={profilfotoBusy} data-testid="profilfoto-entfernen-ja" onClick={async () => { const ok = await profilfotoEntfernen(name); setFrage(false); if (ok && !eigen) onClose(); }}>Entfernen</button>
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}
