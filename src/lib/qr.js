// Kleiner QR-Code-Erzeuger (Byte-Modus, Fehlerkorrektur M, Version 1–10). Ohne Fremdpakete.
const BLOCKS = { // version: [ecPerBlock, [[anzahl, datenwörter], ...]]
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsEc(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) { const next = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, EXP[i]); }); gen = next; }
  const res = new Array(n).fill(0);
  for (const d of data) { const f = d ^ res.shift(); res.push(0); if (f) gen.slice(1).forEach((c, j) => { res[j] ^= mul(c, f); }); }
  return res;
}
function bch(v, poly, bits) { let r = v << bits; const hb = (x) => 31 - Math.clz32(x); while (r && hb(r) >= hb(poly)) r ^= poly << (hb(r) - hb(poly)); return (v << bits) | r; }
const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = 0;
  for (let v = 1; v <= 10; v++) { const cap = BLOCKS[v][1].reduce((s, [n, d]) => s + n * d, 0); if (bytes.length + (v < 10 ? 2 : 3) <= cap) { ver = v; break; } }
  if (!ver) throw new Error("QR-Text zu lang");
  const [ecn, groups] = BLOCKS[ver];
  const capacity = groups.reduce((s, [n, d]) => s + n * d, 0);
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capacity * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);
  const dblocks = [], eblocks = []; let p = 0;
  groups.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const b = data.slice(p, p + d); p += d; dblocks.push(b); eblocks.push(rsEc(b, ecn)); } });
  const out = [];
  for (let i = 0; i < Math.max(...dblocks.map((b) => b.length)); i++) dblocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecn; i++) eblocks.forEach((b) => out.push(b[i]));
  const stream = []; out.forEach((b) => put2(b));
  function put2(v) { for (let i = 7; i >= 0; i--) stream.push((v >> i) & 1); }
  const N = ver * 4 + 17;
  const mk = () => Array.from({ length: N }, () => new Array(N).fill(null));
  const base = mk(); const fn = mk();
  const set = (r, c, v) => { if (r >= 0 && c >= 0 && r < N && c < N) { base[r][c] = v; fn[r][c] = true; } };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)); set(r0 + r, c0 + c, on ? 1 : 0); } };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }
  const al = ALIGN[ver];
  al.forEach((r) => al.forEach((c) => { if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (c === 6 && r === al[al.length - 1])) return; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0); }));
  set(N - 8, 8, 1);
  for (let i = 0; i < 9; i++) { if (base[8][i] === null) set(8, i, 0); if (base[i][8] === null) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { if (base[8][N - 1 - i] === null) set(8, N - 1 - i, 0); if (base[N - 1 - i][8] === null) set(N - 1 - i, 8, 0); }
  if (ver >= 7) { const vi = bch(ver, 0x1f25, 12); for (let i = 0; i < 18; i++) { const v = (vi >> i) & 1; set(Math.floor(i / 3), N - 11 + (i % 3), v); set(N - 11 + (i % 3), Math.floor(i / 3), v); } }
  // Daten platzieren
  const cells = []; let up = true;
  for (let c = N - 1; c > 0; c -= 2) { if (c === 6) c--; for (let i = 0; i < N; i++) { const r = up ? N - 1 - i : i; for (const cc of [c, c - 1]) if (!fn[r][cc]) cells.push([r, cc]); } up = !up; }
  const build = (m) => {
    const g = base.map((row) => row.slice());
    cells.forEach(([r, c], i) => { const bit = i < stream.length ? stream[i] : 0; g[r][c] = bit ^ (MASKS[m](r, c) ? 1 : 0); });
    const fmt = bch(((0 << 3) | m), 0x537, 10) ^ 0x5412; // Ebene M = 00
    for (let i = 0; i < 15; i++) {
      const v = (fmt >> i) & 1;
      if (i < 6) g[i][8] = v; else if (i < 8) g[i + 1][8] = v; else g[N - 15 + i][8] = v;
      if (i < 8) g[8][N - 1 - i] = v; else if (i < 9) g[8][15 - i] = v; else g[8][14 - i] = v;
    }
    g[N - 8][8] = 1;
    return g;
  };
  const penalty = (g) => {
    let s = 0;
    for (let a = 0; a < 2; a++) for (let i = 0; i < N; i++) { let run = 1; for (let j = 1; j < N; j++) { const x = a ? g[j][i] : g[i][j], y = a ? g[j - 1][i] : g[i][j - 1]; if (x === y) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) s += 3; }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = pat.slice().reverse();
    const chk = (get) => { for (let i = 0; i < N; i++) for (let j = 0; j <= N - 11; j++) { let a = true, b = true; for (let k = 0; k < 11; k++) { const v = get(i, j + k); if (v !== pat[k]) a = false; if (v !== pat2[k]) b = false; } if (a) s += 40; if (b) s += 40; } };
    chk((i, j) => g[i][j]); chk((i, j) => g[j][i]);
    let dark = 0; g.forEach((row) => row.forEach((v) => { dark += v; }));
    s += Math.floor(Math.abs((dark * 100) / (N * N) - 50) / 5) * 10;
    return s;
  };
  let best = null, bs = Infinity;
  for (let m = 0; m < 8; m++) { const g = build(m); const s = penalty(g); if (s < bs) { bs = s; best = g; } }
  return best;
}
// Als SVG-Text (mit Ruhezone) – lässt sich in Seiten/PDF einbetten.
export function qrSvg(text, { quiet = 2, dark = "#000", light = "#fff" } = {}) {
  const m = qrMatrix(text), n = m.length + quiet * 2; let d = "";
  m.forEach((row, r) => { let c = 0; while (c < row.length) { if (row[c]) { let e = c; while (e < row.length && row[e]) e++; d += `M${c + quiet} ${r + quiet}h${e - c}v1h-${e - c}z`; c = e; } else c++; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
