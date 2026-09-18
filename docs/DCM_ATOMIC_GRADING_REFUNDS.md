# Charge-specific DCM credit refunds

Implemented locally September 16, 2026. No Stripe payment refund, remote database migration, or real balance change has been performed.

## Corrected understanding of regrades

The current web regrade handlers deduct their credit **after a successful grade**. A failed web regrade is uncharged and must not refund the original grading transaction. All eight category routes and the shared vision-grade route now pass an explicit uncharged marker when `force_regrade=true`.

The earlier offline test illustrated a prepaid regrade, not the web UI's actual sequence. The new refund function also supports that case: callers with a genuinely prepaid regrade must supply its exact credit-transaction ID. It never guesses the latest transaction. No prepaid regrade flow has been added to the UI.

## What changed

- Each refund has a `refund_of_transaction_id` foreign key identifying its exact charge, protected by a unique index.
- The `refund_grading_charge` database function locks that charge, validates owner/card/type/amount, restores one DCM credit, and inserts the refund ledger record in the same transaction. A ledger insert failure rolls back the balance change.
- An organization-funded charge returns to the organization's overage pool. Personal balance is unchanged.
- Duplicate requests for the same charge return `already_refunded`. A subsequent genuinely prepaid regrade can receive its own refund. A delayed duplicate for the first charge cannot refund a newer charge.
- Only the service role can invoke this function. Browser roles cannot call it directly.
- The application reports `refunded`, `already_refunded`, `not_charged`, `invalid_charge`, `needs_review`, or `failed`. Failed web regrades explain that no credit was charged; incomplete-inspection messages do not offer a free retake.
- Initial-grade failures resolve only the unique original `grade` transaction for the owner/card. Bulk failure settlement retains that initial-grade behavior. Explicit `chargeId: null` means the current attempt was uncharged; a supplied ID identifies a prepaid attempt.
- If the RPC is unavailable, the application reports an unconfirmed refund. It does not fall back to the previous separate balance and ledger writes.
- A missing initial-charge ledger row requires review: the old deduction path could consume a credit before failing to record it. Only an explicitly uncharged attempt is reported as `not_charged`.

## Migration and release requirements

Migration: [20260916_atomic_grading_refunds.sql](../supabase/migrations/20260916_atomic_grading_refunds.sql).

Apply the migration on the test database **before** testing the new application against it. It has been executed only inside the isolated PGlite test database, not the project's configured Supabase database. Deploying application code without the migration will leave refunds unconfirmed.

The migration links historical refunds only when an unambiguous original-grade/refund pair matches owner, card, payer, amount and chronology. It changes no historical balances. Ambiguous legacy refunds remain unlinked and block automatic payouts for that card with `needs_review`. Review those histories before release; do not guess or re-credit them automatically.

Quiesce old refund writers for the production migration/application cutover. Old code does not acquire the new charge lock and can write unlinked refunds, so running old and new refund implementations together is not a safe rollout strategy. No production cutover was attempted here.

## Validation

64 tests passed across the refund database, application boundary, customer messaging and inspection suites. Fourteen tests execute the actual migration/function in an isolated PostgreSQL engine (PGlite), including:

- Personal and organization refunds; separate original/regrade refunds.
- Duplicate requests and delayed duplicates targeting an older charge.
- Different charge refunds adding to the same balance.
- Forced ledger insertion failure rolling back both personal and organization restoration, followed by a safe retry.
- Wrong payer/card/type rejection; missing payer handling.
- Historical backfill, ambiguous history holds, and service-role permissions.

PGlite serializes submitted queries. These tests verify duplicate outcomes and transaction rollback, but do not simulate independent PostgreSQL sessions contending on row locks. Run a multi-connection concurrency check against the isolated test backend before production release.

```powershell
node node_modules/vitest/vitest.mjs run src/lib/gradingRefund.database.test.ts src/lib/gradingCreditLifecycle.test.ts src/lib/grading/inspectionMessage.test.ts src/lib/grading/inspectionCompleteness.test.ts src/lib/zoomInspection.completeness.test.ts
```

This change makes the refund operation atomic. It does not rewrite all legacy credit deductions, purchase grants or admin balance writers. Some of those still use read/modify/write operations; a broader balance-concurrency audit is separate from charge-specific refund deduplication.
