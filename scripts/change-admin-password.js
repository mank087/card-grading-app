/**
 * Change admin user password
 * Run with: node scripts/change-admin-password.js
 */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')
const readline = require('readline')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function changePassword() {
  console.log('🔐 Admin Password Change\n')

  // Get email
  const email = await question('Enter admin email (default: admin@cardgrader.com): ')
  const adminEmail = email.trim() || 'admin@cardgrader.com'

  // Check if admin exists
  const { data: admin, error: findError } = await supabase
    .from('admin_users')
    .select('id, email, role')
    .eq('email', adminEmail)
    .single()

  if (findError || !admin) {
    console.error(`❌ Admin user with email "${adminEmail}" not found`)
    rl.close()
    process.exit(1)
  }

  console.log(`\n✅ Found admin: ${admin.email} (${admin.role})`)

  // Get new password
  const newPassword = await question('\nEnter new password (min 8 characters): ')

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters long')
    rl.close()
    process.exit(1)
  }

  // Confirm password
  const confirmPassword = await question('Confirm new password: ')

  if (newPassword !== confirmPassword) {
    console.error('❌ Passwords do not match')
    rl.close()
    process.exit(1)
  }

  // Hash new password
  console.log('\n🔐 Hashing password...')
  const salt = await bcrypt.genSalt(12)
  const passwordHash = await bcrypt.hash(newPassword, salt)

  // Update password
  const { error: updateError } = await supabase
    .from('admin_users')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', admin.id)

  if (updateError) {
    console.error('❌ Error updating password:', updateError.message)
    rl.close()
    process.exit(1)
  }

  console.log('\n✅ Password changed successfully!')
  console.log(`\n📋 New credentials:`)
  console.log(`Email: ${adminEmail}`)
  console.log(`Password: ${newPassword}`)
  console.log('\n⚠️  Save these credentials in a secure location!')

  rl.close()
  process.exit(0)
}

changePassword().catch(error => {
  console.error('❌ Error:', error.message)
  rl.close()
  process.exit(1)
})
