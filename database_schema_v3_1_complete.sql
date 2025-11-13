-- ========================================
-- DCM Grading System v3.1 - Complete Database Schema
-- ========================================
-- This script ensures your Supabase database is fully up-to-date
-- Safe to run multiple times (uses IF NOT EXISTS)
-- Run this in Supabase SQL Editor
-- ========================================

-- Enable UUID extension (required for id generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- MAIN CARDS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS cards (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),

    -- Image storage paths
    front_path TEXT,
    back_path TEXT,

    -- Card category and type
    category TEXT DEFAULT 'Sports',  -- Sports, Pokémon, Magic, Yu-Gi-Oh!, etc.

    -- Card Information (extracted from AI)
    card_name TEXT,
    card_set TEXT,
    card_number TEXT,
    serial_numbering TEXT,
    manufacturer_name TEXT,
    release_date TEXT,
    authentic TEXT DEFAULT 'Yes',

    -- Card Details
    featured TEXT,  -- Player(s)/Character(s) featured
    rookie_or_first_print TEXT,
    rarity_description TEXT,
    memorabilia TEXT,  -- Yes/No for memorabilia pieces
    parallel_insert_type TEXT,  -- Prizm Base, Gold Parallel, etc.
    autographed BOOLEAN DEFAULT FALSE,

    -- Grading Results
    raw_decimal_grade NUMERIC(4,2),
    dcm_grade_whole INTEGER,
    ai_confidence_score TEXT,  -- A, B, C, D
    final_dcm_score TEXT,

    -- Full AI Grading JSON (stores complete v3.1 response)
    ai_grading JSONB,

    -- Market Data
    tcgplayer_url TEXT,
    ebay_url TEXT,
    estimated_market_value TEXT,
    market_price NUMERIC(10,2),
    market_price_low NUMERIC(10,2),
    market_price_high NUMERIC(10,2),
    market_price_source TEXT,
    market_price_updated TIMESTAMP WITH TIME ZONE,
    market_price_confidence TEXT,

    -- Pokémon-specific fields
    card_type TEXT,  -- Pokémon, Trainer, Energy
    pokemon_featured TEXT,
    pokemon_stage TEXT,  -- Basic, Stage 1, Stage 2, etc.
    pokemon_type TEXT,  -- Fire, Water, Grass, etc.
    trainer_subtype TEXT,
    energy_subtype TEXT,
    holofoil TEXT,  -- Yes/No/Reverse
    first_print_rookie TEXT,

    -- Multi-evaluation system (optional feature)
    total_evaluations INTEGER DEFAULT 0,
    completed_evaluations INTEGER DEFAULT 0,
    consensus_raw_grade NUMERIC(4,2),
    consensus_whole_grade INTEGER,
    consensus_confidence VARCHAR(1),
    evaluation_status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed
    target_evaluations INTEGER DEFAULT 1,  -- Default to 1 for normal grading, 3+ for consensus

    -- User-defined card boundaries (legacy feature)
    card_boundaries JSONB,

    -- Processing Metadata
    processing_time INTEGER,  -- milliseconds
    prompt_version TEXT DEFAULT '3.1',  -- Track which prompt version was used

    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Index on user_id for fast user queries
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);

-- Index on card_name for search
CREATE INDEX IF NOT EXISTS idx_cards_card_name ON cards(card_name);

-- Index on dcm_grade_whole for grade filtering
CREATE INDEX IF NOT EXISTS idx_cards_dcm_grade_whole ON cards(dcm_grade_whole);

-- GIN index on ai_grading JSONB for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_cards_ai_grading_gin ON cards USING GIN (ai_grading);

-- Index on prompt_version to track v3.1 cards
CREATE INDEX IF NOT EXISTS idx_cards_prompt_version ON cards(prompt_version);

-- Index on evaluation_status for multi-evaluation queries
CREATE INDEX IF NOT EXISTS idx_cards_evaluation_status ON cards(evaluation_status);

-- Index on pokemon_featured for Pokémon card searches
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_featured ON cards(pokemon_featured);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on cards table
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own cards
CREATE POLICY IF NOT EXISTS "Users can view own cards"
    ON cards FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own cards
CREATE POLICY IF NOT EXISTS "Users can insert own cards"
    ON cards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own cards
CREATE POLICY IF NOT EXISTS "Users can update own cards"
    ON cards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own cards
CREATE POLICY IF NOT EXISTS "Users can delete own cards"
    ON cards FOR DELETE
    USING (auth.uid() = user_id);

-- ========================================
-- STORAGE BUCKET FOR CARD IMAGES
-- ========================================

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('cards', 'cards', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Anyone can view card images
CREATE POLICY IF NOT EXISTS "Public card images are viewable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'cards');

-- Storage policy: Authenticated users can upload card images
CREATE POLICY IF NOT EXISTS "Authenticated users can upload card images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'cards' AND
        auth.role() = 'authenticated'
    );

-- Storage policy: Users can update their own card images
CREATE POLICY IF NOT EXISTS "Users can update own card images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'cards' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policy: Users can delete their own card images
CREATE POLICY IF NOT EXISTS "Users can delete own card images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'cards' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- ========================================
-- TRIGGERS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_cards_updated_at ON cards;
CREATE TRIGGER update_cards_updated_at
    BEFORE UPDATE ON cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE cards IS 'Main table storing all graded cards across all categories';
COMMENT ON COLUMN cards.id IS 'Unique card identifier';
COMMENT ON COLUMN cards.category IS 'Card category: Sports, Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, Other';
COMMENT ON COLUMN cards.ai_grading IS 'Complete v3.1 AI grading response including Stage 0, Stage 1, and Stage 2 data';
COMMENT ON COLUMN cards.prompt_version IS 'Version of AI prompts used for grading (e.g., 3.1)';
COMMENT ON COLUMN cards.dcm_grade_whole IS 'Final whole number grade (1-10)';
COMMENT ON COLUMN cards.raw_decimal_grade IS 'Raw decimal grade before rounding (e.g., 9.7)';
COMMENT ON COLUMN cards.ai_confidence_score IS 'Image quality grade: A (best), B, C, D (worst)';
COMMENT ON COLUMN cards.autographed IS 'Whether card has an autograph (certified or on-card)';
COMMENT ON COLUMN cards.memorabilia IS 'Whether card contains memorabilia pieces (jersey, patch, etc.)';
COMMENT ON COLUMN cards.parallel_insert_type IS 'Specific parallel or insert type (e.g., Prizm Silver, Gold Refractor)';

-- ========================================
-- OPTIONAL: MULTI-EVALUATION SYSTEM
-- ========================================
-- This table is optional - only needed if you want to grade cards multiple times
-- and calculate consensus scores (advanced feature)

CREATE TABLE IF NOT EXISTS card_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    evaluation_number INTEGER NOT NULL,
    ai_grading JSONB,
    raw_decimal_grade NUMERIC(4,2),
    dcm_grade_whole INTEGER,
    ai_confidence_score VARCHAR(1),
    grade_numeric INTEGER,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(card_id, evaluation_number)
);

CREATE INDEX IF NOT EXISTS idx_card_evaluations_card_id ON card_evaluations(card_id);
CREATE INDEX IF NOT EXISTS idx_card_evaluations_status ON card_evaluations(card_id, completed_at);

COMMENT ON TABLE card_evaluations IS 'Optional: Stores multiple AI evaluations per card for consensus grading';

-- ========================================
-- HELPFUL QUERIES FOR v3.1
-- ========================================

-- Check if v3.1 fields are present in existing records
-- Run this after grading a card with v3.1:
/*
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as front_centering_type,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as detection_mode,
    prompt_version,
    created_at
FROM cards
ORDER BY created_at DESC
LIMIT 10;
*/

-- Count cards by OpenCV version
/*
SELECT
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    COUNT(*) as count
FROM cards
WHERE ai_grading IS NOT NULL
GROUP BY opencv_version
ORDER BY count DESC;
*/

-- Find cards with design-anchor centering (borderless/full-art)
/*
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as front_type,
    ai_grading->'Centering_Measurements'->>'back_centering_type' as back_type,
    dcm_grade_whole
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'front_centering_type' = 'design-anchor'
   OR ai_grading->'Centering_Measurements'->>'back_centering_type' = 'design-anchor'
ORDER BY created_at DESC;
*/

-- Find cards by image quality grade
/*
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    ai_grading->'Centering_Measurements'->>'back_image_quality_grade' as back_quality,
    dcm_grade_whole,
    created_at
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'front_image_quality_grade' IN ('C', 'D')
ORDER BY created_at DESC;
*/

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'cards'
ORDER BY indexname;

-- Verify RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'cards'
ORDER BY policyname;

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'cards';

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database schema v3.1 complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary:';
    RAISE NOTICE '   - Cards table: Created/Updated';
    RAISE NOTICE '   - Indexes: Created';
    RAISE NOTICE '   - RLS Policies: Enabled';
    RAISE NOTICE '   - Storage Bucket: Configured';
    RAISE NOTICE '   - Triggers: Active';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Next: Upload a card to test v3.1 grading';
    RAISE NOTICE '🔍 Use the helpful queries above to verify v3.1 fields';
END $$;
