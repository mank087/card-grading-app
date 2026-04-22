/**
 * Create v8.6 Patch Notes Blog Post (Draft)
 *
 * Usage: npx tsx scripts/create-v86-blog-post.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BLOG_CONTENT = `
<article>
<p>Today we're releasing <strong>DCM Optic v8.6</strong> — a grading engine update driven by a comprehensive statistical analysis of over 8,000 graded cards across every category we support. This release focuses on two key areas: <strong>eliminating image quality bias</strong> and <strong>improving centering measurement accuracy</strong>.</p>

<p>These aren't theoretical improvements. Every change in v8.6 is backed by real data from real cards graded through our system.</p>

<h2>What We Found: 8,000+ Card Analysis</h2>

<p>We built a custom intelligence reporting system that analyzed every card graded through DCM — over 8,000 cards spanning Pokemon, Sports, Magic: The Gathering, Lorcana, One Piece, Yu-Gi-Oh, and more. The analysis examined grade distributions, subgrade patterns, defect frequencies, image confidence impact, and grading consistency across the entire dataset.</p>

<p>Here are the key findings that informed v8.6:</p>

<h3>Finding 1: Image Quality Was Subtly Influencing Grades</h3>

<p>Our analysis revealed that cards photographed with excellent image quality (Grade A confidence) averaged <strong>0.79 points higher</strong> than cards with lower-quality photos (Grade C/D confidence). That's a meaningful gap — and it shouldn't exist.</p>

<p>DCM's grading philosophy has always been clear: <em>image quality affects uncertainty, never the score itself.</em> A blurry photo of a perfect card should receive the same grade as a sharp photo of a perfect card. The only difference should be the confidence range (how certain we are about the grade).</p>

<p>The data showed that while our rubric explicitly prohibited this bias, the AI was occasionally being "conservative" on lower-quality images — deducting points for defects it couldn't confirm rather than simply noting the uncertainty. v8.6 addresses this directly.</p>

<h3>Finding 2: Centering Was the #1 Grade Limiter</h3>

<p>Across all 8,000+ cards, <strong>centering was the limiting factor 41.8% of the time</strong> — nearly double the next most common limiter (corners at 22.8%). For cards that scored a 9, centering was the reason they didn't get a 10 in <strong>72.7% of cases</strong>.</p>

<p>While centering is a legitimate quality factor, our analysis identified that photo-based centering measurement has inherent limitations. A card photographed at even a slight angle can appear more off-center than it actually is. This was unfairly penalizing cards that are well-centered in reality but photographed imperfectly.</p>

<h3>Finding 3: Corner Detection Is Accurate</h3>

<p>We manually reviewed 20 cards that scored low (grades 5-6) with corners as the limiting factor. Every single card had legitimate, visible corner wear. The AI's corner detection is working correctly — no hallucinated defects, no phantom whitening. This validated that our defect detection system is grading based on real, observable evidence.</p>

<h2>What Changed in v8.6</h2>

<h3>Image Confidence Bias Elimination</h3>

<p>v8.6 introduces a <strong>priority hierarchy</strong> for how the grading engine handles low-quality images:</p>

<ol>
<li><strong>Score based on visible evidence only</strong> (highest priority)</li>
<li><strong>Increase uncertainty for what cannot be seen</strong> (second priority)</li>
<li><strong>Inspect thoroughly for defects</strong> (applies only to clearly visible areas)</li>
</ol>

<p>Additionally, every card graded with C or D image confidence now goes through a <strong>mandatory self-check</strong>. The system reviews each subgrade and verifies that no deduction references blur, image quality, or "inability to confirm." Any such deduction is flagged as invalid and re-scored based solely on visible evidence.</p>

<p>The result: your card's grade reflects what we can see on the card — period. If the photo is blurry, you'll see a wider uncertainty range (e.g., Grade 9 ±2 instead of Grade 9 ±0), but the base grade itself won't be penalized.</p>

<h3>Centering Measurement Tolerance</h3>

<p>v8.6 adds explicit recognition that photo-based centering measurement has inherent imprecision:</p>

<ul>
<li><strong>±2% measurement tolerance</strong> on all centering ratios. Ratios in the 55/45 to 57/43 range are scored as 10 unless borders are visibly different at normal viewing distance.</li>
<li><strong>Photo perspective awareness</strong>. When the system detects a card was photographed at an angle (not perfectly flat), it applies additional tolerance before scoring centering. This prevents perspective distortion from unfairly lowering centering scores.</li>
<li><strong>Benefit of the doubt</strong> on borderline cases. When centering falls exactly between two score thresholds, v8.6 assigns the higher score — because the card deserves the benefit of photo measurement imprecision.</li>
</ul>

<h3>Structured Defect Data Backfill</h3>

<p>As part of this update, we also completed a full backfill of structured defect data across all 8,000+ previously graded cards. This powers more detailed defect reporting and enables ongoing analysis to continue improving grading accuracy over time.</p>

<h2>What Didn't Change</h2>

<p>v8.6 is a calibration update, not a methodology change. The fundamentals remain the same:</p>

<ul>
<li><strong>Weakest-link grading</strong> — your final grade equals your lowest subgrade. No averaging away defects.</li>
<li><strong>Three-pass consensus</strong> — every card is evaluated three times independently and averaged for consistency.</li>
<li><strong>Whole number grades (1-10)</strong> with standard rounding.</li>
<li><strong>Four subgrade categories</strong>: Centering, Corners, Edges, and Surface.</li>
<li><strong>Strict defect-based scoring</strong> — deductions require visible evidence. No fabricated defects, no hallucinations.</li>
</ul>

<h2>By the Numbers</h2>

<table>
<thead>
<tr><th>Metric</th><th>Finding</th></tr>
</thead>
<tbody>
<tr><td>Cards analyzed</td><td>8,381</td></tr>
<tr><td>Categories covered</td><td>7 (Pokemon, Sports, MTG, Lorcana, One Piece, Yu-Gi-Oh, Other)</td></tr>
<tr><td>Date range</td><td>December 2025 — April 2026</td></tr>
<tr><td>Image confidence bias (pre-v8.6)</td><td>0.79 grade points</td></tr>
<tr><td>Centering as limiting factor</td><td>41.8% of all cards</td></tr>
<tr><td>Corner detection accuracy</td><td>100% confirmed in manual review</td></tr>
<tr><td>Average grade</td><td>8.25</td></tr>
<tr><td>Grade 9+ rate</td><td>59.0%</td></tr>
</tbody>
</table>

<h2>What This Means for You</h2>

<p>If you've previously graded cards with lower-quality photos, your grades are still valid — but you may see slightly different results if you regrade the same card with v8.6. The grade will more accurately reflect the card's condition rather than being influenced by photo quality.</p>

<p>For the best grading experience, we still recommend:</p>
<ul>
<li>Good, even lighting (natural light works great)</li>
<li>Place your card on a flat, contrasting surface</li>
<li>Hold your phone directly overhead for the most accurate centering assessment</li>
<li>Clear, focused photos — higher confidence means a tighter uncertainty range</li>
</ul>

<p>v8.6 is live now for all new gradings. As always, we're committed to continuous improvement backed by data, not guesswork.</p>

<p><em>— The DCM Team</em></p>
</article>
`

async function main() {
  console.log('Creating v8.6 blog post draft...')

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: 'DCM Optic v8.6: Data-Driven Grading Improvements from 8,000+ Card Analysis',
      subtitle: 'Eliminating image quality bias and improving centering accuracy through comprehensive statistical analysis',
      slug: 'dcm-optic-v8-6-data-driven-grading-improvements',
      excerpt: 'v8.6 introduces image confidence bias elimination and centering measurement tolerance improvements, backed by a statistical analysis of over 8,000 graded cards across all categories.',
      content: BLOG_CONTENT.trim(),
      status: 'draft',
      tags: ['patch-notes', 'grading', 'dcm-optic', 'v8.6', 'data-analysis'],
      author_name: 'DCM Team',
      meta_title: 'DCM Optic v8.6 Patch Notes — Data-Driven Grading Improvements',
      meta_description: 'DCM Optic v8.6 eliminates image quality bias and improves centering accuracy, driven by analysis of 8,000+ graded cards. Read the full patch notes.',
    })
    .select('id, title, slug, status')
    .single()

  if (error) {
    console.error('Error creating post:', error)
    return
  }

  console.log('Blog post created as DRAFT:')
  console.log(`  ID: ${data.id}`)
  console.log(`  Title: ${data.title}`)
  console.log(`  Slug: ${data.slug}`)
  console.log(`  Status: ${data.status}`)
  console.log(`\nTo review: go to Admin Panel > Blog`)
  console.log(`To publish: change status to 'published' in the admin panel`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
