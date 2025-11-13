const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://acpzsgznxhtpbdmjdzqh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcHpzZ3pueGh0cGJkbWpkenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjM5MDgzOCwiZXhwIjoyMDQxOTY2ODM4fQ.8tPbCVcUdGMZJe8TqE1KQBKnVyKTTjf-kA6dMF8QmOw';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addEbayUrlColumn() {
  try {
    console.log('Adding ebay_url column to cards table...');

    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_url TEXT;
        COMMENT ON COLUMN cards.ebay_url IS 'Direct link to card search results on eBay';
      `
    });

    if (error) {
      console.error('Error adding column:', error);
      return;
    }

    console.log('Successfully added ebay_url column');

    // Verify the column was added
    const { data: columns } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'ebay_url';
      `
    });

    console.log('Column verification:', columns);

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

addEbayUrlColumn();