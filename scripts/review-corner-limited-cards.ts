/**
 * Corner-Limited Card Review
 *
 * Pulls 20 cards graded 5-6 with corners as the limiting factor
 * for manual hallucination review. Outputs card IDs, grades,
 * corner descriptions, and public page URLs.
 *
 * Usage: npx tsx scripts/review-corner-limited-cards.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Fetching corner-limited cards (grade 5-6)...\n')

  const { data: cards, error } = await supabase
    .from('cards')
    .select(`
      id, serial, category,
      conversational_whole_grade, conversational_decimal_grade,
      conversational_condition_label, conversational_limiting_factor,
      conversational_weighted_sub_scores,
      conversational_defects_front, conversational_defects_back,
      conversational_front_summary, conversational_back_summary,
      conversational_image_confidence,
      front_path, back_path, created_at
    `)
    .in('conversational_whole_grade', [5, 6])
    .ilike('conversational_limiting_factor', '%corner%')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Query error:', error.message)
    return
  }

  if (!cards || cards.length === 0) {
    console.log('No corner-limited grade 5-6 cards found.')
    return
  }

  const lines: string[] = []
  lines.push('# Corner-Limited Card Review (Grades 5-6)')
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`)
  lines.push(`Cards found: ${cards.length}`)
  lines.push('')

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    const scores = c.conversational_weighted_sub_scores || {}
    const categoryPath = (c.category || 'other').toLowerCase().replace(' ', '')

    lines.push(`---`)
    lines.push(`### Card ${i + 1}: ${c.serial || c.id.substring(0, 8)}`)
    lines.push(`- **Page**: https://dcmgrading.com/${categoryPath}/${c.id}`)
    lines.push(`- **Category**: ${c.category}`)
    lines.push(`- **Grade**: ${c.conversational_whole_grade} (${c.conversational_condition_label})`)
    lines.push(`- **Confidence**: ${c.conversational_image_confidence}`)
    lines.push(`- **Limiting Factor**: ${c.conversational_limiting_factor}`)
    lines.push(`- **Subgrades**: C:${scores.centering ?? '?'} Co:${scores.corners ?? '?'} E:${scores.edges ?? '?'} S:${scores.surface ?? '?'}`)
    lines.push(`- **Date**: ${c.created_at?.substring(0, 10)}`)

    // Front defect details
    if (c.conversational_defects_front?.corners) {
      const corners = c.conversational_defects_front.corners
      if (corners.condition) {
        lines.push(`- **Front corners condition**: ${corners.condition}`)
      }
      if (Array.isArray(corners.defects) && corners.defects.length > 0) {
        lines.push(`- **Front corner defects**:`)
        for (const d of corners.defects) {
          lines.push(`  - [${d.severity || '?'}] ${d.location || '?'}: ${d.description}`)
        }
      }
    }

    // Back defect details
    if (c.conversational_defects_back?.corners) {
      const corners = c.conversational_defects_back.corners
      if (corners.condition) {
        lines.push(`- **Back corners condition**: ${corners.condition}`)
      }
      if (Array.isArray(corners.defects) && corners.defects.length > 0) {
        lines.push(`- **Back corner defects**:`)
        for (const d of corners.defects) {
          lines.push(`  - [${d.severity || '?'}] ${d.location || '?'}: ${d.description}`)
        }
      }
    }

    // Summaries
    if (c.conversational_front_summary) {
      lines.push(`- **Front summary**: ${c.conversational_front_summary.substring(0, 200)}`)
    }
    if (c.conversational_back_summary) {
      lines.push(`- **Back summary**: ${c.conversational_back_summary.substring(0, 200)}`)
    }

    lines.push('')
  }

  lines.push('---')
  lines.push('## Review Instructions')
  lines.push('1. Open each card page URL above')
  lines.push('2. View the front and back images')
  lines.push('3. Check if the reported corner defects are actually visible')
  lines.push('4. Mark each card as: CONFIRMED (defects real) / HALLUCINATED (defects not visible) / AMBIGUOUS')
  lines.push('5. If >20% are hallucinated, the corner detection rubric needs anti-hallucination strengthening')

  const report = lines.join('\n')
  const outputPath = path.join(__dirname, '..', 'output', 'corner-review-cards.md')
  fs.writeFileSync(outputPath, report)
  console.log(report)
  console.log(`\nSaved to: ${outputPath}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
