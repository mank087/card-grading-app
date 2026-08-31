# Scope of Work: Submissions (bulk scanner-driven grading)

**Created:** August 31, 2026 · supersedes the build-order section of `FEATURE_PLAN_submissions_bulk_grading_2026-08-29.md` (whose architecture stands)
**Inputs:** the Aug 29 feature plan (code-grounded) + external ChatGPT review (scanner ops + preflight, incorporated below)
**Status:** Ready to build pending sign-off on the four decisions (recommendations inline)

---

## What the external review changed in this plan

**Incorporated** (it was right and we were thin):

- **Scanner feed reality:** the fi-8170's ADF card spec is ~10 non-embossed cards (≤0.76 mm) or 5 thick per feed — not the 100-sheet paper rating. Ops guidance below assumes small stacks, cheap-cards-first testing, roller-mark inspection, clean glass, no toploaders/sleeves until proven.
- **PaperStream profile as a deliverable:** duplex, 24-bit color, 600 dpi, individual JPEGs ~90–95, fixed portrait, sRGB, 2–3% contrasting margin, and **every "cleanup" feature off** — document-scanner cleanup erases exactly the defects grading needs to see. Also **blank-page removal off at the scanner**: DCM detects blanks itself; the scanner silently dropping a page breaks front/back parity, which is the pairing failure mode.
- **Preflight before charging**, as a formal gate: both images decode, resolution ≥ minimums, front ≠ back, corners present, sharpness/streak checks, plausible front/back identity. Summary UI ("47 ready · 2 need review · 1 missing a back · 47 credits required"); only passing pairs are chargeable. A 200-file folder must never charge 200 credits when 184 pairs pass.
- **Richer review-grid controls:** per-pair swap, rotate one side, rotate-all-fronts/backs, global swap-all (a stack fed backwards is one click, not 300), reorder, remove, replace, near-duplicate warning, odd-count warning.
- **`waiting_for_credits` pause state** when the balance runs dry mid-submission.
- **Content hashes** on upload for resume/dedupe (skip re-transfer of an already-uploaded file).
- **Validation set spec** for Phase 0: 30–50 cards spanning known-sharp/damaged, foil/chrome, vintage edge wear, dark borders, full-art, scratches/dents, creases, off-center, and cards with known phone-photo grades — on both scanner backgrounds.
- **Honest scanner-limitation posture:** uniform flat lighting can hide shallow dents; foil renders differently. If Phase 0 shows systematic under-detection, ship a visible "scanner capture" note on affected grades rather than pretending parity.
- **ZIP upload fallback** beside the directory drop.
- **Watch-folder desktop helper: explicitly deferred.** Right call — browser folder import captures the value without installer/driver/support burden.

**Rejected / kept ours:**

- Its "durable server worker" is unspecified for our infra. The **queue table + one drain endpoint driven by both browser and cron with a `claimed_at` lease** stays — concrete, Vercel-shaped, one code path.
- Its 25–50 card initial cap is too conservative given per-card idempotent charging; caps are a tier lever (below).
- Its 3–5 week estimate assumed greenfield; roughly half this feature already exists (binders, idempotent credits, grading routes, batch labels). Real estimate below (~2–2.5 weeks).

---

## Decisions (recommendations — confirm to start)

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Name | **Submissions** |
| 2 | Availability | **All tiers; per-submission cap is the tier lever** — 100 consumer, 500 Dealer, 1,000 Enterprise |
| 3 | Visibility | **Private by default**; drain endpoint gets real auth (pilot for fixing the JWT-less grading GETs) |
| 4 | Ceiling | **500 max at launch** (Enterprise), raise after the infra is proven |

---

## Workstreams

### WS0 — Phase 0: measure first (1–2 days, includes the harness)
Deliverables: PaperStream "DCM Card Batch" profile documented; calibration scan establishing actual file naming/order/orientation; measurement harness script that ingests a folder, pairs, runs cards through the existing single-card flow, and reports per-grade wall time (sizes the drain), scanner-vs-phone grade parity per subgrade (surface especially), and shadow CV-centering error on scanner vs phone input. Run against the 30–50 card validation set on both scanner backgrounds.
**Gate:** parity within tolerance or a scoped capture-note plan; drain throughput number replaces the guess.

### WS1 — Data model & migrations (0.5 day)
`submissions` + `submission_items` tables per the feature plan (adds `front_hash`/`back_hash` and `waiting_for_credits` status from the review). One nullable FK on `cards`. **Sequencing:** explicitly ordered against the pending Aug 17 enterprise migrations — no racing migration sets.

### WS2 — Intake & upload (1.5 days)
Directory drop (`webkitdirectory`) + ZIP fallback; client compression as today; capped concurrency (3–5) resumable uploader with per-file progress, retry/backoff, content-hash skip; serial **block reservation** per submission (kills the per-card round-trip + collision retry).

### WS3 — Pairing & review grid (1.5 days)
Convention detection (duplex-sequential / two-folder / filename-stem) — detected convention stated, user-changeable, never guessed silently. Contact-sheet grid with the full control set (swap, rotate one/all, global swap-all, reorder, remove, replace). Hard stop on odd counts in sequential mode. Front/back identity cross-check (cheap model call per pair) flags disagreements.

### WS4 — Preflight (1 day)
The gate described above, tagged `capture_source: desktop_scanner`. Blank/misfeed exclusion, duplicate detection (perceptual hash vs the user's collection), per-pair pass/review/fail with reasons. Nothing failing preflight can be charged.

### WS5 — Queue & drain (2 days)
Drain endpoint (claims N `queued` items, lease via `claimed_at`, grades via existing per-category pipelines); browser loop while the page is open; cron drains on schedule; `attempts` cap; rate-limit backoff + concurrency ceiling; **proper auth on the drain** (the model for fixing the other grading GETs). Charge per card at grade time via existing idempotent deduction; `waiting_for_credits` pause.

### WS6 — Binders & completion (1 day)
Destination binder pick-or-create-inline; cards filed **as they grade**, `binder_cards.position` = scan order; accent color + first-graded-card cover on new binders; completion email via Resend ("297 graded · 3 need retry") — the close-the-lid experience depends on it.

### WS7 — Progress, history, retry UI (1.5 days)
Live grid filling with grades, running counters, failure list with retry, pause/cancel, submission history page, one-click hand-off to batch label print.

### WS8 — Validation & launch gates (1 day)
Load test the drain at cap size; spend alarm wired (one user can 4× the platform's day); verify the cost table against measured reality; scanner-limitation note if WS0 demanded it; docs.

**Total: ~10–11 dev-days (~2–2.5 calendar weeks).** Phases ship independently: WS0 alone is worth a day regardless; WS1–5 is a usable no-binder MVP; WS6–7 completes the loop.

### Deferred (explicitly out of scope)
- **Scanner-native centering** (the strategic prize): only scoped after WS0 data; per-source confidence policy letting measured centering set a score on scanner submissions. `submissions.source` already anticipates it.
- **Watch-folder desktop helper / TWAIN integration.**
- **Mixed-category submissions** beyond the per-card override.
- **Luna model routing for bulk** (~63% cheaper per grade) — decision belongs to the canary evaluation, not this feature; the hook is trivial once decided.

---

## Acceptance criteria

1. A 300-card duplex folder reaches a fully graded, correctly ordered binder with the tab closed after commit.
2. A deliberately induced double-feed (odd file count) cannot proceed in sequential mode, and a mis-paired card is flagged by the identity cross-check.
3. Killing the browser mid-run loses nothing; cron completes; reopening shows true state.
4. No item is ever charged twice (retry storm test), and preflight-rejected pairs are never charged.
5. Credits exhausted mid-run → clean `waiting_for_credits` pause + notification, resumes on top-up.
6. All submission cards default private; the drain endpoint rejects unauthenticated calls.
7. Spend alarm fires in staging when a synthetic submission crosses the daily threshold.

## Risks (delta from the feature plan — full table stands there)

- Scanner feed is 5–10 cards per drop: real throughput is operator-paced; set expectations in UI copy ("keep feeding — we'll keep grading").
- Scanner capture may under-detect shallow dents/foil surface defects → WS0 gate + capture note, not silent parity claims.
- Migration ordering with the enterprise set → WS1 owns the sequencing explicitly.
