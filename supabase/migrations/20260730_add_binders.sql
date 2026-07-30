-- ============================================================================
-- Binders — user-defined collection organisation
-- ============================================================================
-- See docs/BINDERS_DESIGN_2026-07-30.md for the full rationale.
--
-- A binder is a user-created named container. A card can be in many binders or
-- none; "All Cards" remains the master view and is never manually ordered.
-- Manual drag ordering lives INSIDE a binder, where the item count is small
-- enough for dragging to be a gesture a human can actually perform. Power users
-- hold 500-2,000+ cards, so hand-ordering the whole collection is not viable.
--
-- Two kinds:
--   manual  smart_filter IS NULL  — membership rows in binder_cards
--   smart   smart_filter IS NOT NULL — a saved filter, evaluated on read, no
--           membership rows and no manual order
--
-- ORDERING uses FRACTIONAL INDEXING: `position` is NUMERIC, not a sequential
-- integer. Appending takes max+1024; inserting between two cards takes their
-- midpoint. A move therefore writes ONE row. The naive integer alternative
-- renumbers the whole binder on every drag — slow, and it races when two tabs
-- drag at once. Positions are always computed server-side from the client's
-- INTENT ("put this after that card"), never sent by the client.
-- ============================================================================

CREATE TABLE IF NOT EXISTS binders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  -- SET NULL, not CASCADE: losing the cover card must not delete the binder.
  cover_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  accent_color  TEXT,
  position      NUMERIC NOT NULL DEFAULT 1024,
  smart_filter  JSONB,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  slug          TEXT,
  -- Marks an app-managed binder the user didn't create by hand. Currently only
  -- 'sold'. System binders can be renamed and reordered but not deleted
  -- outright — turning them off is a preference, not a delete.
  system_key    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'binders_user_slug_key') THEN
    ALTER TABLE binders ADD CONSTRAINT binders_user_slug_key UNIQUE (user_id, slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'binders_name_not_blank') THEN
    ALTER TABLE binders ADD CONSTRAINT binders_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'binders_user_system_key') THEN
    ALTER TABLE binders ADD CONSTRAINT binders_user_system_key UNIQUE (user_id, system_key);
  END IF;
END $$;

-- ============================================================================
-- The optional "Sold" binder
-- ============================================================================
-- Sold cards can optionally appear as their own binder. It is implemented as a
-- SMART binder (smart_filter = {"ownership_status":"sold"}) rather than by
-- moving membership rows around, because a filter cannot drift: mark a card
-- sold and it is in the binder; hit "Still mine" and it leaves. Literal
-- membership would need sync on every ownership change, on the eBay
-- reconciliation, and on undo — three places to get out of step.
--
-- NULL = never asked, FALSE = no thanks, TRUE = show me a Sold binder.
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS sold_binder_enabled BOOLEAN;

COMMENT ON COLUMN user_credits.sold_binder_enabled IS
  'NULL = not asked; TRUE = surface an auto-maintained "Sold" smart binder; FALSE = declined. Sold cards are always reachable via the Sold ownership view regardless.';

-- Membership. ON DELETE CASCADE on card_id is safe because cards are now
-- SOFT-deleted (deleted_at) — a deleted card keeps its membership row and
-- silently returns to its binders when restored. Only a retention sweep that
-- hard-deletes the row will actually drop the membership.
CREATE TABLE IF NOT EXISTS binder_cards (
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  card_id   UUID NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  position  NUMERIC NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (binder_id, card_id)
);

-- (binder_id, position, card_id) matches the keyset pagination ORDER BY
-- exactly, so paging a large binder never sorts.
CREATE INDEX IF NOT EXISTS idx_binder_cards_order ON binder_cards (binder_id, position, card_id);
-- "which binders is this card in?" on the card detail page.
CREATE INDEX IF NOT EXISTS idx_binder_cards_card  ON binder_cards (card_id);
CREATE INDEX IF NOT EXISTS idx_binders_user       ON binders (user_id, position);
CREATE INDEX IF NOT EXISTS idx_binders_public     ON binders (user_id, slug) WHERE is_public;

-- ============================================================================
-- RLS — mirrors the cards table: owner-only, plus anonymous read of PUBLIC
-- binders so /collection/<username>/<slug> works logged out.
--
-- NOTE: a public binder exposes only the binder and its membership rows. The
-- CARDS themselves are still gated by their own visibility — the read path
-- filters on cards.visibility so putting a private card in a shared binder can
-- never silently publish it.
-- ============================================================================

ALTER TABLE binders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE binder_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS binders_owner_all ON binders;
CREATE POLICY binders_owner_all ON binders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS binders_public_read ON binders;
CREATE POLICY binders_public_read ON binders
  FOR SELECT USING (is_public);

DROP POLICY IF EXISTS binder_cards_owner_all ON binder_cards;
CREATE POLICY binder_cards_owner_all ON binder_cards
  FOR ALL
  USING (EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND b.user_id = auth.uid()));

DROP POLICY IF EXISTS binder_cards_public_read ON binder_cards;
CREATE POLICY binder_cards_public_read ON binder_cards
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND b.is_public));

-- ============================================================================

COMMENT ON TABLE  binders IS
  'User-created collection containers. smart_filter IS NULL = manual binder with binder_cards rows; NOT NULL = saved filter evaluated on read.';
COMMENT ON COLUMN binders.position IS
  'Fractional index for ordering the binders themselves. Midpoint inserts; never renumber on drag.';
COMMENT ON COLUMN binder_cards.position IS
  'Fractional index within the binder. Computed SERVER-side from client intent (after/before a neighbour) so concurrent drags cannot collide.';
COMMENT ON COLUMN binders.is_public IS
  'Publishes the binder at /collection/<username>/<slug>. Does NOT override per-card visibility — private cards stay hidden inside a public binder.';
