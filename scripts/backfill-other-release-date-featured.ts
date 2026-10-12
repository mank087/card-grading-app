/**
 * Backfill: release_date / featured on category='Other' cards.
 *
 * /api/other/[id] never wrote these two columns at grade time (fixed Oct 2026),
 * so Other cards only have the year and subject inside
 * conversational_card_info. This copies card_info.year -> release_date and
 * card_info.player_or_character -> featured where the column is still NULL.
 *
 * Production-DB rules: only light columns are selected (the two JSON paths are
 * read with ->>, never the whole blob), keyset pages of 50 by id, and every
 * update is guarded with .is(<column>, null) so a value written since the read
 * is never overwritten. label_data is NOT regenerated here.
 *
 * Dry run by default; APPLY=1 writes.
 *   npx tsx --env-file=../../.env.local scripts/backfill-other-release-date-featured.ts
 *   APPLY=1 npx tsx --env-file=../../.env.local scripts/backfill-other-release-date-featured.ts
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.env.APPLY === '1'
const PAGE = 50
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface Row {
  id: string
  release_date: string | null
  featured: string | null
  ci_year: string | null
  ci_subject: string | null
}

const PLACEHOLDER = /^(unknown|n\/?a|none|null|undefined|not visible|unreadable|-+|\?+)$/i

/** A year the grader actually stated: contains a plausible 4-digit year. */
function usableYear(v: unknown): string | null {
  const t = String(v ?? '').trim()
  if (!t || PLACEHOLDER.test(t)) return null
  return /\b(18|19|20)\d{2}\b/.test(t) ? t : null
}

function usableSubject(v: unknown): string | null {
  const t = String(v ?? '').trim()
  if (!t || PLACEHOLDER.test(t)) return null
  return t
}

async function fetchPage(afterId: string | null): Promise<Row[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let q = s.from('cards')
      .select('id, release_date, featured, ci_year:conversational_card_info->>year, ci_subject:conversational_card_info->>player_or_character')
      .eq('category', 'Other')
      .is('deleted_at', null)
      .or('release_date.is.null,featured.is.null')
      .order('id', { ascending: true })
      .limit(PAGE)
    if (afterId) q = q.gt('id', afterId)
    const { data, error } = await q
    if (!error) return (data || []) as unknown as Row[]
    console.warn(`  page after ${afterId ?? 'start'} attempt ${attempt} failed: ${error.message}`)
    if (/522|timeout/i.test(error.message) && attempt >= 2) throw error // stop on load, do not hammer
    await new Promise(r => setTimeout(r, 2000 * attempt))
  }
  throw new Error('page fetch failed 5 times')
}

async function guardedUpdate(id: string, column: 'release_date' | 'featured', value: string): Promise<boolean> {
  const { data, error } = await s.from('cards')
    .update({ [column]: value })
    .eq('id', id)
    .is(column, null)
    .select('id')
  if (error) {
    console.warn(`  ${id} ${column}: ${error.message}`)
    return false
  }
  return (data || []).length > 0
}

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — category=Other, release_date/featured from conversational_card_info`)
  let afterId: string | null = null
  let scanned = 0
  const c = { releaseNull: 0, releaseFillable: 0, releaseNoYear: 0, releaseWritten: 0, featuredNull: 0, featuredFillable: 0, featuredNoSubject: 0, featuredWritten: 0 }
  const samples: string[] = []

  for (;;) {
    const rows = await fetchPage(afterId)
    if (rows.length === 0) break
    for (const r of rows) {
      scanned++
      if (r.release_date == null) {
        c.releaseNull++
        const y = usableYear(r.ci_year)
        if (!y) c.releaseNoYear++
        else {
          c.releaseFillable++
          if (samples.length < 10) samples.push(`${r.id} release_date <- ${JSON.stringify(y)}`)
          if (APPLY && await guardedUpdate(r.id, 'release_date', y)) c.releaseWritten++
        }
      }
      if (r.featured == null) {
        c.featuredNull++
        const f = usableSubject(r.ci_subject)
        if (!f) c.featuredNoSubject++
        else {
          c.featuredFillable++
          if (samples.length < 20) samples.push(`${r.id} featured <- ${JSON.stringify(f)}`)
          if (APPLY && await guardedUpdate(r.id, 'featured', f)) c.featuredWritten++
        }
      }
    }
    afterId = rows[rows.length - 1].id
    if (APPLY) await new Promise(r => setTimeout(r, 200))
  }

  console.log('\nSamples:')
  samples.forEach(x => console.log('  ' + x))
  console.log(`\nScanned (Other, release_date or featured null): ${scanned}`)
  console.log(`release_date null: ${c.releaseNull}  fillable: ${c.releaseFillable}  no usable year: ${c.releaseNoYear}${APPLY ? `  written: ${c.releaseWritten}` : ''}`)
  console.log(`featured null:     ${c.featuredNull}  fillable: ${c.featuredFillable}  no usable subject: ${c.featuredNoSubject}${APPLY ? `  written: ${c.featuredWritten}` : ''}`)
  if (!APPLY) console.log('\nDry run only. Re-run with APPLY=1 to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
