const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testUsersAPI() {
  console.log('Testing users API query...\n')

  // Test the exact query from the API endpoint
  const { data: users, error, count } = await supabase
    .from('users')
    .select('id, email, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  console.log('Error:', error)
  console.log('Count:', count)
  console.log('Users:', JSON.stringify(users, null, 2))

  if (users && users.length > 0) {
    // Get card counts
    const userIds = users.map(u => u.id)
    const { data: cardCounts } = await supabase
      .from('cards')
      .select('user_id')
      .in('user_id', userIds)

    console.log('\nCard counts query result:', cardCounts?.length)
  }
}

testUsersAPI()
