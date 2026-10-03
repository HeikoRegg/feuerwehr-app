// Einheitliche Berichte (Protokolle, Listen, Jahresbericht).
// Ein Bericht wird einmal als "Modell" beschrieben und daraus entweder
//  - als Webseite erzeugt (PC: Drucken / Als PDF sichern über den Browser, Handy: Vorschau) oder
//  - als echte PDF-Datei (Handy: über das Teilen-Menü drucken, sichern oder verschicken).
// Hintergrund: Auf iPhone/Android blockiert die vom Home-Bildschirm gestartete App den Druck-Befehl.
//
// Bausteine (blocks):
//  { t: "h1", text } | { t: "h2", text } | { t: "h3", text }
//  { t: "text", text, klein?, grau?, fett?, kursiv? } | { t: "linie" } | { t: "liste", items: [text] }
//  { t: "tabelle", kopf: [..], zeilen: [[..]], breiten?: [anteile] }
//  { t: "kpis", items: [{ value, label }] }
//  { t: "balken", zeilen: [{ label, value, max, color, rechts, unter? }] }
//  { t: "felder", items: [{ label, value }] }          – Angaben paarweise nebeneinander (z. B. Kopf eines Einsatzberichts)
//  Optional am Modell: fuss: "Text" – steht unten auf jeder Seite (z. B. Hinweis „Änderungen jederzeit möglich“)
//  { t: "bilder", items: [{ src: dataUrl, text? }], spalten? }   – mehrere kleine Fotos nebeneinander (Standard 3 Spalten) mit Bildunterschrift
//  { t: "bild", src: dataUrl, text?, gross? }            – Foto (JPEG/PNG als data-URL); gross = so groß wie die Seite erlaubt (z. B. Karte)
import { LION_ICON } from "./icons";
import { DRUCK_NAME } from "./constants";

// Logo für alle Ausdrucke: Standard ist das Löwen-Wappen der Abteilung, der Admin kann in den Einstellungen ein anderes hochladen.
let druckLogo = LION_ICON;
export function setzeDruckLogo(url) { druckLogo = url || LION_ICON; }
export function aktuellesDruckLogo() { return druckLogo; }
async function logoBytes(src) {
  if (src.startsWith("data:")) {
    const b64 = src.slice(src.indexOf(",") + 1);
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, png: src.startsWith("data:image/png") };
  }
  const res = await fetch(src);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, png: buf[0] === 0x89 && buf[1] === 0x50 };
}

export function istMobil() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// ---------------- Anzeige steuern ----------------
let anzeigeFn = null;
export function registriereBerichtAnzeige(fn) { anzeigeFn = fn; }
// PC: Fenster sofort beim Antippen öffnen (sonst blockiert der Browser es nach dem Laden der Daten).
export function bereiteFensterVor() { return istMobil() ? null : window.open("", "_blank"); }
export function oeffneBericht(modell, fenster) {
  if (istMobil() && anzeigeFn) { if (fenster) fenster.close(); anzeigeFn(modell); return true; }
  const w = fenster || window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(modell.htmlFn ? modell.htmlFn({ vorschau: false }) : berichtHtml(modell)); w.document.close();
  return true;
}
export function dateiname(modell) {
  const basis = String(modell.dateiname || modell.titel || "Bericht").replace(/[^\wäöüÄÖÜß\- ]+/g, "").trim().replace(/\s+/g, "_");
  return `${basis || "Bericht"}.pdf`;
}

// ---------------- HTML ----------------
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

function blockHtml(b) {
  switch (b.t) {
    case "h1": return `<h1 style="font-size:19px;margin:18px 0 4px;">${esc(b.text)}</h1>`;
    case "h2": return `<h2 style="font-size:16px;border-bottom:2px solid #C1272D;padding-bottom:4px;margin:24px 0 8px;page-break-after:avoid;">${esc(b.text)}</h2>`;
    case "h3": return `<div style="font-weight:700;font-size:13.5px;margin:14px 0 4px;page-break-after:avoid;">${esc(b.text)}</div>`;
    case "text": return `<div style="font-size:${b.klein ? 11 : 13}px;color:${b.grau ? "#8A8C86" : "#2C2F2A"};${b.fett ? "font-weight:700;" : ""}${b.kursiv ? "font-style:italic;" : ""}margin:3px 0;white-space:pre-wrap;">${esc(b.text)}</div>`;
    case "linie": return `<hr style="border:none;border-top:1px solid #E2DFD6;margin:14px 0;"/>`;
    case "liste": return `<ul style="margin:4px 0;padding-left:20px;font-size:13px;">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "tabelle": return `<table style="border-collapse:collapse;width:100%;margin-top:10px;"><thead><tr>${b.kopf.map((h) => `<th style="border:1px solid #ccc;padding:6px 8px;font-size:12.5px;text-align:left;background:#F3F1EC;">${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.zeilen.map((z) => `<tr>${z.map((c) => `<td style="border:1px solid #ccc;padding:6px 8px;font-size:12.5px;">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "kpis": return `<div style="display:flex;gap:8px;margin:10px 0;">${b.items.map((k) => `<div style="flex:1;border:1px solid #E2DFD6;border-radius:6px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;">${esc(k.value)}</div><div style="font-size:10.5px;color:#8A8C86;">${esc(k.label)}</div></div>`).join("")}</div>`;
    case "balken": return b.zeilen.map((z) => `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;"><div style="width:170px;font-size:12px;">${esc(z.label)}</div><div style="flex:1;background:#EEEEEC;border-radius:4px;height:11px;overflow:hidden;"><div style="width:${pct(z.value, z.max)}%;background:${z.color || "#4A6670"};height:100%;"></div></div><div style="width:110px;text-align:right;font-size:12px;font-weight:700;">${esc(z.rechts)}</div></div>${z.unter ? `<div style="font-size:11px;color:#5C5F58;margin:0 0 5px;">${esc(z.unter)}</div>` : ""}`).join("");
    case "felder": {
      const zellen = b.items.map((f) => `<div style="flex:1 1 45%;min-width:200px;border-bottom:1px solid #EEEEEC;padding:5px 0;"><div style="font-size:10.5px;color:#8A8C86;text-transform:uppercase;letter-spacing:0.04em;">${esc(f.label)}</div><div style="font-size:13.5px;font-weight:700;">${esc(f.value || "—")}</div></div>`).join("");
      return `<div style="display:flex;flex-wrap:wrap;column-gap:24px;margin:8px 0;">${zellen}</div>`;
    }
    case "bild": return `<div style="margin:10px 0;page-break-inside:avoid;"><img src="${b.src}" alt="" style="max-width:100%;max-height:${b.gross ? "160mm" : "420px"};border:1px solid #E2DFD6;border-radius:4px;"/>${b.text ? `<div style="font-size:11px;color:#8A8C86;">${esc(b.text)}</div>` : ""}</div>`;
    case "bilder": {
      const n = b.spalten || 3;
      return `<div style="display:flex;flex-wrap:wrap;gap:10px;margin:8px 0;">${b.items.map((i) => `<div style="width:calc(${(100 / n).toFixed(3)}% - ${Math.round(10 * (n - 1) / n)}px);page-break-inside:avoid;"><img src="${i.src}" alt="" style="width:100%;max-height:200px;object-fit:contain;object-position:left top;border:1px solid #E2DFD6;border-radius:4px;"/>${i.text ? `<div style="font-size:10.5px;color:#5C5F58;">${esc(i.text)}</div>` : ""}</div>`).join("")}</div>`;
    }
    default: return "";
  }
}

export function berichtHtml(modell, { vorschau = false } = {}) {
  const knoepfe = vorschau ? "" : `<button class="no-print" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:20px;padding:9px 14px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">✕ Schließen</button>
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 3px 10px rgba(0,0,0,0.25);">🖨️ Drucken / Als PDF sichern</button>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(modell.titel)}</title>
<style>html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%;} body{font-family:Arial,sans-serif;max-width:${modell.querformat ? 1000 : 800}px;margin:${vorschau ? 12 : 24}px auto;padding:0 16px ${vorschau ? 20 : 70}px;color:#2C2F2A;line-height:1.4;} .fuss{margin-top:22px;padding-top:8px;border-top:1px solid #E2DFD6;font-size:12px;font-weight:700;color:#5C5F58;text-align:center;} @media print{.fuss{position:fixed;left:0;right:0;bottom:0;margin:0;padding:6px 16px;background:#fff;} ${modell.fuss ? "body{padding-bottom:50px !important;} " : ""}.no-print{display:none !important;} @page{size:A4 ${modell.querformat ? "landscape" : "portrait"};}} @media screen{body{padding-top:${vorschau ? 0 : 46}px;}}</style></head><body>${knoepfe}
<div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #C1272D;padding-bottom:12px;"><img src="${druckLogo}" alt="" style="height:50px;width:auto;max-width:140px;object-fit:contain;"/><div><div style="font-size:17px;font-weight:700;letter-spacing:0.02em;">${esc(DRUCK_NAME.toUpperCase())}</div><div style="font-size:12px;color:#8A8C86;">${esc(modell.untertitel || modell.titel)}</div></div></div>
${modell.blocks.map(blockHtml).join("\n")}
${modell.fuss ? `<div class="fuss">${esc(modell.fuss)}</div>` : ""}
</body></html>`;
}

// ---------------- PDF ----------------
function hexRgb(rgb, hex) {
  const h = String(hex || "#4A6670").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function berichtPdf(modell) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(modell.titel || "Bericht");
  doc.setAuthor(DRUCK_NAME);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ital = await doc.embedFont(StandardFonts.HelveticaOblique);
  let logo = null;
  try { const l = await logoBytes(druckLogo); logo = l.png ? await doc.embedPng(l.bytes) : await doc.embedJpg(l.bytes); }
  catch (e) { try { logo = await doc.embedPng((await logoBytes(LION_ICON)).bytes); } catch (e2) { logo = null; } }

  const [W, H] = modell.querformat ? [841.89, 595.28] : [595.28, 841.89];
  const M = 40, BREITE = W - 2 * M, UNTEN = 46;
  const SCHWARZ = hexRgb(rgb, "#2C2F2A"), GRAU = hexRgb(rgb, "#8A8C86"), DUNKELGRAU = hexRgb(rgb, "#5C5F58"),
    ROT = hexRgb(rgb, "#C1272D"), LINIE = hexRgb(rgb, "#E2DFD6"), SPUR = hexRgb(rgb, "#EEEEEC"), KOPFGRUND = hexRgb(rgb, "#F3F1EC");

  // Zeichen, die die PDF-Standardschrift nicht kennt (z. B. Emojis), werden ersetzt oder weggelassen.
  const ersatz = { "✓": "ok", "✕": "x", "→": "->", "⚠": "!", "…": "...", " ": " " };
  const cache = new Map();
  const sauber = (text, font) => {
    let out = "";
    for (const ch of Array.from(String(text ?? ""))) {
      const c = ersatz[ch] !== undefined ? ersatz[ch] : ch;
      const key = c + "|" + font.name;
      if (!cache.has(key)) { try { font.encodeText(c); cache.set(key, true); } catch (e) { cache.set(key, false); } }
      if (cache.get(key)) out += c;
    }
    return out;
  };
  const umbrechen = (text, font, size, maxW) => {
    const zeilen = [];
    String(text ?? "").split("\n").forEach((absatz) => {
      const woerter = sauber(absatz, font).split(/\s+/).filter(Boolean);
      let z = "";
      woerter.forEach((w) => {
        const probe = z ? z + " " + w : w;
        if (font.widthOfTextAtSize(probe, size) <= maxW) { z = probe; return; }
        if (z) zeilen.push(z);
        // zu lange Einzelwörter hart trennen
        let rest = w;
        while (font.widthOfTextAtSize(rest, size) > maxW && rest.length > 1) {
          let i = rest.length; while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxW) i--;
          zeilen.push(rest.slice(0, i)); rest = rest.slice(i);
        }
        z = rest;
      });
      zeilen.push(z);
    });
    return zeilen;
  };

  let page, y;
  const neueSeite = () => { page = doc.addPage([W, H]); y = H - M; };
  const platz = (h) => { if (y - h < UNTEN) neueSeite(); };
  const schreibe = (t, x, yy, font, size, color) => page.drawText(sauber(t, font), { x, y: yy, size, font, color });

  // Kopf
  neueSeite();
  let logoBreite = 0;
  if (logo) { const s = Math.min(40 / logo.height, 110 / logo.width); logoBreite = logo.width * s; page.drawImage(logo, { x: M, y: y - 20 - (logo.height * s) / 2, width: logoBreite, height: logo.height * s }); }
  const tx = M + (logo ? logoBreite + 14 : 0);
  const kopfName = sauber(DRUCK_NAME.toUpperCase(), bold);
  const kopfGroesse = Math.min(14, Math.max(9, 14 * (W - M - tx) / Math.max(1, bold.widthOfTextAtSize(kopfName, 14))));
  schreibe(kopfName, tx, y - 17, bold, kopfGroesse, SCHWARZ);
  umbrechen(modell.untertitel || modell.titel, reg, 9, W - M - tx).slice(0, 2).forEach((z, i) => schreibe(z, tx, y - 31 - i * 11, reg, 9, GRAU));
  y -= 48;
  page.drawRectangle({ x: M, y, width: BREITE, height: 2, color: ROT });
  y -= 14;

  const textBlock = (text, font, size, color, einzug = 0, abstand = 1.3) => {
    umbrechen(text, font, size, BREITE - einzug).forEach((z) => { platz(size * abstand); schreibe(z, M + einzug, y - size, font, size, color); y -= size * abstand; });
  };

  for (const b of modell.blocks) {
    if (b.t === "h1") { platz(60); y -= 6; textBlock(b.text, bold, 15, SCHWARZ); y -= 2; }
    else if (b.t === "h2") { platz(70); y -= 12; textBlock(b.text, bold, 13, SCHWARZ); page.drawRectangle({ x: M, y: y + 2, width: BREITE, height: 1.5, color: ROT }); y -= 8; }
    else if (b.t === "h3") { platz(50); y -= 7; textBlock(b.text, bold, 10.5, SCHWARZ); y -= 1; }
    else if (b.t === "text") { const size = b.klein ? 8.5 : 10; textBlock(b.text, b.fett ? bold : b.kursiv ? ital : reg, size, b.grau ? GRAU : SCHWARZ); y -= 2; }
    else if (b.t === "linie") { platz(14); y -= 6; page.drawRectangle({ x: M, y, width: BREITE, height: 0.7, color: LINIE }); y -= 8; }
    else if (b.t === "liste") { b.items.forEach((it) => { const z = umbrechen(it, reg, 10, BREITE - 14); z.forEach((zz, i) => { platz(13); if (i === 0) schreibe("•", M + 3, y - 10, reg, 10, SCHWARZ); schreibe(zz, M + 14, y - 10, reg, 10, SCHWARZ); y -= 13; }); }); y -= 3; }
    else if (b.t === "kpis") {
      platz(50); y -= 4; const n = b.items.length || 1; const gap = 8; const bw = (BREITE - gap * (n - 1)) / n;
      b.items.forEach((k, i) => {
        const x = M + i * (bw + gap);
        page.drawRectangle({ x, y: y - 40, width: bw, height: 40, borderColor: LINIE, borderWidth: 1 });
        const v = sauber(k.value, bold); const vw = bold.widthOfTextAtSize(v, 14); schreibe(v, x + (bw - vw) / 2, y - 20, bold, 14, SCHWARZ);
        const l = umbrechen(k.label, reg, 7.5, bw - 6)[0] || ""; const lw = reg.widthOfTextAtSize(l, 7.5); schreibe(l, x + (bw - lw) / 2, y - 33, reg, 7.5, GRAU);
      });
      y -= 50;
    }
    else if (b.t === "balken") {
      const LW = Math.min(170, BREITE * 0.32), RW = 95, BX = M + LW + 8, BW = BREITE - LW - RW - 16;
      b.zeilen.forEach((z) => {
        const unter = z.unter ? umbrechen(z.unter, reg, 8, BREITE) : [];
        platz(16 + Math.min(unter.length, 2) * 10);
        const label = umbrechen(z.label, reg, 9, LW)[0] || "";
        schreibe(label, M, y - 11, reg, 9, SCHWARZ);
        page.drawRectangle({ x: BX, y: y - 12, width: BW, height: 8, color: SPUR });
        const f = z.max ? Math.min(1, (z.value || 0) / z.max) : 0;
        if (f > 0) page.drawRectangle({ x: BX, y: y - 12, width: Math.max(2, BW * f), height: 8, color: hexRgb(rgb, z.color) });
        const r = sauber(z.rechts, bold); schreibe(r, M + BREITE - bold.widthOfTextAtSize(r, 9), y - 11, bold, 9, SCHWARZ);
        y -= 16;
        unter.forEach((u) => { platz(10); schreibe(u, M, y - 7, reg, 8, DUNKELGRAU); y -= 10; });
      });
      y -= 2;
    }
    else if (b.t === "felder") {
      const spalte = (BREITE - 20) / 2;
      for (let i = 0; i < b.items.length; i += 2) {
        const paar = b.items.slice(i, i + 2).map((f) => ({ l: umbrechen(String(f.label || "").toUpperCase(), reg, 7.5, spalte)[0] || "", v: umbrechen(f.value || "—", bold, 10.5, spalte) }));
        const h = 12 + Math.max(...paar.map((p) => p.v.length)) * 13 + 6;
        platz(h);
        paar.forEach((p, k) => {
          const x = M + k * (spalte + 20);
          schreibe(p.l, x, y - 8, reg, 7.5, GRAU);
          p.v.forEach((z, j) => schreibe(z, x, y - 21 - j * 13, bold, 10.5, SCHWARZ));
        });
        y -= h;
        page.drawRectangle({ x: M, y: y + 3, width: BREITE, height: 0.5, color: LINIE });
      }
      y -= 4;
    }
    else if (b.t === "bild") {
      try {
        const l = await logoBytes(b.src);
        const img = l.png ? await doc.embedPng(l.bytes) : await doc.embedJpg(l.bytes);
        const maxH = b.gross ? Math.max(220, y - UNTEN - 28) : 300; const s = Math.min(BREITE / img.width, maxH / img.height, b.gross ? 10 : 1);
        const w = img.width * s, h = img.height * s;
        platz(h + (b.text ? 20 : 10));
        y -= 6;
        page.drawImage(img, { x: M, y: y - h, width: w, height: h });
        y -= h + 4;
        if (b.text) { schreibe(b.text, M, y - 8, reg, 8, GRAU); y -= 12; }
      } catch (e) { textBlock("(Foto konnte nicht eingefügt werden)", ital, 8.5, GRAU); }
    }
    else if (b.t === "bilder") {
      const n = b.spalten || 3, gap = 10, cw = (BREITE - gap * (n - 1)) / n, maxH = 150;
      for (let i = 0; i < b.items.length; i += n) {
        const reihe = [];
        for (const it of b.items.slice(i, i + n)) {
          try {
            const l = await logoBytes(it.src);
            const img = l.png ? await doc.embedPng(l.bytes) : await doc.embedJpg(l.bytes);
            const sc = Math.min(cw / img.width, maxH / img.height);
            reihe.push({ img, w: img.width * sc, h: img.height * sc, z: umbrechen(it.text || "", reg, 7.5, cw).slice(0, 2) });
          } catch (e) { reihe.push({ img: null, w: 0, h: 20, z: umbrechen(`${it.text || ""} (Foto nicht lesbar)`, reg, 7.5, cw).slice(0, 2) }); }
        }
        const rh = Math.max(...reihe.map((r) => r.h)) + 6 + 2 * 10 + 6;
        platz(rh);
        reihe.forEach((r, k) => {
          const x = M + k * (cw + gap);
          if (r.img) page.drawImage(r.img, { x, y: y - r.h, width: r.w, height: r.h });
          r.z.forEach((t, j) => schreibe(t, x, y - r.h - 10 - j * 10, reg, 7.5, DUNKELGRAU));
        });
        y -= rh;
      }
    }
    else if (b.t === "tabelle") {
      const n = b.kopf.length; const anteile = b.breiten && b.breiten.length === n ? b.breiten : Array(n).fill(1);
      const summe = anteile.reduce((s, x) => s + x, 0); const bw = anteile.map((a) => (a / summe) * BREITE);
      const size = n > 6 ? 7.5 : 9; const pad = 4; const zh = size * 1.25;
      const zeile = (zellen, font, grund) => {
        const umb = zellen.map((c, i) => umbrechen(c, font, size, bw[i] - 2 * pad));
        const h = Math.max(...umb.map((u) => u.length)) * zh + 2 * pad;
        return { umb, h, font, grund };
      };
      const zeichne = ({ umb, h, font, grund }) => {
        let x = M;
        umb.forEach((u, i) => {
          page.drawRectangle({ x, y: y - h, width: bw[i], height: h, borderColor: hexRgb(rgb, "#CCCCCC"), borderWidth: 0.6, color: grund || undefined });
          u.forEach((t, k) => schreibe(t, x + pad, y - pad - size - k * zh + 1, font, size, SCHWARZ));
          x += bw[i];
        });
        y -= h;
      };
      y -= 6;
      const kopf = zeile(b.kopf, bold, KOPFGRUND);
      platz(kopf.h + 20); zeichne(kopf);
      b.zeilen.forEach((z) => {
        const r = zeile(z, reg);
        if (y - r.h < UNTEN) { neueSeite(); zeichne(kopf); } // Tabellenkopf auf neuer Seite wiederholen
        zeichne(r);
      });
      y -= 6;
    }
  }

  // Fußzeile mit Seitenzahl
  const seiten = doc.getPages();
  const heute = new Date().toLocaleDateString("de-DE");
  seiten.forEach((p, i) => {
    const t = sauber(`${modell.titel || "Bericht"} · ${heute} · Seite ${i + 1} von ${seiten.length}`, reg);
    p.drawText(t, { x: M, y: 24, size: 7.5, font: reg, color: GRAU });
    if (modell.fuss) { const f = sauber(modell.fuss, bold); const fw = bold.widthOfTextAtSize(f, 8.5); p.drawText(f, { x: Math.max(M, (W - fw) / 2), y: 36, size: 8.5, font: bold, color: DUNKELGRAU }); }
  });
  const bytes = await doc.save();
  return new File([bytes], dateiname(modell), { type: "application/pdf" });
}
