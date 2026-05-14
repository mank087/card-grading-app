-- Migration: In-App Purchase (IAP) transaction ledger for iOS + Android
-- Purpose: Track Apple App Store and Google Play purchases (consumables and
--          subscriptions). Receipt-verified by the backend before credits are
--          granted. Single source of truth for IAP state; user_credits.is_card_lover
--          and related flags continue to act as the boolean state derived from
--          the latest subscription row here.
-- Date: 2026-05-14

-- ============================================
-- 1. IAP TRANSACTIONS TABLE
-- ============================================
-- One row per discrete charge (initial purchase, each subscription renewal,
-- one-time credit pack). Subscription renewals share original_transaction_id
-- across rows so we can trace the full billing lineage.

CREATE TABLE IF NOT EXISTS public.iap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('apple', 'google')),

  -- Product identifiers
  product_id TEXT NOT NULL,                 -- e.g. dcm.credits.basic, dcm.cardlovers.monthly
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('consumable', 'subscription')),

  -- Platform-specific transaction IDs
  transaction_id TEXT NOT NULL,             -- Apple: transactionId. Google: orderId.
  original_transaction_id TEXT,             -- Apple: originalTransactionId. Google: first purchase token.
  purchase_token TEXT,                      -- Google: purchaseToken (needed for API verification + RTDN dedup)

  -- Credit grant tracking
  credits_granted INTEGER NOT NULL DEFAULT 0,

  -- Subscription state (null for consumables)
  subscription_period_start TIMESTAMP WITH TIME ZONE,
  subscription_period_end TIMESTAMP WITH TIME ZONE,
  auto_renew_status BOOLEAN,                -- Apple: autoRenewStatus. Google: autoRenewing.
  is_in_grace_period BOOLEAN DEFAULT FALSE, -- True when sub failed billing but still has access during grace period

  -- Lifecycle status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'refunded', 'revoked', 'pending', 'cancelled')),

  -- Raw payload for debugging / audit (Apple JWS-signed transaction payload or Google API response)
  raw_receipt JSONB,

  -- Server-side metadata
  environment VARCHAR(20) DEFAULT 'production'
    CHECK (environment IN ('production', 'sandbox')),
  notification_count INTEGER DEFAULT 0,     -- Bumped each time a server notification touches this row

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES + CONSTRAINTS
-- ============================================

-- Idempotency: the same platform-side transaction can never produce two rows.
-- Both verify-receipt and the server-notification webhook rely on this to
-- safely re-process payloads without granting credits twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_iap_transactions_unique_txn
  ON public.iap_transactions (platform, transaction_id);

-- Subscription lineage lookups — "what's this user's current Card Lovers state?"
CREATE INDEX IF NOT EXISTS idx_iap_transactions_user_subscription
  ON public.iap_transactions (user_id, product_type, subscription_period_end DESC)
  WHERE product_type = 'subscription';

-- Apple originalTransactionId / Google subscription lineage — used by webhook
-- handlers to find the most recent row for a given subscription line.
CREATE INDEX IF NOT EXISTS idx_iap_transactions_original
  ON public.iap_transactions (platform, original_transaction_id)
  WHERE original_transaction_id IS NOT NULL;

-- Google RTDN webhook hits with a purchase_token — needs to find the active row.
CREATE INDEX IF NOT EXISTS idx_iap_transactions_purchase_token
  ON public.iap_transactions (platform, purchase_token)
  WHERE purchase_token IS NOT NULL;

-- User history queries (account screen "recent purchases" view)
CREATE INDEX IF NOT EXISTS idx_iap_transactions_user_created
  ON public.iap_transactions (user_id, created_at DESC);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================
-- iap_transactions contains payment data — service role only.
-- Users can read their own row count via the API, never the raw rows.

ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.iap_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 4. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.set_iap_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iap_transactions_updated_at ON public.iap_transactions;
CREATE TRIGGER trg_iap_transactions_updated_at
  BEFORE UPDATE ON public.iap_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_iap_transactions_updated_at();

-- ============================================
-- 5. USER_CREDITS — IAP origin marker for Card Lovers
-- ============================================
-- Track which payment provider currently owns the user's Card Lovers
-- subscription so the account screen can show the correct "Manage Subscription"
-- link (App Store / Play Store / Stripe Customer Portal). Without this we'd
-- have to query iap_transactions on every account-page render.

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS card_lover_provider VARCHAR(10)
    CHECK (card_lover_provider IN ('apple', 'google', 'stripe'));

-- ============================================
-- ROLLBACK COMMANDS (if needed)
-- ============================================
/*
ALTER TABLE public.user_credits DROP COLUMN IF EXISTS card_lover_provider;
DROP TRIGGER IF EXISTS trg_iap_transactions_updated_at ON public.iap_transactions;
DROP FUNCTION IF EXISTS public.set_iap_transactions_updated_at();
DROP TABLE IF EXISTS public.iap_transactions;
*/
