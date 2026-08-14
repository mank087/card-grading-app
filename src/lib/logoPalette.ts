/**
 * Extract a small brand palette (up to 5 colors) from a logo image buffer.
 *
 * Used to seed organizations.brand_colors when a color logo is uploaded.
 * Vibrancy-ranked like the card color extractor: pixel share × saturation ×
 * value, so the logo's saturated brand colors beat large neutral areas.
 * Transparent pixels (the square padding) are ignored entirely.
 */

interface RGB { r: number; g: number; b: number }

const hex = (c: RGB) =>
  '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const dist = (a: RGB, b: RGB) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
const sat = (c: RGB) => { const mx = Math.max(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - Math.min(c.r, c.g, c.b)) / mx; };
const val = (c: RGB) => Math.max(c.r, c.g, c.b) / 255;
const lum = (c: RGB) => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;

function kMeans(pixels: RGB[], k: number, iterations = 10): { color: RGB; count: number }[] {
  if (pixels.length <= k) return pixels.map(p => ({ color: p, count: 1 }));
  const cents: RGB[] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) cents.push({ ...pixels[i * step] });
  for (let it = 0; it < iterations; it++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => []);
    for (const p of pixels) {
      let m = Infinity, ci = 0;
      for (let c = 0; c < k; c++) { const d = dist(p, cents[c]); if (d < m) { m = d; ci = c; } }
      clusters[ci].push(p);
    }
    for (let c = 0; c < k; c++) {
      if (!clusters[c].length) continue;
      const t = clusters[c].reduce((a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }), { r: 0, g: 0, b: 0 });
      cents[c] = { r: t.r / clusters[c].length, g: t.g / clusters[c].length, b: t.b / clusters[c].length };
    }
  }
  const counts = new Array(k).fill(0);
  for (const p of pixels) {
    let m = Infinity, ci = 0;
    for (let c = 0; c < k; c++) { const d = dist(p, cents[c]); if (d < m) { m = d; ci = c; } }
    counts[ci]++;
  }
  return cents.map((color, i) => ({ color, count: counts[i] })).filter(x => x.count > 0);
}

export async function extractLogoPalette(buffer: Buffer): Promise<string[]> {
  let sharp: any;
  try { sharp = require('sharp'); } catch { return []; }

  const size = 96;
  const { data: raw } = await sharp(buffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: RGB[] = [];
  for (let i = 0; i < raw.length; i += 4) {
    if (raw[i + 3] < 128) continue; // transparent padding
    pixels.push({ r: raw[i], g: raw[i + 1], b: raw[i + 2] });
  }
  if (pixels.length < 20) return [];

  const clusters = kMeans(pixels, 8)
    // Drop pure black/white (outlines, text) unless the logo is only that.
    .filter(x => { const l = lum(x.color); return l > 0.05 && l < 0.97; });
  if (!clusters.length) return [];

  const total = pixels.length;
  const score = (x: { color: RGB; count: number }) =>
    (x.count / total) * (0.15 + 0.85 * Math.pow(sat(x.color), 1.2)) * (0.4 + 0.6 * val(x.color));
  const ranked = [...clusters]
    .filter(x => x.count >= total * 0.02)
    .sort((a, b) => score(b) - score(a));
  const pool = ranked.length ? ranked : clusters;

  // Dedupe near-identical shades so the 5 slots carry distinct colors.
  const out: RGB[] = [];
  for (const { color } of pool) {
    if (out.every(o => dist(o, color) > 40)) out.push(color);
    if (out.length === 5) break;
  }
  return out.map(hex);
}
