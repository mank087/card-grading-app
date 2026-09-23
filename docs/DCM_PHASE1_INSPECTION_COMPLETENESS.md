# Phase 1: incomplete inspection safeguards

Implemented locally September 16, 2026. No commit, push, deployment, live model call, or database mutation was performed to validate this change.

## Result

The JSON grading pipeline now stops before publishing a numeric grade when it cannot establish the required inspection coverage. Unknown evidence no longer becomes an explicitly clean zoom region, a duplicated holistic evaluation, or a confirmed structural defect.

This is a reliability change, not a demonstrated improvement in physical defect detection. It is deliberately stricter and can increase incomplete outcomes. Evaluate that rate before release.

## Implemented contracts

| Stage | New behavior |
|---|---|
| Holistic ensemble | Requires three completed, non-refused, parseable responses with finite final/category scores from 1 through 10. Never pads a missing evaluation by copying another. |
| Geometry | Requires completed output; fill must be a numeric 0–100 value. Missing values are unknown. Unknown/low fill requires usable quads for both faces; otherwise magnified inspection stops. Geometry exceptions no longer enable blind crops. Quads must be convex and consistently ordered. |
| Geometry budget | Increased completion allowance from 400 to 2,000 for Luna's reasoning plus visible JSON. This budget is a candidate to calibrate, not a measured optimum. |
| Zoom samples | Every expected region must occur exactly once. Reject empty objects, omissions, unknown IDs, duplicate/conflicting entries, invalid verdicts, truncated/refused responses and insufficient visibility. Preserve the existing exact `REGION ` alias compatibility. |
| Zoom batches | Require at least three complete usable samples from the requested five. Retry an insufficient or failed batch once; do not rerun successful batches. Do not combine two insufficient attempts to manufacture quorum. SDK automatic retries are disabled for these batch requests so the application owns the retry count. |
| Coverage | Report the number of regions whose batch established quorum, not the number of crops generated. Preserve successful-batch counts when another batch fails; withhold the overall grading result if any required batch remains incomplete. |
| Structural verification | `confirmed: true`, `false`, or `null` distinguish confirmation, rejection and unknown. Require three complete responses accounting for all supplied claims. Fetch/request/parser failures, unsupported claims and excess claims return unknown. Retry unknown verification once, then stop grading if unresolved. |
| Grade publication | A typed `INSPECTION_INCOMPLETE` error prevents downstream clean-evidence reconciliation or numeric grade publication when required inspection fails. It bypasses whole-ensemble retries. Successful JSON records include `inspection_status` with inspection version and zoom coverage. |
| Failure handling | Category routes and the shared vision-grade route expose the new code and next action through existing grading-failure handling. Existing refund logic is reused, not replaced. Refund success remains conditional on the refund service result. |
| Customer message | All eight web category detail pages show incomplete-inspection and support guidance, including when detected during polling. They stop polling that terminal outcome and mention a refund only when the API confirms one. No free retake or replacement submission is offered. |
| Diagnostics | `cq-2` capture records add `zoom_inspection_status` and batch coverage. `zoom_outcome` continues to describe crop selection, independently of inspection success. |

The compact zoom prompt now explicitly says blur, glare, obstruction and background are not clean evidence. Uninspectable regions can be reported without inventing a defect; those responses cannot establish complete coverage.

## Material behavior changes and limits

- `ZOOM_DISABLED=1` now prevents successful JSON grading rather than allowing a holistic-only grade. Treat it as an inspection stop, not a degraded-grading mode.
- A structural claim that cannot be verified neither receives a hard cap nor produces an uncapped completed grade. It ends in incomplete inspection.
- More than four structural claims or claim types outside the verifier's supported set are incomplete. This avoids silently verifying only a subset; supporting additional claims needs a separate batching design.
- A successful batch needs three fully inspectable responses. Partially valid responses are not pooled region by region. This conservative contract is simpler to audit but may reject usable photographs more often than a future per-region quorum design.
- Retries can increase latency and model cost; category routes have execution deadlines. Measure the tail latency with realistic Luna responses before deployment. The existing geometric API retry behavior remains unchanged; batch and structural retries are explicitly bounded at the application level.
- The main ensemble check validates completion and usable category/final scores. It is **not** a full schema validator for all corner/edge fields, narratives, coordinates and cross-field consistency. That broader schema work remains pending.
- Completeness means the model supplied valid answers, not that it detected every real defect. There is no new calibrated blur/glare threshold or independent verification that a model correctly marked a region clean.
- The existing canonical score ladders, cosmetic voting thresholds, category construction assumptions and physical back-face mapping remain in place. Their audit findings are separate work.
- The new customer handling covers the web category pages. Native user experience and the legacy markdown grading path require separate validation; active category grading uses JSON.
- Geometry/capture diagnostic persistence is best effort, as before. An unavailable database cannot be assumed to have recorded coverage or refunded a credit.

## Local validation

```powershell
node node_modules/vitest/vitest.mjs run src/lib/grading src/lib/zoomInspection.completeness.test.ts src/lib/normalizeCropRegionIds.test.ts src/lib/identification src/lib/identity src/lib/localCaptureAudit.test.ts tests/accuracyPhase0.test.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false
node scripts/check-grading-isolation.cjs
```

The regression run passed 205 tests in 14 files. The final focused run passed all 40 inspection tests. TypeScript, grading isolation and tracked diff whitespace checks passed. New tests exercise actual image cropping on synthetic JPEGs with injected model failures, partial batch coverage, successful clean inspection, geometry failure, malformed/truncated responses, structural confirmation/rejection/unknown, finite score requirements, and customer error/refund messaging. Model requests and image downloads in these tests are mocked. No real card was graded.

Before release: replay a reviewed, representative fixture corpus to measure completion rate, missed defects, false defects, structural verdicts, latency and cost. Exercise an authenticated end-to-end failure on an isolated test backend to verify database state, credit refund and rendered customer message together. The unit/integration tests do not establish that external-service behavior.

## Credit review correction — September 16 (initial findings)

**Updated:** the refund fixes are now implemented locally. See [charge-specific refunds](DCM_ATOMIC_GRADING_REFUNDS.md) for the corrected web regrade lifecycle, atomic database function, tests and migration requirements. The findings below describe the earlier implementation. The earlier paid-regrade test was a prepaid scenario; the actual web UI charges regrades after success.

The initial retry/retake wording was premature and has been removed from both the API error and customer message. `next_action` is now `contact_support` for every incomplete-inspection stage.

**Reversed 2026-09-23:** a customer read "Inspection incomplete... contact support" as a broken account and wrote in; both of their failed cards had blurry or cropped photos. The customer message now asks for a retake ("This can happen when a photo is blurry, taken at an angle, or cuts off part of the card") and keeps support as the fallback, and `next_action` is `retake_photos`. The failed attempt is refunded or never charged, so a retake is not a paid retry. When the refund is unconfirmed, the message still sends the owner to support and does not suggest a retake. The stored `error_message` keeps its `Inspection incomplete (<stage>).` prefix for failure-rate queries. Internal model retries do not create another card submission or invoke credit deduction; they are separate from a customer uploading or regrading a card.

Offline verification now exercises the real `deductCredit`, `refundGradeCredit`, and `recordGradingFailure` functions against an in-memory database adapter. Ten lifecycle tests plus the existing message/completeness tests passed (39 tests total in this follow-up). This verifies sequential application behavior, not live database transactions or concurrency.

Confirmed behavior:

- An initial personal-credit charge followed by a successful refund restores the starting balance and decrements `total_used`.
- A later sequential failure for that same card does not refund it again.
- Repeating an initial-grade deduction for the same card ID skips a second charge, including after refund. This is not a replacement-photo workflow.
- A new upload has a new card ID and can consume a credit. Explicit paid regrades also consume a credit.
- Organization-funded refunds return to the organization's overage pool, not the user's personal balance.
- A failed balance/pool write does not produce a confirmed-refund message. An unavailable card-status write does not prevent the existing handler from attempting the refund.

**Unresolved billing issues: Phase 1 is not yet verified safe to release on the strength of refunds alone.**

1. The refund helper finds transactions with `type = 'grade'`, not a specific paid attempt. After an earlier refund for a card, a failed paid regrade receives no separate refund. An offline characterization test reproduces this gap; its passing result documents the problem, not desired behavior.
2. Balance restoration and refund transaction insertion are separate operations. Source review shows no enclosing atomic transaction in this helper. Concurrent failures or an audit-insert failure can undermine the apparent per-card idempotency. The sequential fake database tests do not validate these races.
3. A previously refunded card returns `refunded: false` on a subsequent call, so the current boolean cannot distinguish "already refunded" from other unconfirmed states. Customer text deliberately says confirmation is unavailable rather than asserting that no refund ever happened.

Billing follow-up should identify the exact charged attempt, restore the correct payer's balance and insert its refund record atomically, and return explicit `refunded`, `already_refunded`, `not_charged`, or `failed` status. Validate that transaction against a local/test database before enabling stricter inspection failures in production. This correction does not rewrite billing or change any real credit balances.

The next planned product phase remains identity confirmation and pricing consistency. Full prompt cleanup and scoring calibration follow controlled evaluation of the grading pipeline.
