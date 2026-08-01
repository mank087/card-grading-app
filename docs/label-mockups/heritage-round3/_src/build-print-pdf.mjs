// Printable PDF of every Round 3 label, at TRUE SIZE.
//
// The review HTML shows labels ~1000px wide, roughly 4x life size, which is
// useless for judging whether 29px context type is actually readable on a slab.
// This lays each one out at exactly 2.8" x 0.8" so a printed page can be held
// against a real slab.
//
// Print at 100% / "Actual size" -- NOT "Fit to page", which is the default in
// most viewers and will silently rescale everything. There is a 1-inch ruler on
// page 1 to verify the print came out true.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';

const DIR = process.argv[2] || 'docs/label-mockups/heritage-round3';

const PT = 72;                       // points per inch
const LW = 2.8 * PT;                 // 201.6pt
const LH = 0.8 * PT;                 // 57.6pt
const PAGE_W = 8.5 * PT, PAGE_H = 11 * PT;
const MARGIN = 0.45 * PT * 1.6;      // ~0.5"
const CAP = 11;                      // caption band above each label
const GAP_Y = 16;                    // breathing room between rows
const COLS = 2;
const COL_GAP = (PAGE_W - 2 * MARGIN - COLS * LW) / (COLS - 1);
const ROW_H = LH + CAP + GAP_Y;

const LABELS = [
  ['— Heritage fronts —', null],
  ['Front A · Base (purple band) · grade 9', 'r3-a-base.png'],
  ['Front B · Card colours · grade 8', 'r3-b-cardcolors.png'],
  ['Front C · Mosaic band · grade 10', 'r3-c-pattern.png'],
  ['Back · Round 3', 'r3-back.png'],

  ['— Logo treatments (diamond band, grade 9) —', null],
  ['Logo · A — Purple plate', 'logo-plate.png'],
  ['Logo · B — Colour mark + rules', 'logo-rules.png'],
  ['Logo · Plain (reference)', 'logo-plain.png'],

  ['— Band fronts (card palette) —', null],
  ['Band · Diamond mosaic', 'band-diamond.png'],
  ['Band · Chevron', 'band-chevron.png'],
  ['Band · Scales', 'band-scales.png'],
  ['Band · Prism', 'band-prism.png'],
  ['Band · Gradient', 'band-gradient.png'],
  ['Band · Split', 'band-split.png'],
  ['Band · Mosaic tiles', 'band-mosaic.png'],
  ['Band · Diagonal stripes', 'band-stripes.png'],
  ['Band · Lightning bolt', 'band-lightning.png'],
  ['Band · Shattered glass', 'band-shattered.png'],
  ['Band · Fractured', 'band-fractured.png'],

  ['— Band fronts (brand palette, grade 10) —', null],
  ['Band · Gradient · brand', 'band-gradient-brand.png'],
  ['Band · Mosaic · brand', 'band-mosaic-brand.png'],
  ['Band · Lightning · brand', 'band-lightning-brand.png'],
  ['Band · Diamond · brand', 'band-diamond-brand.png'],

  ['— Band backs —', null],
  ['Back · Gradient', 'back-band-gradient.png'],
  ['Back · Split', 'back-band-split.png'],
  ['Back · Mosaic tiles', 'back-band-mosaic.png'],
  ['Back · Diagonal stripes', 'back-band-stripes.png'],
  ['Back · Lightning bolt', 'back-band-lightning.png'],
  ['Back · Shattered glass', 'back-band-shattered.png'],
  ['Back · Fractured', 'back-band-fractured.png'],
  ['Back · Diamond mosaic', 'back-band-diamond.png'],
  ['Back · Chevron', 'back-band-chevron.png'],
  ['Back · Scales', 'back-band-scales.png'],
  ['Back · Prism', 'back-band-prism.png'],

  ['— Full-bleed custom styles —', null],
  ['Custom · Gradient', 'cs-gradient.png'],
  ['Custom · Extension', 'cs-extension.png'],
  ['Custom · Neon', 'cs-neon.png'],
  ['Custom · Split', 'cs-split.png'],
  ['Custom · Shattered Glass', 'cs-geo-shattered.png'],
  ['Custom · Diagonal Stripes', 'cs-geo-stripes.png'],
  ['Custom · Fractured', 'cs-geo-fractured.png'],
  ['Custom · Mosaic Grid', 'cs-geo-mosaic.png'],
  ['Custom · Lightning Bolt', 'cs-geo-lightning.png'],
];

const doc = await PDFDocument.create();
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

let page = null, cursorY = 0, col = 0, pageNo = 0;

function newPage(first = false) {
  page = doc.addPage([PAGE_W, PAGE_H]);
  pageNo++;
  cursorY = PAGE_H - MARGIN;
  col = 0;

  page.drawText('DCM label redesign — Round 3 — printed at true size (2.8" × 0.8")', {
    x: MARGIN, y: cursorY - 10, size: 9, font: bold, color: rgb(0.08, 0.08, 0.08),
  });
  cursorY -= 22;
  page.drawText('Print at 100% / Actual size. "Fit to page" will rescale these and the measurement will be wrong.', {
    x: MARGIN, y: cursorY - 6, size: 7.5, font: reg, color: rgb(0.42, 0.42, 0.42),
  });
  cursorY -= 20;

  if (first) {
    // Ruler: if this does not measure 1 inch, the print was scaled.
    const rx = MARGIN, ry = cursorY - 12;
    page.drawLine({ start: { x: rx, y: ry }, end: { x: rx + PT, y: ry }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = rx + t * PT;
      page.drawLine({ start: { x, y: ry }, end: { x, y: ry + (t % 0.5 === 0 ? 7 : 4) }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
    }
    page.drawText('1 inch — measure me first', { x: rx + PT + 8, y: ry - 1, size: 7.5, font: reg, color: rgb(0.42, 0.42, 0.42) });
    cursorY -= 32;
  }
  page.drawText(`page ${pageNo}`, { x: PAGE_W - MARGIN - 30, y: MARGIN - 14, size: 7, font: reg, color: rgb(0.6, 0.6, 0.6) });
}

function ensureRoom(need) {
  if (!page || cursorY - need < MARGIN) newPage(pageNo === 0);
}

newPage(true);

for (const [caption, file] of LABELS) {
  if (!file) {
    // Section heading: always starts a fresh row.
    if (col !== 0) { cursorY -= ROW_H; col = 0; }
    ensureRoom(30 + ROW_H);
    cursorY -= 8;
    page.drawText(caption.replace(/—/g, '').trim().toUpperCase(), {
      x: MARGIN, y: cursorY - 8, size: 8, font: bold, color: rgb(0.65, 0.49, 0.11),
    });
    cursorY -= 20;
    continue;
  }

  if (col === 0) ensureRoom(ROW_H);
  const x = MARGIN + col * (LW + COL_GAP);
  const yTop = cursorY;

  page.drawText(caption, { x, y: yTop - 8, size: 6.5, font: reg, color: rgb(0.35, 0.35, 0.35) });

  const png = await doc.embedPng(fs.readFileSync(`${DIR}/${file}`));
  const y = yTop - CAP - LH;
  page.drawImage(png, { x, y, width: LW, height: LH });
  // Hairline so the true edge is visible against white paper.
  page.drawRectangle({ x, y, width: LW, height: LH, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });

  col++;
  if (col >= COLS) { col = 0; cursorY -= ROW_H; }
}

const out = `${DIR}/DCM-labels-round3-print.pdf`;
fs.writeFileSync(out, await doc.save());
const n = LABELS.filter(l => l[1]).length;
console.log(`wrote ${out} — ${n} labels across ${pageNo} pages at ${LW.toFixed(1)}×${LH.toFixed(1)}pt (2.8"×0.8")`);
