-- Track Card Lovers subscription renewal payment failures so the account
-- page can show a past-due banner and the recovery email can be triggered.
-- Set by handleInvoicePaymentFailed() in the Stripe webhook.
-- Cleared by handleInvoicePaid() on the next successful renewal.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS card_lover_payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_lover_last_failed_invoice_id text;

-- Partial index so the eventual account-page query
--   "SELECT 1 FROM user_credits WHERE user_id = $1 AND card_lover_payment_failed_at IS NOT NULL"
-- doesn't scan the table.
CREATE INDEX IF NOT EXISTS idx_user_credits_payment_failed
  ON user_credits (user_id)
  WHERE card_lover_payment_failed_at IS NOT NULL;
