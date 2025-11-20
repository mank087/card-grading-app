const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listTables() {
  console.log('Checking for users-related tables...\n')

  // Try different table names
  const tableNames = ['users', 'admin_users', 'auth.users']

  for (const table of tableNames) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.log(`❌ ${table}: ${error.message}`)
    } else {
      console.log(`✅ ${table}: Found (count: ${data})`)
    }
  }

  // Check if there's a cards table to reference
  console.log('\nChecking cards table...')
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, user_id')
    .limit(5)

  if (!cardsError && cards) {
    console.log(`✅ Found ${cards.length} cards`)
    if (cards.length > 0) {
      console.log(`Sample user_id from cards: ${cards[0].user_id}`)
    }
  } else {
    console.log(`❌ Cards error: ${cardsError?.message}`)
  }
}

listTables()
