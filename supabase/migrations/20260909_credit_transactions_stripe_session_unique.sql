-- Stripe webhook idempotency at the database level.
-- The webhook checks credit_transactions.stripe_session_id before crediting,
-- but nothing stopped two concurrent deliveries of the same
-- checkout.session.completed event from both passing that check. A partial
-- unique index makes the second purchase insert fail with 23505 instead of
-- crediting twice. Scoped to type = 'purchase' because a session legitimately
-- also writes a 'bonus' row with the same session id, and to 2026 onward
-- because two December 2025 sessions (one test, one live Basic pack) were
-- credited twice before the idempotency check existed.
-- Applied by the owner from the dashboard SQL editor on 2026-09-09.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS credit_transactions_stripe_session_purchase_unique
  ON public.credit_transactions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL
    AND type = 'purchase'
    AND created_at >= '2026-01-01';
