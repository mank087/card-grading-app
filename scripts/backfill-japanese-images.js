/**
 * Backfill Japanese Pokemon Card Images
 *
 * Updates image_url for Japanese cards that are missing images.
 * TCGdex image format: https://assets.tcgdex.net/ja/{series}/{set}/{localId}/high.webp
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillImages() {
  console.log('🖼️ Backfilling Japanese Pokemon Card Images');
  console.log('==========================================\n');

  // Get all Japanese cards with null images
  const { data: cards, error } = await supabase
    .from('pokemon_cards_ja')
    .select('id, local_id, set_id')
    .is('image_url', null);

  if (error) {
    console.error('Error fetching cards:', error);
    process.exit(1);
  }

  console.log(`Found ${cards.length} cards without images\n`);

  let updated = 0;
  let errors = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);

    // Fetch image URLs from TCGdex for this batch
    const updates = [];

    for (const card of batch) {
      try {
        // Fetch card details from TCGdex to get the image URL
        const response = await fetch(`https://api.tcgdex.net/v2/ja/cards/${card.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.image) {
            updates.push({
              id: card.id,
              image_url: `${data.image}/high.webp`
            });
          }
        }
        // Small delay to be nice to TCGdex API
        await sleep(30);
      } catch (err) {
        // Skip failed fetches
      }
    }

    // Batch update to Supabase
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('pokemon_cards_ja')
          .update({ image_url: update.image_url })
          .eq('id', update.id);

        if (updateError) {
          errors++;
        } else {
          updated++;
        }
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, cards.length)}/${cards.length} processed, ${updated} updated`);
  }

  console.log('\n==========================================');
  console.log(`✅ Complete: ${updated} images updated, ${errors} errors`);
}

backfillImages().catch(console.error);
