/**
 * Script to create an admin user directly in the database
 * Run with: node scripts/create-admin-user.js
 */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createAdminUser() {
  // No hardcoded default password (privacy audit): generate a random one and
  // print it once. Pass ADMIN_PASSWORD env var to choose your own.
  const email = process.env.ADMIN_EMAIL || 'admin@cardgrader.com'
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url')

  console.log('Creating admin user...')
  console.log('Email:', email)

  // Hash password
  const salt = await bcrypt.genSalt(12)
  const passwordHash = await bcrypt.hash(password, salt)

  console.log('Password hash generated')

  // Check if admin_users table exists
  const { data: tables, error: tableError } = await supabase
    .from('admin_users')
    .select('id')
    .limit(1)

  if (tableError) {
    console.error('\n❌ Error: admin_users table does not exist!')
    console.error('\n📋 Please run the database schema first:')
    console.error('1. Open Supabase Dashboard (https://supabase.com)')
    console.error('2. Go to SQL Editor')
    console.error('3. Copy contents of database/admin_schema.sql')
    console.error('4. Paste and run in SQL Editor')
    console.error('\nError details:', tableError.message)
    process.exit(1)
  }

  // Check if admin already exists
  const { data: existing } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()

  if (existing) {
    // Never silently reset an existing admin's password — that's how the
    // admin123 downgrade landmine worked. Use change-admin-password.js instead.
    console.log('\n⚠️  Admin user already exists — leaving password unchanged.')
    console.log('To rotate the password, run: node scripts/change-admin-password.js')
    process.exit(0)
  } else {
    console.log('\nCreating new admin user...')

    const { data: newAdmin, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        email,
        password_hash: passwordHash,
        role: 'super_admin',
        full_name: 'System Administrator',
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creating admin user:', insertError.message)
      process.exit(1)
    }

    console.log('✅ Admin user created successfully!')
    console.log('User ID:', newAdmin.id)
  }

  console.log('\n✅ You can now login with:')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('\n⚠️  Save this password now — it is not stored anywhere else.')
}

createAdminUser()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message)
    process.exit(1)
  })
