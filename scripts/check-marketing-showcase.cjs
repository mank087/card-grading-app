const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'fixtures/marketing-showcase.json');
const source = fs.readFileSync(path.join(root, 'src/lib/cards/marketingShowcase.ts'), 'utf8');
const ids = [...new Set(source.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g))];
const groups = ['1', ...source.matchAll(/^  '([^']+)': \[/gm)].map(value => typeof value === 'string' ? value : value[1]);
const base = process.env.SHOWCASE_BASE_URL || 'http://127.0.0.1:3000';
const fields = ['serial', 'card_name', 'front_path', 'back_path', 'conversational_decimal_grade', 'conversational_whole_grade', 'conversational_condition_label', 'conversational_sub_scores'];
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
(async () => {
  const cards = new Map();
  for (const group of groups) {
    const response = await fetch(`${base}/api/cards/featured?showcase=${group}&limit=50`);
    if (!response.ok) throw new Error(`${group}: HTTP ${response.status}`);
    for (const card of (await response.json()).cards) {
      if (!card.front_url || !card.back_url) throw new Error(`${card.id}: missing photo URL`);
      cards.set(card.id, card);
    }
  }
  const missing = ids.filter(id => !cards.has(id));
  if (missing.length) throw new Error(`Missing, private, or ungraded pinned cards: ${missing.join(', ')}`);
  const crops = [...fs.readFileSync(path.join(root, 'src/components/design/HeritageCard.tsx'), 'utf8').matchAll(/'([0-9]{6})': \{ x:/g)].map(match => match[1]);
  const missingCrops = crops.filter(serial => ![...cards.values()].some(card => String(card.serial) === serial));
  if (missingCrops.length) throw new Error(`Crop serials no longer match pinned cards: ${missingCrops.join(', ')}`);
  const snapshot = Object.fromEntries(ids.sort().map(id => [id, Object.fromEntries(fields.map(field => [field, cards.get(id)[field] ?? null]))]));
  if (process.argv.includes('--write-baseline')) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(stable(snapshot), null, 2) + '\n');
    console.log(`Recorded ${ids.length} pinned cards. Review baseline changes before accepting them.`);
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const changed = [...new Set([...Object.keys(baseline), ...ids])].filter(id => JSON.stringify(stable(baseline[id])) !== JSON.stringify(stable(snapshot[id])));
    if (changed.length) throw new Error(`Pinned card identity, photo, or grade changed; review: ${changed.join(', ')}`);
    console.log(`PASS: ${ids.length} public pinned cards, both photos, unchanged grades, and ${crops.length} crop mappings.`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
