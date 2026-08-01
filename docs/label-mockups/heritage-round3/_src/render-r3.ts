// DCM Heritage label mockups — ROUND 3.
// Same three front variants as Round 1, reworked to the Aug 1 notes:
//   front: logo moved to bottom-centre (hugging the edge); grade chip is now
//          colour-coded by grade rather than by variant.
//   back:  grade + condition centred; serial removed (the QR carries it);
//          logo replaced by a QR with the DCM mark in the middle; the
//          "SCAN TO VERIFY" line dropped; sub-grades right-aligned as on the
//          current production label; VIP / Card Lover / Founder emblems
//          rotated 90 deg counter-clockwise with the symbol on top, matching
//          ModernBackLabel.
// 2.8" x 0.8" at 500dpi -> 1400 x 400 px.
import sharp from 'sharp';
import * as fs from 'fs';
import QRCode from 'qrcode';

const W = 1400, H = 400;
const OUT = process.argv[2] || '.';
const LOGO_URI = `data:image/png;base64,${fs.readFileSync('public/DCM-logo.png').toString('base64')}`;

const IVORY = '#faf8f4';
const INK = '#141414';
const INK_SOFT = '#5a5a5a';
const GOLD = '#a67c1b';

// ── Grade colour ramp ───────────────────────────────────────────────────────
// 10/9/8 are fixed by you (gold / silver / blue). 7-1 continue the idea: a
// controlled cool-to-warm-to-dark descent so quality reads at slab distance
// without any two ADJACENT grades looking alike, which is the failure mode
// that matters -- nobody confuses a 10 with a 4, they confuse an 8 with a 7.
//
// `ink` is the text colour, not decoration: white on gold or silver fails
// WCAG contrast badly, so those two carry dark text. Everything from 8 down is
// dark enough for white. Same polarity rule already shipped in Label Lab.
interface GradeColor { grade: number; label: string; fill: string; ink: string; note: string }
const GRADE_COLORS: GradeColor[] = [
  { grade: 10, label: 'GEM MINT',  fill: '#C8A02C', ink: '#1a1206', note: 'gold — locked' },
  { grade: 9,  label: 'MINT',      fill: '#AFB3B8', ink: '#15171a', note: 'silver — locked' },
  { grade: 8,  label: 'NM-MINT',   fill: '#1D4ED8', ink: '#ffffff', note: 'blue — locked' },
  { grade: 7,  label: 'NEAR MINT', fill: '#0E7490', ink: '#ffffff', note: 'teal — cool, clearly not the 8 blue' },
  { grade: 6,  label: 'EX-NM',     fill: '#15803D', ink: '#ffffff', note: 'green — last of the "good" band' },
  { grade: 5,  label: 'EXCELLENT', fill: '#A16207', ink: '#ffffff', note: 'dark amber — the turn into warm' },
  { grade: 4,  label: 'VG-EX',     fill: '#EA580C', ink: '#ffffff', note: 'bright orange — pulled away from 5' },
  { grade: 3,  label: 'VERY GOOD', fill: '#DC2626', ink: '#ffffff', note: 'true red — separates from the orange above and maroon below' },
  { grade: 2,  label: 'GOOD',      fill: '#7F1D1D', ink: '#ffffff', note: 'dark maroon — separated from 3 by lightness, not hue' },
  { grade: 1,  label: 'POOR',      fill: '#3F3F46', ink: '#ffffff', note: 'charcoal — deliberately not red, so 1 reads as "no colour left" rather than "very bad 2"' },
];
const gc = (g: number) => GRADE_COLORS.find(c => c.grade === g)!;

// ── Front pieces ────────────────────────────────────────────────────────────
function gradeChip(x: number, grade: number): string {
  const c = gc(grade);
  const isBig = String(grade).length > 1;
  return `
    <rect x="${x}" y="64" width="240" height="252" rx="28" fill="${c.fill}"/>
    <rect x="${x + 6}" y="70" width="228" height="240" rx="24" fill="none" stroke="${c.ink === '#ffffff' ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)'}" stroke-width="3"/>
    <text x="${x + 120}" y="${isBig ? 236 : 238}" font-family="Arial, Helvetica, sans-serif" font-size="${isBig ? 150 : 168}" font-weight="bold" fill="${c.ink}" text-anchor="middle">${grade}</text>
    <text x="${x + 120}" y="292" font-family="Arial, Helvetica, sans-serif" font-size="${c.label.length > 8 ? 26 : 30}" font-weight="bold" letter-spacing="4" fill="${c.ink}" opacity="0.9" text-anchor="middle">${c.label}</text>`;
}

// Logo hugging the bottom edge, centred on the label.
function bottomLogo(): string {
  const w = 200, h = 78;
  return `<image href="${LOGO_URI}" x="${(W - w) / 2}" y="${H - h - 10}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

function textBlock(name: string, context: string, serial: string): string {
  return `
    <text x="150" y="132" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="${INK}">${name}</text>
    <text x="150" y="198" font-family="Arial, Helvetica, sans-serif" font-size="29" letter-spacing="4" fill="${INK_SOFT}">${context}</text>
    <line x1="150" y1="236" x2="1090" y2="236" stroke="#d9d2c4" stroke-width="2"/>
    <text x="150" y="292" font-family="Courier New, monospace" font-size="36" letter-spacing="4" fill="${INK_SOFT}">DCM ${serial}</text>`;
}

const frame = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  ${inner}
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#e5decf" stroke-width="2"/>
</svg>`;

// ── Variant A: brand purple band ────────────────────────────────────────────
const variantA = frame(`
  <defs><linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4c1d95"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="90" height="${H}" fill="url(#band)"/>
  <rect x="90" y="0" width="6" height="${H}" fill="${GOLD}" opacity="0.85"/>
  ${textBlock('Mega Sharpedo EX', 'PHANTASMAL FLAMES · FULL ART · #127/094 · 2025', '580976')}
  ${gradeChip(1130, 9)}
  ${bottomLogo()}
`);

// ── Variant B: card-colour band ─────────────────────────────────────────────
const variantB = frame(`
  <defs><linearGradient id="cardband" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d9488"/><stop offset="0.55" stop-color="#155e75"/><stop offset="1" stop-color="#ea580c"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="90" height="${H}" fill="url(#cardband)"/>
  <rect x="90" y="0" width="6" height="${H}" fill="#155e75" opacity="0.6"/>
  ${textBlock('Charizard ex', 'OBSIDIAN FLAMES · SAR · #234/197 · 2023', '773412')}
  ${gradeChip(1130, 8)}
  ${bottomLogo()}
`);

// ── Variant C: mosaic pattern band ──────────────────────────────────────────
const diamonds = (() => {
  let d = ''; const size = 45;
  for (let row = 0; row < Math.ceil(H / size) + 1; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = 22.5 + col * size, cy = row * size;
      const tone = (row + col) % 2 === 0 ? '#7c3aed' : '#4c1d95';
      d += `<rect x="${cx - 16}" y="${cy - 16}" width="32" height="32" fill="${tone}" transform="rotate(45 ${cx} ${cy})"/>`;
    }
  }
  return d;
})();
const variantC = frame(`
  <rect x="0" y="0" width="90" height="${H}" fill="#2e1065"/>
  <g opacity="0.9">${diamonds}</g>
  <rect x="90" y="0" width="6" height="${H}" fill="${GOLD}"/>
  ${textBlock('Jaxson Dart', 'TOPPS CHROME · REFRACTOR RC · #74 · 2025', '412117')}
  ${gradeChip(1130, 10)}
  ${bottomLogo()}
`);

// ── Emblem: symbol on top, word rotated 90deg CCW (matches ModernBackLabel) ──
function emblem(x: number, symbol: string, word: string, color: string): string {
  // text-anchor="end" with rotate(-90) pins the LAST character at the origin.
  // Rotated CCW the last character sits at the top, so every word starts flush
  // under its symbol and grows downward. Anchoring the other end instead
  // bottom-aligns them and the tops come out ragged, because "VIP" and
  // "CARD LOVER" are wildly different lengths.
  return `
    <text x="${x}" y="88" font-family="Arial, Helvetica, sans-serif" font-size="46" fill="${color}" text-anchor="middle">${symbol}</text>
    <text transform="translate(${x + 13} 122) rotate(-90)" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="bold" letter-spacing="3" fill="${color}">${word}</text>`;
}

// ── Back ────────────────────────────────────────────────────────────────────
function backLabel(qrUri: string): string {
  return frame(`
    <defs><linearGradient id="bandback" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#4c1d95"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="90" height="${H}" fill="url(#bandback)"/>
    <rect x="90" y="0" width="6" height="${H}" fill="${GOLD}" opacity="0.85"/>

    <!-- QR with the DCM mark in the middle; replaces the separate logo. -->
    <rect x="132" y="52" width="296" height="296" fill="#ffffff" stroke="#d9d2c4" stroke-width="2"/>
    <image href="${qrUri}" x="140" y="60" width="280" height="280"/>

    <!-- Emblems: symbol on top, word reading bottom-to-top. -->
    ${emblem(486, '&#9733;', 'FOUNDER', '#b45309')}
    ${emblem(560, '&#9829;', 'CARD LOVER', '#be185d')}
    ${emblem(634, '&#9670;', 'VIP', '#4f46e5')}

    <!-- Grade + condition, centred. No serial: the QR carries it. -->
    <text x="880" y="212" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="bold" fill="${INK}" text-anchor="middle">9</text>
    <text x="880" y="266" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" letter-spacing="7" fill="${INK}" text-anchor="middle">MINT</text>
    <text x="880" y="332" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="3" fill="${GOLD}" text-anchor="middle">DCMGRADING.COM/VERIFY</text>

    <!-- Sub-grades, right-aligned, as on the current production label. -->
    <text x="1330" y="118" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="1" fill="${INK_SOFT}" text-anchor="end">Centering: 9</text>
    <text x="1330" y="182" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="1" fill="${INK_SOFT}" text-anchor="end">Corners: 9</text>
    <text x="1330" y="246" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="1" fill="${INK_SOFT}" text-anchor="end">Edges: 10</text>
    <text x="1330" y="310" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="1" fill="${INK_SOFT}" text-anchor="end">Surface: 10</text>
  `);
}

// ── Grade colour ramp reference sheet ───────────────────────────────────────
function rampSheet(): string {
  const cols = 5, cw = 268, ch = 210, padX = 30, padY = 90;
  let cells = '';
  GRADE_COLORS.forEach((c, i) => {
    const x = padX + (i % cols) * cw, y = padY + Math.floor(i / cols) * ch;
    const big = String(c.grade).length > 1;
    cells += `
      <rect x="${x}" y="${y}" width="232" height="164" rx="24" fill="${c.fill}"/>
      <rect x="${x + 6}" y="${y + 6}" width="220" height="152" rx="20" fill="none" stroke="${c.ink === '#ffffff' ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)'}" stroke-width="3"/>
      <text x="${x + 116}" y="${y + 106}" font-family="Arial, Helvetica, sans-serif" font-size="${big ? 88 : 96}" font-weight="bold" fill="${c.ink}" text-anchor="middle">${c.grade}</text>
      <text x="${x + 116}" y="${y + 142}" font-family="Arial, Helvetica, sans-serif" font-size="${c.label.length > 8 ? 20 : 23}" font-weight="bold" letter-spacing="3" fill="${c.ink}" opacity="0.9" text-anchor="middle">${c.label}</text>
      <text x="${x + 116}" y="${y + 190}" font-family="Courier New, monospace" font-size="21" fill="#5a5a5a" text-anchor="middle">${c.fill}</text>`;
  });
  const w = padX * 2 + cols * cw - 36, h = padY + 2 * ch + 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${IVORY}"/>
    <text x="${padX}" y="56" font-family="Georgia, serif" font-size="40" font-weight="bold" fill="${INK}">Grade colour ramp — 10 to 1</text>
    ${cells}
  </svg>`;
}

async function main() {
  // Error correction H: the logo punches a hole in the middle of the QR, and
  // only the highest level survives that with reliable scanning.
  const qrBuf = await QRCode.toBuffer('https://dcmgrading.com/verify/580976', {
    errorCorrectionLevel: 'H', margin: 1, width: 560,
    color: { dark: '#141414', light: '#ffffff' },
  });
  // White knockout behind the mark so the logo never sits on QR modules.
  const mark = await sharp('public/DCM-logo.png').resize(132, 132, { fit: 'inside' }).png().toBuffer();
  const plate = await sharp({ create: { width: 168, height: 168, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
  const qrWithLogo = await sharp(qrBuf).composite([{ input: plate, gravity: 'centre' }]).png().toBuffer();
  const qrUri = `data:image/png;base64,${qrWithLogo.toString('base64')}`;

  const jobs: Array<[string, string]> = [
    ['r3-a-base.png', variantA],
    ['r3-b-cardcolors.png', variantB],
    ['r3-c-pattern.png', variantC],
    ['r3-back.png', backLabel(qrUri)],
    ['r3-grade-ramp.png', rampSheet()],
  ];
  for (const [file, svg] of jobs) {
    await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`);
    console.log('rendered', file);
  }
  fs.writeFileSync(`${OUT}/grade-colors.json`, JSON.stringify(GRADE_COLORS, null, 2));
  console.log('wrote grade-colors.json');
}
main().catch(e => { console.error(e); process.exit(1); });
