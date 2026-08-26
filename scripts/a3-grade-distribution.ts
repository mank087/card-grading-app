/**
 * A-3: grade + centering distribution report (READ-ONLY, count-first).
 *
 * Answers:
 *   - current grade distribution and 10-rate
 *   - how the distribution moved across prompt versions (v9.18 leniency removal)
 *   - how many 10s sit in the 55/45 - 57/43 centering band  [decision B3]
 *
 * Safety (per the Aug 8 full-table-scan outage): every population query is
 * count-only via { count: 'exact', head: true } — the server returns a number
 * and zero rows. The single row-returning query is narrowly filtered to
 * grade-10 cards, selects ONE small JSON column (not conversational_grading),
 * and is paged at 500 with a stop-on-error guard.
 *
 * Run: npx tsx scripts/a3-grade-distribution.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const GRADED = 'conversational_whole_grade'
const VERSION = 'conversational_prompt_version'
const RATIOS = 'conversational_centering_ratios'
const AT = 'conversational_evaluated_at'

/** count-only: returns a number, never rows */
async function countWhere(build: (q: any) => any): Promise<number> {
  const q = build(s.from('cards').select('id', { count: 'exact', head: true }))
  const { count, error } = await q
  if (error) throw new Error(`count failed: ${error.message}`)
  return count ?? 0
}

const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) + '%' : '-')
const bar = (n: number, d: number, w = 28) =>
  '█'.repeat(Math.round((d ? n / d : 0) * w)).padEnd(w, '·')

;(async () => {
  console.log('\n=== A-3 GRADE DISTRIBUTION REPORT ===\n')

  // ---- 1. Version census. Tells us what is even answerable. -----------------
  const totalGraded = await countWhere(q => q.not(GRADED, 'is', null))
  console.log(`Total graded cards: ${totalGraded.toLocaleString()}\n`)

  const { data: versionRows, error: vErr } = await s
    .from('cards')
    .select(VERSION)
    .not(GRADED, 'is', null)
    .not(VERSION, 'is', null)
    .order(AT, { ascending: false })
    .limit(4000)
  if (vErr) throw new Error(`version sample failed: ${vErr.message}`)

  const vCounts = new Map<string, number>()
  for (const r of versionRows ?? []) {
    const v = String((r as any)[VERSION])
    vCounts.set(v, (vCounts.get(v) ?? 0) + 1)
  }
  const versions = [...vCounts.entries()].sort((a, b) => b[1] - a[1])
  console.log('Prompt versions (most recent 1,000 grades — Supabase row cap):')
  for (const [v, n] of versions) {
    console.log(`  ${v.padEnd(24)} ${String(n).padStart(6)}  ${pct(n, versionRows?.length ?? 0)}`)
  }

  // ---- 2. Overall grade distribution (count-only, 11 queries) ---------------
  console.log('\nOverall grade distribution:')
  const overall: Record<number, number> = {}
  for (let g = 10; g >= 1; g--) {
    overall[g] = await countWhere(q => q.eq(GRADED, g))
  }
  for (let g = 10; g >= 1; g--) {
    console.log(
      `  ${String(g).padStart(2)}  ${bar(overall[g], totalGraded)} ${String(overall[g]).padStart(6)}  ${pct(overall[g], totalGraded)}`
    )
  }
  console.log(`\n  10-rate overall: ${pct(overall[10], totalGraded)}`)

  // ---- 3. 10-rate per version (count-only) ---------------------------------
  console.log('\n10-rate by prompt version:')
  for (const [v] of versions.slice(0, 8)) {
    const tot = await countWhere(q => q.eq(VERSION, v).not(GRADED, 'is', null))
    const tens = await countWhere(q => q.eq(VERSION, v).eq(GRADED, 10))
    console.log(
      `  ${v.padEnd(24)} ${String(tens).padStart(5)}/${String(tot).padEnd(6)} = ${pct(tens, tot).padStart(6)}`
    )
  }

  // ---- 4. B3: centering band of current 10s --------------------------------
  // Narrow: grade-10 only, ONE small JSON column, paged, stop on error.
  console.log('\n--- B3: centering ratios among grade-10 cards ---')
  const parseRatio = (v: unknown): number | null => {
    if (v == null) return null
    const m = String(v).match(/(\d{1,3})\s*[\/:]\s*(\d{1,3})/)
    if (!m) return null
    const a = Number(m[1]), b = Number(m[2])
    if (!a || !b) return null
    return Math.max(a, b) // worse side, e.g. "57/43" -> 57
  }

  const buckets = { '50-55': 0, '55.1-57': 0, '57.1-60': 0, '>60': 0, unparsed: 0 }
  let scanned = 0
  let frontEqualsBack = 0   // signature of pattern-matching rather than measuring
  let lrEqualsTb = 0        // ditto: both axes reported identical
  const PAGE = 500
  for (let from = 0; from < overall[10]; from += PAGE) {
    const { data, error } = await s
      .from('cards')
      .select(RATIOS)
      .eq(GRADED, 10)
      .not(RATIOS, 'is', null)
      .range(from, from + PAGE - 1)
    if (error) {
      console.log(`  ! stopped at offset ${from}: ${error.message}`)
      break
    }
    if (!data?.length) break
    for (const row of data) {
      scanned++
      const r: any = (row as any)[RATIOS]
      const fLr = String(r?.front_lr ?? ''), fTb = String(r?.front_tb ?? '')
      const bLr = String(r?.back_lr ?? ''), bTb = String(r?.back_tb ?? '')
      if (fLr && bLr && fLr === bLr && fTb === bTb) frontEqualsBack++
      if (fLr && fTb && fLr === fTb) lrEqualsTb++
      const worst = [parseRatio(fLr), parseRatio(fTb)].filter((x): x is number => x != null)
      if (!worst.length) { buckets.unparsed++; continue }
      const w = Math.max(...worst)
      if (w <= 55) buckets['50-55']++
      else if (w <= 57) buckets['55.1-57']++
      else if (w <= 60) buckets['57.1-60']++
      else buckets['>60']++
    }
    if (data.length < PAGE) break
  }

  console.log(`  scanned ${scanned} grade-10 cards with stored ratios\n`)
  const parsed = scanned - buckets.unparsed
  for (const [k, n] of Object.entries(buckets)) {
    if (k === 'unparsed') continue
    console.log(`  front worse-side ${k.padEnd(9)} ${bar(n, parsed)} ${String(n).padStart(5)}  ${pct(n, parsed)}`)
  }
  console.log(`  unparsed/absent: ${buckets.unparsed}`)
  const atRisk = buckets['55.1-57'] + buckets['57.1-60'] + buckets['>60']
  console.log(
    `\n  >>> B3: tightening the Gem-Mint gate to 55/45 would put ${atRisk} of ${parsed} sampled 10s ` +
    `(${pct(atRisk, parsed)}) below the threshold.`
  )
  console.log(
    `  >>> Caveat: these are the ENGINE'S REPORTED ratios. Per the Aug 2026 centering finding, ` +
    `the engine calls 96% of cards 55/45-or-better while CV says 41%. This measures what tightening\n` +
    `      costs against reported numbers, NOT against true centering.`
  )

  // ---- 5. Is the engine measuring, or pattern-matching? --------------------
  console.log('\n--- Measurement-plausibility signals (grade-10 sample) ---')
  console.log(`  front ratios identical to back:  ${String(frontEqualsBack).padStart(5)}  ${pct(frontEqualsBack, scanned)}`)
  console.log(`  L/R ratio identical to T/B:      ${String(lrEqualsTb).padStart(5)}  ${pct(lrEqualsTb, scanned)}`)
  console.log(
    `\n  A card whose front and back centering genuinely match to the digit is rare;\n` +
    `  so is one whose horizontal and vertical centering match exactly. High rates here\n` +
    `  indicate the model is emitting a plausible ratio rather than measuring one.`
  )

  console.log('\n=== END ===\n')
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
