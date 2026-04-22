/**
 * Backfill Script - Parse existing cards' markdown into structured data
 * Run once after deploying Phase 2 changes
 *
 * Usage:
 * 1. Set environment variables:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *
 * 2. Run: npx tsx scripts/backfill_structured_data.ts
 */

import * as path from 'path';
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import {
  parseConversationalDefects,
  parseCenteringMeasurements,
  parseGradingMetadata
} from '../src/lib/conversationalDefectParser';

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BackfillStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ card_id: string; error: string }>;
}

async function backfillStructuredData() {
  console.log('🚀 Starting backfill of structured data...\n');
  console.log('This will parse existing cards\' conversational_grading markdown');
  console.log('and populate the new structured data columns.\n');

  const stats: BackfillStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Fetch all cards that have conversational_grading but no structured data
    console.log('📊 Fetching cards to backfill...');
    const { data: cards, error: fetchError } = await supabase
      .from('cards')
      .select('id, conversational_grading')
      .not('conversational_grading', 'is', null)
      .is('conversational_defects_front', null)
      .order('created_at', { ascending: false })
      .limit(1000); // Process in batches

    if (fetchError) {
      console.error('❌ Error fetching cards:', fetchError);
      return;
    }

    if (!cards || cards.length === 0) {
      console.log('✨ No cards need backfilling. All cards are up to date!');
      return;
    }

    stats.total = cards.length;
    console.log(`📦 Found ${cards.length} cards to backfill\n`);

    // Process each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const progress = `[${i + 1}/${cards.length}]`;

      try {
        console.log(`${progress} Processing card ${card.id.substring(0, 8)}...`);

        // Parse markdown
        const structuredDefects = parseConversationalDefects(card.conversational_grading);
        const structuredCentering = parseCenteringMeasurements(card.conversational_grading);
        const structuredMetadata = parseGradingMetadata(card.conversational_grading);

        if (!structuredDefects) {
          console.warn(`  ⚠️  Could not parse defects for card ${card.id.substring(0, 8)}`);
          stats.skipped++;
          stats.errors.push({
            card_id: card.id,
            error: 'Parser returned null - markdown format may be incompatible'
          });
          continue;
        }

        // Update database
        const { error: updateError } = await supabase
          .from('cards')
          .update({
            conversational_defects_front: structuredDefects.front,
            conversational_defects_back: structuredDefects.back,
            conversational_centering: structuredCentering,
            conversational_metadata: structuredMetadata
          })
          .eq('id', card.id);

        if (updateError) {
          console.error(`  ❌ Error updating card ${card.id.substring(0, 8)}:`, updateError.message);
          stats.failed++;
          stats.errors.push({
            card_id: card.id,
            error: updateError.message
          });
        } else {
          console.log(`  ✅ Successfully backfilled card ${card.id.substring(0, 8)}`);
          stats.success++;
        }

        // Rate limit: wait 100ms between updates to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

        // Progress update every 10 cards
        if ((i + 1) % 10 === 0) {
          console.log(`\n📈 Progress: ${i + 1}/${cards.length} (${Math.round((i + 1) / cards.length * 100)}%)`);
          console.log(`   ✅ Success: ${stats.success} | ⚠️  Skipped: ${stats.skipped} | ❌ Failed: ${stats.failed}\n`);
        }

      } catch (error) {
        console.error(`  ❌ Exception processing card ${card.id.substring(0, 8)}:`, error);
        stats.failed++;
        stats.errors.push({
          card_id: card.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary');
    console.log('='.repeat(60));
    console.log(`📦 Total cards:     ${stats.total}`);
    console.log(`✅ Successful:      ${stats.success}`);
    console.log(`⚠️  Skipped:         ${stats.skipped}`);
    console.log(`❌ Failed:          ${stats.failed}`);
    console.log(`📈 Success rate:    ${Math.round(stats.success / stats.total * 100)}%`);
    console.log('='.repeat(60));

    // Show errors if any
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach((err, idx) => {
        console.log(`\n${idx + 1}. Card: ${err.card_id.substring(0, 8)}`);
        console.log(`   Error: ${err.error}`);
      });
      console.log('\n💡 Tip: Cards with errors may need manual review or re-grading.');
    }

    // Next steps
    console.log('\n📝 Next Steps:');
    if (stats.success > 0) {
      console.log('1. ✅ Backfill completed successfully!');
      console.log('2. 🔄 Deploy frontend changes to use structured data');
      console.log('3. 🧪 Test cards with structured data on frontend');
      console.log('4. 📊 Monitor error logs for any issues');
    }
    if (stats.skipped > 0 || stats.failed > 0) {
      console.log('⚠️  Some cards were skipped or failed:');
      console.log('   - Review error list above');
      console.log('   - Consider re-grading problem cards');
      console.log('   - Check markdown format compatibility');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Run backfill
console.log('🎯 v3.3 Structured Data Backfill Script');
console.log('=======================================\n');

backfillStructuredData()
  .then(() => {
    console.log('\n✨ Backfill process complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Backfill failed with fatal error:', error);
    process.exit(1);
  });
