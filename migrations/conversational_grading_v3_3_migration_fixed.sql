-- =========================================================================
-- Conversational Grading v3.3 Database Migration (CORRECTED)
-- =========================================================================
-- Date: 2025-10-24
-- Purpose: Add new fields for v3.3 enhanced grading features to CARDS table
--
-- New Features:
-- 1. Rarity classification (10-tier hierarchy)
-- 2. Defect coordinate tracking (X%, Y% positions)
-- 3. Enhanced grading metadata (pre-cap scores, rounding flags)
-- 4. Cross-side verification results
-- 5. Lighting conditions notes
-- =========================================================================

-- =========================================================================
-- SECTION 1: Rarity Classification Fields
-- =========================================================================

-- Primary rarity tier from 10-tier hierarchy
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_tier VARCHAR(100);

-- Serial number in fraction format (e.g., "12/99")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS serial_number_fraction VARCHAR(50);

-- Autograph type classification
ALTER TABLE cards ADD COLUMN IF NOT EXISTS autograph_type VARCHAR(50);

-- Memorabilia/relic type
ALTER TABLE cards ADD COLUMN IF NOT EXISTS memorabilia_type VARCHAR(100);

-- Finish/material type
ALTER TABLE cards ADD COLUMN IF NOT EXISTS finish_material VARCHAR(100);

-- Rookie card flag
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rookie_flag VARCHAR(20);

-- Subset/insert name
ALTER TABLE cards ADD COLUMN IF NOT EXISTS subset_insert_name VARCHAR(200);

-- Special attributes (multiple features)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS special_attributes TEXT;

-- Rarity classification notes
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_notes TEXT;

-- =========================================================================
-- SECTION 2: Enhanced Grading Metadata
-- =========================================================================

-- Weighted total before any caps applied
ALTER TABLE cards ADD COLUMN IF NOT EXISTS weighted_total_pre_cap NUMERIC(3,1);

-- Reason for grade cap (if any)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS capped_grade_reason TEXT;

-- Conservative rounding flag
ALTER TABLE cards ADD COLUMN IF NOT EXISTS conservative_rounding_applied BOOLEAN DEFAULT FALSE;

-- Lighting conditions notes
ALTER TABLE cards ADD COLUMN IF NOT EXISTS lighting_conditions_notes TEXT;

-- =========================================================================
-- SECTION 3: Defect Coordinate Tracking
-- =========================================================================

-- Front defect coordinates (JSON array)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS defect_coordinates_front JSONB;

-- Back defect coordinates (JSON array)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS defect_coordinates_back JSONB;

-- =========================================================================
-- SECTION 4: Cross-Side Verification
-- =========================================================================

-- Cross-side verification result
ALTER TABLE cards ADD COLUMN IF NOT EXISTS cross_side_verification_result VARCHAR(50);

-- =========================================================================
-- SECTION 5: Create Indexes for Performance
-- =========================================================================

-- Index on rarity tier for filtering rare cards
CREATE INDEX IF NOT EXISTS idx_cards_rarity_tier ON cards(rarity_tier);

-- Index on autograph type for filtering autographed cards
CREATE INDEX IF NOT EXISTS idx_cards_autograph_type ON cards(autograph_type);

-- Index on rookie flag for filtering rookie cards
CREATE INDEX IF NOT EXISTS idx_cards_rookie_flag ON cards(rookie_flag);

-- Index on cross-side verification for filtering structural issues
CREATE INDEX IF NOT EXISTS idx_cards_cross_verification ON cards(cross_side_verification_result);

-- GIN index on defect coordinates for JSON queries
CREATE INDEX IF NOT EXISTS idx_cards_defects_front_gin ON cards USING GIN (defect_coordinates_front);
CREATE INDEX IF NOT EXISTS idx_cards_defects_back_gin ON cards USING GIN (defect_coordinates_back);

-- =========================================================================
-- Migration Complete
-- =========================================================================
