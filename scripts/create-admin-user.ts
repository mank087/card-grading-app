/**
 * Script to create an admin user directly in the database
 * Run with: npx tsx scripts/create-admin-user.ts
 */

import { supabase } from '../src/lib/supabaseClient'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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

  // Check if admin_users table exists
  const { error: tableError } = await supabase
    .from('admin_users')
    .select('id')
    .limit(1)

  if (tableError) {
    console.error('❌ Error: admin_users table does not exist!')
    console.error('Please run the database schema first:')
    console.error('1. Open Supabase SQL Editor')
    console.error('2. Copy contents of database/admin_schema.sql')
    console.error('3. Paste and run in SQL Editor')
    console.error('\nError details:', tableError)
    return
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
    console.log('⚠️  Admin user already exists — leaving password unchanged.')
    console.log('To rotate the password, run: node scripts/change-admin-password.js')
    return
  }

  console.log('Creating new admin user...')

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
    console.error('❌ Error creating admin user:', insertError)
    return
  }

  console.log('✅ Admin user created successfully!')
  console.log('User ID:', newAdmin.id)
  console.log('\n✅ You can now login with:')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('\n⚠️  Save this password now — it is not stored anywhere else.')
}

createAdminUser()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
