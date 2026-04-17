# DCM Comic Grading — Implementation Plan

**Status**: Planning / pre-implementation
**Last updated**: 2026-04-16
**Owner**: Doug Mankiewicz

This document captures the comprehensive plan for expanding DCM's grading service to comic books. It consolidates decisions on grading scale, capture methodology, and phased rollout.

---

## 1. Executive Summary

DCM will expand beyond trading cards to offer AI-powered comic book condition grading. The service will:

- Use a **DCM-native grading scale** (1.0–10.0 in 0.5 increments) distinct from CGC/CBCS
- Capture comic imagery via a **guided document scanner interface** (not individual photos, not video)
- Position as an independent grading service and fast alternative to mail-in graders
- Target modern comics (1992+) at MVP, expand to vintage in later phases

**Why this approach works**: Scanner UX eliminates the tedium of individual photo capture while delivering higher image quality than video. A DCM-native scale avoids creating false expectations that our grades should mirror CGC's physical inspection outcomes.

---

## 2. Feasibility Considerations

### What AI Can Grade Well in Comics

- Cover condition (creases, spine stress, corner wear, fading, scuffs, tears)
- Visible spine assessment (rolls, splits, stress marks from edge-on photos)
- Cover gloss/reflectivity
- Missing pieces / chunks
- Tape, markers, writing
- Visible staples (rust, missing, bent)

### What AI Struggles With (Hard Limits)

- Interior page brittleness (requires tactile assessment — can only infer from color)
- Binding integrity under cover (requires physical inspection)
- Subtle binding defects not visible in photos
- Supplement/coupon completeness in very old books

### Positioning Implications

DCM comic grading is framed as:
- An **independent standard** with its own methodology (consistent with DCM's current positioning)
- A **fast, accessible alternative** to mail-in grading
- **Not a replacement** for CGC/CBCS physical inspection for high-value submissions
- Best for: collection management, sale listings, pre-purchase evaluation, insurance documentation

---

## 3. DCM Comic Grade Scale

### The Scale: 19 Points, 1.0–10.0 in 0.5 Increments

Simpler than CGC's 25-point non-uniform scale. More granular than DCM's current 1–10 integer card scale. Consistent with DCM's existing grading brand.

| DCM Grade | Label | Description |
|-----------|-------|-------------|
| **10.0** | Pristine | Essentially perfect. No visible handling defects. Minor manufacturing variance only. |
| **9.5** | Exceptional | Nearly perfect with only the most minor imperfections detectable. |
| **9.0** | Excellent | Outstanding condition. Minor wear barely noticeable. |
| **8.5** | Very Good+ | Above average with minor visible wear. |
| **8.0** | Very Good | Solid condition with some minor defects. |
| **7.5** | Good+ | Above average, showing moderate but non-distracting wear. |
| **7.0** | Good | Average condition. Visible wear, still highly collectible. |
| **6.5** | Fair+ | Below average but clean. Some structural wear. |
| **6.0** | Fair | Noticeable wear, reduced eye appeal. |
| **5.5** | Moderate Wear | Significant handling marks. |
| **5.0** | Well-Worn | Multiple moderate defects. |
| **4.5** | Heavy Wear | Substantial wear, readable. |
| **4.0** | Rough | Accumulation of defects. |
| **3.5** | Damaged | Significant damage, but intact. |
| **3.0** | Heavy Damage | Multiple structural issues. |
| **2.5** | Degraded | Significant structural compromise. |
| **2.0** | Severely Damaged | Serious condition issues. |
| **1.5** | Poor | Severely compromised. |
| **1.0** | Critical | Barely intact, major missing pieces or defects. |

### Design Principles

1. **No split grades** (e.g., no "NM/VF") — one number, one label. Simpler than CGC/Overstreet.
2. **Uniform 0.5 increments** — no weird jumps like CGC's 9.2/9.4/9.6/9.8 then 9.0/8.5/8.0.
3. **Descriptive labels, not industry jargon** — accessible to casual collectors.
4. **Weakest-link methodology** (inherited from card rubric) — final grade = MIN of subgrades.
5. **Qualifiers as separate flags** — coupon-clipped, restored, etc. noted separately (like CGC), base grade stays clean.
6. **Page quality displayed separately** — White / Off-White / Cream / Tan / Brittle.

### Grade 10 Calibration Target

~50–60% of modern comic submissions (1992+) should grade 9.5+ to align with collector expectations. Grade 10 (Pristine) reserved for essentially perfect books — expected to be rare.

---

## 4. Grading Categories (Subgrades)

Comics require different categories than cards. Each submission receives six subgrades, and the final DCM Grade is the MIN of all subgrades (weakest-link principle).

| Category | Weight | What's Evaluated |
|---|---|---|
| **Cover Condition** | 30% | Front + back cover surface, color, gloss, scuffs, dents |
| **Spine Integrity** | 20% | Spine stresses, rolls, splits, color break along spine |
| **Corners & Edges** | 20% | All 4 corners + edges of cover |
| **Staples & Binding** | 10% | Staple condition, rust, bent/missing, spine attachment |
| **Interior Pages** | 15% | Page color, cleanliness, tears, writing |
| **Structural Integrity** | 5% | Overall flatness, warping, missing pieces |

### Hard Grade Caps

| Defect | Grade Cap |
|---|---|
| Tape repair (any) | 3.5 |
| Missing page(s) | 1.5 or "Incomplete" designation |
| Brittle pages | 3.0 |
| Cover detached (both staples) | 3.0 |
| Heavy water damage | 2.0 |
| Coupon clipped | 1.5 or noted with qualifier |
| Color touch / restoration | Qualifier flag (not a grade cap) |

### Page Quality Scale (Separate from Grade)

- White
- Off-White to White
- Off-White
- Cream to Off-White
- Cream
- Tan to Cream
- Tan
- Brown
- Brittle

Displayed alongside the grade (e.g., "DCM Grade: 9.0 / Page Quality: White").

### Defect Taxonomy Categories

**Cover Defects**: color break, crease (with/without color break), spine stress marks, spine roll, spine split, corner blunting, corner creasing, edge tears, cover detachment, soiling, price stickers, water damage, fade/sun damage.

**Binding Defects**: staple rust (clean/slight/moderate/heavy), missing staples, bent staples, staple pull, staple migration, centerfold detachment.

**Interior Defects**: page tears, writing, missing pages, coupon clipped, missing piece, tape repair, glue repair.

**Structural Defects**: overall warp, moisture ripple, heat damage, missing chunks, restoration.

---

## 5. Capture Methodology: Guided Document Scanner

### Why Scanner (Not Photo Wizard, Not Video)

| Approach | User Effort | Image Quality | Coverage | Processing |
|---|---|---|---|---|
| Individual photo wizard | High (6+ manual shots) | Excellent | Limited | Low |
| Video recording | Low | Variable (motion blur) | Excellent | Very high |
| **Guided scanner** ✅ | Low | Excellent (still quality) | Excellent | Moderate |

Scanner mode delivers the best of both worlds: low user effort and high image quality. Each page gets a still-photo-quality capture without motion blur or focus hunting.

### The Sequential Flow

App walks users through a predictable sequence:

```
1. FRONT COVER          (single page, portrait orientation)
2. PAGES 2–3            (two-page spread, landscape)
3. PAGES 4–5            (two-page spread)
...                     (continues until user ends interior)
N. BACK COVER           (single page, portrait)
N+1. SPINE              (edge-on, landscape strip)
N+2. TOP EDGE           (edge-on)
N+3. BOTTOM EDGE        (edge-on)
```

### Auto-Capture Mechanics

1. Live camera preview with detection overlay
2. App detects comic boundaries (edges, corners)
3. Determines if single page or two-page spread
4. Waits for stability (frame-to-frame position delta below threshold)
5. Auto-triggers capture with haptic + audio feedback
6. Advances to next step in the sequence
7. Shows thumbnail in review rail

### Smart Flow Features

- **Manual capture fallback** always available
- **"I'm done with interior"** button to jump to back cover flow
- **Review rail** with thumbnails — tap to retake, add close-up annotations, reorder
- **Per-capture quality scoring** with user-visible flags (blurry, glare, shadow, cropped)
- **Real-time lighting/glare feedback** before capture triggers
- **Page count sanity check** after interior done ("Detected 22 pages — was expecting ~32 for this era")

### Edge Cases

- **Thick books** (trade paperbacks, omnibuses) → "Single Page Mode" — capture each page individually
- **Polybagged comics** → detect plastic wrapping, adjust glare tolerance, disclaimer about limited assessment
- **Damaged / loose pages** → manual insertion mode, out-of-sequence capture with reordering

### Image Processing Pipeline

Each captured image goes through:

```
Raw capture
  → Perspective correction (warp to clean rectangle)
  → Crop to comic boundary
  → Color normalization (white balance, contrast)
  → Label metadata ({"type": "spread", "pages": [4,5], "sequence_index": 3})
  → Quality scoring (sharpness, glare, shadow)
  → Upload to Supabase Storage
  → Store reference in comics.image_paths (jsonb)
```

### Image Confidence Tiers

| Tier | Coverage | Grade Ceiling |
|---|---|---|
| **A** | Full scan (cover + back + spine + edges + all interior spreads) | Up to 10.0 |
| **B** | Full scan, some flagged quality issues | Up to 9.0 |
| **C** | Partial scan (exterior only, interior skipped) | Up to 8.0 |
| **D** | Insufficient or low-quality scan | Rejected — request better scans |

Users get clear messaging: "Complete the full interior scan to unlock our highest grades."

---

## 6. Technical Stack

### Phase 1: Web-Based Scanner (MVP)

**Scanner detection library options:**

| Library | Platform | Cost | Notes |
|---|---|---|---|
| **jscanify** | Web | Free, open source | OpenCV.js wrapper, well-documented, fast to implement — **recommended for MVP** |
| **OpenCV.js** (direct) | Web | Free, open source | Full CV library, build-your-own — more control but more work |
| **Scanbot SDK** | Web + native | Commercial ($$$) | Polished, AI-powered, live feedback — consider for later phases |
| **Dynamsoft Document Scanner** | Web + native | Commercial ($$$) | Enterprise-grade, expensive |

**MVP stack:**
- Camera: `MediaStream API` for live video preview
- Detection: `jscanify` for document boundary detection
- Capture: `ImageCapture API` for high-resolution stills
- Processing: Canvas API for perspective correction + cropping
- Web Workers for OpenCV processing (keep UI responsive)
- Storage: Supabase Storage for processed images

**Implementation notes:**
- Run detection on downscaled frame (240p) for performance, capture at full resolution
- `requestAnimationFrame` for detection loop
- Lock focus + exposure after first detection

**Known web limitations:**
- Autofocus hunting on some Android browsers
- iOS Safari camera API historically flaky
- Slightly lower image quality than native apps

### Phase 2: Polish & Expansion

Three-pass consensus grading, era deltas, qualifier system, single-page mode, real-time feedback.

### Phase 3: Native Mobile Apps

**iOS** — `VNDocumentCameraViewController` from VisionKit (Apple's built-in document scanner, free, excellent quality).

**Android** — `GmsDocumentScanning` from Google ML Kit Document Scanner (free, excellent quality).

**Cross-platform option** — React Native + `react-native-vision-camera` + ML Kit for single codebase.

Native apps will have significantly superior quality and UX compared to web.

### Phase 4: Advanced Features

- OCR on covers (auto-detect title, issue number)
- Cover matching against comic database
- AR lighting guidance with real-time heatmaps
- Multi-device recording (tablet + phone for spine/edges)

---

## 7. Database Schema

New `comics` table (separate from `cards` — too different to share):

```sql
comics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  serial TEXT UNIQUE,

  -- Comic identity
  title TEXT,
  issue_number TEXT,
  publisher TEXT,
  publication_year INT,
  era TEXT,  -- 'modern' | 'copper' | 'bronze' | 'silver' | 'golden'

  -- Captures
  image_paths JSONB,  -- array of { path, type, sequence_index, page_numbers, quality_score }

  -- Grading output
  dcm_grade NUMERIC(3,1),  -- 1.0 to 10.0 in 0.5 increments
  grade_label TEXT,
  page_quality TEXT,  -- 'White' | 'Off-White' | ... | 'Brittle'

  -- Subgrades (each on the 1.0–10.0 scale)
  cover_condition_score NUMERIC(3,1),
  spine_integrity_score NUMERIC(3,1),
  corners_edges_score NUMERIC(3,1),
  staples_binding_score NUMERIC(3,1),
  interior_pages_score NUMERIC(3,1),
  structural_integrity_score NUMERIC(3,1),

  -- Defect data
  cover_defects JSONB,
  spine_defects JSONB,
  binding_defects JSONB,
  interior_defects JSONB,
  structural_defects JSONB,

  -- Qualifiers
  qualifiers JSONB,  -- { "coupon_clipped": bool, "restoration": bool, "signed": bool, ... }

  -- Standard metadata
  image_confidence CHAR(1),  -- 'A' | 'B' | 'C' | 'D'
  grading_passes JSONB,  -- three-pass consensus data
  conversational_metadata JSONB,
  visibility TEXT DEFAULT 'private',

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## 8. Code Organization (New Files)

- `src/lib/comicGrader.ts` — Primary AI grading engine for comics
- `src/lib/comicPromptLoader.ts` — Loads master comic rubric + era-specific deltas
- `src/lib/comicScanner/` — Scanner utilities
  - `detectDocument.ts` — jscanify wrapper
  - `extractFrame.ts` — perspective correction, cropping
  - `qualityScore.ts` — sharpness, glare detection
  - `sequenceState.ts` — sequential page tracking
- `src/app/upload/comics/page.tsx` — Comic upload with scanner UI
- `src/components/scanner/` — Scanner UI components
  - `LiveScanner.tsx` — camera + detection overlay
  - `CaptureReview.tsx` — thumbnail review rail
  - `SequencePrompt.tsx` — step-by-step instruction UI
- `src/app/comics/[id]/page.tsx` — Comic detail page
- `src/app/comics/[id]/CardDetailClient.tsx` — Comic detail client component
- `src/app/comic-database/page.tsx` — Comic database/search
- `src/types/comic.ts` — TypeScript types
- `prompts/master_comic_rubric_v1.txt` — Master comic grading rubric
- `prompts/comic_era_delta_modern.txt` — Modern era (1992+) delta
- `prompts/comic_era_delta_copper.txt` — Copper age (1984–1991) delta
- `prompts/comic_era_delta_bronze.txt` — Bronze age (1970–1983) delta
- `prompts/comic_era_delta_silver.txt` — Silver age (1956–1969) delta
- `prompts/comic_era_delta_golden.txt` — Golden age (pre-1956) delta

---

## 9. AI API Usage & Pricing

### Cost Implications

- Image volume: 15–30+ images per comic submission vs. 2 per card
- Expect per-comic API cost to be ~3–5x a card grade
- Multi-image reasoning in GPT-5.1: explicit labeling required in prompt

### Suggested Credit Pricing

- **1 comic grade = 3–4 credits** (vs. 1 credit per card)
- Alternative: separate "Comic Credits" packages
- Alternative: premium tier at $2–3 per comic grade

---

## 10. Phased Rollout

### Phase 1: Web-Based Scanner MVP

- `/upload/comics` with `jscanify` scanner
- Sequential page flow with auto-capture
- Perspective correction + cropping
- Thumbnail review rail
- `master_comic_rubric_v1.txt`
- Single-pass grading on DCM 1.0–10.0 scale
- `comics` table + basic API routes
- Comic detail page
- **Scope limit: modern comics only (1992+)** — easier baseline
- **Grade ceiling during beta: 9.5** — gives room to calibrate
- Admin-only beta access initially

**Goal**: Validate scanner UX and grading accuracy.

### Phase 2: Polish & Accuracy

- Three-pass consensus grading
- Era-specific deltas (Modern / Copper / Bronze / Silver / Golden)
- Qualifier system (coupon clipped, restored, signed, etc.)
- Single-page mode for thick books
- Real-time lighting/glare feedback
- Review rail: retake, delete, reorder, annotate
- Cover OCR for auto-populating metadata
- Public-facing beta launch
- Pricing tier established

**Goal**: Production-ready, public-facing launch.

### Phase 3: Native Mobile Apps

- iOS app (VisionKit scanner)
- Android app (ML Kit scanner)
- Offline drafts, push notifications, biometric auth

**Goal**: Premium mobile experience that distinguishes DCM from web-only AI competitors.

### Phase 4: Scale Features

- Comic slab labels (comic-sized case labels)
- Comic storage accessory Amazon affiliate integration
- Batch scanning (multi-comic sessions)
- Comic collection management UI
- eBay comparables for graded comics
- Marketplace partnership integration

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| OpenCV.js performance on older phones | Downsample detection frames, fall back to manual capture |
| iOS Safari camera inconsistency | Test aggressively; native app is the true fix |
| Users frustrated by auto-capture misfires | Manual capture button always available |
| Thick books don't lay flat | Single-page mode, explicit UI for this case |
| Polybagged comics (glare, reflection) | Detect plastic, lower glare penalty, recommend unbagging |
| Interior page count mismatch | "Detected 22 pages — expected ~32. Add more?" prompt |
| Damaged comics with missing/loose pages | Manual insertion mode, ordered out-of-sequence capture |
| AI accuracy variance in grading | Significant prompt iteration planned; three-pass consensus in Phase 2 |
| Collector skepticism vs. CGC/CBCS | Position as independent standard, not replacement for physical grading |
| Legal exposure on high-value grades | Terms airtight specifically for comics; grading disclaimers |

---

## 12. Open Questions to Resolve Before Phase 1

- [ ] Target modern comics first (recommended) or go broad Day 1?
- [ ] Separate "Comic Credits" packages or unify with existing credit system?
- [ ] Does the marketplace partner have interest in comics too?
- [ ] User-submitted metadata (issue, publisher, year) or auto-detect from cover OCR?
- [ ] Beta grade ceiling (suggested: 9.5) — where to land?
- [ ] Pricing target: $2–3 per comic grade, or credit-based?

---

## 13. Recommended Starting Point

Two parallel tracks for Phase 1:

**Track A — Rubric:**
- Draft `prompts/master_comic_rubric_v1.txt`
- Structure mirroring existing card rubric (sections for presence validation, category subgrades, defect taxonomy, weakest-link, image confidence)
- Calibrate to modern comics (1992+)
- Test against labeled sample set (10–20 graded comics with known CGC/CBCS grades for baseline)

**Track B — Scanner UI:**
- Build `/upload/comics` scanner interface
- Integrate `jscanify` for document detection
- Implement sequential page state machine
- Perspective correction + upload pipeline
- Thumbnail review rail with retake capability

Both tracks can proceed simultaneously. Track A feeds into the grading backend; Track B feeds into the user capture frontend. They meet at the image upload API.

---

## 14. Reference Materials

- Overstreet Grading Guide: Traditional comic grading standards (MT through PR scale)
- CGC Grading Scale: Industry-dominant mail-in grading service (25-point scale)
- CBI Scale: Historical/cultural impact rating (separate from condition — possible Phase 4+ feature)
- DCM Master Card Rubric (`prompts/master_grading_rubric_v5.txt`): Template for rubric structure patterns

---

*This plan is informed by the DCM Grading architecture established for trading cards and the repositioning work done in April 2026 to establish DCM as a standalone, independent grading authority.*
