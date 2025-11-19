/**
 * Script to create an admin user directly in the database
 * Run with: node scripts/create-admin-user.js
 */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')
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
  const email = 'admin@cardgrader.com'
  const password = 'admin123'

  console.log('Creating admin user...')
  console.log('Email:', email)
  console.log('Password:', password)

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
    console.log('\n⚠️  Admin user already exists!')
    console.log('Updating password...')

    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)

    if (updateError) {
      console.error('❌ Error updating admin user:', updateError)
      process.exit(1)
    }

    console.log('✅ Admin password updated successfully!')
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
  console.log('\n⚠️  IMPORTANT: Change this password after first login!')
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
