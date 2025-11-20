const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUsers() {
  console.log('Checking users table...\n')

  // Try to get all users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .limit(5)

  if (error) {
    console.error('Error querying users:', error)
    return
  }

  console.log(`Found ${users?.length || 0} users`)
  if (users && users.length > 0) {
    console.log('\nFirst user columns:')
    console.log(Object.keys(users[0]))
    console.log('\nFirst user data:')
    console.log(users[0])
  }

  // Get total count
  const { count, error: countError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })

  if (!countError) {
    console.log(`\nTotal users in database: ${count}`)
  }
}

checkUsers()
