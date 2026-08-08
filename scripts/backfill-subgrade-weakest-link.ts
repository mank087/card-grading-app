/**
 * Backfill: enforce the weakest-link display invariant on historical cards.
 *
 * A card's final grade is MIN(subgrades), so no card should display subgrades
 * above its own grade. Cards graded before v9.12 could: the uncertainty,
 * rigid-case and unanimity gates dropped the final without touching the tiles.
 *
 * Attribution matches visionGrader v9.12:
 *   - if a pass actually scored a category lower, that category carries the
 *     drop (floored at the final grade)
 *   - otherwise the cap came from evidence quality, so all four are capped
 *
 * Never raises a score. Run with --apply to write; default is a dry run.
 *   npx tsx scripts/backfill-subgrade-weakest-link.ts
 *   npx tsx scripts/backfill-subgrade-weakest-link.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'
dotenv.config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CATS = ['centering', 'corners', 'edges', 'surface'] as const
type Cat = typeof CATS[number]

const LOG = `scripts/_backfill-subgrade-${APPLY ? 'applied' : 'dryrun'}.jsonl`
fs.writeFileSync(LOG, '')

interface Row {
  id: string; serial: string | null; created_at: string
  conversational_whole_grade: number | null
  conversational_sub_scores: any
  conversational_weighted_sub_scores: any
  conversational_grading: string | null
  conversational_prompt_version: string | null
}

const shownOf = (ss: any, c: Cat): number | null => {
  const v = ss?.[c]
  if (typeof v === 'number') return v
  if (v && typeof v.weighted === 'number') return v.weighted
  return null
}

async function main() {
  let from = 0
  const PAGE = 1000
  let scanned = 0, fixed = 0, attributed = 0, capped = 0, skippedNoData = 0
  const versions: Record<string, number> = {}

  for (;;) {
    // Supabase occasionally drops a long-running page fetch; retry rather than
    // abandoning a partially-completed backfill.
    let data: any = null, error: any = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      ;({ data, error } = await s.from('cards')
        .select('id, serial, created_at, conversational_whole_grade, conversational_sub_scores, conversational_weighted_sub_scores, conversational_grading, conversational_prompt_version')
        .not('conversational_whole_grade', 'is', null)
        .not('conversational_sub_scores', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1))
      if (!error) break
      console.warn(`  page ${from} attempt ${attempt} failed: ${error.message || error}; retrying…`)
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
    if (error) throw error
    const rows = (data || []) as Row[]
    if (rows.length === 0) break

    for (const r of rows) {
      scanned++
      const final = r.conversational_whole_grade!
      const ss = r.conversational_sub_scores
      const shown: Partial<Record<Cat, number>> = {}
      let haveAll = true
      for (const c of CATS) {
        const v = shownOf(ss, c)
        if (v === null) { haveAll = false; break }
        shown[c] = v
      }
      if (!haveAll) continue
      const minShown = Math.min(...CATS.map(c => shown[c]!))
      if (minShown <= final) continue

      // per-pass scores from the stored report
      let passes: any[] = []
      try {
        const j = JSON.parse(r.conversational_grading || '')
        const gp = j?.grading_passes
        passes = [gp?.pass_1, gp?.pass_2, gp?.pass_3].filter(Boolean)
      } catch { /* no parsable report */ }

      const minAcross = (c: Cat) => passes.length
        ? Math.min(...passes.map(p => (typeof p?.[c] === 'number' ? p[c] : 10)))
        : 10
      const attributable = passes.length ? CATS.filter(c => minAcross(c) < shown[c]!) : []
      const targets: Cat[] = attributable.length ? attributable : [...CATS]

      const next = JSON.parse(JSON.stringify(ss))
      const changes: Record<string, [number, number]> = {}
      for (const c of targets) {
        const v = attributable.length ? Math.max(minAcross(c), final) : final
        if (v >= shown[c]!) continue
        changes[c] = [shown[c]!, v]
        if (typeof next[c] === 'number') next[c] = v
        else {
          next[c].weighted = v
          for (const face of ['front', 'back']) {
            if (typeof next[c][face] === 'number' && next[c][face] > v) next[c][face] = v
          }
        }
      }
      if (Object.keys(changes).length === 0) { skippedNoData++; continue }

      // mirror into the weighted column and the stored report
      const patch: Record<string, any> = { conversational_sub_scores: next }
      if (r.conversational_weighted_sub_scores && typeof r.conversational_weighted_sub_scores === 'object') {
        const w = JSON.parse(JSON.stringify(r.conversational_weighted_sub_scores))
        for (const c of Object.keys(changes) as Cat[]) {
          if (typeof w[c] === 'number' && w[c] > changes[c][1]) w[c] = changes[c][1]
        }
        patch.conversational_weighted_sub_scores = w
      }
      try {
        const j = JSON.parse(r.conversational_grading || '')
        let touched = false
        for (const c of Object.keys(changes) as Cat[]) {
          const v = changes[c][1]
          if (j.weighted_scores && typeof j.weighted_scores[c] === 'number' && j.weighted_scores[c] > v) { j.weighted_scores[c] = v; touched = true }
          if (j.grading_passes?.averaged_rounded && typeof j.grading_passes.averaged_rounded[c] === 'number' && j.grading_passes.averaged_rounded[c] > v) { j.grading_passes.averaged_rounded[c] = v; touched = true }
          for (const face of ['front', 'back']) {
            const k = `${c}_${face}`
            if (j.raw_sub_scores && typeof j.raw_sub_scores[k] === 'number' && j.raw_sub_scores[k] > v) { j.raw_sub_scores[k] = v; touched = true }
          }
        }
        if (touched) patch.conversational_grading = JSON.stringify(j)
      } catch { /* leave report as-is */ }

      fixed++
      if (attributable.length) attributed++; else capped++
      const ver = r.conversational_prompt_version || 'unknown'
      versions[ver] = (versions[ver] || 0) + 1
      fs.appendFileSync(LOG, JSON.stringify({
        id: r.id, serial: r.serial, final, mode: attributable.length ? 'attributed' : 'capped', changes,
      }) + '\n')

      if (APPLY) {
        const { error: upErr } = await s.from('cards').update(patch).eq('id', r.id)
        if (upErr) console.error('UPDATE FAILED', r.serial, upErr.message)
      }
    }

    console.log(`  scanned ${scanned}… fixed ${fixed}`)
    if (rows.length < PAGE) break
    from += PAGE
  }

  console.log('\n=== weakest-link subgrade backfill ===')
  console.log('mode                :', APPLY ? 'APPLIED' : 'DRY RUN (use --apply to write)')
  console.log('cards scanned       :', scanned)
  console.log('cards needing fix   :', fixed)
  console.log('  attributed to pass:', attributed)
  console.log('  evidence-cap (all):', capped)
  console.log('  no usable change  :', skippedNoData)
  console.log('by prompt version   :', JSON.stringify(versions))
  console.log('log                 :', LOG)
}
main().catch(e => { console.error(e); process.exit(1) })
