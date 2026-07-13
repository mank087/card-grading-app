# DCM Comic Book Grading — System Plan
**Date:** 2026-07-12 · **Status:** RECOMMENDATION — no changes made
**Premise:** apply everything the card system taught us (often the hard way) to comics, with two grading products and a capture strategy decision.

---

## 1. The two products (your framing, endorsed)

### Product A — Cover Grade (fast, cheap, ships first)
Front + back cover photos (plus two targeted shots, below) → grade on the comic scale. This is the card-grading UX transplanted. Honest positioning: **"Cover Grade"** — the label and report explicitly state the interior was not inspected (completeness, interior tears, writing, page quality are assessed only via the page-edge view). This honesty is a feature: CGC's grade also drops on interior issues; we say exactly what we did and didn't see.

### Product B — Full Book Grade (premium, ships second)
Cover shots + a page-through capture of every interior spread → adds: **completeness check** (page/spread count vs. expected for the issue), interior defects (tears, writing, detached pages, water damage), **page quality color** (White / Off-White / Cream / Tan / Brittle — a first-class comic attribute cards don't have), staple condition from the centerfold. Priced higher (more capture effort + ~10-20× the image volume).

Both products output: decimal comic-scale grade + per-category breakdown + page quality (B only, estimated from edges in A) + the human-readable narrator summary + label/PDF/eBay integration reusing the existing pipeline.

---

## 2. What transfers directly from the card system (the earned architecture)

| Card-system component | Comic reuse | Notes |
|---|---|---|
| Master rubric + delta prompt architecture | **comic_master_rubric + ERA deltas** | Deltas by era, not franchise: Golden/Silver/Bronze/Copper/Modern have different standards (off-white pages tolerable in a Silver 9.4; Modern 9.8 expects white; Marvel chipping is a Bronze-era production artifact, not damage) |
| 3-completion ensemble + median consensus | as-is | |
| Regioned zoom w/ ≤8-crop parallel batches | **new region map** (see §5) | The attention-collapse lesson (0/5 detection at 24+ crops) applies identically |
| Geometry gate (frame-fill + quad) | as-is | Comics are bigger; margin photos even more likely |
| Strict top-grade gates (unanimity, case/bag detection) | adapted | Bagged-and-boarded detection replaces top-loader detection; grade through a bag → capped + reshoot note |
| Server-side deterministic caps, weakest-link, narrate-after-consensus | adapted weighting | Spine is king in comics (see §4) |
| Calibration set + repeatability harness, ship-gated | **build FIRST, before the engine** | The single most important carry-over. No comic engine ships until ~15 anchor books with known grades gate it |
| Version stamping, zoom-status persistence, evidence rules | as-is | |
| Shared prompt-cache key, cost discipline | as-is | Rubric-first prompt assembly, one cache key |
| Narrator (human summary, ASCII, length budget) | as-is + comic vocabulary | "Light spine stress and a small color-breaking tick near the top staple" |
| Labels / PDF reports / eBay listing / pricing cache | extended | PriceCharting API already covers comics (docs/PRICING_API_RESEARCH.md); eBay comps infra reusable |

**Lessons encoded as requirements** (each cost us a production incident):
1. Harness before engine. Anchor books with verified grades (CGC-graded books photographed raw before slabbing are gold; owner-graded acceptable) spanning 9.8 / 9.4 / 8.0 / 6.0 / 3.0, both eras, at least one restored-suspect and one incomplete book.
2. Perception before rules. Fix what the model *sees* (crop resolution, batch size, background) before tuning caps.
3. Detection-pressure prompt lines are load-bearing — don't delete without fixing perception underneath.
4. Every gate/skip persisted in the record ("zoom unavailable" invisibility blinded two investigations).
5. Top grades must be *earned* (unanimity + verification), not defaulted to on absence of visible defects.

---

## 3. What's genuinely different about comics (new work)

1. **Scale:** decimal 0.5–10 (9.9/9.8/9.6/9.4/9.2/9.0/8.5…0.5) with CGC-style labels (NM/M 9.8, VF/NM 9.0, FN 6.0…). Whole-number card logic (Math.round, 1–10 ladders) must be re-derived, not reused. Server owns the mapping table defect→ceiling exactly like the card ladders.
2. **Defect taxonomy:** spine ticks (color-breaking vs non-breaking — THE 9.8/9.6/9.4 decision), spine roll, spine split, corner blunting, edge chipping, cover gloss loss, foxing, tanning, subscription crease, water rings, staple rust/migration/replacement, cover detached at one/both staples, miswrap (cover alignment — the comic analog of centering), writing/date stamps, cut coupons, missing pages, Marvel chipping.
3. **Spine primacy:** the spine is the single most grade-determining area — the zoom region map must treat it the way cards treat corners (dedicated native-res segments, both the front-left spine edge AND the back-right).
4. **Page quality is a separate output**, not part of the numeric grade (CGC reports it beside the grade). In Product A, estimate from the visible page-edge stack + interior gutter shots and label it "estimated"; in B, measure from interior pages directly.
5. **Restoration: DISCLAIM, don't attempt.** Color touch, trimming, married pages, pressing are barely detectable from photos even for experts with tools. State plainly: "DCM grades do not include restoration detection." Attempting it would manufacture the exact false-confidence problem we just spent a week fixing in cards. (Trimming *suspicion* via measured dimensions from the quad is a cheap later add — flag only, never grade on it.)
6. **Completeness (Product B):** page-count verification against the issue's expected count (Grand Comics Database / ComicVine have page counts + variant data for identification too). A book missing its centerfold is worth a fraction — this is Product B's headline value.
7. **Aspect ratio + size:** modern 6.63"×10.25", golden age wider, magazines bigger — capture guides need per-era framing; the geometry gate handles the rest.

---

## 4. Grading model (comics version of subgrades + weakest link)

Categories: **Spine · Corners · Edges · Surface/Gloss · Cover Wrap (miswrap) · [B only: Interior/Completeness]**, plus Page Quality as a side-channel attribute.
- Per-category defect→ceiling ladders in the master rubric (e.g., "1–2 non-color-breaking spine ticks → 9.6 ceiling; any color-breaking tick → 9.2; 4+ color-breaking → 8.5…") — deterministic server-side, like the card ladders after v8.8.
- Weakest-link MIN across categories, structural caps (spine split, detached cover, missing pages) exactly like card creases.
- Top-grade gates: 9.8 requires unanimous passes + zoom-verified clean spine/corners + no bag/board occlusion (the card Gem-10 lesson, transplanted).
- Uncertainty: same confidence-letter system; Product A carries a standing note that interior condition is unverified.

## 5. Zoom region map (comics)
Per cover face: 4 corners · **3 spine segments (native res — the money regions)** · 3 open-edge segments · top/bottom edge segments · 4 surface quadrants + center bands. Product B adds: centerfold/staple crop + per-page quick review (pages get single holistic passes at moderate detail; zoom escalates ONLY on pages the holistic pass flags — keeps cost sane).

## 6. Capture strategy — the decision you asked about

**Covers (both products): reuse the card capture flow** with comic-sized guides. It's proven, ships fast, and the geometry gate already handles imperfect framing. Add two REQUIRED extra shots for Product A: (1) spine close-up, (2) angled page-edge stack shot (top or open edge) — this is what lets Cover Grade estimate page tanning honestly.

**Interior pages (Product B): build on Scanner Lab (Scanic), not a literal PDF/flatbed scanner.**
- The "PDF-document-scanner" UX you described is exactly what Scanic prototyped: continuous auto-capture, per-page quad detection, auto-crop, rectification — and it's already in the admin at `src/app/admin/(dashboard)/scanner-lab/page.tsx` with 3 working tabs. Productize that into a "page-through mode": user turns pages, app auto-captures each spread, shows a running page counter and thumbnail strip, flags blurry/missed spreads for recapture.
- Why not actual flatbed/PDF scanning: pressing a comic flat on a scanner bed risks damaging the spine of exactly the high-value books people grade (collectors know this and would revolt); scanners crop at the gutter; and it adds a hardware dependency. A guided phone flow keeps us mobile-first and Scanic's rectification gives us scanner-like flat images anyway.
- Accept PDF **upload** as a secondary input for people who already have scans (CBZ/PDF ingestion is cheap once page-grading exists) — but don't build capture around it.

## 7. Data model & pipeline
- New `comics` table (not a card row): title, issue, variant, publisher, era, page_quality, completeness fields, grade columns mirroring the conversational_* pattern. `comic_pages` table for Product B (page number, storage path, per-page findings). Storage bucket: reuse `cards` bucket with `comics/` prefix or new bucket.
- New route family `/api/comics/[id]/grade` calling a generalized `gradeComicConversational` (same engine skeleton; comic rubric + era delta; comic zoom map).
- Identification: cover OCR (title/issue #/publisher marks) + ComicVine/GCD lookup for canonical issue data, variant matching, page counts. Pricing: PriceCharting comics endpoints + existing eBay comps infra.

## 8. Phased delivery
- **Phase 0 — Ground truth first (½ week):** acquire/photograph ~15 anchor books w/ verified grades; extend the harness to the comic scale. *Nothing ships that this set doesn't gate.*
- **Phase 1 — Cover Grade MVP (~2-3 weeks):** comic master rubric + Modern & Silver era deltas; capture flow (4 shots); engine port (scale mapping, spine-centric zoom map, gates); narrator vocabulary; details page; label/PDF ("COVER GRADE" clearly marked); harness-gated launch to a beta cohort.
- **Phase 2 — Full Book Grade (~3-4 weeks):** Scanic productization (page-through mode), completeness + page-quality engine, per-page findings UI (flip-through viewer with defect pins), premium pricing.
- **Phase 3 — Ecosystem (ongoing):** ComicVine/GCD identification polish, PriceCharting + eBay comp pricing, pop report, comic label designs, InstaList comics support.

## 9. Cost & pricing sketch (using measured card economics)
- Cover Grade: 4 images ≈ card-grade cost + ~30% (extra shots + spine zoom) → ~$0.15–0.25/grade at current caching. Price: 1–2 credits.
- Full Book: ~24–40 spreads at moderate detail, holistic-only per page + escalation ≈ ~$0.60–1.20/grade. Price: 4–6 credits. (Output tokens stay the dominant cost; per-page output must be terse JSON — the Phase 3 output-trim lesson applies from day one.)

## 10. Risks / do-not-promise list
- Never imply parity with CGC slabbing (no restoration check, no physical handling, photo ceiling on 9.9/10 precision — cap displayed precision at 9.8 like CGC's practical ceiling, and require the same "earned not defaulted" gates).
- Newsstand vs direct edition and variant mis-ID affects value — identification confidence must gate pricing claims, not grading.
- Page-through capture of a fragile golden-age book — UX must never encourage aggressive page flattening; allow "skip fragile pages" with the completeness check downgraded to "not verified".
- Scale expectations: comic collectors are 9.8-obsessed; the strict-gate lesson says a defaulted 9.8 will burn trust exactly like card 10s did on Jul 9-10.
