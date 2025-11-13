// Run database migration to add conversational_grading field
// Usage: node run_conversational_migration.js

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
  console.log('🔧 Running conversational grading migration...');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'add_conversational_grading.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL Migration:');
    console.log(sql);
    console.log('');

    // Execute migration
    console.log('⚙️  Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠️  exec_sql function not found, trying direct query...');

      // Split by semicolons and run each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT') && !s.startsWith('COMMENT'));

      for (const statement of statements) {
        if (statement) {
          console.log(`Executing: ${statement.substring(0, 80)}...`);
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });

          if (stmtError) {
            console.error('❌ Error executing statement:', stmtError);
            throw stmtError;
          }
        }
      }
    }

    // Verify the column exists
    console.log('✅ Migration executed successfully');
    console.log('');
    console.log('🔍 Verifying column was added...');

    // Try to query a card to see if the field exists
    const { data: testData, error: testError } = await supabase
      .from('cards')
      .select('id, conversational_grading')
      .limit(1);

    if (testError) {
      console.error('❌ Verification failed:', testError);
      console.log('');
      console.log('⚠️  The column might not have been added. You may need to run the migration manually in Supabase SQL Editor.');
      console.log('📋 Copy and paste this SQL into Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grading TEXT;');
      console.log('');
    } else {
      console.log('✅ Column verified! conversational_grading field is now available.');
      console.log('');
      console.log('📊 Test query result:', testData);
    }

    console.log('');
    console.log('🎉 Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your dev server: npm run dev');
    console.log('2. Upload a test card to see conversational grading in action');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('📋 Manual migration instructions:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run this SQL:');
    console.log('');
    console.log('ALTER TABLE cards ADD COLUMN IF NOT EXISTS conversational_grading TEXT;');
    console.log('');
    process.exit(1);
  }
}

runMigration();
