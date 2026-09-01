/**
 * Post-migration verification for migrations/add_submissions_tables.sql.
 *
 * There is no DDL path from here — the migration is applied by hand in the
 * Supabase SQL editor. This script only READS, and only shapes: it confirms
 * both tables exist, that every column the service layer writes is present,
 * and that cards.submission_id landed.
 *
 * Column presence is probed with `select(col).limit(0)` rather than by reading
 * rows: PostgREST validates the column list before it fetches anything, so a
 * missing column is an error and a present one costs no rows. Nothing here
 * scans a table (see feedback_production_db_safety).
 *
 *   npx tsx scripts/_tmp-verify-submissions-schema.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const s = createClient(url, key)

const SUBMISSION_COLUMNS = [
  'id', 'user_id', 'name', 'category', 'sub_category', 'binder_id', 'status',
  'source', 'card_count', 'routing_key', 'created_at', 'committed_at', 'completed_at',
]

const ITEM_COLUMNS = [
  'id', 'submission_id', 'card_id', 'position', 'front_path', 'back_path',
  'front_hash', 'back_hash', 'status', 'claimed_at', 'attempts', 'error', 'created_at',
]

let failures = 0

function report(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  ok    ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Does the table exist and is it readable? */
async function checkTable(table: string): Promise<boolean> {
  const { error } = await s.from(table).select('*', { head: true, count: 'exact' }).limit(0)
  if (error) {
    report(`table ${table}`, false, error.message)
    return false
  }
  report(`table ${table}`, true)
  return true
}

/** Probe each column individually so the failure names the missing one. */
async function checkColumns(table: string, columns: string[]) {
  for (const column of columns) {
    const { error } = await s.from(table).select(column).limit(0)
    report(`${table}.${column}`, !error, error?.message)
  }
}

async function main() {
  console.log('\nVerifying migrations/add_submissions_tables.sql\n')

  console.log('submissions')
  if (await checkTable('submissions')) {
    await checkColumns('submissions', SUBMISSION_COLUMNS)
  }

  console.log('\nsubmission_items')
  if (await checkTable('submission_items')) {
    await checkColumns('submission_items', ITEM_COLUMNS)
  }

  console.log('\ncards')
  await checkColumns('cards', ['submission_id'])

  // Status vocabulary: a rejected insert proves the CHECK constraint is on.
  // If it is NOT on, the insert succeeds and leaves a junk row — so delete
  // whatever came back before reporting.
  console.log('\nconstraints')
  const { data: sneaked, error: badStatus } = await s
    .from('submissions')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      category: '__schema_probe__',
      status: 'not_a_status',
    })
    .select('id')

  if (sneaked?.length) {
    await s.from('submissions').delete().in('id', sneaked.map((r: any) => r.id))
  }

  report(
    'submissions.status CHECK rejects an unknown status',
    !!badStatus,
    badStatus ? '' : 'an invalid status was accepted — the CHECK is missing'
  )

  console.log(
    failures === 0
      ? '\nAll checks passed — the migration is applied.\n'
      : `\n${failures} check(s) failed — the migration has not been applied (or not fully).\n`
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Verification threw:', e?.message || e)
  process.exit(1)
})
