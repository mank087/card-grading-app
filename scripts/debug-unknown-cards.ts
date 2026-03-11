import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Fetch ALL columns for the cards with no name data
  const unknownIds = [
    'bf47d70c-452e-4ef6-8952-ccf6684ed321',
    '74ae4f1a-6e1f-4da6-8679-ed791e3ddbb6',
    '7d2b9ea1-cc89-4819-9913-083fd731019e',
  ];

  for (const id of unknownIds) {
    const { data: card, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !card) {
      console.log(`Card ${id}: ERROR`, error);
      continue;
    }

    console.log(`\n=== Card ${id} ===`);
    // Print all non-null fields that might contain name/player info
    const keys = Object.keys(card).sort();
    for (const key of keys) {
      const val = card[key];
      if (val === null || val === undefined || val === '') continue;
      // Skip large blobs, just show their type/length
      if (typeof val === 'string' && val.length > 200) {
        console.log(`  ${key}: [string, ${val.length} chars] ${val.substring(0, 100)}...`);
      } else if (typeof val === 'object' && val !== null) {
        const str = JSON.stringify(val);
        if (str.length > 200) {
          console.log(`  ${key}: [object, ${str.length} chars] ${str.substring(0, 100)}...`);
        } else {
          console.log(`  ${key}:`, val);
        }
      } else {
        console.log(`  ${key}:`, val);
      }
    }
  }
}

main();
