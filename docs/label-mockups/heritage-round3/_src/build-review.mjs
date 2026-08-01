// Builds the Round 3 review page, matching the Heritage review format:
// self-contained HTML with the PNGs inlined as data URIs so it can be opened
// or emailed without the image folder.
import * as fs from 'fs';

const DIR = process.argv[2] || 'docs/label-mockups/heritage-round3';
const b64 = (f) => `data:image/png;base64,${fs.readFileSync(`${DIR}/${f}`).toString('base64')}`;
const COLORS = JSON.parse(fs.readFileSync(`${DIR}/grade-colors.json`, 'utf8'));

const front = (id, title, tag, img, notes) => `
  <h3>${title}</h3>
  <section class="card">
    <div class="meta"><span class="tag">${tag}</span><span class="dim">${id}</span></div>
    <img src="${img}" alt="${title}">
    <ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>
  </section>`;

const swatches = COLORS.map(c => `
  <tr>
    <td><span class="chip" style="background:${c.fill};color:${c.ink}">${c.grade}</span></td>
    <td><strong>${c.label}</strong></td>
    <td><code>${c.fill}</code></td>
    <td><code>${c.ink}</code></td>
    <td class="dim">${c.note}</td>
  </tr>`).join('');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DCM Label Redesign — Round 3</title>
<style>
  :root { --ink:#141414; --soft:#5a5a5a; --gold:#a67c1b; --line:#e5decf; --bg:#faf8f4; }
  * { box-sizing:border-box; }
  body { margin:0; padding:56px 24px 96px; background:var(--bg); color:var(--ink);
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; }
  .eyebrow { color:var(--gold); font-size:12px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; margin:0 0 10px; }
  h1 { font-family:Georgia,serif; font-size:38px; margin:0 0 14px; }
  h2 { font-family:Georgia,serif; font-size:26px; margin:56px 0 6px; padding-top:28px; border-top:1px solid var(--line); }
  h3 { font-family:Georgia,serif; font-size:21px; margin:34px 0 12px; }
  .lede { color:var(--soft); max-width:70ch; margin:0 0 8px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px; margin:0 0 8px; }
  .card img { width:100%; height:auto; display:block; border-radius:6px; }
  .meta { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px; flex-wrap:wrap; }
  .tag { background:#f3ecdc; color:#7a5a12; font-size:11px; font-weight:700; letter-spacing:1.4px;
         text-transform:uppercase; padding:5px 11px; border-radius:20px; }
  .dim { color:#8a8a8a; font-size:13px; }
  ul { margin:14px 0 0; padding-left:20px; color:#3a3a3a; font-size:14.5px; }
  li { margin:5px 0; }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:11px 14px; border-bottom:1px solid #f0ebe0; font-size:14px; vertical-align:middle; }
  th { background:#f7f2e8; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#7a5a12; }
  tr:last-child td { border-bottom:none; }
  code { font-family:"SF Mono",Consolas,monospace; font-size:12.5px; background:#f5f1e8; padding:2px 6px; border-radius:4px; }
  .chip { display:inline-flex; align-items:center; justify-content:center; width:52px; height:40px;
          border-radius:9px; font-weight:800; font-size:20px; }
  .changed { background:#fff; border-left:3px solid var(--gold); padding:14px 18px; margin:18px 0; border-radius:0 8px 8px 0; }
  .changed ul { margin:8px 0 0; }
  .q { background:#fffdf5; border:1px solid #efe2c0; border-radius:10px; padding:16px 20px; margin-top:14px; }
</style></head>
<body><div class="wrap">

<p class="eyebrow">Label redesign · Round 3 · For review</p>
<h1>Round 1 cleaned up, band variants, and every custom style</h1>
<p class="lede">Same three front variants as Round 1. Everything below is your Aug 1 list applied:
logo moved to the bottom centre, grade chip colour-coded by grade, and the back rebuilt around the
QR. Still exact 2.8&Prime; &times; 0.8&Prime;, 500 DPI, inside the Round 1 print-safe spec.</p>

<div class="changed">
  <strong>What changed from Round 1</strong>
  <ul>
    <li><strong>Front:</strong> logo moved from the inline right position to bottom centre, hugging the edge.</li>
    <li><strong>Front:</strong> the grade chip is no longer tinted per variant &mdash; it is now driven by the grade itself.</li>
    <li><strong>Back:</strong> grade and condition centred; serial removed; separate logo removed;
        &ldquo;SCAN TO VERIFY&rdquo; removed; QR now carries the DCM mark; sub-grades right-aligned;
        emblems rotated to match the current production label.</li>
  </ul>
</div>

<h2>Fronts</h2>
<p class="lede">Each is shown at a different grade so you can see the chip colour in place rather than
only on the swatch sheet.</p>

${front('r3-a-base.png', 'Front A — Base (brand purple)', 'closest to current', b64('r3-a-base.png'), [
  'Grade 9 &rarr; silver chip with dark ink. Silver and gold both fail white-text contrast, so those two carry dark type.',
  'Logo centred on the label, not on the text block, so it stays centred regardless of how long the card name runs.',
])}

${front('r3-b-cardcolors.png', 'Front B — Card colours', 'band drawn from the card art', b64('r3-b-cardcolors.png'), [
  'Grade 8 &rarr; blue chip. The band still samples the card, but the chip no longer competes with it.',
  'This is the variant where separating band colour from grade colour helps most &mdash; previously both moved at once.',
])}

${front('r3-c-pattern.png', 'Front C — Mosaic pattern', 'most decorative', b64('r3-c-pattern.png'), [
  'Grade 10 &rarr; gold chip. On this variant the gold chip and the gold hairline now agree by design.',
  'Two-digit 10 is set slightly smaller so it occupies the same optical width as a single digit.',
])}

<h2>Band variants</h2>
<p class="lede">The same idea as Front C, generalised: the design lives <strong>only in the left band</strong>
and the field stays ivory. You get the decoration without paying for it in legibility, because the card
name never sits on a pattern and needs no halo.</p>
<p class="lede">The patterns are the same five, but re-cut for a 90&times;400 strip rather than a
1400&times;400 landscape. A 5&times;2 mosaic or a 7-band 30&deg; stripe set means nothing in a strip that
narrow, so each is re-proportioned to the aspect it actually has to live in. Divider strokes are thinner
too &mdash; 2.5px reads as a hairline across a full label and as a fat rule inside a band.</p>

${[
  ['band-gradient.png',  'Gradient',        'quietest', 'Vertical multi-stop through the sampled palette. The safest of the set and the closest to Round 1 variant A.'],
  ['band-split.png',     'Split',           'two-colour cards', 'Hard stack, no blend. Built for team or dual-colour cards.'],
  ['band-mosaic.png',    'Mosaic tiles',    '2 × 9 tiles', 'Flat tiles, no gradients anywhere, so nothing to band on a cheap printer. Closest in spirit to the Round 1 variant C you liked.'],
  ['band-stripes.png',   'Diagonal stripes','45° across the strip', 'Sheared to 45° rather than 30° — across 90px, a 30° stripe barely leaves the edge it started on.'],
  ['band-lightning.png', 'Lightning bolt',  'most brand-forward', 'A single zigzag running the height of the band. Works far better here than full-bleed, where it fought the card name.'],
  ['band-shattered.png', 'Shattered glass', 'busiest', 'Ten shards from a focal point at 45% / 38%. The most detailed, and the one most likely to lose definition at 500 DPI on matte stock.'],
  ['band-fractured.png', 'Fractured',       'five regions', 'Five stacked regions with angled cuts. Reads as geological strata in a strip, which is a different feel from the full-bleed version.'],
].map(([f, name, tag, note]) => `
  <section class="card">
    <div class="meta"><span class="tag">${tag}</span><span class="dim">${name}</span></div>
    <img src="${b64(f)}" alt="${name}">
    <ul><li>${note}</li></ul>
  </section>`).join('')}

<h3>Same treatments on the brand palette</h3>
<p class="lede">To show the band carries either source: sampled card colours above, DCM purple here.
These also run a grade 10, so you can see the gold chip against a purple band.</p>
${[
  ['band-gradient-brand.png',  'Gradient — brand'],
  ['band-mosaic-brand.png',    'Mosaic — brand'],
  ['band-lightning-brand.png', 'Lightning — brand'],
].map(([f, name]) => `
  <section class="card">
    <div class="meta"><span class="tag">brand palette</span><span class="dim">${name}</span></div>
    <img src="${b64(f)}" alt="${name}">
  </section>`).join('')}

<div class="q">
  <strong>Why I think this is the stronger direction</strong>
  <ul>
    <li><strong>Nothing needs a halo.</strong> Every full-bleed custom style needs stroked type to stay
        readable. Band variants keep the ivory field, so the type is flat black on near-white and the
        logo can stay navy &mdash; no polarity switching, no per-style special-casing.</li>
    <li><strong>The pattern survives the shrink better than the type would.</strong> At 2.8&Prime; wide the
        card name is the thing that has to stay crisp; confining decoration to 6% of the width protects it.</li>
    <li><strong>One variable to tune, not two.</strong> Band pattern and grade colour are independent, so
        a customer picking a wild band can never make the grade unreadable.</li>
    <li><strong>The trade:</strong> far less visual impact at arm's length than a full-bleed Lightning or
        Mosaic. If the goal is a slab that shouts across a case, the full-bleed set wins; if it is a slab
        that reads as graded and professional, this does.</li>
  </ul>
</div>

<h2>Back</h2>
<section class="card">
  <div class="meta"><span class="tag">All six changes applied</span><span class="dim">r3-back.png</span></div>
  <img src="${b64('r3-back.png')}" alt="Round 3 back label">
  <ul>
    <li><strong>QR carries the DCM mark</strong> in a white knockout, replacing the separate logo. Generated at error-correction level H, which is what allows a centre punch-out without breaking scanning.</li>
    <li><strong>Serial removed.</strong> The QR encodes <code>/verify/580976</code>, so the number was duplicated.</li>
    <li><strong>Grade + condition centred</strong> in the space between the QR block and the sub-grades.</li>
    <li><strong>&ldquo;SCAN TO VERIFY&rdquo; dropped</strong>; the URL alone remains under the grade.</li>
    <li><strong>Sub-grades right-aligned</strong> as &ldquo;Centering: 9&rdquo; etc., matching <code>ModernBackLabel</code>.</li>
    <li><strong>Emblems rotated 90&deg; counter-clockwise</strong>, symbol on top, word reading bottom-to-top. All three shown together to prove they fit; in practice most cards show none or one.</li>
  </ul>
</section>

<h3>Backs with the same bands</h3>
<p class="lede">Each back carries the band treatment of its front, so a slab can be judged as a matched
pair rather than two unrelated faces. Everything else is the Round 3 back unchanged &mdash; QR with the
mark, rotated emblems, centred grade, right-aligned sub-grades.</p>
${[
  ['back-band-gradient.png',  'Gradient'],
  ['back-band-split.png',     'Split'],
  ['back-band-mosaic.png',    'Mosaic tiles'],
  ['back-band-stripes.png',   'Diagonal stripes'],
  ['back-band-lightning.png', 'Lightning bolt'],
  ['back-band-shattered.png', 'Shattered glass'],
  ['back-band-fractured.png', 'Fractured'],
].map(([f, name]) => `
  <section class="card">
    <div class="meta"><span class="tag">back</span><span class="dim">${name}</span></div>
    <img src="${b64(f)}" alt="Back — ${name}">
  </section>`).join('')}

<h2>Grade colour ramp</h2>
<p class="lede">10, 9 and 8 are yours. 7 through 1 are my suggestion. The ordering principle is that
<strong>adjacent grades must never look alike</strong> &mdash; nobody confuses a 10 with a 4, they confuse
an 8 with a 7. So the ramp runs precious metals &rarr; cool &rarr; warm &rarr; dark, and each step
changes hue or lightness enough to survive a glance across a table.</p>
<section class="card"><img src="${b64('r3-grade-ramp.png')}" alt="Grade colour ramp"></section>
<table>
  <tr><th>Chip</th><th>Label</th><th>Fill</th><th>Ink</th><th>Why</th></tr>
  ${swatches}
</table>

<div class="q">
  <strong>Two things worth deciding before these get hard-coded</strong>
  <ul>
    <li><strong>Ink colour is functional, not decoration.</strong> White on gold (#C8A02C) lands around
        2.4:1 contrast and white on silver is worse &mdash; both fail WCAG badly and look muddy in print.
        10 and 9 carry dark ink; 8 down carry white. If you want white everywhere for consistency,
        gold and silver have to darken enough that they stop reading as metals.</li>
    <li><strong>1 is charcoal, not red.</strong> Running 3&ndash;2&ndash;1 as red&ndash;darker red&ndash;darkest red
        makes the bottom three mush together. Charcoal lets a 1 read as &ldquo;off the scale&rdquo;
        rather than &ldquo;a slightly worse 2&rdquo;. Easy to change if you would rather it stay in the red family.</li>
  </ul>
</div>

<h2>Custom label styles</h2>
<p class="lede">These already exist in the product &mdash; the five layout styles and five geometric
patterns a customer picks in Label Studio. They are shown here with the <strong>Round 3 front treatment
applied</strong> (logo bottom centre, grade-coloured chip) so you can judge the whole system in one place
rather than two. Geometry is transcribed from <code>customSlabLabelGenerator.ts</code>: same focal point,
same 30&deg; stripe angle, same zigzag vertices, same 5&times;2 grid, same divider strokes.</p>
<p class="lede">All ten use one sampled palette (a Charizard-style orange set) so the differences you see
are the <em>style</em>, not the colours.</p>

<h3>Layout styles</h3>
${[
  ['cs-gradient.png',  'Gradient',  'color-gradient', 'Primary to secondary, corner to corner. The quietest of the five and the safest with long card names.'],
  ['cs-extension.png', 'Extension', 'card-extension', 'Multi-stop gradient sampled from the card’s top edge, so the label reads as a continuation of the card. Carries a bottom darkening pass for depth.'],
  ['cs-neon.png',      'Neon',      'neon-outline',   'Near-black ground with a glowing rule in the card colour. The only style where the grade chip is the brightest thing on the label.'],
  ['cs-split.png',     'Split',     'team-colors',    'Hard left/right split with a narrow blend at 45–55%. Built for two-colour team cards.'],
].map(([f, name, id, note]) => `
  <section class="card">
    <div class="meta"><span class="tag">${name}</span><span class="dim">${id}</span></div>
    <img src="${b64(f)}" alt="${name}">
    <ul><li>${note}</li></ul>
  </section>`).join('')}

<h3>Geometric patterns</h3>
<p class="lede">All five sit under the single <code>geometric</code> layout, selected by
<code>geometricPattern</code> 0&ndash;4.</p>
${[
  ['cs-geo-shattered.png', 'Shattered Glass', '0', 'Ten triangular shards radiating from a focal point at 35% / 40%. The busiest of the five; the type halo is doing real work here.'],
  ['cs-geo-stripes.png',   'Diagonal Stripes', '1', 'Seven bands skewed 30&deg;. Reads cleanly at slab distance because the bands are wider than the type.'],
  ['cs-geo-fractured.png', 'Fractured', '2', 'Five regions from three angled dividers plus one horizontal. The generator forces five distinct colours, nudging any repeat by &plusmn;30 per channel.'],
  ['cs-geo-mosaic.png',    'Mosaic Grid', '3', 'Flat 5&times;2 tiles. The most print-predictable of the patterns &mdash; no gradients at all, so no banding risk.'],
  ['cs-geo-lightning.png', 'Lightning Bolt', '4', 'A single zigzag splitting the label into two fills. The most brand-forward and the one that fights the card name most.'],
].map(([f, name, idx, note]) => `
  <section class="card">
    <div class="meta"><span class="tag">${name}</span><span class="dim">geometricPattern: ${idx}</span></div>
    <img src="${b64(f)}" alt="${name}">
    <ul><li>${note}</li></ul>
  </section>`).join('')}

<div class="q">
  <strong>What the side-by-side makes obvious</strong>
  <ul>
    <li><strong>The grade chip works everywhere, the logo does not.</strong> The navy mark vanishes on
        saturated orange, so these render the white mark; the Heritage fronts keep navy on ivory. If the
        bottom-centre logo is adopted, it needs to switch on background lightness &mdash; one more thing
        the polarity helper should own rather than each style deciding.</li>
    <li><strong>Every custom style needs the type halo</strong> to stay legible. The Heritage fronts do
        not, because ivory gives flat contrast for free. That is an argument for Heritage as the default
        and custom as the opt-in, not the reverse.</li>
    <li><strong>Mosaic and Split are the only two with no gradients at all</strong>, which makes them the
        least likely to band on a cheap printer.</li>
  </ul>
</div>

<h2>Not done yet</h2>
<p class="lede">These are mockups rendered by a script, not the production renderer. Before any of this
ships, the grade colour has to come out of the code: it is currently <strong>hard-coded purple in seven
files</strong>, which is the blocker flagged in the Label Studio review. That cleanup is the real work
behind the colour ramp &mdash; the palette itself is the easy part.</p>

</div></body></html>`;

fs.writeFileSync(`${DIR}/round3-review.html`, html);
console.log(`wrote ${DIR}/round3-review.html (${(html.length / 1024).toFixed(0)} KB)`);
