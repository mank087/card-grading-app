/**
 * Migration Script: Convert old serial format to new 6-digit randomized numeric format
 *
 * Old format: CATEGORY-xxxxxx (e.g., "SPORTS-a1b2c3", "POKEMON-xyz789")
 * New format: 000001-999999 (random, non-sequential)
 *
 * This script:
 * 1. Fetches all cards with old-format serial numbers
 * 2. Generates random unique 6-digit serials for each
 * 3. Ensures no duplicates with existing cards
 * 4. Updates each card in the database
 *
 * Usage: npx tsx scripts/migrate-serials.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SERIAL_LENGTH = 6;
const MAX_SERIAL = 999999;
const MIN_SERIAL = 1;

interface Card {
  id: string;
  serial: string;
  created_at: string;
}

function isOldFormat(serial: string): boolean {
  return /^[A-Z]+-[a-z0-9]+$/.test(serial);
}

function isNewFormat(serial: string): boolean {
  return /^\d{6,}$/.test(serial); // 6 or more digits
}

/**
 * Generate a random 6-digit serial that doesn't exist in the set
 */
function generateUniqueSerial(existingSerials: Set<string>): string {
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    const randomNum = Math.floor(Math.random() * (MAX_SERIAL - MIN_SERIAL + 1)) + MIN_SERIAL;
    const paddedSerial = randomNum.toString().padStart(SERIAL_LENGTH, '0');

    if (!existingSerials.has(paddedSerial)) {
      existingSerials.add(paddedSerial); // Reserve it
      return paddedSerial;
    }
    attempts++;
  }

  // Fallback: expand to 7 digits
  const expandedNum = Math.floor(Math.random() * 9000000) + 1000000;
  const expandedSerial = expandedNum.toString();
  existingSerials.add(expandedSerial);
  return expandedSerial;
}

async function migrateSerials(dryRun: boolean = true) {
  console.log('========================================');
  console.log('DCM Serial Number Migration Script');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update database)'}`);
  console.log('Format: 6-digit randomized numeric (e.g., 847291, 003847)');
  console.log('');

  // Fetch all cards
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, serial, created_at');

  if (error) {
    console.error('Error fetching cards:', error);
    process.exit(1);
  }

  if (!cards || cards.length === 0) {
    console.log('No cards found in database.');
    return;
  }

  console.log(`Found ${cards.length} total cards`);

  // Separate old-format and new-format cards
  const oldFormatCards = cards.filter(c => c.serial && isOldFormat(c.serial));
  const newFormatCards = cards.filter(c => c.serial && isNewFormat(c.serial));
  const otherCards = cards.filter(c => !c.serial || (!isOldFormat(c.serial) && !isNewFormat(c.serial)));

  console.log(`- Old format (to migrate): ${oldFormatCards.length}`);
  console.log(`- New format (already migrated): ${newFormatCards.length}`);
  console.log(`- Other/invalid format: ${otherCards.length}`);
  console.log('');

  if (oldFormatCards.length === 0) {
    console.log('No cards need migration!');
    return;
  }

  // Build set of existing numeric serials
  const existingSerials = new Set<string>();
  for (const card of newFormatCards) {
    existingSerials.add(card.serial);
  }

  console.log(`Reserved ${existingSerials.size} existing numeric serials`);
  console.log('');

  // Prepare migration with random serials
  const migrations: Array<{ id: string; oldSerial: string; newSerial: string }> = [];

  for (const card of oldFormatCards) {
    const newSerial = generateUniqueSerial(existingSerials);
    migrations.push({
      id: card.id,
      oldSerial: card.serial,
      newSerial
    });
  }

  // Show preview
  console.log('Migration Preview (first 10):');
  console.log('----------------------------');
  migrations.slice(0, 10).forEach((m, i) => {
    console.log(`${i + 1}. ${m.oldSerial} → ${m.newSerial}`);
  });
  if (migrations.length > 10) {
    console.log(`... and ${migrations.length - 10} more`);
  }
  console.log('');

  if (dryRun) {
    console.log('========================================');
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('========================================');
    console.log('');
    console.log('To apply changes, run:');
    console.log('  npx tsx scripts/migrate-serials.ts --live');
    return;
  }

  // Apply migrations
  console.log('Applying migrations...');
  let successCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    const { error: updateError } = await supabase
      .from('cards')
      .update({ serial: migration.newSerial })
      .eq('id', migration.id);

    if (updateError) {
      console.error(`Failed to update ${migration.id}: ${updateError.message}`);
      errorCount++;
    } else {
      successCount++;
      if (successCount % 50 === 0) {
        console.log(`Progress: ${successCount}/${migrations.length}`);
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log('Migration Complete');
  console.log('========================================');
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live') || args.includes('-l');

migrateSerials(!isLive).catch(console.error);
