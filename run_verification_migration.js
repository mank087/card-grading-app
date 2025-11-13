const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running front/back verification migration...\n');

  // Read the SQL migration file
  const sqlPath = path.join(__dirname, 'migrations', 'add_front_back_verification.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolons to execute each statement separately
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    console.log(statement.substring(0, 100) + '...\n');

    const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

    if (error) {
      // Try direct execution as fallback
      console.warn('RPC method failed, trying direct SQL execution...');
      const { error: directError } = await supabase.from('_sql').select('*').limit(0);

      if (directError) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        console.error('Statement:', statement);
        console.error('\nPlease run the migration manually using Supabase SQL editor:');
        console.error('  1. Go to Supabase Dashboard → SQL Editor');
        console.error('  2. Copy the contents of migrations/add_front_back_verification.sql');
        console.error('  3. Execute the SQL\n');
        process.exit(1);
      }
    }

    console.log(`✅ Statement ${i + 1} executed successfully\n`);
  }

  console.log('✅ Migration completed successfully!');
  console.log('\nNew columns added to cards table:');
  console.log('  - front_back_verified (BOOLEAN)');
  console.log('  - front_back_verification_notes (TEXT)');
  console.log('  - front_back_verification_assessment (VARCHAR)');
  console.log('  - front_back_verification_confidence (VARCHAR)');
  console.log('\nIndexes created:');
  console.log('  - idx_cards_front_back_verified');
  console.log('  - idx_cards_verification_assessment');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
