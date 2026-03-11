import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createPost() {
  // Get the "news" category
  const { data: category } = await supabase
    .from('blog_categories')
    .select('id')
    .eq('slug', 'news')
    .single();

  if (!category) {
    console.error('Could not find "news" category');
    process.exit(1);
  }

  const content = `## What's New

DCM Optic v8.4 ships two significant changes: a leaner grading engine and a completely restructured card detail page. Both updates are live now across all six supported card types — Pokemon, MTG, Sports, Lorcana, One Piece, and Other.

---

## Grading Engine: Rubric v7.4.2

The master grading rubric that powers every DCM Optic grade has been streamlined from v7.3 to v7.4.2. The goal was clarity and reduced token overhead — tighter instructions mean the AI spends more of its context window actually analyzing your card, not parsing verbose flowcharts.

**Key changes:**

- **Compact execution order** — The multi-phase flowchart has been replaced with a 10-step linear execution sequence. Same logic, less ambiguity.
- **Strengthened weakest-link rule** — The 1:1 subgrade cap is now explicit in the core rules: if your lowest subgrade is a 7, your final grade is capped at 7. No exceptions.
- **Cleaner cap priority system** — Structural damage, visible defects, defect-based caps, and weakest-link caps are now presented in a flat priority table instead of nested boxes.
- **Image artifact distinction** — Rules 13 and 14 (image artifacts vs. real defects, blur handling) are now permanent core rules rather than addenda.
- **Card-type deltas updated** — All six card-type delta prompts (Pokemon, MTG, Sports, Lorcana, One Piece, Other) have been updated to reference the new rubric structure.

The grading methodology itself hasn't changed — three-pass consensus, dominant defect control, whole-number floor rounding. This is a prompt engineering optimization, not a scoring change.

---

## Card Detail Page Redesign

The card detail page has been rebuilt from a long vertical scroll into a focused hero zone with collapsible accordion sections.

### Hero Zone (Always Visible)

The top of the page now shows only what matters at a glance:

- Front and back card images with metallic grade labels — **clean, no defect markers**
- Grade hero banner with overall score, condition label, and confidence badge
- Sub-score circles for Centering, Corners, Edges, and Surface
- Overall condition summary and limiting factor
- DCM Estimated Value (when pricing data is available)
- Action bar — serial number, download report, share

### Collapsible Sections

Everything else lives in eight accordion sections, all collapsed by default:

1. **Card Information** — Card metadata, database match, slab detection details
2. **Centering Analysis** — Front/back card images, L/R and T/B ratios, quality tier
3. **Corners, Edges & Surface Analysis** — Defect overlay maps with numbered markers, toggle, legend, and corner zoom crops
4. **DCM Optic Confidence Score** — Confidence letter grade and breakdown
5. **Market Value** — PriceCharting data, search links, estimated values
6. **Estimated Mail-Away Grade Scores** — PSA, BGS, SGC, CGC projections
7. **Insta-List on eBay** — eBay auction listing tool (card owner only)
8. **DCM Optic Report** — Full conversational grading narrative

### Defect Overlay System

Defect markers have been moved off the hero card images and into the Corners, Edges & Surface section. Each defect is plotted as a numbered marker on the card image with a clickable legend. Front and back images each have independent overlays with a toggle to show/hide markers.

### What Was Removed

- **CenteringDiagram SVG** — Replaced with the existing card images and ratio text
- **6 legacy sections** — Category Breakdown Scores, Legacy Confidence, Card Detection Assessment, Execution Control, Legacy Front/Back Analysis, and OCR Transcription have been removed
- **Defect markers on hero images** — Moved into the dedicated analysis section
- **14-step tour** — Rewritten to 12 steps with auto-expand/collapse behavior for accordion sections

### Slab Detection

For cards detected in professional grading slabs (PSA, BGS, CGC, SGC), corner zoom crops are now automatically hidden since they would show the slab label rather than the actual card corners.

---

## Technical Notes

- All changes apply uniformly across all six card types
- Four new shared components: \`CollapsibleSection\`, \`DefectOverlay\`, \`DefectLegend\`, \`CornerZoomCrops\`
- Net reduction of ~4,200 lines across the codebase (7,554 removed, 3,326 added)
- The guided onboarding tour dynamically expands and collapses accordion sections as it progresses through each step

---

*These updates are live now at [dcmgrading.com](https://dcmgrading.com). Grade a card and see the new layout in action.*`;

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      title: 'DCM Optic v8.4: Leaner Grading Engine, Redesigned Card Detail Pages',
      subtitle: 'Rubric v7.4.2 and a collapsible accordion layout ship across all six card types',
      slug: 'dcm-optic-v8-4-grading-engine-card-detail-redesign',
      excerpt: 'DCM Optic v8.4 delivers a streamlined grading rubric (v7.4.2) with reduced token overhead and a completely restructured card detail page featuring collapsible accordion sections, a focused hero zone, and an interactive defect overlay system.',
      content,
      category_id: category.id,
      tags: ['update', 'dcm optic', 'grading engine', 'card detail', 'v8.4', 'rubric', 'ui redesign'],
      meta_title: 'DCM Optic v8.4: Leaner Grading Engine, Redesigned Card Detail Pages | DCM Grading',
      meta_description: 'DCM Optic v8.4 ships a streamlined grading rubric and redesigned card detail pages with collapsible accordions, defect overlays, and a focused hero zone.',
      status: 'draft',
      author_name: 'DCM Team',
    })
    .select('id, title, slug, status')
    .single();

  if (error) {
    console.error('Error creating post:', error);
    process.exit(1);
  }

  console.log('Blog post created successfully!');
  console.log('  ID:', post.id);
  console.log('  Title:', post.title);
  console.log('  Slug:', post.slug);
  console.log('  Status:', post.status);
  console.log('  Edit at: /admin/blog/' + post.id + '/edit');
}

createPost().catch(console.error);
