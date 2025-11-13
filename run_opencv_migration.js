#!/usr/bin/env node
/**
 * Run OpenCV Metrics Migration
 *
 * Adds opencv_metrics JSONB column to cards table
 *
 * Usage: node run_opencv_migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running OpenCV Metrics Migration');
  console.log('================================\n');

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_opencv_metrics_column.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSql);
    console.log('');

    // Execute migration
    console.log('⏳ Executing migration...\n');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSql
    });

    if (error) {
      // If exec_sql doesn't exist, try direct approach
      console.log('⚠️  RPC method not available, trying direct execution...\n');

      // Split SQL into individual statements
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 80)}...`);

        const { error: execError } = await supabase.rpc('exec', {
          query: statement
        });

        if (execError) {
          console.error(`❌ Failed to execute statement: ${execError.message}`);
          console.error('   Statement:', statement);
          throw execError;
        }
      }

      console.log('✅ Migration completed successfully!\n');
    } else {
      console.log('✅ Migration completed successfully!\n');
      console.log('Response:', data);
    }

    // Verify column was added
    console.log('🔍 Verifying column was added...\n');

    const { data: columns, error: verifyError } = await supabase
      .from('cards')
      .select('opencv_metrics')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.error('\n⚠️  You may need to run the migration manually in Supabase SQL Editor:');
      console.error('   1. Go to Supabase Dashboard > SQL Editor');
      console.error('   2. Paste the contents of migrations/add_opencv_metrics_column.sql');
      console.error('   3. Run the query\n');
      process.exit(1);
    }

    console.log('✅ Column verified! opencv_metrics column exists.\n');

    console.log('🎉 Migration Complete!');
    console.log('===================\n');
    console.log('Next steps:');
    console.log('1. Test OpenCV analysis endpoint: GET http://localhost:3000/api/opencv-analyze');
    console.log('2. Test grading with OpenCV integration');
    console.log('3. Verify opencv_metrics are saved to database\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    console.error('\n⚠️  Manual migration required:');
    console.error('   1. Go to Supabase Dashboard > SQL Editor');
    console.error('   2. Paste the contents of migrations/add_opencv_metrics_column.sql');
    console.error('   3. Run the query\n');
    process.exit(1);
  }
}

runMigration();
