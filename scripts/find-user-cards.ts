import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Fetch all cards (default limit is 1000, need to paginate for large collections)
  let allCards: Array<{ user_id: string; category: string }> = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch } = await sb.from('cards').select('user_id, category').range(page * pageSize, (page + 1) * pageSize - 1);
    if (!batch || batch.length === 0) break;
    allCards.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }
  const data = allCards;
  console.log(`Total cards in DB: ${data.length}\n`);
  const byUser: Record<string, Record<string, number>> = {};
  data?.forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    byUser[r.user_id][r.category] = (byUser[r.user_id][r.category] || 0) + 1;
  });

  // Show users with 100+ cards
  for (const [uid, cats] of Object.entries(byUser)) {
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    if (total > 100) {
      console.log(`${uid} total=${total}`);
      for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${cat}: ${count}`);
      }

      // Check history coverage
      const { data: userCardIds } = await sb.from('cards').select('id').eq('user_id', uid);
      const ids = userCardIds?.map(c => c.id) || [];

      // Query in chunks
      let historyCount = 0;
      const cardIdsWithHistory = new Set<string>();
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { data: hist } = await sb.from('card_price_history').select('card_id').in('card_id', chunk);
        hist?.forEach(h => {
          historyCount++;
          cardIdsWithHistory.add(h.card_id);
        });
      }
      console.log(`  History rows: ${historyCount}, unique cards with history: ${cardIdsWithHistory.size}`);
      console.log();
    }
  }
}

main().catch(console.error);
