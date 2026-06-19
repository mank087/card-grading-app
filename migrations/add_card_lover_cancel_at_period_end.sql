-- Persist a pending Card Lovers cancellation (cancel_at_period_end) in our DB.
--
-- Previously the only record of a cancellation was the final 'cancelled'
-- subscription_event written when Stripe fully deleted the sub at period end.
-- A *pending* cancellation (user clicked Cancel; Stripe set cancel_at_period_end)
-- lived only in live Stripe and was read on-demand by /api/subscription/status,
-- so there was no audit trail and admins couldn't tell from the DB that a user
-- had asked to cancel. These columns are kept in sync by:
--   - /api/stripe/cancel-subscription  (sets them on request)
--   - webhook customer.subscription.updated  (mirrors Stripe's cancel_at_period_end)
--   - /api/stripe/resume-subscription  (clears them)

ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_cancel_at_period_end BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS card_lover_cancel_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_credits.card_lover_cancel_at_period_end IS 'True when the Card Lovers sub is scheduled to cancel at period end (mirrors Stripe cancel_at_period_end).';
COMMENT ON COLUMN user_credits.card_lover_cancel_at IS 'When the pending cancellation takes effect (current period end). Null when not pending cancellation.';
