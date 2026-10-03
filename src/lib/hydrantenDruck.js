// Ausdrucke der Hydranten-Kachel: Mängelliste und Kartenausschnitt.
// Beide werden als Bericht-Modell beschrieben (lib/bericht.js): PC = Druckvorschau, Handy = PDF zum Teilen.
import { ZUSTAND, datumDe, hatStandort, zustandVon } from "./hydranten";

const heuteDe = () => new Date().toLocaleDateString("de-DE");
const dateiDatum = () => new Date().toLocaleDateString("sv-SE");
const letzte = (h) => (h.letzteKontrolle ? `${datumDe(h.letzteKontrolle.datum)} (${h.letzteKontrolle.von})` : "nie");
const leitung = (h) => (h.dn ? `DN ${h.dn}` : "–");
const zustand = (h) => (h.typ === "schieber" && !h.zustand ? "Schieber" : ZUSTAND[zustandVon(h)].text);
// Mängeltext ohne das doppelte „nicht funktionsfähig“ (steht schon in der Spalte Zustand)
const maengel = (h) => String(h.zustandText || "").replace(/^nicht funktionsfähig( · )?/, "");
const nrSort = (a, b) => String(a.nr || "").localeCompare(String(b.nr || ""), "de", { numeric: true });

// ---------------- Mängelliste ----------------
export function maengelModell(hydranten, filterText, fotos) {
  const liste = hydranten.filter((h) => h.zustand === "mangel" || h.zustand === "defekt")
    .sort((a, b) => (a.zustand === "defekt" ? 0 : 1) - (b.zustand === "defekt" ? 0 : 1) || (a.gruppe || 9) - (b.gruppe || 9) || nrSort(a, b));
  const nDefekt = liste.filter((h) => h.zustand === "defekt").length;
  const blocks = [
    { t: "h1", text: "Hydranten mit Mängeln" },
    { t: "text", text: `Stand ${heuteDe()}${filterText ? ` · ${filterText}` : ""}`, grau: true, klein: true },
    { t: "kpis", items: [{ value: String(nDefekt), label: "nicht funktionsfähig" }, { value: String(liste.length - nDefekt), label: "mit Mangel" }, { value: String(liste.length), label: "gesamt" }] },
  ];
  if (!liste.length) blocks.push({ t: "text", text: "Keine Hydranten mit Mängeln." });
  else blocks.push({
    t: "tabelle",
    kopf: ["Nr.", "Lage", "Gruppe", "Leitung", "Zustand", "Mängel", "Letzte Kontrolle", "Erledigt"],
    breiten: [1.1, 2.6, 0.9, 1, 1.5, 3.4, 1.8, 1.1],
    zeilen: liste.map((h) => [h.nr, h.lage, h.gruppe ? String(h.gruppe) : "–", leitung(h), zustand(h), maengel(h), letzte(h), ""]),
  });
  // Fotos der Kontrolle, die den Mangel gemeldet hat: Übersicht oben bleibt, die Bilder folgen darunter.
  const mitFoto = liste.filter((h) => fotos && fotos[h.id] && fotos[h.id].dataUrl);
  if (mitFoto.length) {
    blocks.push({ t: "h2", text: `Fotos (${mitFoto.length})` });
    blocks.push({ t: "bilder", spalten: 3, items: mitFoto.map((h) => ({ src: fotos[h.id].dataUrl, text: `${h.nr} · ${h.lage} · ${datumDe(fotos[h.id].datum)}` })) });
  }
  return { titel: "Hydranten – Mängelliste", untertitel: "Hydranten-Kontrolle", dateiname: `Hydranten_Maengel_${dateiDatum()}`, querformat: true, blocks };
}

// ---------------- Kartenausschnitt ----------------
export function kartenModell(bild, hydranten) {
  const sichtbar = bild.sichtbar.map((id) => hydranten.find((h) => h.id === id)).filter(Boolean).sort(nrSort);
  const blocks = [
    { t: "h1", text: "Hydranten – Kartenausschnitt" },
    { t: "text", text: `Stand ${heuteDe()} · ${sichtbar.length} ${sichtbar.length === 1 ? "Hydrant" : "Hydranten"} im Ausschnitt`, grau: true, klein: true },
    { t: "bild", src: bild.dataUrl, gross: true, text: `Kartendaten © OpenStreetMap-Mitwirkende (openstreetmap.org/copyright)${bild.fehlend ? " · Kartenhintergrund unvollständig – keine Verbindung zum Kartendienst?" : ""}` },
    { t: "text", text: "Punkte: grün = in Ordnung · orange = Mangel · rot = nicht funktionsfähig · grau = noch nie kontrolliert · blau = Schieber", klein: true },
  ];
  if (sichtbar.length) blocks.push({
    t: "tabelle",
    kopf: ["Nr.", "Lage", "Leitung", "Zustand", "Mängel / Bemerkung", "Letzte Kontrolle"],
    breiten: [1.1, 2.6, 1, 1.5, 3.4, 1.8],
    zeilen: sichtbar.map((h) => [h.nr, h.lage, leitung(h), zustand(h), [h.zustand && h.zustand !== "ok" ? maengel(h) : "", h.bemerkung || ""].filter(Boolean).join(" · "), letzte(h)]),
  });
  return { titel: "Hydranten – Karte", untertitel: "Hydranten-Karte", dateiname: `Hydranten_Karte_${dateiDatum()}`, querformat: bild.breite >= bild.hoehe, blocks };
}

// Den aktuellen Kartenausschnitt als Bild zeichnen: OpenStreetMap-Kacheln (eine Stufe schärfer als auf dem
// Bildschirm), Hydranten-Punkte mit Nummer, Maßstab und Quellenangabe. „map“ ist die Leaflet-Karte.
const ladeKachel = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const t = setTimeout(() => resolve(null), 15000);
  img.onload = () => { clearTimeout(t); resolve(img); };
  img.onerror = () => { clearTimeout(t); resolve(null); };
  img.src = url;
});

export async function kartenBild(map, hydranten) {
  const zoom = map.getZoom();
  const zt = Math.min(19, Math.round(zoom) + 1);
  const skala = Math.pow(2, zt - zoom);
  const groesse = map.getSize();
  let W = Math.round(groesse.x * skala), H = Math.round(groesse.y * skala);
  const maxSeite = 2600; // Speicher auf dem Handy schonen
  const verkl = Math.min(1, maxSeite / Math.max(W, H));
  const c = map.project(map.getCenter(), zt);
  const ox = c.x - W / 2, oy = c.y - H / 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * verkl); canvas.height = Math.round(H * verkl);
  const ctx = canvas.getContext("2d");
  ctx.scale(verkl, verkl);
  const u = skala; // Größe eines Bildschirmpunkts im Bild

  const zeichnePunkte = () => {
    const sichtbar = [];
    (hydranten || []).filter(hatStandort).forEach((h) => {
      const p = map.project([h.lat, h.lng], zt);
      const x = p.x - ox, y = p.y - oy;
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) return;
      sichtbar.push(h.id);
      ctx.beginPath(); ctx.arc(x, y, 7 * u, 0, Math.PI * 2);
      ctx.fillStyle = h.typ === "schieber" ? "#5B7C99" : ZUSTAND[zustandVon(h)].karte; ctx.fill();
      ctx.lineWidth = 2 * u; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
      ctx.font = `bold ${11 * u}px Arial, sans-serif`; ctx.textBaseline = "middle";
      ctx.lineWidth = 3 * u; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.strokeText(String(h.nr || ""), x + 10 * u, y);
      ctx.fillStyle = "#1F2422"; ctx.fillText(String(h.nr || ""), x + 10 * u, y);
    });
    return sichtbar;
  };
  const zeichneRand = () => {
    // Maßstab unten links
    const lat = map.getCenter().lat;
    const meterProPunkt = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zt));
    const laenge = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter((m) => m / meterProPunkt <= W * 0.25).pop() || 10;
    const px = laenge / meterProPunkt;
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(8 * u, H - 28 * u, px + 16 * u, 20 * u);
    ctx.fillStyle = "#1F2422"; ctx.fillRect(16 * u, H - 14 * u, px, 3 * u);
    ctx.font = `${10 * u}px Arial, sans-serif`; ctx.textBaseline = "alphabetic";
    ctx.fillText(laenge >= 1000 ? `${laenge / 1000} km` : `${laenge} m`, 16 * u, H - 17 * u);
    // Quelle unten rechts
    const quelle = "© OpenStreetMap-Mitwirkende";
    const qb = ctx.measureText(quelle).width;
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(W - qb - 14 * u, H - 18 * u, qb + 10 * u, 14 * u);
    ctx.fillStyle = "#1F2422"; ctx.fillText(quelle, W - qb - 9 * u, H - 7 * u);
  };

  // Kacheln laden
  const n = Math.pow(2, zt);
  const auftraege = [];
  for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W - 1) / 256); tx++) {
    for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H - 1) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      auftraege.push(ladeKachel(`https://tile.openstreetmap.org/${zt}/${wx}/${ty}.png`).then((img) => ({ img, x: tx * 256 - ox, y: ty * 256 - oy })));
    }
  }
  const kacheln = await Promise.all(auftraege);
  const grund = () => { ctx.fillStyle = "#E8E6DF"; ctx.fillRect(0, 0, W, H); };
  grund();
  let fehlend = 0;
  kacheln.forEach((k) => { if (k.img) ctx.drawImage(k.img, k.x, k.y, 256, 256); else fehlend++; });
  let sichtbar = zeichnePunkte(); zeichneRand();
  let dataUrl;
  try { dataUrl = canvas.toDataURL("image/jpeg", 0.88); }
  catch (e) {
    // Kacheln ohne Freigabe für Fremdzugriff: dann nur Punkte auf grauem Grund
    grund(); fehlend = kacheln.length; sichtbar = zeichnePunkte(); zeichneRand();
    dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  }
  return { dataUrl, breite: canvas.width, hoehe: canvas.height, sichtbar, fehlend: fehlend > 0 };
}

// ---------------- Fotos für die Mängelliste laden ----------------
// Holt die Foto-Links vom Server und macht daraus verkleinerte Bilder (data-URL), damit sie im Ausdruck/PDF stehen.
async function verkleinert(url, maxSeite = 800) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Foto nicht ladbar");
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = obj; });
    const s = Math.min(1, maxSeite / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const ctx = c.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(obj); }
}
export async function ladeMaengelFotos(callAuthed, hydranten) {
  const ids = hydranten.filter((h) => h.zustand === "mangel" || h.zustand === "defekt").map((h) => h.id);
  if (!ids.length) return { fotos: {}, fehlend: 0 };
  const r = await callAuthed("hydranten", { action: "maengelFotos", ids });
  if (!r.ok) throw new Error((r.data && r.data.error) || "Fotos nicht ladbar");
  const eintraege = Object.entries(r.data.fotos || {}).slice(0, 80);
  const fotos = {}; let fehlend = 0;
  const holen = async ([id, f]) => {
    try { fotos[id] = { dataUrl: await verkleinert(f.url), datum: f.datum, von: f.von }; } catch (e) { fehlend++; }
  };
  for (let i = 0; i < eintraege.length; i += 4) await Promise.all(eintraege.slice(i, i + 4).map(holen)); // je 4 gleichzeitig
  return { fotos, fehlend };
}
