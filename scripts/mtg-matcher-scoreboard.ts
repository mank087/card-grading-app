// Offline MTG matcher scoreboard: run lookupMtgCard on saved identities (no model calls).
import fs from 'fs';
import { lookupMtgCard } from '../src/lib/mtgCardMatcher';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as any[];
const tag = process.argv[3];
(async () => {
  const out: any[] = [];
  for (const r of rows) {
    const i = r.info || {};
    const res: any = await lookupMtgCard({ card_name: i.card_name || r.card_name || undefined, expansion_code: i.expansion_code || undefined, card_number: i.card_number_raw || i.card_number || r.card_number || undefined, set_name: i.set_name || r.card_set || undefined }).catch(e => ({ card: null, confidence: { overallConfidence: 'error', warnings: [String(e?.message || e)] } }));
    const c = res?.card;
    out.push({ id: r.id, serial: r.serial, name: i.card_name || r.card_name, set_in: i.set_name || r.card_set, num_in: i.card_number_raw || i.card_number || r.card_number, linked_before: r.mtg_card_id, pick: c ? { id: c.id, name: c.name, set: c.set_name, code: c.set_code, number: c.collector_number, border: c.border_color, foil: c.foil, nonfoil: c.nonfoil, year: String(c.released_at || '').slice(0, 4) } : null, confidence: res?.confidence?.overallConfidence ?? null, warnings: res?.confidence?.warnings ?? [] });
  }
  fs.writeFileSync(process.argv[2].replace(/\.json$/, `.${tag}.json`), JSON.stringify(out, null, 1));
  const linked = out.filter(o => o.pick && o.confidence !== 'low').length;
  console.log(`${tag}: ${out.length} cards, matcher links ${linked} (${Math.round(100 * linked / out.length)}%)`);
})();
