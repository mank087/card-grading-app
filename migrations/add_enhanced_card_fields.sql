-- ========================================
-- Enhanced Card Information Fields Migration
-- DVG v1 Schema Update - Card Details Enhancement
-- ========================================
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ========================================

-- ========================================
-- CARD TEXT BLOCKS FIELDS
-- ========================================

-- Add text extraction fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS main_text_box TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS stat_table_text TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS copyright_text TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS text_confidence VARCHAR(10);

COMMENT ON COLUMN cards.main_text_box IS 'Extracted text from card back main text area (bio, description)';
COMMENT ON COLUMN cards.stat_table_text IS 'Extracted text from stat table or numeric data area';
COMMENT ON COLUMN cards.copyright_text IS 'Copyright notice and legal text from card';
COMMENT ON COLUMN cards.text_confidence IS 'OCR confidence level: high, medium, low';

-- ========================================
-- RARITY & FEATURE CLASSIFICATION FIELDS
-- ========================================

-- Add rarity classification fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_tier VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_score INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS feature_tags TEXT[];
ALTER TABLE cards ADD COLUMN IF NOT EXISTS print_finish VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_notes TEXT;

COMMENT ON COLUMN cards.rarity_tier IS 'Rarity classification: event_specific, short_print, 1_of_1, autographed, memorabilia, parallel_variant, rookie_card, base_common';
COMMENT ON COLUMN cards.rarity_score IS 'Numeric rarity score from 1-10 (10 = 1-of-1, 1 = base common)';
COMMENT ON COLUMN cards.feature_tags IS 'Array of feature tags: serial_numbered, autograph_on_card, prizm, refractor, rookie_card, etc.';
COMMENT ON COLUMN cards.print_finish IS 'Card finish type: standard_gloss, foil, holo, prizm, matte, refractor';
COMMENT ON COLUMN cards.rarity_notes IS 'Additional rarity context and notes';

-- ========================================
-- ENHANCED CARD INFO FIELDS
-- ========================================

-- Update existing fields with better types/defaults
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rookie_card BOOLEAN;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS first_print BOOLEAN;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS memorabilia_type VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS autograph_type VARCHAR(50);

COMMENT ON COLUMN cards.rookie_card IS 'True if card is designated rookie card';
COMMENT ON COLUMN cards.first_print IS 'True if card is first print/edition';
COMMENT ON COLUMN cards.memorabilia_type IS 'Type of memorabilia: patch, jersey, bat, ticket, none';
COMMENT ON COLUMN cards.autograph_type IS 'Type of autograph: on-card, sticker, dual, cut, none';

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Index on rarity_tier for filtering
CREATE INDEX IF NOT EXISTS idx_cards_rarity_tier ON cards(rarity_tier);

-- Index on rarity_score for sorting
CREATE INDEX IF NOT EXISTS idx_cards_rarity_score ON cards(rarity_score);

-- GIN index on feature_tags array for tag searches
CREATE INDEX IF NOT EXISTS idx_cards_feature_tags ON cards USING GIN (feature_tags);

-- Index on print_finish for filtering
CREATE INDEX IF NOT EXISTS idx_cards_print_finish ON cards(print_finish);

-- Index on rookie_card for filtering
CREATE INDEX IF NOT EXISTS idx_cards_rookie_card ON cards(rookie_card) WHERE rookie_card = true;

-- Index on text_confidence for quality filtering
CREATE INDEX IF NOT EXISTS idx_cards_text_confidence ON cards(text_confidence);

-- ========================================
-- HELPFUL QUERIES
-- ========================================

-- Find all rookie cards
/*
SELECT id, card_name, featured, rarity_tier, rarity_score, dcm_grade_whole
FROM cards
WHERE rookie_card = true
ORDER BY rarity_score DESC, dcm_grade_whole DESC
LIMIT 20;
*/

-- Find high-rarity cards (score 7+)
/*
SELECT id, card_name, featured, rarity_tier, rarity_score, feature_tags
FROM cards
WHERE rarity_score >= 7
ORDER BY rarity_score DESC, created_at DESC
LIMIT 20;
*/

-- Find cards by specific feature tag
/*
SELECT id, card_name, featured, rarity_tier, feature_tags
FROM cards
WHERE 'autograph_on_card' = ANY(feature_tags)
ORDER BY created_at DESC
LIMIT 20;
*/

-- Find cards by print finish type
/*
SELECT id, card_name, featured, print_finish, rarity_score
FROM cards
WHERE print_finish IN ('prizm', 'refractor', 'holo')
ORDER BY rarity_score DESC
LIMIT 20;
*/

-- Cards with extracted text (high confidence)
/*
SELECT id, card_name, main_text_box, text_confidence
FROM cards
WHERE text_confidence = 'high' AND main_text_box IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
*/

-- Rarity distribution analysis
/*
SELECT
    rarity_tier,
    COUNT(*) as count,
    AVG(rarity_score) as avg_rarity_score,
    AVG(dcm_grade_whole) as avg_grade
FROM cards
WHERE rarity_tier IS NOT NULL
GROUP BY rarity_tier
ORDER BY avg_rarity_score DESC;
*/

-- Feature tag popularity
/*
SELECT
    unnest(feature_tags) as tag,
    COUNT(*) as count
FROM cards
WHERE feature_tags IS NOT NULL
GROUP BY tag
ORDER BY count DESC
LIMIT 20;
*/

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN (
  'main_text_box', 'stat_table_text', 'copyright_text', 'text_confidence',
  'rarity_tier', 'rarity_score', 'feature_tags', 'print_finish', 'rarity_notes',
  'rookie_card', 'first_print', 'memorabilia_type', 'autograph_type'
)
ORDER BY column_name;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cards'
AND indexname LIKE 'idx_cards_%'
ORDER BY indexname;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced card information fields migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 New Fields Added:';
    RAISE NOTICE '   - Card Text Blocks: main_text_box, stat_table_text, copyright_text';
    RAISE NOTICE '   - Rarity Features: rarity_tier, rarity_score, feature_tags, print_finish';
    RAISE NOTICE '   - Enhanced Info: rookie_card, first_print, memorabilia_type, autograph_type';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Indexes Created:';
    RAISE NOTICE '   - idx_cards_rarity_tier, idx_cards_rarity_score';
    RAISE NOTICE '   - idx_cards_feature_tags (GIN), idx_cards_print_finish';
    RAISE NOTICE '   - idx_cards_rookie_card, idx_cards_text_confidence';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Next: Grade a card to test new field extraction';
    RAISE NOTICE '🔍 Use the helpful queries above to explore the new data';
END $$;
