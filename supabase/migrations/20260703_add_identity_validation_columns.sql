-- ============================================================================
-- Uniform Identity Validation Columns (WS2b / WS7.1 / WS7.2)
-- ============================================================================
-- Standardizes how DB-backed identity validation is recorded across ALL card
-- categories (sports first, then Pokemon/MTG/Lorcana/OP/YGO/SW alignment):
--
--   validated_source      which local table confirmed the identity
--                         (e.g. 'sports_card_products', 'pokemon_cards',
--                          'mtg_cards'); NULL = unvalidated AI guess
--   validation_tier       'exact' | 'family' | NULL
--                         exact  = single product pinned down
--                         family = set+number confirmed, variant ambiguous
--   validation_confidence 'high' | 'medium' | 'low' | NULL
--   ai_card_info_original snapshot of the AI extraction BEFORE any DB
--                         overwrite (audit trail; Pokemon currently destroys
--                         this by rewriting the raw grading JSON)
-- ============================================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS validated_source TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS validation_tier TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS validation_confidence TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ai_card_info_original JSONB;

CREATE INDEX IF NOT EXISTS idx_cards_validated_source ON cards(validated_source);

COMMENT ON COLUMN cards.validated_source IS 'Local DB table that confirmed card identity; NULL = unvalidated AI extraction';
COMMENT ON COLUMN cards.validation_tier IS 'exact = product pinned; family = set+number confirmed, variant ambiguous';
COMMENT ON COLUMN cards.ai_card_info_original IS 'AI-extracted card_info snapshot taken before DB validation overwrites';
