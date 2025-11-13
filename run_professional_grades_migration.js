// Script to add estimated_professional_grades column to cards table
// Run with: node run_professional_grades_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting migration: Add estimated_professional_grades column...\n');

  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_professional_grades_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');

    // Execute migration using Supabase RPC
    // Note: We need to execute this via the Postgres connection
    // Supabase's JS client doesn't directly support raw SQL DDL
    // So we'll use the REST API to execute the SQL

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql function doesn't exist, we need to run the SQL directly
      // Let's try a different approach - check if column exists first
      console.log('⚠️  exec_sql function not available, checking column manually...\n');

      // Check if column already exists by trying to select it
      const { data: testData, error: testError } = await supabase
        .from('cards')
        .select('estimated_professional_grades')
        .limit(1);

      if (testError && testError.message.includes('column')) {
        console.log('❌ Column does not exist. Manual migration required.');
        console.log('\n📋 Please run this SQL manually in Supabase Dashboard > SQL Editor:\n');
        console.log(migrationSQL);
        console.log('\n');
        process.exit(1);
      } else if (testError) {
        throw testError;
      } else {
        console.log('✅ Column estimated_professional_grades already exists!');
        console.log('✅ Migration already applied or database schema is up to date.\n');
      }
    } else {
      console.log('✅ Migration executed successfully!');
      console.log('✅ Column estimated_professional_grades added to cards table.\n');
    }

    console.log('🎉 Migration process completed!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Please run this SQL manually in Supabase Dashboard > SQL Editor:');

    const migrationPath = path.join(__dirname, 'migrations', 'add_professional_grades_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('\n' + migrationSQL + '\n');

    process.exit(1);
  }
}

runMigration();
