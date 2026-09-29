// One-off (Sept 29): Pokemon Black Star promo cards stored an invented "of N" in
// their card number ("75/215", "SWSH263/307", "XY124/211"): the catalog gives
// promo sets a printedTotal and older writers appended it. Promos are never
// numbered "of N". This strips the trailing "/N" from cards.card_number and the
// matching conversational_card_info keys (card_number, card_number_raw,
// card_number_text_seen; set_total cleared when it is that same N), then
// regenerates label_data (and original_label_data when non-null).
//
// Scope: non-deleted Pokemon cards whose linked catalog set is a promo set
// (pokemon_api_data->set->>id in svp/swshp/smp/xyp/...), plus UNLINKED cards
// whose card_set names a Black Star Promos set (handled by name). A "/N" is
// stripped only when N is that promo set's catalog printedTotal; with no known
// total (unlinked, name not an exact catalog promo name) only a prefixed promo
// number ("SM190/248") is stripped. Everything else is listed for a human.
//
// Not touched: conversational_grading (the report). Its card_info is the grade
// run snapshot the manual-review RPCs compare against.
//
//   npx tsx scripts/_tmp-fix-promo-card-numbers.ts            # dry run (default)
//   npx tsx scripts/_tmp-fix-promo-card-numbers.ts --apply    # write
import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { generateLabelData, type CardForLabel } from '../src/lib/labelDataGenerator';
import { isPokemonPromoSetId, isPokemonPromoSetName, stripPromoTotal } from '../src/lib/pokemonPromoNumber';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const APPLY = process.argv.includes('--apply');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
const NARROW = [
  'id', 'card_name', 'card_set', 'card_number',
  'set_id:pokemon_api_data->set->>id', 'set_total_cat:pokemon_api_data->set->>printedTotal',
  'cn:conversational_card_info->>card_number', 'raw:conversational_card_info->>card_number_raw',
  'seen:conversational_card_info->>card_number_text_seen', 'st:conversational_card_info->>set_total',
  'lbl:label_data->>formattedCardNumber',
].join(',');
const INFO_KEYS = ['card_number', 'card_number_raw', 'card_number_text_seen'] as const;

async function pages(filter: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await filter(db.from('cards').select(NARROW).eq('category', 'Pokemon').is('deleted_at', null)).order('id').range(from, from + 199);
    if (error) throw error;
    out.push(...data!);
    if (data!.length < 200) return out;
    await sleep(100);
  }
}

(async () => {
  const { data: sets, error: setError } = await db.from('pokemon_sets').select('id,name,printed_total');
  if (setError) throw setError;
  const promoSets = sets!.filter(s => isPokemonPromoSetId(s.id));
  const totalById = new Map(promoSets.map(s => [s.id, s.printed_total]));
  const totalByName = new Map(promoSets.map(s => [squash(s.name), s.printed_total]));

  const linked = await pages(q => q.in('pokemon_api_data->set->>id', promoSets.map(s => s.id)));
  const named = await pages(q => q.ilike('card_set', '%promo%'));
  const rows = new Map<string, any>();
  for (const r of [...linked, ...named]) rows.set(r.id, r);

  const fixes: Array<{ row: any; col: string | null; info: Record<string, string | null>; clearSetTotal: boolean; how: string }> = [];
  const flagged: string[] = [];
  let byName = 0;
  for (const r of rows.values()) {
    let total: number | null | undefined;
    let how: string;
    if (r.set_id && isPokemonPromoSetId(r.set_id)) { total = totalById.get(r.set_id) ?? (r.set_total_cat ? Number(r.set_total_cat) : null); how = r.set_id; }
    else if (r.set_id) {
      if ([r.card_number, r.cn, r.raw].some(v => /\//.test(v || '')) || /\//.test(r.lbl || ''))
        flagged.push(`ODD  ${r.id.slice(0, 8)} ${r.card_name} | set id ${r.set_id} but card_set "${r.card_set}" | #${r.card_number} | label ${r.lbl}`);
      continue;
    } else if (isPokemonPromoSetName(r.card_set)) { total = totalByName.get(squash(r.card_set)) ?? null; how = `name:${total ?? '?'}`; byName++; }
    else {
      if ([r.card_number, r.raw].some(v => /\//.test(v || '')))
        flagged.push(`NAME ${r.id.slice(0, 8)} ${r.card_name} | unlinked, card_set "${r.card_set}" (not a Black Star Promos name) | #${r.card_number}`);
      continue;
    }
    const strip = (v: string | null) => (v == null ? v : stripPromoTotal(v, total));
    const col = strip(r.card_number);
    const info: Record<string, string | null> = {};
    for (const [k, alias] of [['card_number', 'cn'], ['card_number_raw', 'raw'], ['card_number_text_seen', 'seen']] as const) {
      const next = strip(r[alias]);
      if (next !== r[alias]) info[k] = next as string;
    }
    // Keep the printed zero padding when the card info has it ("56/215" -> "056", not "56").
    const unpad = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/^([A-Z]*)0+(?=\d)/, '$1');
    let colOut = col;
    if (typeof col === 'string' && col !== r.card_number) {
      const padded = [info.card_number_text_seen ?? r.seen, info.card_number ?? r.cn, info.card_number_raw ?? r.raw]
        .find(v => typeof v === 'string' && !v.includes('/') && v.trim().length > col.length && unpad(v) === unpad(col));
      if (padded) colOut = padded.trim();
    }
    const clearSetTotal = r.st != null && total != null && Number(r.st) === Number(total);
    const colChanged = colOut !== r.card_number;
    if (!colChanged && !Object.keys(info).length && !clearSetTotal) {
      if ([r.card_number, r.raw].some(v => /\//.test(v || '')))
        flagged.push(`KEEP ${r.id.slice(0, 8)} ${r.card_name} | ${how} total ${total ?? '?'} | #${r.card_number} raw ${r.raw} (denominator is not the promo total)`);
      continue;
    }
    fixes.push({ row: r, col: colChanged ? (colOut as string) : null, info, clearSetTotal, how });
  }

  console.log(`candidates ${rows.size} (linked to a promo set ${linked.length}, by name ${named.length}; unlinked handled by name ${byName})`);
  console.log(`to fix ${fixes.length}: card_number column ${fixes.filter(f => f.col).length}, card-info only ${fixes.filter(f => !f.col).length}\n`);

  let written = 0, labelChanged = 0;
  for (const f of fixes) {
    const r = f.row;
    // One card, read whole, to rebuild its label from the fixed row.
    const { data: card, error } = await db.from('cards').select('*').eq('id', r.id).single();
    if (error) { console.error('stop (read):', error.message); break; }
    const info = { ...(card.conversational_card_info || {}) };
    for (const k of INFO_KEYS) if (k in f.info) info[k] = f.info[k];
    if (f.clearSetTotal) info.set_total = null;
    const fixed = { ...card, conversational_card_info: info, ...(f.col ? { card_number: f.col } : {}) };
    const label = generateLabelData(fixed as unknown as CardForLabel);
    const labelBefore = card.label_data?.formattedCardNumber ?? null;
    if (labelBefore != null && label.formattedCardNumber !== labelBefore) labelChanged++;
    console.log(`${r.id.slice(0, 8)} ${String(r.card_name).padEnd(22)} [${f.how}] #${r.card_number} -> #${f.col ?? r.card_number}` +
      ` | info ${Object.entries(f.info).map(([k, v]) => `${k.replace('card_number', 'cn')}=${v}`).join(' ') || '-'}${f.clearSetTotal ? ' set_total=null' : ''}` +
      ` | label ${labelBefore} -> ${card.label_data != null ? label.formattedCardNumber : '(no label)'}`);
    if (!APPLY) { await sleep(40); continue; }
    const cols: Record<string, any> = { conversational_card_info: info };
    if (f.col) cols.card_number = f.col;
    if (card.label_data != null) cols.label_data = label;
    if (card.original_label_data != null) cols.original_label_data = label;
    const { data: done, error: w } = await db.from('cards').update(cols).eq('id', r.id).eq('card_number', card.card_number).select('id, pokemon_api_id, identity_revision');
    if (w) { console.error('stop (write):', w.message); break; }
    if (!done?.length) { console.error(`stop: ${r.id} changed underneath us`); break; }
    // A database trigger must not have treated this as an identity change.
    if (card.pokemon_api_id && !done[0].pokemon_api_id) { console.error(`stop: ${r.id} lost its catalog link on write`); break; }
    written++;
    await sleep(150);
  }

  console.log(`\n${APPLY ? 'fixed' : 'would fix'} ${APPLY ? written : fixes.length} cards; label number changes ${labelChanged} (of labels that had one)`);
  console.log(`\nflagged for a human (${flagged.length}):`);
  for (const line of flagged) console.log('  ' + line);
})().catch(e => { console.error('stop:', e?.message || e); process.exit(1); });
