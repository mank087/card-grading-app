/**
 * Find auth.users rows that don't have a matching public.users row and
 * insert the missing rows so analytics counts match auth.
 *
 * Run: npx tsx scripts/backfill-orphan-public-users.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  // 1. Pull all auth.users (paginated to bypass the 1000-row cap)
  const authUsers: Array<{ id: string; email: string; created_at: string }> = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (!data.users.length) break
    data.users.forEach((u) => {
      if (u.email) authUsers.push({ id: u.id, email: u.email, created_at: u.created_at })
    })
    if (data.users.length < 200) break
  }
  console.log(`auth.users: ${authUsers.length} rows`)

  // 2. Pull existing public.users IDs (paginated)
  const publicIds = new Set<string>()
  let from = 0
  const batchSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .range(from, from + batchSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    data.forEach((u: any) => publicIds.add(u.id))
    if (data.length < batchSize) break
    from += batchSize
  }
  console.log(`public.users: ${publicIds.size} rows`)

  // 3. Diff
  const orphans = authUsers.filter((u) => !publicIds.has(u.id))
  console.log(`Orphans (in auth, not in public.users): ${orphans.length}`)
  if (orphans.length === 0) {
    console.log('Nothing to backfill.')
    return
  }
  orphans.slice(0, 10).forEach((o) => console.log(`  - ${o.id}  ${o.email}  created ${o.created_at}`))
  if (orphans.length > 10) console.log(`  ... and ${orphans.length - 10} more`)

  // 4. Insert. Default signup_source to 'web' since we don't know.
  const rows = orphans.map((o) => ({
    id: o.id,
    email: o.email,
    created_at: o.created_at,
    signup_source: 'web',
  }))
  const { error: insertErr } = await supabase
    .from('users')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
  if (insertErr) {
    console.error('Insert failed:', insertErr)
    process.exit(1)
  }
  console.log(`✓ Backfilled ${rows.length} rows into public.users`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
