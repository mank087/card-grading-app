// Renders the five custom label LAYOUT styles and the five GEOMETRIC patterns
// with the Round 3 front treatment applied (logo bottom-centre, grade-coloured
// chip), so every label direction can be reviewed in one document.
//
// Geometry is transcribed from src/lib/customSlabLabelGenerator.ts
// (drawCustomBackground) so these match what the product actually draws --
// same focal point, same stripe angle, same zigzag vertices, same 5x2 grid,
// same rgba(0,0,0,0.9) 2.5px divider strokes. That generator is Canvas-based
// and browser-only, hence the re-implementation in SVG rather than a reuse.
import sharp from 'sharp';
import * as fs from 'fs';

const W = 1400, H = 400;
const OUT = process.argv[2] || '.';
// White mark: these grounds are saturated mid-tones, and the navy logo all
// but disappears on orange. The Heritage fronts keep the navy one on ivory.
const LOGO_URI = `data:image/png;base64,${fs.readFileSync('public/DCM Logo white.png').toString('base64')}`;
const SCALE = Math.min(W, H) / 400;
const DIV = `stroke="rgba(0,0,0,0.9)" stroke-width="${2.5 * SCALE}" fill="none"`;

// A card-derived palette, the way Card Colors would sample a Charizard.
const COLORS = ['#EA580C', '#F59E0B', '#DC2626', '#7C2D12', '#FBBF24'];
const pick = (i: number) => COLORS[i % COLORS.length];

// Grade ramp, same as the Round 3 fronts.
const GRADE = { g: 9, label: 'MINT', fill: '#AFB3B8', ink: '#15171a' };

function gradeChip(x: number): string {
  return `
    <rect x="${x}" y="64" width="240" height="252" rx="28" fill="${GRADE.fill}"/>
    <rect x="${x + 6}" y="70" width="228" height="240" rx="24" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="3"/>
    <text x="${x + 120}" y="238" font-family="Arial, Helvetica, sans-serif" font-size="168" font-weight="bold" fill="${GRADE.ink}" text-anchor="middle">${GRADE.g}</text>
    <text x="${x + 120}" y="292" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" letter-spacing="4" fill="${GRADE.ink}" opacity="0.9" text-anchor="middle">${GRADE.label}</text>`;
}

// White type with a dark halo — the same trick strokeText() uses in the
// generator, because these backgrounds are far too busy for flat text.
function overlay(): string {
  const halo = `stroke="rgba(0,0,0,0.55)" stroke-width="7" paint-order="stroke fill"`;
  const w = 200, h = 78;
  return `
    <text x="70" y="132" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="#ffffff" ${halo}>Charizard ex</text>
    <text x="72" y="196" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="4" fill="#ffffff" opacity="0.95" stroke="rgba(0,0,0,0.5)" stroke-width="5" paint-order="stroke fill">OBSIDIAN FLAMES · SAR · #234/197 · 2023</text>
    <text x="72" y="286" font-family="Courier New, monospace" font-size="34" letter-spacing="4" fill="#ffffff" opacity="0.9" stroke="rgba(0,0,0,0.5)" stroke-width="5" paint-order="stroke fill">DCM 773412</text>
    ${gradeChip(1130)}
    <image href="${LOGO_URI}" x="${(W - w) / 2}" y="${H - h - 10}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${inner}${overlay()}
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>
</svg>`;

// ── Layout styles ───────────────────────────────────────────────────────────
const styleGradient = svg(`
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${COLORS[0]}"/><stop offset="1" stop-color="${COLORS[3]}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>`);

const styleExtension = svg(`
  <defs>
    <linearGradient id="ext" x1="0" y1="0" x2="1" y2="0">
      ${COLORS.map((c, i) => `<stop offset="${i / (COLORS.length - 1)}" stop-color="${c}"/>`).join('')}
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.25)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ext)"/>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>`);

const styleNeon = svg(`
  <defs><radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.6" stop-color="${COLORS[0]}" stop-opacity="0"/>
    <stop offset="1" stop-color="${COLORS[0]}" stop-opacity="0.2"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="10" fill="none" stroke="${COLORS[0]}" stroke-width="8" opacity="0.95"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="10" fill="none" stroke="${COLORS[1]}" stroke-width="18" opacity="0.28"/>`);

const styleSplit = svg(`
  <defs><linearGradient id="sp" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${COLORS[0]}"/><stop offset="0.45" stop-color="${COLORS[0]}"/>
    <stop offset="0.55" stop-color="${COLORS[3]}"/><stop offset="1" stop-color="${COLORS[3]}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sp)"/>`);

// ── Geometric pattern 0: Shattered Glass ────────────────────────────────────
const shattered = (() => {
  const cx = W * 0.35, cy = H * 0.4;
  const pts: [number, number][] = [
    [0, 0], [W * 0.33, 0], [W * 0.66, 0], [W, 0],
    [W, H * 0.5], [W, H], [W * 0.66, H], [W * 0.33, H], [0, H], [0, H * 0.5],
  ];
  let fills = '', strokes = '';
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const d = `M ${cx} ${cy} L ${ax} ${ay} L ${bx} ${by} Z`;
    fills += `<path d="${d}" fill="${pick(i)}"/>`;
    strokes += `<path d="${d}" ${DIV}/>`;
  }
  return svg(fills + strokes);
})();

// ── Geometric pattern 1: Diagonal Stripes (7 bands at 30deg) ────────────────
const stripes = (() => {
  const n = 7, bandW = W / n, skew = H * Math.tan(30 * Math.PI / 180);
  let fills = '', strokes = '';
  for (let i = -1; i <= n; i++) {
    const x0 = i * bandW;
    fills += `<path d="M ${x0 - skew} 0 L ${x0 + bandW - skew} 0 L ${x0 + bandW} ${H} L ${x0} ${H} Z" fill="${pick(i + 1)}"/>`;
  }
  for (let i = 0; i <= n; i++) {
    const x0 = i * bandW;
    strokes += `<path d="M ${x0 - skew} 0 L ${x0} ${H}" ${DIV}/>`;
  }
  return svg(`<g clip-path="url(#clipAll)">${fills}${strokes}</g>
    <defs><clipPath id="clipAll"><rect width="${W}" height="${H}"/></clipPath></defs>`);
})();

// ── Geometric pattern 2: Fractured (5 unique regions) ───────────────────────
const fractured = (() => {
  // The generator guarantees 5 distinct colours, nudging any repeat by +/-30.
  const c5: string[] = [];
  for (let i = 0; i < 5; i++) {
    const c = COLORS[i % COLORS.length];
    if (c5.includes(c)) {
      const [r, g, b] = [1, 3, 5].map(o => parseInt(c.slice(o, o + 2), 16));
      const adj = i % 2 === 0 ? 30 : -30;
      c5.push('#' + [r, g, b].map(v => Math.max(0, Math.min(255, v + adj)).toString(16).padStart(2, '0')).join(''));
    } else c5.push(c);
  }
  const d1x = W * 0.12, d2x = W * 0.38, d3x = W * 0.62, hY = H * 0.45;
  const regions = [
    `M 0 0 L ${d1x} 0 L ${d1x + W * 0.08} ${H} L 0 ${H} Z`,
    `M ${d1x} 0 L ${d2x} 0 L ${d2x + W * 0.05} ${H} L ${d1x + W * 0.08} ${H} Z`,
    `M ${d2x} 0 L ${d3x} 0 L ${d3x - W * 0.03} ${H} L ${d2x + W * 0.05} ${H} Z`,
    `M ${d3x} 0 L ${W} 0 L ${W} ${hY} L ${d3x - W * 0.01} ${hY} Z`,
    `M ${d3x - W * 0.01} ${hY} L ${W} ${hY} L ${W} ${H} L ${d3x - W * 0.03} ${H} Z`,
  ];
  const dividers = [
    `M ${d1x} 0 L ${d1x + W * 0.08} ${H}`,
    `M ${d2x} 0 L ${d2x + W * 0.05} ${H}`,
    `M ${d3x} 0 L ${d3x - W * 0.03} ${H}`,
    `M ${d3x - W * 0.01} ${hY} L ${W} ${hY}`,
  ];
  return svg(
    regions.map((d, i) => `<path d="${d}" fill="${c5[i]}"/>`).join('') +
    dividers.map(d => `<path d="${d}" ${DIV}/>`).join('')
  );
})();

// ── Geometric pattern 3: Mosaic Grid (5 x 2) ────────────────────────────────
const mosaic = (() => {
  const cols = 5, rows = 2, tw = W / cols, th = H / rows;
  let cells = '', lines = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells += `<rect x="${c * tw}" y="${r * th}" width="${tw}" height="${th}" fill="${pick(r * cols + c)}"/>`;
  for (let c = 1; c < cols; c++) lines += `<path d="M ${c * tw} 0 L ${c * tw} ${H}" ${DIV}/>`;
  for (let r = 1; r < rows; r++) lines += `<path d="M 0 ${r * th} L ${W} ${r * th}" ${DIV}/>`;
  return svg(cells + lines);
})();

// ── Geometric pattern 4: Lightning Bolt ─────────────────────────────────────
const lightning = (() => {
  const z: [number, number][] = [
    [W * 0.3, 0], [W * 0.55, H * 0.3], [W * 0.35, H * 0.45], [W * 0.65, H * 0.7], [W * 0.5, H],
  ];
  const zig = z.map(([x, y]) => `L ${x} ${y}`).join(' ');
  const left = `M 0 0 L ${z[0][0]} ${z[0][1]} ${zig} L 0 ${H} Z`;
  const right = `M ${W} 0 L ${z[0][0]} ${z[0][1]} ${zig} L ${W} ${H} Z`;
  return svg(
    `<rect width="${W}" height="${H}" fill="${pick(0)}"/>` +
    `<path d="${left}" fill="${pick(0)}"/><path d="${right}" fill="${pick(1)}"/>` +
    `<path d="M ${z[0][0]} ${z[0][1]} ${zig}" ${DIV}/>`
  );
})();

async function main() {
  const jobs: Array<[string, string]> = [
    ['cs-gradient.png', styleGradient],
    ['cs-extension.png', styleExtension],
    ['cs-neon.png', styleNeon],
    ['cs-split.png', styleSplit],
    ['cs-geo-shattered.png', shattered],
    ['cs-geo-stripes.png', stripes],
    ['cs-geo-fractured.png', fractured],
    ['cs-geo-mosaic.png', mosaic],
    ['cs-geo-lightning.png', lightning],
  ];
  for (const [file, s] of jobs) {
    await sharp(Buffer.from(s)).png().toFile(`${OUT}/${file}`);
    console.log('rendered', file);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
