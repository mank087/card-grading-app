// Printable preview of every Round 3 label, at TRUE SIZE.
//
// The review HTML shows labels ~1000px wide, roughly 4x life size, which is
// fine for comparing designs and useless for judging whether 29px context type
// survives on a real slab. This lays each one out at exactly 2.8" x 0.8".
//
// Organised so each SECTION starts a fresh page: page 1 is the default brand
// palette, page 2 crosses the logo styles against busy and quiet bands, and the
// pages after that are alternate palettes -- one per page, so a palette can be
// judged as a set rather than interleaved with others.
//
// Print at 100% / "Actual size" -- NOT "Fit to page", which is the default in
// most viewers and silently rescales everything. Page 1 carries a 1-inch ruler.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';

const DIR = process.argv[2] || 'docs/label-mockups/heritage-round3';

const PT = 72;
const LW = 2.8 * PT, LH = 0.8 * PT;
const PAGE_W = 8.5 * PT, PAGE_H = 11 * PT;
const MARGIN = 0.5 * PT;
const CAP = 10;
const GAP_Y = 13;
const COLS = 2;
const COL_GAP = (PAGE_W - 2 * MARGIN - COLS * LW) / (COLS - 1);
const ROW_H = LH + CAP + GAP_Y;

const PATTERNS = [
  ['diamond', 'Diamond mosaic'], ['mosaic', 'Mosaic tiles'], ['gradient', 'Gradient'],
  ['split', 'Split'], ['stripes', 'Diagonal stripes'], ['chevron', 'Chevron'],
  ['lightning', 'Lightning bolt'], ['shattered', 'Shattered glass'],
  ['fractured', 'Fractured'], ['scales', 'Scales'], ['prism', 'Prism'],
];

const PALETTES = [
  ['brand',   'DCM brand purple — THE DEFAULT', 'What every label ships with until a user changes it in Label Studio.'],
  ['ember',   'Ember — sampled from a Charizard', 'What "use the card’s colours" actually produces.'],
  ['ocean',   'Ocean blue', ''],
  ['crimson', 'Crimson', ''],
  ['forest',  'Forest green', ''],
  ['slate',   'Graphite — the neutral test', 'If a pattern reads here, it is the geometry doing the work and not the colour.'],
];

const LOGOS = [['plate', 'A · Purple plate'], ['rules', 'B · Colour mark + rules'], ['plain', 'Plain (reference)']];

/** Each entry becomes its own page. */
const SECTIONS = [
  {
    title: 'DEFAULT — DCM BRAND PURPLE',
    sub: 'All eleven band patterns on the brand palette with the purple-plate mark. This is the shipping default.',
    ruler: true,
    items: PATTERNS.map(([id, name]) => [name, `p-brand-${id}.png`]),
  },
  {
    title: 'GRADE RAMP — ALL TEN GRADES',
    sub: 'Same band and palette throughout, so the chip is the only thing that moves. 10 and 9 are inverted: flat ink cannot imitate metal, so contrast implies it instead.',
    items: [
      ['10 · Gem Mint', 'g-10.png'], ['9 · Mint', 'g-9.png'],
      ['8 · NM-Mint', 'g-8.png'], ['7 · Near Mint', 'g-7.png'],
      ['6 · EX-NM', 'g-6.png'], ['5 · Excellent', 'g-5.png'],
      ['4 · VG-EX', 'g-4.png'], ['3 · Very Good', 'g-3.png'],
      ['2 · Good', 'g-2.png'], ['1 · Poor', 'g-1.png'],
    ],
  },
  {
    title: 'STRESS TEST — REAL WORST-CASE CARDS',
    sub: 'The longest names and set lines in ~8,000 graded cards. Nothing is ever truncated: type shrinks, then wraps to up to 3 lines. Names run to 119 characters and set lines to 128 in the real data.',
    items: [
      ['119-char name · 8-player Leaf Trinity', 'stress-8player.png'],
      ['128-char set line · Japanese Pokémon', 'stress-jp-context.png'],
      ['105-char set line · Leaf proof 1/1', 'stress-leaf-proof.png'],
      ['4-player Bowman auto', 'stress-4player.png'],
      ['Long name + parenthetical', 'stress-monsters.png'],
      ['Typical card, for scale', 'stress-typical.png'],
    ],
  },
  {
    title: 'LOGO STYLES × BAND',
    sub: 'Each mark treatment against a busy band and a quiet one — the mark has to survive both.',
    items: ['diamond', 'mosaic', 'gradient', 'lightning'].flatMap((p) =>
      LOGOS.map(([t, label]) => [`${label} · ${p}`, `lx-${t}-${p}.png`])
    ),
  },
  // Brand backs sit immediately after the brand fronts so the default pair can
  // be judged together; every other palette then gets fronts-then-backs.
  {
    title: 'DEFAULT BACKS — DCM BRAND PURPLE',
    sub: 'The matching back for each front on page 1. Same band, same palette — a slab is a pair, not two unrelated faces.',
    items: PATTERNS.map(([id, name]) => [name, `pb-brand-${id}.png`]),
  },
  ...PALETTES.filter(([id]) => id !== 'brand').flatMap(([id, name, note]) => [
    {
      title: `PALETTE — ${name.toUpperCase()} · FRONTS`,
      sub: note || 'Same eleven patterns, different colours.',
      items: PATTERNS.map(([pid, pname]) => [pname, `p-${id}-${pid}.png`]),
    },
    {
      title: `PALETTE — ${name.toUpperCase()} · BACKS`,
      sub: 'The matching back for each front on the previous page.',
      items: PATTERNS.map(([pid, pname]) => [pname, `pb-${id}-${pid}.png`]),
    },
  ]),
  {
    title: 'FULL-BLEED CUSTOM STYLES (existing product)',
    sub: 'For contrast: the current Label Studio styles, where the pattern covers the whole label.',
    items: [
      ['Gradient', 'cs-gradient.png'], ['Extension', 'cs-extension.png'], ['Neon', 'cs-neon.png'],
      ['Split', 'cs-split.png'], ['Shattered Glass', 'cs-geo-shattered.png'],
      ['Diagonal Stripes', 'cs-geo-stripes.png'], ['Fractured', 'cs-geo-fractured.png'],
      ['Mosaic Grid', 'cs-geo-mosaic.png'], ['Lightning Bolt', 'cs-geo-lightning.png'],
    ],
  },
];

const doc = await PDFDocument.create();
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
let pageNo = 0;

const cache = new Map();
async function png(file) {
  if (!cache.has(file)) cache.set(file, await doc.embedPng(fs.readFileSync(`${DIR}/${file}`)));
  return cache.get(file);
}

let skipped = 0;

for (const section of SECTIONS) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pageNo++;
  let y = PAGE_H - MARGIN;

  page.drawText(section.title, { x: MARGIN, y: y - 10, size: 11, font: bold, color: rgb(0.42, 0.32, 0.07) });
  y -= 24;
  page.drawText(section.sub, { x: MARGIN, y: y - 6, size: 7.5, font: reg, color: rgb(0.4, 0.4, 0.4) });
  y -= 16;
  page.drawText('True size 2.8" × 0.8" — print at 100% / Actual size, not Fit to page.', {
    x: MARGIN, y: y - 6, size: 7, font: reg, color: rgb(0.55, 0.55, 0.55),
  });
  y -= 18;

  if (section.ruler) {
    const rx = MARGIN, ry = y - 10;
    page.drawLine({ start: { x: rx, y: ry }, end: { x: rx + PT, y: ry }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = rx + t * PT;
      page.drawLine({ start: { x, y: ry }, end: { x, y: ry + (t % 0.5 === 0 ? 7 : 4) }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    }
    page.drawText('1 inch — measure me first', { x: rx + PT + 8, y: ry - 1, size: 7, font: reg, color: rgb(0.42, 0.42, 0.42) });
    y -= 26;
  }

  let col = 0;
  for (const [caption, file] of section.items) {
    if (!fs.existsSync(`${DIR}/${file}`)) { skipped++; continue; }
    // A section that overflows continues on a fresh page rather than silently
    // dropping labels off the bottom.
    if (col === 0 && y - ROW_H < MARGIN + 10) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      pageNo++;
      y = PAGE_H - MARGIN;
      page.drawText(`${section.title} (cont.)`, { x: MARGIN, y: y - 10, size: 9, font: bold, color: rgb(0.42, 0.32, 0.07) });
      y -= 26;
    }
    const x = MARGIN + col * (LW + COL_GAP);
    page.drawText(caption, { x, y: y - 8, size: 6.5, font: reg, color: rgb(0.35, 0.35, 0.35) });
    const img = await png(file);
    const iy = y - CAP - LH;
    page.drawImage(img, { x, y: iy, width: LW, height: LH });
    page.drawRectangle({ x, y: iy, width: LW, height: LH, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });
    col++;
    if (col >= COLS) { col = 0; y -= ROW_H; }
  }

  page.drawText(`page ${pageNo}`, { x: PAGE_W - MARGIN - 30, y: MARGIN - 12, size: 7, font: reg, color: rgb(0.6, 0.6, 0.6) });
}

const out = `${DIR}/DCM-labels-round3-print.pdf`;
fs.writeFileSync(out, await doc.save());
const total = SECTIONS.reduce((n, s) => n + s.items.length, 0) - skipped;
console.log(`wrote ${out} — ${total} labels across ${pageNo} pages at ${LW.toFixed(1)}×${LH.toFixed(1)}pt (2.8"×0.8")`);
if (skipped) console.log(`  ${skipped} missing PNG(s) skipped — run render-band-variants.ts first`);
