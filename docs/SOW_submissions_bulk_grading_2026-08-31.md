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

## Owner direction (Aug 31) — supersedes earlier decisions 1 and parts of intake

1. **No user-facing product name.** The entry point lives on the existing grading page: after the card
   type/subtype selection and the camera / submit-photos options, a link — **"Submit more than one card →"** —
   opens the batch flow. "Submissions" survives only as internal table/route naming; no branded surface, no
   separate landing page.
2. **No scanner-software coupling.** Intake is the standard OS file/gallery picker: the user navigates to
   wherever the images live (scanner output folder, phone gallery, downloads) and multi-selects. Works on
   desktop and mobile alike; a desktop folder-drop is a convenience enhancement, not the primary path. The
   PaperStream "profile" is demoted to one paragraph of optional scanning tips in help content (the
   cleanup-features-off advice stays — it genuinely affects grading accuracy — but it is user guidance, not
   product scope).
3. **Ordering/pairing signal:** filename sort primary (duplex scanners name sequentially), cross-checked
   against `File.lastModified` (browsers cannot read true creation dates); disagreement between the two is
   flagged, not silently resolved. The pairing-confirmation screen (front/back shown side by side per card)
   plus the even-count and identity cross-checks remain the real protection.
4. **Binder chosen at submission time** — pick existing or create inline, before anything is charged (cards
   still file into it one-by-one as they grade; that is a resilience detail, not a choice deferred to grading).
5. **Hard credit gate at selection.** Immediately after cards are selected (and again at commit, server-side),
   the required credit count is checked against the wallet. Insufficient balance **blocks the submission from
   processing** — no partial start, no charge — and the user is told exactly two ways forward: *trim the
   selection to what the wallet covers* (one-tap "keep the first N") or *buy credits first* (link to /credits;
   the draft submission is preserved and resumes where they left off). The mid-run `waiting_for_credits` state
   remains only as a backstop for balance changes from another device after commit; it is not the primary
   mechanism.

## Decisions — RESOLVED (owner, Aug 31)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Availability | **Everyone** — no tier gating; credits meter the spend |
| 2 | Visibility | **Public**, same as every other graded card (same insert path; no special casing) |
| 3 | Ceiling | **100 cards per submission** |

## Grading execution — verified approach (code review, Aug 31)

**Mechanism: internal self-call to the existing per-category GET routes, fire-and-poll — no refactor.** The 8 routes
(~11,700 lines total) already carry the cross-instance grading lock (`acquireGradingLock` CAS on
`cards.grade_status`), the failure/refund path, and all per-category divergence; extracting a callable core is an
8×1,300-line refactor of the most business-critical path with no route test coverage. Rejected.

- **Drain**: `POST /api/submissions/drain` (`maxDuration 60`, cronAuth-protected), ticked by a per-minute Vercel
  cron plus a kick on submission commit. Each tick counts the submission's cards in `grade_status='processing'`
  (the lock column is the authoritative in-flight counter — no in-memory state); if in-flight ≥ 4 it returns.
  Otherwise it takes up to `4 − inFlight` queued items: `deductCredit` (card-id idempotent, handles org pools),
  then dispatches the self-call with a ~55s abort — abort-after-dispatch is success, the grade continues in its
  own 300s function, and the lock guarantees the next tick can't double-fire.
- **Concurrency ceiling 4** — ~24 in-flight OpenAI requests / ~800K prompt tokens/min (one grade ≈ 6-8 HTTP
  requests, ~28 completions, ~150-250K prompt tokens; the ~75K rubric prefix is cached and a burst keeps it
  warm). Above ~5 concurrent, the zoom pass's OpenAI client — which has **no retries** and swallows failures —
  starts silently degrading grades under 429s (grades drift optimistic). Raising the ceiling later requires
  adding zoom-client retries FIRST and confirming zoom 429 rates in `api_usage_log`.
- **Throughput**: 4-wide × ~90s/grade ≈ **~40 minutes for a full 100-card submission**.
- **Reconcile**: any card `processing` > 10 min → `recordGradingFailure` (auto-refunds), matching the existing
  client-side threshold.
- **Model routing**: pin the submission's `routingKey` per-submission (not per-card) so a future canary split
  can't grade one submission with two different models.
- **Safety**: `SUBMISSIONS_DRAIN_ENABLED` env kill switch + per-submission spend ceiling (no budget guard exists
  anywhere in the grading path today; usage logging is after-the-fact).
- **Progress endpoint** (new, small): `GET /api/submissions/{id}/status` — one `.in('id', ...)` query returning
  `grade_status`, whole grade, and batched signed thumbnail URLs for the whole submission. The existing
  per-card `?status_only=true` path would mean 100 requests per poll tick; not viable.
- **Progress UI**: 100 shimmer placeholders (one shared CSS animation), single poll every ~4s against the status
  endpoint, lazy-loaded thumbnails fading in as cards complete (a trickle over ~40 min, not a burst). Confirmed
  cheap; collection pages already render larger grids.
- **Serial block reservation** stands (random-6-digit check-then-insert races at 100×; upload's retry is only
  3 attempts).

## Adjacent findings routed to the AEO track (not this feature's scope)

The crawlability review surfaced pre-existing gaps that bulk grading amplifies: card detail pages emit their
Product JSON-LD only after hydration (server metadata is good; body/schema are client-only); `sitemap.ts`
silently caps at PostgREST's default 1,000 rows (newest-first — every new card evicts an old one) and filters
neither `deleted_at` nor ungraded uploads; the `/verify/{serial}` sitemap entries added Aug 31 are pure
redirects (should be removed or made real pages); `/collection/[username]` sets `robots: index` while
robots.txt disallows `/collection`. Tracked as AEO follow-ups.

---

## Workstreams

### WS0 — Phase 0: measure first (1 day, includes the harness)
Deliverables: calibration scan establishing the fi-8170's actual file naming/order/orientation; measurement harness script that ingests a folder, pairs, runs cards through the existing single-card flow, and reports per-grade wall time (sizes the drain), scanner-vs-phone grade parity per subgrade (surface especially), and shadow CV-centering error on scanner vs phone input. Run against the 30–50 card validation set on both scanner backgrounds. One paragraph of scanner-settings tips written for help content (cleanup off, margins, backgrounds).
**Gate:** parity within tolerance or a scoped capture-note plan; drain throughput number replaces the guess.

### WS1 — Data model & migrations (0.5 day)
`submissions` + `submission_items` tables per the feature plan (adds `front_hash`/`back_hash` and `waiting_for_credits` status from the review). One nullable FK on `cards`. **Sequencing:** explicitly ordered against the pending Aug 17 enterprise migrations — no racing migration sets.

### WS2 — Intake & upload (1.5 days)
Entry point on the grading page ("Submit more than one card →" under the camera/photos options, after card type/subtype). Standard multi-select file/gallery picker as the primary path (works on mobile too); desktop folder-drop (`webkitdirectory`) and ZIP as conveniences. Client compression as today; capped concurrency (3–5) resumable uploader with per-file progress, retry/backoff, content-hash skip; serial **block reservation** per submission (kills the per-card round-trip + collision retry).

### WS3 — Pairing & review grid (1.5 days)
Convention detection (duplex-sequential / two-folder / filename-stem) — detected convention stated, user-changeable, never guessed silently. Order by filename, cross-checked against `File.lastModified`; a disagreement between the two signals is flagged. Contact-sheet grid showing front/back side by side per card, with the full control set (swap, rotate one/all, global swap-all, reorder, remove, replace). Hard stop on odd counts in sequential mode. Front/back identity cross-check (cheap model call per pair) flags disagreements.

### WS4 — Preflight & credit gate (1 day)
The quality gate described above, tagged `capture_source: desktop_scanner`. Blank/misfeed exclusion, duplicate detection (perceptual hash vs the user's collection), per-pair pass/review/fail with reasons. Nothing failing preflight can be charged.
**Credit gate (owner requirement):** after selection, required credits (= preflight-passing pairs) vs wallet balance is checked client-side for immediate feedback and **enforced server-side at commit** — insufficient balance blocks processing entirely with two offered paths: "keep the first N" (trim to balance) or "buy credits" (draft preserved, resume after purchase). Submission status `blocked_insufficient_credits` until resolved.

### WS5 — Queue & drain (2 days)
Drain endpoint (claims N `queued` items, lease via `claimed_at`, grades via existing per-category pipelines); browser loop while the page is open; cron drains on schedule; `attempts` cap; rate-limit backoff + concurrency ceiling; **proper auth on the drain** (the model for fixing the other grading GETs). Charge per card at grade time via existing idempotent deduction; `waiting_for_credits` pause.

### WS6 — Binders & completion (1 day)
Destination binder pick-or-create-inline **at submission time, before commit** (owner direction); cards filed **as they grade**, `binder_cards.position` = scan order; accent color + first-graded-card cover on new binders; completion email via Resend ("297 graded · 3 need retry") — the close-the-lid experience depends on it.

### WS7 — Progress, history, retry UI (1.5 days)
Live grid filling with grades, running counters, failure list with retry, pause/cancel, submission history page, one-click hand-off to batch label print.

### WS8 — Validation & launch gates (1 day)
Load test the drain at cap size; spend alarm wired (one user can 4× the platform's day); verify the cost table against measured reality; scanner-limitation note if WS0 demanded it; docs.

**Total: ~9.5–10.5 dev-days (~2 calendar weeks).** Phases ship independently: WS0 alone is worth a day regardless; WS1–5 is a usable no-binder MVP; WS6–7 completes the loop.

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
5. A 20-card selection against a 2-credit wallet cannot commit: the submission is blocked with the trim-to-N and buy-credits paths offered, nothing is charged, and the draft survives a purchase round-trip. Credits exhausted mid-run (balance spent from another device after commit) → clean `waiting_for_credits` pause + notification, resumes on top-up.
6. All submission cards default private; the drain endpoint rejects unauthenticated calls.
7. Spend alarm fires in staging when a synthetic submission crosses the daily threshold.

## Risks (delta from the feature plan — full table stands there)

- Scanner feed is 5–10 cards per drop: real throughput is operator-paced; set expectations in UI copy ("keep feeding — we'll keep grading").
- Scanner capture may under-detect shallow dents/foil surface defects → WS0 gate + capture note, not silent parity claims.
- Migration ordering with the enterprise set → WS1 owns the sequencing explicitly.
