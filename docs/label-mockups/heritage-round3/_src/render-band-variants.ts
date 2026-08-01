// Band variants: the Heritage front (ivory ground, dark type, grade-coloured
// chip, logo bottom-centre) with the pattern confined to the left band, the way
// Round 1 variant C put mosaic diamonds there.
//
// The patterns are the same five from customSlabLabelGenerator.ts, but re-cut
// for a 90 x 400 vertical strip rather than a 1400 x 400 landscape one. A 5x2
// mosaic grid or a 7-band 30-degree stripe set is meaningless in a strip that
// narrow, so each is re-proportioned to the aspect it actually has to live in.
import sharp from 'sharp';
import * as fs from 'fs';
import QRCode from 'qrcode';
import { bandGeometry, BAND_STROKE_COLOR, BAND_PATTERNS, type BandPattern } from '../../../../src/lib/labelLab/bandGeometry';
import { EMBLEMS } from '../../../../src/lib/labelLab/emblemShapes';

const W = 1400, H = 400;
const BAND = 90;              // band width, unchanged from Round 1
const RULE = 6;               // gold hairline separating band from field
const OUT = process.argv[2] || '.';
const LOGO_URI = `data:image/png;base64,${fs.readFileSync('public/DCM-logo.png').toString('base64')}`;

// Print-hardened theme. A 2% ivory tint dithers into speckle on a consumer
// inkjet and costs ink across the whole label to look like blank paper, so the
// field is paper white (zero coverage = perfectly flat). Everything structural
// darkens, because consumer printers are good at dark solids and bad at light
// tints and light neutrals.
const IVORY = '#ffffff';
const INK = '#000000';
const INK_SOFT = '#3f3f46';
const GOLD = '#8a6a14';
const KEYLINE = '#141414';

// Sampled card palette, same set used for the full-bleed custom styles so the
// two sections compare like for like.
const CARD = ['#EA580C', '#F59E0B', '#DC2626', '#7C2D12', '#FBBF24'];
const BRAND = ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd'];

/**
 * Palettes for the preview sheets.
 *
 * BRAND is the default every label ships with until a user changes it in Label
 * Studio; the rest exist to show that the same eleven patterns hold up when the
 * colours move, which is the thing that actually needs proving before we let
 * customers pick their own.
 */
const PALETTES: { id: string; name: string; colors: string[] }[] = [
  { id: 'brand',   name: 'DCM brand purple (default)', colors: BRAND },
  { id: 'ember',   name: 'Ember — sampled from a Charizard', colors: CARD },
  { id: 'ocean',   name: 'Ocean blue', colors: ['#0284C7', '#0C4A6E', '#38BDF8', '#082F49', '#7DD3FC'] },
  { id: 'crimson', name: 'Crimson', colors: ['#DC2626', '#7F1D1D', '#F87171', '#450A0A', '#FCA5A5'] },
  { id: 'forest',  name: 'Forest green', colors: ['#16A34A', '#14532D', '#4ADE80', '#052E16', '#86EFAC'] },
  { id: 'slate',   name: 'Graphite — the neutral test', colors: ['#475569', '#1E293B', '#94A3B8', '#0F172A', '#CBD5E1'] },
];

// Dividers scale down with the band: 2.5px at 400 wide would swamp a 90px strip.
const DIV = `stroke="rgba(0,0,0,0.55)" stroke-width="2" fill="none"`;

interface Grade { g: number; label: string; fill: string; ink: string }
/**
 * The print-hardened ramp, mirroring GRADE_CHIPS_PRINT in labelPresets.
 * 10 and 9 are inverted — near-black chip, metallic-toned numeral — because
 * flat ink cannot imitate metal and light neutrals pick up a colour cast.
 * 8 down are already saturated mid-to-dark colours that reproduce cleanly.
 */
const GRADES: Grade[] = [
  { g: 10, label: 'GEM MINT',  fill: '#1A1206', ink: '#E8C25A' },
  { g: 9,  label: 'MINT',      fill: '#15171A', ink: '#D8DEE6' },
  { g: 8,  label: 'NM-MINT',   fill: '#1D4ED8', ink: '#FFFFFF' },
  { g: 7,  label: 'NEAR MINT', fill: '#0E7490', ink: '#FFFFFF' },
  { g: 6,  label: 'EX-NM',     fill: '#15803D', ink: '#FFFFFF' },
  { g: 5,  label: 'EXCELLENT', fill: '#A16207', ink: '#FFFFFF' },
  { g: 4,  label: 'VG-EX',     fill: '#EA580C', ink: '#FFFFFF' },
  { g: 3,  label: 'VERY GOOD', fill: '#DC2626', ink: '#FFFFFF' },
  { g: 2,  label: 'GOOD',      fill: '#7F1D1D', ink: '#FFFFFF' },
  { g: 1,  label: 'POOR',      fill: '#3F3F46', ink: '#FFFFFF' },
];
const G9  = GRADES.find(g => g.g === 9)!;
const G10 = GRADES.find(g => g.g === 10)!;

function chip(x: number, c: Grade): string {
  const big = String(c.g).length > 1;
  return `
    <rect x="${x}" y="64" width="240" height="252" rx="28" fill="${c.fill}"/>
    <rect x="${x + 6}" y="70" width="228" height="240" rx="24" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    <text x="${x + 120}" y="${big ? 236 : 238}" font-family="Arial, Helvetica, sans-serif" font-size="${big ? 150 : 168}" font-weight="bold" fill="${c.ink}" text-anchor="middle">${c.g}</text>
    <text x="${x + 120}" y="292" font-family="Arial, Helvetica, sans-serif" font-size="${c.label.length > 8 ? 26 : 30}" font-weight="bold" letter-spacing="4" fill="${c.ink}" opacity="0.9" text-anchor="middle">${c.label}</text>`;
}

const LOGO_WHITE_URI = `data:image/png;base64,${fs.readFileSync('public/DCM Logo white.png').toString('base64')}`;

export type LogoTreatment = 'plate' | 'rules' | 'plain';

/**
 * The bottom-centre mark plus whatever makes it visible. A bare navy mark on
 * ivory reads as a smudge at 2.8", which defeats the point of moving it there.
 * Only the backing changes between treatments — the mark never moves or resizes.
 */
const BRAND_PURPLE = '#7c3aed';

/** Brand-purple rounded plate, white mark. Fitted badge, not a bar. */
function logoBlock(t: LogoTreatment): string {
  const mw = 190, mh = 70;
  if (t === 'plain' || t === 'rules') {
    const left = (W - mw) / 2, top = H - mh - 10;
    const mark = `<image href="${LOGO_URI}" x="${left}" y="${top}" width="${mw}" height="${mh}" preserveAspectRatio="xMidYMid meet"/>`;
    if (t === 'plain') return mark;
    // Short flanking rules. Kept short on purpose — a full-width rule becomes a
    // second horizontal divider and argues with the one above the serial.
    const len = 110, gap = 18, y = top + mh / 2;
    return `<rect x="${left - gap - len}" y="${y}" width="${len}" height="5" fill="${GOLD}" opacity="0.85"/>
      <rect x="${left + mw + gap}" y="${y}" width="${len}" height="5" fill="${GOLD}" opacity="0.85"/>
      ${mark}`;
  }
  const pw = 172, ph = 64, x = (W - pw) / 2, y = H - ph - 8;
  const iw = pw * 0.80, ih = ph * 0.74;
  return `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="16" fill="${BRAND_PURPLE}"/>
    <image href="${LOGO_WHITE_URI}" x="${(W - iw) / 2}" y="${y + (ph - ih) / 2}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet"/>`;
}

function body(name: string, context: string, serial: string, grade: Grade, logo: LogoTreatment = 'plate'): string {
  return `
    <text x="150" y="132" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="${INK}">${name}</text>
    <text x="150" y="198" font-family="Arial, Helvetica, sans-serif" font-size="29" letter-spacing="4" fill="${INK_SOFT}">${context}</text>
    <line x1="150" y1="236" x2="1090" y2="236" stroke="#9ca3af" stroke-width="2"/>
    <text x="150" y="292" font-family="Courier New, monospace" font-size="36" letter-spacing="4" fill="${INK_SOFT}">Serial: ${serial}</text>
    ${chip(1130, grade)}
    ${logoBlock(logo)}`;
}

// Everything the band draws is clipped to the band, so a pattern can be
// generated loosely and still land inside a clean edge.
const label = (bandInner: string, rule: string, grade: Grade, name: string, ctx: string, serial: string, logo: LogoTreatment = 'plate') => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="band"><rect x="0" y="0" width="${BAND}" height="${H}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <g clip-path="url(#band)">${bandInner}</g>
  <rect x="${BAND}" y="0" width="${RULE}" height="${H}" fill="${rule}"/>
  ${body(name, ctx, serial, grade, logo)}
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${KEYLINE}" stroke-width="4"/>
</svg>`;

const pick = (p: string[]) => (i: number) => p[i % p.length];

// ── Bands: rendered from the SHARED geometry module ────────────────────────
// These used to be a second implementation of the same eleven patterns, which
// is how the stripes bug lived on here after being fixed in the lab. Both
// renderers now consume src/lib/labelLab/bandGeometry.ts; this file only maps
// primitives to SVG strings.
function band(pattern: BandPattern, palette: string[], gradId = 'g'): string {
  const g = bandGeometry(pattern, palette, BAND, H);
  if (g.gradientStops) {
    const stops = g.gradientStops
      .map((c, i) => `<stop offset="${g.gradientStops!.length > 1 ? i / (g.gradientStops!.length - 1) : 0}" stop-color="${c}"/>`)
      .join('');
    return `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>
      <rect width="${BAND}" height="${H}" fill="url(#${gradId})"/>`;
  }
  return [
    `<rect width="${BAND}" height="${H}" fill="${g.base}"/>`,
    ...g.fills.map(f => `<path d="${f.d}" fill="${f.fill}"/>`),
    ...g.strokes.map(k => `<path d="${k.d}" fill="none" stroke="${BAND_STROKE_COLOR}" stroke-width="${g.strokeWidth}"/>`),
  ].join('');
}

const NAME = 'Charizard ex', CTX = 'OBSIDIAN FLAMES · SAR · #234/197 · 2023', SER = '773412';
const PNAME = 'Mega Sharpedo EX', PCTX = 'PHANTASMAL FLAMES · FULL ART · #127/094 · 2025', PSER = '580976';

// ── Back, with the same band treatment ──────────────────────────────────────
// Identical to the Round 3 back (QR carrying the mark, rotated emblems, centred
// grade, right-aligned sub-grades) with the flat purple band swapped for a
// patterned one, so a front and back can be judged as a matched pair.
function emblem(x: number, id: 'founder' | 'cardLover' | 'vip'): string {
  const e = EMBLEMS[id];
  const size = 52;
  // Drawn as a path, not a text glyph: the mark has to survive whatever font
  // the renderer has, and @react-pdf's Helvetica has no star/heart/diamond.
  // Colours are production's hues pulled dark enough to hold on a white field
  // (production's originals sit on a DARK back label).
  return `
    <g transform="translate(${x - size / 2} 52) scale(${size / 100})"><path d="${e.path}" fill="${e.color}"/></g>
    <text transform="translate(${x + 13} 126) rotate(-90)" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="bold" letter-spacing="3" fill="${e.color}">${e.word}</text>`;
}

function backWithBand(bandInner: string, qrUri: string, grade: string, cond: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="bandb"><rect x="0" y="0" width="${BAND}" height="${H}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <g clip-path="url(#bandb)">${bandInner}</g>
  <rect x="${BAND}" y="0" width="${RULE}" height="${H}" fill="${GOLD}"/>

  <rect x="132" y="52" width="296" height="296" fill="#ffffff" stroke="#9ca3af" stroke-width="2"/>
  <image href="${qrUri}" x="140" y="60" width="280" height="280"/>

  ${emblem(486, 'founder')}
  ${emblem(560, 'cardLover')}
  ${emblem(634, 'vip')}

  <text x="880" y="212" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="bold" fill="${INK}" text-anchor="middle">${grade}</text>
  <text x="880" y="266" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" letter-spacing="7" fill="${INK}" text-anchor="middle">${cond}</text>

  <text x="1330" y="118" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Centering: 9</text>
  <text x="1330" y="182" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Corners: 9</text>
  <text x="1330" y="246" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Edges: 10</text>
  <text x="1330" y="310" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Surface: 10</text>

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${KEYLINE}" stroke-width="4"/>
</svg>`;
}

async function main() {
  const jobs: Array<[string, string]> = [
    ['band-mosaic.png',     label(band('mosaic', CARD),          GOLD, G9,  NAME, CTX, SER)],
    ['band-lightning.png',  label(band('lightning', CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-stripes.png',    label(band('stripes', CARD),         GOLD, G9,  NAME, CTX, SER)],
    ['band-shattered.png',  label(band('shattered', CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-fractured.png',  label(band('fractured', CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-gradient.png',   label(band('gradient', CARD, 'gc'),  GOLD, G9,  NAME, CTX, SER)],
    ['band-split.png',      label(band('split', CARD),           GOLD, G9,  NAME, CTX, SER)],
    // Four added Aug 2026 after the 8x audit.
    ['band-diamond.png',   label(band('diamond', CARD),  GOLD, G9, NAME, CTX, SER)],
    ['band-chevron.png',   label(band('chevron', CARD),  GOLD, G9, NAME, CTX, SER)],
    ['band-scales.png',    label(band('scales', CARD),   GOLD, G9, NAME, CTX, SER)],
    ['band-prism.png',     label(band('prism', CARD),    GOLD, G9, NAME, CTX, SER)],
    // Same treatments on the brand palette, to show the band carries either.
    ['band-mosaic-brand.png',    label(band('mosaic', BRAND),         GOLD, G10, PNAME, PCTX, PSER)],
    ['band-lightning-brand.png', label(band('lightning', BRAND),      GOLD, G10, PNAME, PCTX, PSER)],
    ['band-gradient-brand.png',  label(band('gradient', BRAND, 'gb'), GOLD, G10, PNAME, PCTX, PSER)],
    ['band-diamond-brand.png',   label(band('diamond', BRAND),        GOLD, G10, PNAME, PCTX, PSER)],
  ];

  // Logo treatments: one label each, everything else held constant so the only
  // variable is how hard the mark works to be seen.
  const LOGOS: LogoTreatment[] = ['plate', 'rules', 'plain'];
  for (const t of LOGOS) {
    jobs.push([`logo-${t}.png`, label(band('diamond', CARD), GOLD, G9, NAME, CTX, SER, t)]);
  }

  // ── Palette sheets ────────────────────────────────────────────────────────
  // Every pattern in every palette. The brand set is what ships by default;
  // the others prove the patterns survive a colour change before we hand the
  // picker to customers.
  for (const pal of PALETTES) {
    for (const p of BAND_PATTERNS) {
      jobs.push([
        `p-${pal.id}-${p.id}.png`,
        label(band(p.id, pal.colors, `g-${pal.id}-${p.id}`), GOLD, G9, NAME, CTX, SER, 'plate'),
      ]);
    }
  }

  // ── Grade ramp ────────────────────────────────────────────────────────────
  // Every grade on the same card, band and palette, so the chip is the only
  // thing that moves. Card names change with the grade so the sheet does not
  // read as ten copies of one card.
  const RAMP_CARDS: Record<number, [string, string, string]> = {
    10: ['Charizard ex',      'OBSIDIAN FLAMES · SAR · #234/197 · 2023', '773412'],
    9:  ['Mega Sharpedo EX',  'PHANTASMAL FLAMES · FULL ART · #127/094 · 2025', '580976'],
    8:  ['Jaxson Dart',       'TOPPS CHROME · REFRACTOR RC · #74 · 2025', '412117'],
    7:  ['Xerosic',           'PHANTOM FORCES · #110/119 · 2014', '284401'],
    6:  ['Roberto Clemente',  'TOPPS CHROME · /99 · #12 · 2023', '901233'],
    5:  ['LeBron James',      'DONRUSS OPTIC · #44 · 2019', '556018'],
    4:  ['Eddy Pineiro',      'DONRUSS · #188 · 2021', '330277'],
    3:  ['Andre the Giant',   'WRESTLEMANIA III · #22 · 1987', '119845'],
    2:  ['Giratina',          'LOST ORIGIN · #131/196 · 2022', '677310'],
    1:  ['Gengar',            'TRIUMPHANT · #26/102 · 2010', '204119'],
  };
  for (const g of GRADES) {
    const [n, c, sr] = RAMP_CARDS[g.g];
    jobs.push([`g-${g.g}.png`, label(band('diamond', BRAND, `gr-${g.g}`), GOLD, g, n, c, sr, 'plate')]);
  }

  // Logo styles crossed with a few representative patterns, so the mark can be
  // judged against a busy band and a quiet one rather than only one of each.
  for (const p of ['diamond', 'mosaic', 'gradient', 'lightning'] as const) {
    for (const t of LOGOS) {
      jobs.push([
        `lx-${t}-${p}.png`,
        label(band(p, BRAND, `gx-${t}-${p}`), GOLD, G9, NAME, CTX, SER, t),
      ]);
    }
  }
  // Error correction H so the centre mark does not break scanning.
  const qrBuf = await QRCode.toBuffer('https://dcmgrading.com/verify/773412', {
    errorCorrectionLevel: 'H', margin: 1, width: 560, color: { dark: '#141414', light: '#ffffff' },
  });
  const mark = await sharp('public/DCM-logo.png').resize(132, 132, { fit: 'inside' }).png().toBuffer();
  const plate = await sharp({ create: { width: 168, height: 168, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  const qrUri = `data:image/png;base64,${(await sharp(qrBuf).composite([{ input: plate, gravity: 'centre' }]).png().toBuffer()).toString('base64')}`;

  const backs: Array<[string, string]> = [
    ['back-band-gradient.png',  band('gradient', CARD, 'bg1')],
    ['back-band-split.png',     band('split', CARD)],
    ['back-band-mosaic.png',    band('mosaic', CARD)],
    ['back-band-stripes.png',   band('stripes', CARD)],
    ['back-band-lightning.png', band('lightning', CARD)],
    ['back-band-shattered.png', band('shattered', CARD)],
    ['back-band-fractured.png', band('fractured', CARD)],
    ['back-band-diamond.png',   band('diamond', CARD)],
    ['back-band-chevron.png',   band('chevron', CARD)],
    ['back-band-scales.png',    band('scales', CARD)],
    ['back-band-prism.png',     band('prism', CARD)],
  ];
  for (const [f, band] of backs) jobs.push([f, backWithBand(band, qrUri, '9', 'MINT')]);

  for (const [f, s] of jobs) {
    await sharp(Buffer.from(s)).png().toFile(`${OUT}/${f}`);
    console.log('rendered', f);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
