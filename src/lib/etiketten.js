// Etiketten mit QR-Code für die Geräte: A4-Bogen mit 2 × 8 Etiketten (je 105 × 37,125 mm).
// Auf dem Etikett: Löwen-Wappen + „Feuerwehr Abt. Regglisweiler“, Gerätename, Seriennummer/Inventarnummer,
// Standort · Fach und den QR-Code – auf Wunsch zweimal (links und rechts), falls einer mal nicht lesbar ist.
// Kommt als HTML (PC-Druck und Vorschau am Handy) und als PDF (Handy: Teilen/Drucken).
import { qrMatrix, qrSvg } from "./qr";
import { LION_ICON } from "./icons";
import { aktuellesDruckLogo } from "./bericht";
import { geraeteLink, geraeteName } from "./geraete";

const SPALTEN = 2, ZEILEN = 8, PRO_SEITE = SPALTEN * ZEILEN;
const B_MM = 105, H_MM = 37.125, MM = 72 / 25.4;
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inhalt(g) {
  const nummern = [g.seriennummer ? `SN ${g.seriennummer}` : "", g.inventar ? `Inv. ${g.inventar}` : ""].filter(Boolean).join("  ·  ");
  const ort = [g.ortName, g.fach].filter(Boolean).join(" · ");
  return { titel: geraeteName(g), nummern, ort, link: geraeteLink(g.id) };
}
// Leere Plätze vorne (für schon teilweise benutzte Bögen), dann die Etiketten, dann seitenweise aufteilen.
function seiten(geraete, opts) {
  const start = Math.max(0, Math.min(PRO_SEITE - 1, (parseInt(opts.start, 10) || 1) - 1));
  const alle = [...Array(start).fill(null), ...geraete];
  const out = [];
  for (let i = 0; i < alle.length; i += PRO_SEITE) out.push(alle.slice(i, i + PRO_SEITE));
  return out.length ? out : [[]];
}

export function etikettenHtml(geraete, opts = {}, { vorschau = false } = {}) {
  const zwei = opts.zweiCodes !== false, wappen = opts.wappen !== false;
  const logo = aktuellesDruckLogo() || LION_ICON;
  const etikett = (g) => {
    if (!g) return `<div class="l leer"></div>`;
    const c = inhalt(g); const q = qrSvg(c.link, { quiet: 1 });
    return `<div class="l"><div class="q">${q}</div><div class="m">
      <div class="k">${wappen ? `<img src="${esc(logo)}" alt="">` : ""}<span>Feuerwehr Abt.<br>Regglisweiler</span></div>
      <div class="n">${esc(c.titel)}</div>${c.nummern ? `<div class="s">${esc(c.nummern)}</div>` : ""}${c.ort ? `<div class="o">${esc(c.ort)}</div>` : ""}
    </div>${zwei ? `<div class="q">${q}</div>` : ""}</div>`;
  };
  const knoepfe = vorschau ? "" : `<button class="np" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;">Schließen</button>
<button class="np" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.25);">Drucken</button>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Geräte-Etiketten</title>
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:${vorschau ? "#fff" : "#DDD"};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Arial,Helvetica,sans-serif;color:#000;${vorschau ? "zoom:0.47;" : ""}}
.p{width:210mm;height:297mm;background:#fff;margin:${vorschau ? "0 auto 6mm" : "8mm auto"};display:grid;grid-template-columns:${B_MM}mm ${B_MM}mm;grid-auto-rows:${H_MM}mm;page-break-after:always;overflow:hidden}
.l{border:0.2mm dashed #999;display:flex;align-items:center;justify-content:space-between;padding:2.5mm 3mm;gap:2mm;overflow:hidden}.l.leer{border-color:#E4E4E4}
.q{width:28mm;height:28mm;flex:none}.q svg{width:100%;height:100%;display:block}
.m{flex:1;text-align:center;min-width:0;display:flex;flex-direction:column;align-items:center;gap:0.8mm}
.k{display:flex;align-items:center;gap:1.2mm;font-size:5.6pt;font-weight:700;color:#C1272D;line-height:1.15;text-align:left}.k img{width:7mm;height:7mm;object-fit:contain}
.n{font-size:8.5pt;font-weight:800;line-height:1.15;margin-top:0.6mm;overflow-wrap:anywhere}.s{font-size:7.5pt;font-family:monospace;font-weight:700}.o{font-size:6.5pt;color:#444}
@media print{html,body{background:#fff}.p{margin:0}.np{display:none}}
</style></head><body>${knoepfe}${seiten(geraete, opts).map((s) => `<div class="p">${s.map(etikett).join("")}</div>`).join("")}</body></html>`;
}

async function bilderBytes(src) {
  if (src.startsWith("data:")) {
    const bin = atob(src.slice(src.indexOf(",") + 1)); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, png: src.startsWith("data:image/png") };
  }
  const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
  return { bytes: buf, png: buf[0] === 0x89 && buf[1] === 0x50 };
}

export async function etikettenPdf(geraete, opts = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const zwei = opts.zweiCodes !== false, wappen = opts.wappen !== false;
  const doc = await PDFDocument.create();
  doc.setTitle("Geräte-Etiketten");
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), mono = await doc.embedFont(StandardFonts.CourierBold);
  let logo = null;
  if (wappen) {
    try { const l = await bilderBytes(aktuellesDruckLogo() || LION_ICON); logo = l.png ? await doc.embedPng(l.bytes) : await doc.embedJpg(l.bytes); }
    catch (e) { try { logo = await doc.embedPng((await bilderBytes(LION_ICON)).bytes); } catch (e2) { logo = null; } }
  }
  const sauber = (t, font) => Array.from(String(t ?? "")).map((ch) => { try { font.encodeText(ch); return ch; } catch (e) { return ch === "…" ? "..." : "?"; } }).join("");
  const umbrechen = (text, font, size, maxW) => {
    const z = []; let cur = "";
    sauber(text, font).split(/\s+/).filter(Boolean).forEach((w) => {
      const probe = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(probe, size) <= maxW) { cur = probe; return; }
      if (cur) z.push(cur);
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > maxW && rest.length > 1) { let i = rest.length; while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxW) i--; z.push(rest.slice(0, i)); rest = rest.slice(i); }
      cur = rest;
    });
    if (cur) z.push(cur);
    return z;
  };
  const SCHWARZ = rgb(0, 0, 0), ROT = rgb(193 / 255, 39 / 255, 45 / 255), GRAU = rgb(0.27, 0.27, 0.27), RAND = rgb(0.6, 0.6, 0.6);
  const W = 595.28, H = 841.89, LW = B_MM * MM, LH = H_MM * MM, QR = 28 * MM, PAD_X = 3 * MM;

  const zeichneQr = (page, text, x, y) => {
    const m = qrMatrix(text), n = m.length, quiet = 1, u = QR / (n + 2 * quiet);
    m.forEach((row, r) => { let c = 0; while (c < n) { if (row[c]) { let e = c; while (e < n && row[e]) e++; page.drawRectangle({ x: x + (c + quiet) * u, y: y + QR - (r + quiet + 1) * u, width: (e - c) * u + 0.15, height: u + 0.15, color: SCHWARZ }); c = e; } else c++; } });
  };

  for (const seite of seiten(geraete, opts)) {
    const page = doc.addPage([W, H]);
    seite.forEach((g, i) => {
      const sp = i % SPALTEN, zl = Math.floor(i / SPALTEN);
      const x0 = sp * LW, y0 = H - (zl + 1) * LH;
      page.drawRectangle({ x: x0, y: y0, width: LW, height: LH, borderColor: g ? RAND : rgb(0.89, 0.89, 0.89), borderWidth: 0.5, borderDashArray: [2, 2] });
      if (!g) return;
      const c = inhalt(g);
      const qy = y0 + (LH - QR) / 2;
      zeichneQr(page, c.link, x0 + PAD_X, qy);
      const mitteX0 = x0 + PAD_X + QR + 6, mitteX1 = x0 + LW - PAD_X - (zwei ? QR + 6 : 0);
      if (zwei) zeichneQr(page, c.link, x0 + LW - PAD_X - QR, qy);
      const mw = mitteX1 - mitteX0, mx = (mitteX0 + mitteX1) / 2;
      const mitte = (t, font, size, yy, color) => { const s = sauber(t, font); page.drawText(s, { x: mx - font.widthOfTextAtSize(s, size) / 2, y: yy, size, font, color }); };
      // Titelzeilen zuerst, damit der Block senkrecht mittig steht
      const titel = umbrechen(c.titel, bold, 8.5, mw).slice(0, 3);
      const nr = c.nummern ? umbrechen(c.nummern, mono, 7.5, mw).slice(0, 2) : [];
      const ort = c.ort ? umbrechen(c.ort, reg, 6.5, mw).slice(0, 2) : [];
      const kopfH = 20;
      const gesamt = kopfH + 4 + titel.length * 10 + nr.length * 9 + ort.length * 8;
      let y = y0 + LH / 2 + gesamt / 2;
      // Kopf: Wappen + „Feuerwehr Abt. / Regglisweiler“
      const kw = Math.max(reg.widthOfTextAtSize("Feuerwehr Abt.", 5.6), 0); const bw = bold.widthOfTextAtSize("Feuerwehr Abt.", 5.6);
      const textB = Math.max(kw, bw), logoB = logo ? 7 * MM : 0, gap = logo ? 3.4 : 0;
      const kx = mx - (logoB + gap + textB) / 2;
      if (logo) { const s = Math.min(logoB / logo.width, logoB / logo.height); page.drawImage(logo, { x: kx, y: y - kopfH + (kopfH - logo.height * s) / 2 - 1, width: logo.width * s, height: logo.height * s }); }
      page.drawText("Feuerwehr Abt.", { x: kx + logoB + gap, y: y - 9, size: 5.6, font: bold, color: ROT });
      page.drawText("Regglisweiler", { x: kx + logoB + gap, y: y - 15.5, size: 5.6, font: bold, color: ROT });
      y -= kopfH + 4;
      titel.forEach((t) => { y -= 8.6; mitte(t, bold, 8.5, y, SCHWARZ); y -= 1.4; });
      nr.forEach((t) => { y -= 7.6; mitte(t, mono, 7.5, y, SCHWARZ); y -= 1.4; });
      ort.forEach((t) => { y -= 6.6; mitte(t, reg, 6.5, y, GRAU); y -= 1.4; });
    });
  }
  const bytes = await doc.save();
  return new File([bytes], "Geraete_Etiketten.pdf", { type: "application/pdf" });
}

// Wird wie ein Bericht angezeigt (PC: eigenes Fenster, Handy: Vorschau mit „Als PDF teilen / drucken“).
export function etikettenModell(geraete, opts = {}) {
  return { titel: "Geräte-Etiketten", dateiname: "Geraete_Etiketten", blocks: [], htmlFn: (o) => etikettenHtml(geraete, opts, o), pdfFn: () => etikettenPdf(geraete, opts) };
}
