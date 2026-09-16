/** English physical Pokemon catalog. Dry run by default; --write persists data. */
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { createScrydexClient, prepareExpansion, writeExpansion, date } = require('../src/lib/scrydexPokemon.cjs');

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/import-pokemon-scrydex.js [--set=me55,me55c,mep | --sync] [--write]\nDefault: dry-run anniversary sets me55,me55c. --sync selects missing/partial sets, recent sets (90 days), and promos.');
    return;
  }
  for (const arg of args) if (!['--write', '--sync'].includes(arg) && !/^--set=[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  if (args.filter(arg => arg.startsWith('--set=')).length > 1 || (args.includes('--sync') && args.some(arg => arg.startsWith('--set=')))) throw new Error('Choose either --set or --sync');
  const api = createScrydexClient();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase configuration');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let ids = (args.find(arg => arg.startsWith('--set='))?.slice(6) || 'me55,me55c').split(',');
  if (args.includes('--sync')) {
    ids = [];
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const sets = await api.list('/expansions');
    for (const set of sets) {
      if (set.language_code?.toUpperCase() !== 'EN' || set.is_online_only !== false || !set.total || !set.release_date || date(set.release_date) > today) continue;
      const { count, error } = await db.from('pokemon_cards').select('id', { count: 'exact', head: true }).eq('set_id', set.id);
      if (error) throw new Error(error.message);
      if ((count || 0) < set.total || date(set.release_date) >= cutoff || /promo/i.test(set.name)) ids.push(set.id);
    }
  }
  ids = [...new Set(ids)];
  console.log(`${args.includes('--write') ? 'WRITE' : 'DRY RUN'}: ${ids.join(', ') || 'no sets need updating'}`);
  for (const id of ids) {
    const prepared = await prepareExpansion(api, id);
    console.log(`${id}: ${prepared.set.name}, ${prepared.cards.length} validated cards, ${prepared.cards.filter(card => !card.image_large).length} without a large image`);
    if (args.includes('--write')) {
      const count = await writeExpansion(db, prepared);
      console.log(`${id}: ${count} cards upserted and verified by ID`);
    }
  }
  console.log(args.includes('--write') ? 'Import completed.' : 'Dry run completed. No database writes. Add --write to import.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
