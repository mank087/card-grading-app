/**
 * Grading Intelligence Report
 *
 * Analyzes 8,000+ graded cards to find patterns, common defects,
 * grading consistency metrics, and improvement opportunities.
 *
 * Usage: npx tsx scripts/grading-intelligence-report.ts
 * Output: output/grading-intelligence-report.md
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load env
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES
// ============================================================================

interface CardRow {
  id: string
  conversational_whole_grade: number | null
  conversational_decimal_grade: number | null
  conversational_condition_label: string | null
  conversational_limiting_factor: string | null
  conversational_weighted_sub_scores: { centering: number; corners: number; edges: number; surface: number } | null
  conversational_sub_scores: any | null
  conversational_defects_front: any | null
  conversational_defects_back: any | null
  conversational_centering: any | null
  conversational_image_confidence: string | null
  conversational_case_detection: any | null
  conversational_grade_uncertainty: string | null
  conversational_prompt_version: string | null
  category: string | null
  rarity_tier: string | null
  print_finish: string | null
  is_foil: boolean | null
  rookie_card: boolean | null
  created_at: string | null
}

// ============================================================================
// DATA FETCH
// ============================================================================

async function fetchAllCards(): Promise<CardRow[]> {
  const allCards: CardRow[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  const columns = [
    'id',
    'conversational_whole_grade', 'conversational_decimal_grade',
    'conversational_condition_label', 'conversational_limiting_factor',
    'conversational_weighted_sub_scores', 'conversational_sub_scores',
    'conversational_defects_front', 'conversational_defects_back',
    'conversational_centering',
    'conversational_image_confidence', 'conversational_case_detection',
    'conversational_grade_uncertainty', 'conversational_prompt_version',
    'category', 'rarity_tier', 'print_finish',
    'is_foil', 'rookie_card',
    'created_at'
  ].join(',')

  while (hasMore) {
    const { data, error } = await supabase
      .from('cards')
      .select(columns)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`Query error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) { hasMore = false; break }

    allCards.push(...(data as CardRow[]))
    console.log(`  Fetched ${allCards.length} cards...`)
    offset += pageSize
    if (data.length < pageSize) hasMore = false
  }

  return allCards
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return (n / total * 100).toFixed(1) + '%'
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function countMap<T>(items: T[]): Map<T, number> {
  const map = new Map<T, number>()
  for (const item of items) map.set(item, (map.get(item) || 0) + 1)
  return map
}

function topN<T>(map: Map<T, number>, n: number): [T, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

function padLeft(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s
}

function tableRow(cols: string[], widths: number[]): string {
  return '| ' + cols.map((c, i) => padRight(c, widths[i])).join(' | ') + ' |'
}

function tableSep(widths: number[]): string {
  return '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |'
}

// ============================================================================
// ANALYSIS 1: GRADE DISTRIBUTION
// ============================================================================

function analyzeGradeDistribution(cards: CardRow[]): string {
  const lines: string[] = ['## 1. Grade Distribution\n']

  // Overall distribution
  const gradeCounts = new Map<number, number>()
  for (let g = 1; g <= 10; g++) gradeCounts.set(g, 0)
  for (const c of cards) {
    const g = c.conversational_whole_grade
    if (g !== null) gradeCounts.set(g, (gradeCounts.get(g) || 0) + 1)
  }

  const w = [8, 8, 10, 40]
  lines.push(tableRow(['Grade', 'Count', 'Percent', 'Histogram'], w))
  lines.push(tableSep(w))
  for (let g = 10; g >= 1; g--) {
    const count = gradeCounts.get(g) || 0
    const bar = '#'.repeat(Math.round(count / cards.length * 100))
    lines.push(tableRow([g.toString(), count.toString(), pct(count, cards.length), bar], w))
  }

  const avgGrade = avg(cards.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!))
  const grade10Count = gradeCounts.get(10) || 0
  const grade9PlusCount = grade10Count + (gradeCounts.get(9) || 0)

  lines.push('')
  lines.push(`**Average grade**: ${avgGrade.toFixed(2)}`)
  lines.push(`**Median grade**: ${median(cards.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!))}`)
  lines.push(`**Grade 10 rate**: ${pct(grade10Count, cards.length)} (${grade10Count} cards)`)
  lines.push(`**Grade 9+ rate**: ${pct(grade9PlusCount, cards.length)} (${grade9PlusCount} cards)`)

  // By category
  lines.push('\n### Grade Distribution by Category\n')
  const categories = [...new Set(cards.map(c => c.category || 'Unknown'))]
  const cw = [15, 8, 8, 8, 8, 8]
  lines.push(tableRow(['Category', 'Cards', 'Avg', 'Median', '10 Rate', '9+ Rate'], cw))
  lines.push(tableSep(cw))

  for (const cat of categories.sort()) {
    const catCards = cards.filter(c => (c.category || 'Unknown') === cat)
    const grades = catCards.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    const nines = grades.filter(g => g >= 9).length
    lines.push(tableRow([
      cat, catCards.length.toString(), avg(grades).toFixed(1),
      median(grades).toString(), pct(tens, grades.length), pct(nines, grades.length)
    ], cw))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 2: LIMITING FACTOR
// ============================================================================

function analyzeLimitingFactor(cards: CardRow[]): string {
  const lines: string[] = ['## 2. Limiting Factor Analysis\n']
  lines.push('Which subgrade most often determines (caps) the final grade?\n')

  const withFactor = cards.filter(c => c.conversational_limiting_factor)
  const factorCounts = countMap(withFactor.map(c => c.conversational_limiting_factor!.toLowerCase()))

  const w = [12, 8, 10]
  lines.push(tableRow(['Factor', 'Count', 'Percent'], w))
  lines.push(tableSep(w))
  for (const [factor, count] of topN(factorCounts, 10)) {
    lines.push(tableRow([factor, count.toString(), pct(count, withFactor.length)], w))
  }

  // By grade tier
  lines.push('\n### Limiting Factor by Grade Tier\n')
  const tiers = [
    { label: 'Grade 10', filter: (g: number) => g === 10 },
    { label: 'Grade 9', filter: (g: number) => g === 9 },
    { label: 'Grade 7-8', filter: (g: number) => g >= 7 && g <= 8 },
    { label: 'Grade 5-6', filter: (g: number) => g >= 5 && g <= 6 },
    { label: 'Grade 1-4', filter: (g: number) => g >= 1 && g <= 4 },
  ]

  const tw = [12, 12, 12, 12, 12]
  lines.push(tableRow(['Tier', 'Centering', 'Corners', 'Edges', 'Surface'], tw))
  lines.push(tableSep(tw))
  for (const tier of tiers) {
    const tierCards = withFactor.filter(c => c.conversational_whole_grade !== null && tier.filter(c.conversational_whole_grade!))
    const fc = countMap(tierCards.map(c => c.conversational_limiting_factor!.toLowerCase()))
    lines.push(tableRow([
      tier.label,
      pct(fc.get('centering') || 0, tierCards.length),
      pct(fc.get('corners') || 0, tierCards.length),
      pct(fc.get('edges') || 0, tierCards.length),
      pct(fc.get('surface') || 0, tierCards.length),
    ], tw))
  }

  // By category
  lines.push('\n### Limiting Factor by Category\n')
  const categories = [...new Set(cards.map(c => c.category || 'Unknown'))].sort()
  lines.push(tableRow(['Category', 'Centering', 'Corners', 'Edges', 'Surface'], tw))
  lines.push(tableSep(tw))
  for (const cat of categories) {
    const catCards = withFactor.filter(c => (c.category || 'Unknown') === cat)
    if (catCards.length < 5) continue
    const fc = countMap(catCards.map(c => c.conversational_limiting_factor!.toLowerCase()))
    lines.push(tableRow([
      cat,
      pct(fc.get('centering') || 0, catCards.length),
      pct(fc.get('corners') || 0, catCards.length),
      pct(fc.get('edges') || 0, catCards.length),
      pct(fc.get('surface') || 0, catCards.length),
    ], tw))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 3: SUBGRADE DISTRIBUTIONS
// ============================================================================

function analyzeSubgrades(cards: CardRow[]): string {
  const lines: string[] = ['## 3. Subgrade Score Distributions\n']

  const withScores = cards.filter(c => c.conversational_weighted_sub_scores)
  const centering: number[] = [], corners: number[] = [], edges: number[] = [], surface: number[] = []

  for (const c of withScores) {
    const s = c.conversational_weighted_sub_scores!
    if (typeof s.centering === 'number' && !isNaN(s.centering)) centering.push(s.centering)
    if (typeof s.corners === 'number' && !isNaN(s.corners)) corners.push(s.corners)
    if (typeof s.edges === 'number' && !isNaN(s.edges)) edges.push(s.edges)
    if (typeof s.surface === 'number' && !isNaN(s.surface)) surface.push(s.surface)
  }

  const w = [12, 8, 8, 8, 8, 8]
  lines.push(tableRow(['Subgrade', 'Avg', 'Median', 'Min', 'Max', 'Cards'], w))
  lines.push(tableSep(w))

  const stats = [
    { name: 'Centering', data: centering },
    { name: 'Corners', data: corners },
    { name: 'Edges', data: edges },
    { name: 'Surface', data: surface },
  ]

  for (const s of stats) {
    const sorted = [...s.data].sort((a, b) => a - b)
    lines.push(tableRow([
      s.name,
      avg(s.data).toFixed(2),
      median(s.data).toFixed(1),
      (sorted[0] ?? 0).toString(),
      (sorted[sorted.length - 1] ?? 0).toString(),
      s.data.length.toString(),
    ], w))
  }

  // Per-subgrade distribution (how many score 10, 9, 8, etc.)
  lines.push('\n### Subgrade Score Frequency\n')
  const dw = [8, 12, 12, 12, 12]
  lines.push(tableRow(['Score', 'Centering', 'Corners', 'Edges', 'Surface'], dw))
  lines.push(tableSep(dw))
  for (let g = 10; g >= 1; g--) {
    lines.push(tableRow([
      g.toString(),
      pct(centering.filter(v => Math.round(v) === g).length, centering.length),
      pct(corners.filter(v => Math.round(v) === g).length, corners.length),
      pct(edges.filter(v => Math.round(v) === g).length, edges.length),
      pct(surface.filter(v => Math.round(v) === g).length, surface.length),
    ], dw))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 4: DEFECT PATTERNS
// ============================================================================

function analyzeDefects(cards: CardRow[]): string {
  const lines: string[] = ['## 4. Defect Pattern Analysis\n']

  // Count defects by location and severity
  interface DefectStat { location: string; side: string; severity: string; count: number }
  const defectMap = new Map<string, number>()
  const severityMap = new Map<string, number>()
  const locationMap = new Map<string, number>()
  let totalDefects = 0
  let cardsWithDefects = 0

  for (const card of cards) {
    let hasDefect = false

    for (const [side, defects] of [['front', card.conversational_defects_front], ['back', card.conversational_defects_back]] as const) {
      if (!defects) continue

      // Handle BOTH data formats:
      // Format A (transformedDefects): { corners: { condition: "...", defects: [{description, severity, location}] } }
      // Format B (SideDefects):        { corners: { top_left: { severity, description } } }

      for (const area of ['corners', 'edges', 'surface'] as const) {
        const areaData = defects[area]
        if (!areaData) continue

        // Format A: has a 'defects' array
        if (Array.isArray(areaData.defects)) {
          for (const d of areaData.defects) {
            if (d?.description && d.description !== 'N/A' && d.description !== 'none') {
              const sev = d.severity || 'minor'
              const loc = d.location || area
              defectMap.set(`${side}:${loc}:${sev}`, (defectMap.get(`${side}:${loc}:${sev}`) || 0) + 1)
              severityMap.set(sev, (severityMap.get(sev) || 0) + 1)
              locationMap.set(loc, (locationMap.get(loc) || 0) + 1)
              totalDefects++
              hasDefect = true
            }
          }
        } else {
          // Format B: nested per-location objects
          for (const [pos, data] of Object.entries(areaData) as [string, any][]) {
            if (pos === 'condition' || pos === 'defects') continue // skip Format A fields
            if (data?.severity && data.severity !== 'none') {
              const key = `${side}:${area}:${pos}:${data.severity}`
              defectMap.set(key, (defectMap.get(key) || 0) + 1)
              severityMap.set(data.severity, (severityMap.get(data.severity) || 0) + 1)
              locationMap.set(`${area}:${pos}`, (locationMap.get(`${area}:${pos}`) || 0) + 1)
              totalDefects++
              hasDefect = true
            }
          }
        }
      }
    }

    if (hasDefect) cardsWithDefects++
  }

  lines.push(`**Cards with any defect**: ${cardsWithDefects} / ${cards.length} (${pct(cardsWithDefects, cards.length)})`)
  lines.push(`**Total defects detected**: ${totalDefects}`)
  lines.push(`**Avg defects per card**: ${(totalDefects / cards.length).toFixed(1)}`)

  // Severity breakdown
  lines.push('\n### Defects by Severity\n')
  const sw = [12, 8, 10]
  lines.push(tableRow(['Severity', 'Count', 'Percent'], sw))
  lines.push(tableSep(sw))
  for (const [sev, count] of topN(severityMap, 10)) {
    lines.push(tableRow([sev, count.toString(), pct(count, totalDefects)], sw))
  }

  // Most common defect locations
  lines.push('\n### Most Common Defect Locations\n')
  const lw = [25, 8, 10]
  lines.push(tableRow(['Location', 'Count', 'Per Card'], lw))
  lines.push(tableSep(lw))
  for (const [loc, count] of topN(locationMap, 20)) {
    lines.push(tableRow([loc, count.toString(), pct(count, cards.length)], lw))
  }

  // Front vs back
  let frontCount = 0, backCount = 0
  for (const [key, count] of defectMap) {
    if (key.startsWith('front:')) frontCount += count
    else backCount += count
  }
  lines.push(`\n**Front-side defects**: ${frontCount} (${pct(frontCount, totalDefects)})`)
  lines.push(`**Back-side defects**: ${backCount} (${pct(backCount, totalDefects)})`)

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 5: THREE-PASS CONSISTENCY
// ============================================================================

function analyzeConsistency(cards: CardRow[]): string {
  const lines: string[] = ['## 5. Three-Pass Consistency Analysis\n']

  // Three-pass data is embedded in conversational_grading (markdown/JSON), not a separate column.
  // We can infer consistency from the sub_scores data by comparing raw vs weighted scores.
  lines.push('*Note: Three-pass detailed data is embedded in the grading markdown, not a separate queryable column.*')
  lines.push('*This section analyzes consistency using available subgrade data.*\n')

  // Analyze agreement between sub_scores and weighted_sub_scores
  const withBoth = cards.filter(c => c.conversational_sub_scores && c.conversational_weighted_sub_scores)
  lines.push(`**Cards with subgrade data**: ${withBoth.length}\n`)

  if (withBoth.length === 0) {
    lines.push('No subgrade data available for consistency analysis.')
    return lines.join('\n')
  }

  // Look at the spread between subgrades within each card
  // A card with centering=10, corners=10, edges=10, surface=5 has high internal variance
  const internalVariances: number[] = []
  const spreadCounts = new Map<string, number>()

  for (const c of withBoth) {
    const w = c.conversational_weighted_sub_scores!
    const scores = [w.centering, w.corners, w.edges, w.surface].filter(s => s !== undefined && s !== null)
    if (scores.length < 4) continue
    const maxS = Math.max(...scores)
    const minS = Math.min(...scores)
    const spread = maxS - minS
    internalVariances.push(spread)

    const bucket = spread === 0 ? '0 (perfect)' : spread <= 1 ? '1' : spread <= 2 ? '2' : spread <= 3 ? '3' : '4+'
    spreadCounts.set(bucket, (spreadCounts.get(bucket) || 0) + 1)
  }

  lines.push('### Internal Subgrade Spread (Max - Min across 4 subgrades per card)\n')
  lines.push(`**Average spread**: ${avg(internalVariances).toFixed(2)}`)
  lines.push(`**Median spread**: ${median(internalVariances).toFixed(1)}`)
  lines.push(`**Cards with 0 spread (all subgrades equal)**: ${internalVariances.filter(v => v === 0).length} (${pct(internalVariances.filter(v => v === 0).length, internalVariances.length)})`)
  lines.push(`**Cards with 3+ spread (one subgrade much weaker)**: ${internalVariances.filter(v => v >= 3).length} (${pct(internalVariances.filter(v => v >= 3).length, internalVariances.length)})\n`)

  const sw = [15, 8, 10]
  lines.push(tableRow(['Spread', 'Count', 'Percent'], sw))
  lines.push(tableSep(sw))
  for (const bucket of ['0 (perfect)', '1', '2', '3', '4+']) {
    const count = spreadCounts.get(bucket) || 0
    lines.push(tableRow([bucket, count.toString(), pct(count, internalVariances.length)], sw))
  }

  // Grade uncertainty distribution
  lines.push('\n### Grade Uncertainty Distribution\n')
  const uncertainties = countMap(cards.filter(c => c.conversational_grade_uncertainty !== null).map(c => String(c.conversational_grade_uncertainty)))
  const uw = [15, 8, 10]
  lines.push(tableRow(['Uncertainty', 'Count', 'Percent'], uw))
  lines.push(tableSep(uw))
  for (const [unc, count] of topN(uncertainties, 10)) {
    lines.push(tableRow([unc, count.toString(), pct(count, cards.length)], uw))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 6: IMAGE CONFIDENCE IMPACT
// ============================================================================

function analyzeImageConfidence(cards: CardRow[]): string {
  const lines: string[] = ['## 6. Image Confidence Impact\n']
  lines.push('Does image quality (A/B/C/D) affect the grade assigned?\n')

  const withConfidence = cards.filter(c => c.conversational_image_confidence)
  const confMap = new Map<string, CardRow[]>()
  for (const c of withConfidence) {
    const conf = c.conversational_image_confidence!
    if (!confMap.has(conf)) confMap.set(conf, [])
    confMap.get(conf)!.push(c)
  }

  const w = [12, 8, 8, 8, 8, 8]
  lines.push(tableRow(['Confidence', 'Cards', 'Avg Grade', 'Median', '10 Rate', '9+ Rate'], w))
  lines.push(tableSep(w))

  for (const conf of ['A', 'B', 'C', 'D']) {
    const group = confMap.get(conf) || []
    if (group.length === 0) continue
    const grades = group.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    const nines = grades.filter(g => g >= 9).length
    lines.push(tableRow([
      `Grade ${conf}`,
      group.length.toString(),
      avg(grades).toFixed(2),
      median(grades).toString(),
      pct(tens, grades.length),
      pct(nines, grades.length),
    ], w))
  }

  // Bias check
  const gradeA = confMap.get('A') || []
  const gradeCD = [...(confMap.get('C') || []), ...(confMap.get('D') || [])]
  if (gradeA.length > 0 && gradeCD.length > 0) {
    const avgA = avg(gradeA.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!))
    const avgCD = avg(gradeCD.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!))
    const diff = avgA - avgCD
    lines.push(`\n**Bias check**: Grade-A images avg ${avgA.toFixed(2)} vs. C/D images avg ${avgCD.toFixed(2)} (diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)})`)
    if (Math.abs(diff) > 0.5) {
      lines.push('**WARNING**: Significant gap between high and low confidence images. The rubric may be penalizing blurry images instead of only adjusting uncertainty.')
    } else {
      lines.push('Blur bias appears minimal — image quality affects uncertainty, not score.')
    }
  }

  // Confidence by category
  lines.push('\n### Image Confidence by Category\n')
  const categories = [...new Set(cards.map(c => c.category || 'Unknown'))].sort()
  const cw2 = [15, 8, 8, 8, 8]
  lines.push(tableRow(['Category', 'A Rate', 'B Rate', 'C Rate', 'D Rate'], cw2))
  lines.push(tableSep(cw2))
  for (const cat of categories) {
    const catCards = withConfidence.filter(c => (c.category || 'Unknown') === cat)
    if (catCards.length < 5) continue
    lines.push(tableRow([
      cat,
      pct(catCards.filter(c => c.conversational_image_confidence === 'A').length, catCards.length),
      pct(catCards.filter(c => c.conversational_image_confidence === 'B').length, catCards.length),
      pct(catCards.filter(c => c.conversational_image_confidence === 'C').length, catCards.length),
      pct(catCards.filter(c => c.conversational_image_confidence === 'D').length, catCards.length),
    ], cw2))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 7: CENTERING DEEP DIVE
// ============================================================================

function analyzeCentering(cards: CardRow[]): string {
  const lines: string[] = ['## 7. Centering Analysis\n']

  const withCentering = cards.filter(c => c.conversational_centering?.centering_score !== undefined)
  lines.push(`**Cards with centering data**: ${withCentering.length}\n`)

  if (withCentering.length === 0) {
    lines.push('No centering data available.')
    return lines.join('\n')
  }

  const scores = withCentering.map(c => c.conversational_centering.centering_score)
  lines.push(`**Average centering score**: ${avg(scores).toFixed(2)}`)
  lines.push(`**Median centering score**: ${median(scores)}`)

  // Front vs back quality tier
  const frontTiers = countMap(withCentering.map(c => c.conversational_centering.front_quality_tier || 'Unknown'))
  const backTiers = countMap(withCentering.map(c => c.conversational_centering.back_quality_tier || 'Unknown'))

  lines.push('\n### Front Centering Quality\n')
  const tw = [15, 8, 10]
  lines.push(tableRow(['Tier', 'Count', 'Percent'], tw))
  lines.push(tableSep(tw))
  for (const [tier, count] of topN(frontTiers, 10)) {
    lines.push(tableRow([tier as string, count.toString(), pct(count, withCentering.length)], tw))
  }

  lines.push('\n### Back Centering Quality\n')
  lines.push(tableRow(['Tier', 'Count', 'Percent'], tw))
  lines.push(tableSep(tw))
  for (const [tier, count] of topN(backTiers, 10)) {
    lines.push(tableRow([tier as string, count.toString(), pct(count, withCentering.length)], tw))
  }

  // Centering as limiting factor frequency
  const centeringLimiting = cards.filter(c => c.conversational_limiting_factor?.toLowerCase() === 'centering').length
  lines.push(`\n**Centering as limiting factor**: ${centeringLimiting} / ${cards.length} (${pct(centeringLimiting, cards.length)})`)

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 8: CASE DETECTION IMPACT
// ============================================================================

function analyzeCaseImpact(cards: CardRow[]): string {
  const lines: string[] = ['## 8. Case/Holder Impact Analysis\n']

  const withCase = cards.filter(c => c.conversational_case_detection?.case_type)
  lines.push(`**Cards with case detection data**: ${withCase.length}\n`)

  if (withCase.length === 0) {
    lines.push('No case detection data available.')
    return lines.join('\n')
  }

  const caseGroups = new Map<string, CardRow[]>()
  for (const c of withCase) {
    const type = c.conversational_case_detection.case_type
    if (!caseGroups.has(type)) caseGroups.set(type, [])
    caseGroups.get(type)!.push(c)
  }

  const w = [15, 8, 8, 8, 12]
  lines.push(tableRow(['Case Type', 'Cards', 'Avg Grade', '10 Rate', 'Avg Confidence'], w))
  lines.push(tableSep(w))

  for (const [caseType, group] of [...caseGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const grades = group.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    const confScores = group.filter(c => c.conversational_image_confidence).map(c => {
      const conf = c.conversational_image_confidence!
      return conf === 'A' ? 4 : conf === 'B' ? 3 : conf === 'C' ? 2 : 1
    })
    lines.push(tableRow([
      caseType,
      group.length.toString(),
      avg(grades).toFixed(2),
      pct(tens, grades.length),
      avg(confScores).toFixed(1) + '/4',
    ], w))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 9: TEMPORAL TRENDS
// ============================================================================

function analyzeTemporalTrends(cards: CardRow[]): string {
  const lines: string[] = ['## 9. Temporal Trends\n']

  // Group by month
  const monthGroups = new Map<string, CardRow[]>()
  for (const c of cards) {
    if (!c.created_at) continue
    const month = c.created_at.substring(0, 7) // YYYY-MM
    if (!monthGroups.has(month)) monthGroups.set(month, [])
    monthGroups.get(month)!.push(c)
  }

  const months = [...monthGroups.keys()].sort()
  const w = [10, 8, 8, 8, 8]
  lines.push(tableRow(['Month', 'Cards', 'Avg Grade', '10 Rate', '9+ Rate'], w))
  lines.push(tableSep(w))

  for (const month of months) {
    const group = monthGroups.get(month)!
    const grades = group.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    const nines = grades.filter(g => g >= 9).length
    lines.push(tableRow([
      month,
      group.length.toString(),
      avg(grades).toFixed(2),
      pct(tens, grades.length),
      pct(nines, grades.length),
    ], w))
  }

  // Prompt version comparison
  lines.push('\n### By Prompt Version\n')
  const versionGroups = new Map<string, CardRow[]>()
  for (const c of cards) {
    const v = c.conversational_prompt_version || 'unknown'
    if (!versionGroups.has(v)) versionGroups.set(v, [])
    versionGroups.get(v)!.push(c)
  }

  const vw = [20, 8, 8, 8]
  lines.push(tableRow(['Version', 'Cards', 'Avg Grade', '10 Rate'], vw))
  lines.push(tableSep(vw))
  for (const [version, group] of [...versionGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const grades = group.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    lines.push(tableRow([
      version.substring(0, 20),
      group.length.toString(),
      avg(grades).toFixed(2),
      pct(tens, grades.length),
    ], vw))
  }

  return lines.join('\n')
}

// ============================================================================
// ANALYSIS 10: FOIL / HOLO IMPACT
// ============================================================================

function analyzeFoilImpact(cards: CardRow[]): string {
  const lines: string[] = ['## 10. Foil / Holo / Variant Impact\n']

  const foilCards = cards.filter(c => c.is_foil === true || c.print_finish === 'foil' || c.print_finish === 'holo')
  const nonFoilCards = cards.filter(c => !c.is_foil && (!c.print_finish || c.print_finish === 'standard_gloss' || c.print_finish === 'matte'))

  if (foilCards.length < 5) {
    lines.push(`Only ${foilCards.length} foil/holo cards found — insufficient for analysis.`)
    return lines.join('\n')
  }

  const w = [15, 8, 8, 8, 8]
  lines.push(tableRow(['Type', 'Cards', 'Avg Grade', '10 Rate', 'Avg Conf'], w))
  lines.push(tableSep(w))

  for (const [label, group] of [['Foil/Holo', foilCards], ['Non-Foil', nonFoilCards]] as const) {
    const grades = group.filter(c => c.conversational_whole_grade !== null).map(c => c.conversational_whole_grade!)
    const tens = grades.filter(g => g === 10).length
    const confScores = group.filter(c => c.conversational_image_confidence).map(c => {
      const conf = c.conversational_image_confidence!
      return conf === 'A' ? 4 : conf === 'B' ? 3 : conf === 'C' ? 2 : 1
    })
    lines.push(tableRow([
      label,
      group.length.toString(),
      avg(grades).toFixed(2),
      pct(tens, grades.length),
      confScores.length > 0 ? avg(confScores).toFixed(1) + '/4' : 'N/A',
    ], w))
  }

  // Print finish breakdown
  const finishGroups = countMap(cards.filter(c => c.print_finish).map(c => c.print_finish!))
  if (finishGroups.size > 1) {
    lines.push('\n### By Print Finish\n')
    const fw = [20, 8, 10]
    lines.push(tableRow(['Finish', 'Count', 'Percent'], fw))
    lines.push(tableSep(fw))
    for (const [finish, count] of topN(finishGroups, 15)) {
      lines.push(tableRow([finish, count.toString(), pct(count, cards.length)], fw))
    }
  }

  return lines.join('\n')
}

// ============================================================================
// OUTLIER DETECTION
// ============================================================================

function analyzeOutliers(cards: CardRow[]): string {
  const lines: string[] = ['## 11. Outlier Alerts\n']

  // High-grade + low-confidence (suspicious)
  const highGradeLowConf = cards.filter(c =>
    c.conversational_whole_grade !== null && c.conversational_whole_grade >= 9 &&
    (c.conversational_image_confidence === 'C' || c.conversational_image_confidence === 'D')
  )
  lines.push(`**Grade 9+ with C/D image confidence**: ${highGradeLowConf.length} cards`)
  if (highGradeLowConf.length > 0 && highGradeLowConf.length <= 20) {
    for (const c of highGradeLowConf.slice(0, 10)) {
      lines.push(`  - ID: ${c.id.substring(0, 8)}... | Grade: ${c.conversational_whole_grade} | Confidence: ${c.conversational_image_confidence} | Category: ${c.category}`)
    }
  }

  // High internal subgrade spread (one subgrade much weaker than others)
  const highSpread = cards.filter(c => {
    if (!c.conversational_weighted_sub_scores) return false
    const w = c.conversational_weighted_sub_scores
    const scores = [w.centering, w.corners, w.edges, w.surface].filter(s => s !== undefined && s !== null)
    if (scores.length < 4) return false
    return Math.max(...scores) - Math.min(...scores) >= 4
  })
  lines.push(`\n**High subgrade spread (4+ gap)**: ${highSpread.length} cards`)
  if (highSpread.length > 0 && highSpread.length <= 20) {
    for (const c of highSpread.slice(0, 10)) {
      const w = c.conversational_weighted_sub_scores!
      lines.push(`  - ID: ${c.id.substring(0, 8)}... | Grade: ${c.conversational_whole_grade} | C:${w.centering} Co:${w.corners} E:${w.edges} S:${w.surface} | ${c.category}`)
    }
  }

  // Grade 10 with any moderate/heavy defects
  const perfect10WithDefects = cards.filter(c => {
    if (c.conversational_whole_grade !== 10) return false
    for (const defects of [c.conversational_defects_front, c.conversational_defects_back]) {
      if (!defects) continue
      for (const area of [defects.corners, defects.edges, defects.surface]) {
        if (!area) continue
        for (const data of Object.values(area) as any[]) {
          if (data?.severity === 'moderate' || data?.severity === 'heavy') return true
        }
      }
    }
    return false
  })
  lines.push(`\n**Grade 10 with moderate/heavy defects**: ${perfect10WithDefects.length} cards`)
  if (perfect10WithDefects.length > 0 && perfect10WithDefects.length <= 20) {
    for (const c of perfect10WithDefects.slice(0, 10)) {
      lines.push(`  - ID: ${c.id.substring(0, 8)}... | Category: ${c.category}`)
    }
  }

  return lines.join('\n')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== DCM Grading Intelligence Report ===\n')
  console.log('Fetching all graded cards...')

  const cards = await fetchAllCards()
  console.log(`\nTotal graded cards: ${cards.length}\n`)

  if (cards.length === 0) {
    console.error('No graded cards found!')
    return
  }

  console.log('Running analyses...')

  const sections: string[] = []

  // Header
  sections.push(`# DCM Grading Intelligence Report`)
  sections.push(``)
  sections.push(`**Generated**: ${new Date().toISOString().split('T')[0]}`)
  sections.push(`**Total graded cards analyzed**: ${cards.length}`)
  sections.push(`**Date range**: ${cards[0]?.created_at?.substring(0, 10) || 'unknown'} to ${cards[cards.length - 1]?.created_at?.substring(0, 10) || 'unknown'}`)
  sections.push(`**Categories**: ${[...new Set(cards.map(c => c.category || 'Unknown'))].sort().join(', ')}`)
  sections.push('')
  sections.push('---')
  sections.push('')

  // Run all analyses
  console.log('  1/11 Grade distribution...')
  sections.push(analyzeGradeDistribution(cards))
  sections.push('\n---\n')

  console.log('  2/11 Limiting factor...')
  sections.push(analyzeLimitingFactor(cards))
  sections.push('\n---\n')

  console.log('  3/11 Subgrade distributions...')
  sections.push(analyzeSubgrades(cards))
  sections.push('\n---\n')

  console.log('  4/11 Defect patterns...')
  sections.push(analyzeDefects(cards))
  sections.push('\n---\n')

  console.log('  5/11 Three-pass consistency...')
  sections.push(analyzeConsistency(cards))
  sections.push('\n---\n')

  console.log('  6/11 Image confidence impact...')
  sections.push(analyzeImageConfidence(cards))
  sections.push('\n---\n')

  console.log('  7/11 Centering analysis...')
  sections.push(analyzeCentering(cards))
  sections.push('\n---\n')

  console.log('  8/11 Case/holder impact...')
  sections.push(analyzeCaseImpact(cards))
  sections.push('\n---\n')

  console.log('  9/11 Temporal trends...')
  sections.push(analyzeTemporalTrends(cards))
  sections.push('\n---\n')

  console.log('  10/11 Foil/holo impact...')
  sections.push(analyzeFoilImpact(cards))
  sections.push('\n---\n')

  console.log('  11/11 Outlier detection...')
  sections.push(analyzeOutliers(cards))

  // Write report
  const report = sections.join('\n')
  const outputDir = path.join(__dirname, '..', 'output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'grading-intelligence-report.md')
  fs.writeFileSync(outputPath, report)

  console.log(`\nReport saved to: ${outputPath}`)
  console.log(`Report size: ${(report.length / 1024).toFixed(1)} KB`)
  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
