/**
 * One-off: migrate Fred Sellerik's account from fredsellerik@gmail.com
 * to fredsell17@gmail.com. Verified by admin via Stripe last-4 match.
 *
 * Background: an earlier manual edit in the Supabase Table Editor
 * deleted Fred's public.users row while attempting to change the email.
 * auth.users + profiles + user_credits + cards all still exist (keyed
 * by user_id UUID), but public.users is gone and the email never
 * propagated.
 *
 * This script:
 *   1. Updates auth.users.email via admin API (email_confirm=true to
 *      skip the verify-email handshake — we trust the admin verified)
 *   2. Re-creates the missing public.users row with reconstructed data
 *      from auth.users.raw_user_meta_data (full_name = "Erik Fredsell")
 *   3. Updates public.profiles.email and re-enables marketing
 *   4. Verifies all keyed-by-user_id data (credits, cards) is intact
 *
 * Run: npx tsx scripts/recover-user-fred-email-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const USER_ID = '442b52be-49e3-4b49-9c5b-888ea619d8b9'
const OLD_EMAIL = 'fredsellerik@gmail.com'
const NEW_EMAIL = 'fredsell17@gmail.com'
const FULL_NAME = 'Erik Fredsell'
const ORIGINAL_CREATED_AT = '2026-05-08T00:08:01.619065+00:00'

async function main() {
  console.log(`Migrating ${OLD_EMAIL} → ${NEW_EMAIL} for user ${USER_ID}\n`)

  // 1. Update auth.users email (with email_confirm to skip verification flow)
  console.log('Step 1: updating auth.users.email...')
  const { data: authUpd, error: authErr } = await supabase.auth.admin.updateUserById(USER_ID, {
    email: NEW_EMAIL,
    email_confirm: true,
  })
  if (authErr) {
    console.error('  ! auth.users update failed:', authErr.message)
    process.exit(1)
  }
  console.log(`  ✓ auth.users.email is now ${authUpd.user?.email}`)

  // 2. Recreate public.users row. public.users schema is intentionally
  //    minimal — only id, email, created_at, updated_at, signup_source.
  //    full_name lives in auth.users.raw_user_meta_data and is read from
  //    there by the rest of the app, so no need to duplicate it here.
  console.log('\nStep 2: recreating public.users row...')
  const { error: usersErr } = await supabase
    .from('users')
    .upsert({
      id: USER_ID,
      email: NEW_EMAIL,
      created_at: ORIGINAL_CREATED_AT,
      signup_source: 'web', // Google OAuth via web
    }, { onConflict: 'id' })
  if (usersErr) {
    console.error('  ! public.users upsert failed:', usersErr.message)
    process.exit(1)
  }
  console.log(`  ✓ public.users row recreated (id=${USER_ID}, email=${NEW_EMAIL})`)
  console.log(`    Note: full_name "${FULL_NAME}" lives in auth.users.raw_user_meta_data, preserved`)

  // 3. Update profiles.email + re-enable marketing
  console.log('\nStep 3: updating public.profiles...')
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      email: NEW_EMAIL,
      marketing_emails_enabled: true,
      marketing_unsubscribed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', USER_ID)
  if (profErr) {
    console.error('  ! profiles update failed:', profErr.message)
    process.exit(1)
  }
  console.log(`  ✓ profiles.email=${NEW_EMAIL}, marketing re-enabled`)

  // 4. Verify the preserved data is still intact
  console.log('\nStep 4: verifying preserved data...')
  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, total_used, is_vip, stripe_customer_id')
    .eq('user_id', USER_ID)
    .maybeSingle()
  const { count: cardCount } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
  console.log(`  Credits: ${credits?.balance} balance, ${credits?.total_purchased} purchased, ${credits?.total_used} used`)
  console.log(`  VIP: ${credits?.is_vip}`)
  console.log(`  Stripe customer: ${credits?.stripe_customer_id}`)
  console.log(`  Cards owned: ${cardCount}`)

  console.log(`\n=== Migration complete ===`)
  console.log(`Fred can now sign in at https://dcmgrading.com/login with email ${NEW_EMAIL}.`)
  console.log(`Since he originally used Google OAuth, he needs to set a password:`)
  console.log(`  Option A — send him to /reset-password to set one himself`)
  console.log(`  Option B — admin sets a temp password and shares with him securely`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
