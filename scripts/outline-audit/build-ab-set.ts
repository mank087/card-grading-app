// Build a report-only calibration set (run-zoom-calibration --set format) for the outline A/B.
// Read-only, light columns. IDS=a,b,c npx tsx --env-file=../../.env.local scripts/outline-audit/build-ab-set.ts
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const TYPE: Record<string, string> = { Sports: 'sports', Pokemon: 'pokemon', MTG: 'mtg', Lorcana: 'lorcana', 'One Piece': 'onepiece', 'Yu-Gi-Oh': 'yugioh', 'Star Wars': 'starwars', Other: 'other' };
(async () => {
  const ids = process.env.IDS!.split(',');
  const { data, error } = await sb.from('cards').select('id, category, card_name, front_path, back_path, conversational_whole_grade').in('id', ids);
  if (error) throw error;
  const cards = ids.map(id => data!.find(r => r.id === id)!).map(r => ({
    key: `${String(r.card_name || r.category).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${r.id.slice(0, 4)}`,
    label: r.card_name, cardType: TYPE[r.category] || 'other', card_id: r.id, front_path: r.front_path, back_path: r.back_path,
    engine_grade: r.conversational_whole_grade, expected_grade: r.conversational_whole_grade,
    expected_subgrades: null, expected_limiting: null, false_positive: null, report_only: true,
  }));
  const out = { _readme: 'Card-outline A/B (Oct 12 2026): recent card_relative cards whose stored cq-2 quad was squashed. report_only — no trusted grade; compare arms.', cards };
  fs.writeFileSync(path.join(__dirname, 'ab-set.json'), JSON.stringify(out, null, 1));
  for (const c of cards) console.log(c.key, c.cardType, c.engine_grade);
})().catch(e => { console.error(e); process.exit(1); });
