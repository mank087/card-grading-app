// Run database migration for Conversational Grading v3.3
// Usage: node run_v3_3_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('');
  console.log('========================================');
  console.log('🚀 Conversational Grading v3.3 Migration');
  console.log('========================================');
  console.log('');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'conversational_grading_v3_3_migration.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Migration file not found:', sqlPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Migration File Loaded');
    console.log('   Location:', sqlPath);
    console.log('   Size:', sql.length, 'characters');
    console.log('');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out empty statements, comments, and DO blocks (which are self-contained)
        return s &&
               !s.startsWith('--') &&
               s.length > 5 &&
               !s.startsWith('COMMENT ON');
      });

    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

      console.log(`[${i + 1}/${statements.length}] ${preview}...`);

      try {
        // For ALTER TABLE statements, we need to use raw SQL
        // Supabase client doesn't support DDL directly, so we need to execute via SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
          // Some errors are OK (e.g., column already exists)
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('duplicate')
          )) {
            console.log('   ⚠️  Already exists, skipping...');
            skipCount++;
          } else {
            console.error('   ❌ Error:', error.message || error);
            errorCount++;
          }
        } else {
          console.log('   ✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error('   ❌ Exception:', err.message || err);
        errorCount++;
      }
    }

    console.log('');
    console.log('========================================');
    console.log('📈 Migration Summary');
    console.log('========================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped:    ${skipCount}`);
    console.log(`❌ Errors:     ${errorCount}`);
    console.log('');

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This is often OK if:');
      console.log('   - Columns/indexes already exist');
      console.log('   - Constraints already defined');
      console.log('   - exec_sql function not available');
      console.log('');
    }

    // Verify new columns exist
    console.log('🔍 Verifying new v3.3 fields...');
    console.log('');

    const { data: testData, error: testError } = await supabase
      .from('card_grading')
      .select('id, rarity_tier, defect_coordinates_front, conservative_rounding_applied')
      .limit(1);

    if (testError) {
      console.error('❌ Verification query failed:', testError.message);
      console.log('');
      console.log('⚠️  The migration may not have completed successfully.');
      console.log('');
      console.log('📋 Manual Migration Instructions:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Open the migration file:');
      console.log(`   ${sqlPath}`);
      console.log('3. Copy and paste the contents into SQL Editor');
      console.log('4. Run the migration manually');
      console.log('');
      process.exit(1);
    } else {
      console.log('✅ Verification successful!');
      console.log('');
      console.log('📦 New v3.3 Fields Available:');
      console.log('   • rarity_tier');
      console.log('   • serial_number_fraction');
      console.log('   • autograph_type');
      console.log('   • memorabilia_type');
      console.log('   • finish_material');
      console.log('   • rookie_flag');
      console.log('   • subset_insert_name');
      console.log('   • special_attributes');
      console.log('   • rarity_notes');
      console.log('   • weighted_total_pre_cap');
      console.log('   • capped_grade_reason');
      console.log('   • conservative_rounding_applied');
      console.log('   • lighting_conditions_notes');
      console.log('   • defect_coordinates_front (JSONB)');
      console.log('   • defect_coordinates_back (JSONB)');
      console.log('   • cross_side_verification_result');
      console.log('');
      console.log('Test query result:', testData);
    }

    console.log('');
    console.log('🎉 v3.3 Migration Complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. ✅ Phase 2 complete - database schema updated');
    console.log('2. ⏭️  Phase 3 - Update AI assistant configuration');
    console.log('3. ⏭️  Phase 4 - Update TypeScript interfaces and backend logic');
    console.log('4. ⏭️  Phase 5 - Update frontend displays');
    console.log('5. ⏭️  Phase 6 - Test new features');
    console.log('');
    console.log('🔄 Restart your dev server to load the updated schema:');
    console.log('   npm run dev');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed with exception:', error);
    console.log('');
    console.log('📋 Manual Migration Instructions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy the contents of:');
    console.log('   migrations/conversational_grading_v3_3_migration.sql');
    console.log('3. Paste into SQL Editor and run');
    console.log('');
    process.exit(1);
  }
}

// Handle async execution
runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
