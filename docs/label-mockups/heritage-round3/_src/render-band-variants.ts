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

const W = 1400, H = 400;
const BAND = 90;              // band width, unchanged from Round 1
const RULE = 6;               // gold hairline separating band from field
const OUT = process.argv[2] || '.';
const LOGO_URI = `data:image/png;base64,${fs.readFileSync('public/DCM-logo.png').toString('base64')}`;

const IVORY = '#faf8f4';
const INK = '#141414';
const INK_SOFT = '#5a5a5a';
const GOLD = '#a67c1b';

// Sampled card palette, same set used for the full-bleed custom styles so the
// two sections compare like for like.
const CARD = ['#EA580C', '#F59E0B', '#DC2626', '#7C2D12', '#FBBF24'];
const BRAND = ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd'];

// Dividers scale down with the band: 2.5px at 400 wide would swamp a 90px strip.
const DIV = `stroke="rgba(0,0,0,0.55)" stroke-width="2" fill="none"`;

interface Grade { g: number; label: string; fill: string; ink: string }
const G9: Grade  = { g: 9,  label: 'MINT',     fill: '#AFB3B8', ink: '#15171a' };
const G10: Grade = { g: 10, label: 'GEM MINT', fill: '#C8A02C', ink: '#1a1206' };

function chip(x: number, c: Grade): string {
  const big = String(c.g).length > 1;
  return `
    <rect x="${x}" y="64" width="240" height="252" rx="28" fill="${c.fill}"/>
    <rect x="${x + 6}" y="70" width="228" height="240" rx="24" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="3"/>
    <text x="${x + 120}" y="${big ? 236 : 238}" font-family="Arial, Helvetica, sans-serif" font-size="${big ? 150 : 168}" font-weight="bold" fill="${c.ink}" text-anchor="middle">${c.g}</text>
    <text x="${x + 120}" y="292" font-family="Arial, Helvetica, sans-serif" font-size="${c.label.length > 8 ? 26 : 30}" font-weight="bold" letter-spacing="4" fill="${c.ink}" opacity="0.9" text-anchor="middle">${c.label}</text>`;
}

function body(name: string, context: string, serial: string, grade: Grade): string {
  const lw = 200, lh = 78;
  return `
    <text x="150" y="132" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="${INK}">${name}</text>
    <text x="150" y="198" font-family="Arial, Helvetica, sans-serif" font-size="29" letter-spacing="4" fill="${INK_SOFT}">${context}</text>
    <line x1="150" y1="236" x2="1090" y2="236" stroke="#d9d2c4" stroke-width="2"/>
    <text x="150" y="292" font-family="Courier New, monospace" font-size="36" letter-spacing="4" fill="${INK_SOFT}">DCM ${serial}</text>
    ${chip(1130, grade)}
    <image href="${LOGO_URI}" x="${(W - lw) / 2}" y="${H - lh - 10}" width="${lw}" height="${lh}" preserveAspectRatio="xMidYMid meet"/>`;
}

// Everything the band draws is clipped to the band, so a pattern can be
// generated loosely and still land inside a clean edge.
const label = (bandInner: string, rule: string, grade: Grade, name: string, ctx: string, serial: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="band"><rect x="0" y="0" width="${BAND}" height="${H}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <g clip-path="url(#band)">${bandInner}</g>
  <rect x="${BAND}" y="0" width="${RULE}" height="${H}" fill="${rule}"/>
  ${body(name, ctx, serial, grade)}
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#e5decf" stroke-width="2"/>
</svg>`;

const pick = (p: string[]) => (i: number) => p[i % p.length];

// ── Band 1: Mosaic tiles — 2 columns x 9 rows ───────────────────────────────
function bandMosaic(p: string[]): string {
  const q = pick(p), cols = 2, rows = 9, tw = BAND / cols, th = H / rows;
  let s = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      s += `<rect x="${c * tw}" y="${r * th}" width="${tw}" height="${th}" fill="${q(r * cols + c)}"/>`;
  for (let c = 1; c < cols; c++) s += `<path d="M ${c * tw} 0 L ${c * tw} ${H}" ${DIV}/>`;
  for (let r = 1; r < rows; r++) s += `<path d="M 0 ${r * th} L ${BAND} ${r * th}" ${DIV}/>`;
  return s;
}

// ── Band 2: Lightning — vertical zigzag running the height of the band ──────
function bandLightning(p: string[]): string {
  const q = pick(p);
  const z: [number, number][] = [
    [BAND * 0.62, 0], [BAND * 0.28, H * 0.22], [BAND * 0.70, H * 0.44],
    [BAND * 0.30, H * 0.66], [BAND * 0.66, H * 0.86], [BAND * 0.40, H],
  ];
  const zig = z.map(([x, y]) => `L ${x} ${y}`).join(' ');
  return `
    <rect width="${BAND}" height="${H}" fill="${q(0)}"/>
    <path d="M 0 0 L ${z[0][0]} ${z[0][1]} ${zig} L 0 ${H} Z" fill="${q(0)}"/>
    <path d="M ${BAND} 0 L ${z[0][0]} ${z[0][1]} ${zig} L ${BAND} ${H} Z" fill="${q(1)}"/>
    <path d="M ${z[0][0]} ${z[0][1]} ${zig}" ${DIV}/>`;
}

// ── Band 3: Diagonal stripes — 9 bands sheared across the strip ─────────────
function bandStripes(p: string[]): string {
  const q = pick(p), n = 9, h = H / n, skew = BAND;  // 45deg across a narrow strip
  let s = '';
  for (let i = -1; i <= n; i++) {
    const y0 = i * h;
    s += `<path d="M 0 ${y0} L ${BAND} ${y0 - skew} L ${BAND} ${y0 - skew + h} L 0 ${y0 + h} Z" fill="${q(i + 1)}"/>`;
  }
  for (let i = 0; i <= n; i++) {
    const y0 = i * h;
    s += `<path d="M 0 ${y0} L ${BAND} ${y0 - skew}" ${DIV}/>`;
  }
  return s;
}

// ── Band 4: Shattered — shards from a focal point inside the band ───────────
function bandShattered(p: string[]): string {
  const q = pick(p), cx = BAND * 0.45, cy = H * 0.38;
  const pts: [number, number][] = [
    [0, 0], [BAND, 0],
    [BAND, H * 0.25], [BAND, H * 0.5], [BAND, H * 0.75], [BAND, H],
    [0, H], [0, H * 0.72], [0, H * 0.45], [0, H * 0.2],
  ];
  let s = '';
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const d = `M ${cx} ${cy} L ${ax} ${ay} L ${bx} ${by} Z`;
    s += `<path d="${d}" fill="${q(i)}"/><path d="${d}" ${DIV}/>`;
  }
  return s;
}

// ── Band 5: Fractured — five stacked regions, angled dividers ──────────────
function bandFractured(p: string[]): string {
  const q = pick(p);
  const ys = [0, H * 0.18, H * 0.40, H * 0.58, H * 0.80, H];
  const jog = BAND * 0.34;   // horizontal offset that makes each cut angled
  let s = '';
  for (let i = 0; i < 5; i++) {
    const yA = ys[i], yB = ys[i + 1];
    const oA = i % 2 === 0 ? 0 : jog, oB = (i + 1) % 2 === 0 ? 0 : jog;
    s += `<path d="M 0 ${yA} L ${BAND} ${yA + oA * 0.5} L ${BAND} ${yB + oB * 0.5} L 0 ${yB} Z" fill="${q(i)}"/>`;
    if (i > 0) s += `<path d="M 0 ${yA} L ${BAND} ${yA + oA * 0.5}" ${DIV}/>`;
  }
  return s;
}

// ── Band 6: Gradient — the quiet one ────────────────────────────────────────
function bandGradient(p: string[], id: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      ${p.map((c, i) => `<stop offset="${i / (p.length - 1)}" stop-color="${c}"/>`).join('')}
    </linearGradient></defs>
    <rect width="${BAND}" height="${H}" fill="url(#${id})"/>`;
}

// ── Band 7: Split — hard stack, no blend ────────────────────────────────────
function bandSplit(p: string[]): string {
  const q = pick(p);
  return `
    <rect y="0" width="${BAND}" height="${H / 2}" fill="${q(0)}"/>
    <rect y="${H / 2}" width="${BAND}" height="${H / 2}" fill="${q(3)}"/>
    <path d="M 0 ${H / 2} L ${BAND} ${H / 2}" ${DIV}/>`;
}

const NAME = 'Charizard ex', CTX = 'OBSIDIAN FLAMES · SAR · #234/197 · 2023', SER = '773412';
const PNAME = 'Mega Sharpedo EX', PCTX = 'PHANTASMAL FLAMES · FULL ART · #127/094 · 2025', PSER = '580976';

// ── Back, with the same band treatment ──────────────────────────────────────
// Identical to the Round 3 back (QR carrying the mark, rotated emblems, centred
// grade, right-aligned sub-grades) with the flat purple band swapped for a
// patterned one, so a front and back can be judged as a matched pair.
function emblem(x: number, symbol: string, word: string, color: string): string {
  return `
    <text x="${x}" y="88" font-family="Arial, Helvetica, sans-serif" font-size="46" fill="${color}" text-anchor="middle">${symbol}</text>
    <text transform="translate(${x + 13} 122) rotate(-90)" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="bold" letter-spacing="3" fill="${color}">${word}</text>`;
}

function backWithBand(bandInner: string, qrUri: string, grade: string, cond: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="bandb"><rect x="0" y="0" width="${BAND}" height="${H}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <g clip-path="url(#bandb)">${bandInner}</g>
  <rect x="${BAND}" y="0" width="${RULE}" height="${H}" fill="${GOLD}"/>

  <rect x="132" y="52" width="296" height="296" fill="#ffffff" stroke="#d9d2c4" stroke-width="2"/>
  <image href="${qrUri}" x="140" y="60" width="280" height="280"/>

  ${emblem(486, '&#9733;', 'FOUNDER', '#b45309')}
  ${emblem(560, '&#9829;', 'CARD LOVER', '#be185d')}
  ${emblem(634, '&#9670;', 'VIP', '#4f46e5')}

  <text x="880" y="212" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="bold" fill="${INK}" text-anchor="middle">${grade}</text>
  <text x="880" y="266" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" letter-spacing="7" fill="${INK}" text-anchor="middle">${cond}</text>
  <text x="880" y="332" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="3" fill="${GOLD}" text-anchor="middle">DCMGRADING.COM/VERIFY</text>

  <text x="1330" y="118" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Centering: 9</text>
  <text x="1330" y="182" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Corners: 9</text>
  <text x="1330" y="246" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Edges: 10</text>
  <text x="1330" y="310" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${INK_SOFT}" text-anchor="end">Surface: 10</text>

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#e5decf" stroke-width="2"/>
</svg>`;
}

async function main() {
  const jobs: Array<[string, string]> = [
    ['band-mosaic.png',     label(bandMosaic(CARD),          GOLD, G9,  NAME, CTX, SER)],
    ['band-lightning.png',  label(bandLightning(CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-stripes.png',    label(bandStripes(CARD),         GOLD, G9,  NAME, CTX, SER)],
    ['band-shattered.png',  label(bandShattered(CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-fractured.png',  label(bandFractured(CARD),       GOLD, G9,  NAME, CTX, SER)],
    ['band-gradient.png',   label(bandGradient(CARD, 'gc'),  GOLD, G9,  NAME, CTX, SER)],
    ['band-split.png',      label(bandSplit(CARD),           GOLD, G9,  NAME, CTX, SER)],
    // Same treatments on the brand palette, to show the band carries either.
    ['band-mosaic-brand.png',    label(bandMosaic(BRAND),         GOLD, G10, PNAME, PCTX, PSER)],
    ['band-lightning-brand.png', label(bandLightning(BRAND),      GOLD, G10, PNAME, PCTX, PSER)],
    ['band-gradient-brand.png',  label(bandGradient(BRAND, 'gb'), GOLD, G10, PNAME, PCTX, PSER)],
  ];
  // Error correction H so the centre mark does not break scanning.
  const qrBuf = await QRCode.toBuffer('https://dcmgrading.com/verify/773412', {
    errorCorrectionLevel: 'H', margin: 1, width: 560, color: { dark: '#141414', light: '#ffffff' },
  });
  const mark = await sharp('public/DCM-logo.png').resize(132, 132, { fit: 'inside' }).png().toBuffer();
  const plate = await sharp({ create: { width: 168, height: 168, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  const qrUri = `data:image/png;base64,${(await sharp(qrBuf).composite([{ input: plate, gravity: 'centre' }]).png().toBuffer()).toString('base64')}`;

  const backs: Array<[string, string]> = [
    ['back-band-gradient.png',  bandGradient(CARD, 'bg1')],
    ['back-band-split.png',     bandSplit(CARD)],
    ['back-band-mosaic.png',    bandMosaic(CARD)],
    ['back-band-stripes.png',   bandStripes(CARD)],
    ['back-band-lightning.png', bandLightning(CARD)],
    ['back-band-shattered.png', bandShattered(CARD)],
    ['back-band-fractured.png', bandFractured(CARD)],
  ];
  for (const [f, band] of backs) jobs.push([f, backWithBand(band, qrUri, '9', 'MINT')]);

  for (const [f, s] of jobs) {
    await sharp(Buffer.from(s)).png().toFile(`${OUT}/${f}`);
    console.log('rendered', f);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
