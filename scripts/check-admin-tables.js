/**
 * Check if admin tables exist in database
 */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('Checking admin tables...\n')

  const tables = [
    'admin_users',
    'admin_sessions',
    'admin_activity_log',
    'api_usage_log',
    'error_log',
    'card_flags',
    'system_settings'
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1)

      if (error) {
        console.log(`❌ ${table}: NOT FOUND`)
      } else {
        console.log(`✅ ${table}: EXISTS`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ERROR - ${err.message}`)
    }
  }

  console.log('\nChecking admin user...')
  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('email, role, is_active')
    .eq('email', 'admin@cardgrader.com')
    .single()

  if (adminError) {
    console.log('❌ Admin user NOT FOUND')
  } else {
    console.log('✅ Admin user EXISTS:')
    console.log('   Email:', admin.email)
    console.log('   Role:', admin.role)
    console.log('   Active:', admin.is_active)
  }
}

checkTables().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
