const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getUsersData() {
  console.log('Fetching users data...\n')

  // Try to get users with count
  const { data: users, error, count } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Total count: ${count}`)
  console.log(`Returned rows: ${users?.length || 0}\n`)

  if (users && users.length > 0) {
    console.log('First user:')
    console.log(JSON.stringify(users[0], null, 2))
  } else {
    console.log('No users found in the users table')

    // Check auth.users instead
    console.log('\nChecking auth.users...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('Auth error:', authError)
    } else {
      console.log(`Found ${authUsers?.users?.length || 0} users in auth.users`)
      if (authUsers?.users?.length > 0) {
        console.log('First auth user:')
        console.log(JSON.stringify(authUsers.users[0], null, 2))
      }
    }
  }
}

getUsersData()
