-- =========================================================================
-- Conversational Grading v3.3 Database Migration
-- =========================================================================
-- Date: 2025-10-24
-- Purpose: Add new fields for v3.3 enhanced grading features
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
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS rarity_tier VARCHAR(100);
COMMENT ON COLUMN card_grading.rarity_tier IS 'Primary rarity classification: 1-of-1, SSP, SP, Authenticated Autograph, Memorabilia/Relic, Parallel/Insert, Rookie, Limited Edition, Commemorative/Promo, Base/Common';

-- Serial number in fraction format (e.g., "12/99")
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS serial_number_fraction VARCHAR(50);
COMMENT ON COLUMN card_grading.serial_number_fraction IS 'Serial number in fraction format (e.g., "12/99" or "1/1")';

-- Autograph type classification
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS autograph_type VARCHAR(50);
COMMENT ON COLUMN card_grading.autograph_type IS 'Autograph classification: on-card, sticker, unverified, or none';

-- Memorabilia/relic type
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS memorabilia_type VARCHAR(100);
COMMENT ON COLUMN card_grading.memorabilia_type IS 'Type of memorabilia: patch, fabric, relic, jersey, etc.';

-- Finish/material type
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS finish_material VARCHAR(100);
COMMENT ON COLUMN card_grading.finish_material IS 'Card finish: foil, matte, refractor, chrome, etc.';

-- Rookie card flag
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS rookie_flag VARCHAR(20);
COMMENT ON COLUMN card_grading.rookie_flag IS 'Rookie designation: yes, no, or potential';

-- Subset/insert name
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS subset_insert_name VARCHAR(200);
COMMENT ON COLUMN card_grading.subset_insert_name IS 'Name of subset or insert series';

-- Special attributes (multiple features)
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS special_attributes TEXT;
COMMENT ON COLUMN card_grading.special_attributes IS 'Special card attributes: die-cut, acetate, booklet, metal, etc. (comma-separated)';

-- Rarity classification notes
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS rarity_notes TEXT;
COMMENT ON COLUMN card_grading.rarity_notes IS 'Additional notes about rarity classification reasoning';

-- =========================================================================
-- SECTION 2: Enhanced Grading Metadata
-- =========================================================================

-- Weighted total before any caps applied
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS weighted_total_pre_cap DECIMAL(3,1);
COMMENT ON COLUMN card_grading.weighted_total_pre_cap IS 'Calculated weighted total before grade caps applied';

-- Reason for grade cap (if any)
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS capped_grade_reason TEXT;
COMMENT ON COLUMN card_grading.capped_grade_reason IS 'Explanation if grade was capped (structural damage, dent, crease, etc.)';

-- Conservative rounding flag
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS conservative_rounding_applied BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN card_grading.conservative_rounding_applied IS 'True if conservative rounding rule was applied due to uncertainty';

-- Lighting conditions notes
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS lighting_conditions_notes TEXT;
COMMENT ON COLUMN card_grading.lighting_conditions_notes IS 'Notes about lighting direction, glare areas, and environmental conditions';

-- =========================================================================
-- SECTION 3: Defect Coordinate Tracking
-- =========================================================================

-- Front defect coordinates (JSON array)
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS defect_coordinates_front JSONB;
COMMENT ON COLUMN card_grading.defect_coordinates_front IS 'Array of defect coordinates on front: [{"x": 0-100, "y": 0-100, "type": "scratch", "severity": "minor", "description": "..."}]';

-- Back defect coordinates (JSON array)
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS defect_coordinates_back JSONB;
COMMENT ON COLUMN card_grading.defect_coordinates_back IS 'Array of defect coordinates on back: [{"x": 0-100, "y": 0-100, "type": "scratch", "severity": "minor", "description": "..."}]';

-- =========================================================================
-- SECTION 4: Cross-Side Verification
-- =========================================================================

-- Cross-side verification result
ALTER TABLE card_grading ADD COLUMN IF NOT EXISTS cross_side_verification_result VARCHAR(50);
COMMENT ON COLUMN card_grading.cross_side_verification_result IS 'Result of cross-side verification: Confirmed Structural Crease, Confirmed Dent, Uncertain Artifact, Cleared Reflection';

-- =========================================================================
-- SECTION 5: Create Indexes for Performance
-- =========================================================================

-- Index on rarity tier for filtering rare cards
CREATE INDEX IF NOT EXISTS idx_card_grading_rarity_tier ON card_grading(rarity_tier);

-- Index on autograph type for filtering autographed cards
CREATE INDEX IF NOT EXISTS idx_card_grading_autograph_type ON card_grading(autograph_type);

-- Index on rookie flag for filtering rookie cards
CREATE INDEX IF NOT EXISTS idx_card_grading_rookie_flag ON card_grading(rookie_flag);

-- Index on cross-side verification for filtering structural issues
CREATE INDEX IF NOT EXISTS idx_card_grading_cross_verification ON card_grading(cross_side_verification_result);

-- GIN index on defect coordinates for JSON queries
CREATE INDEX IF NOT EXISTS idx_card_grading_defects_front_gin ON card_grading USING GIN (defect_coordinates_front);
CREATE INDEX IF NOT EXISTS idx_card_grading_defects_back_gin ON card_grading USING GIN (defect_coordinates_back);

-- =========================================================================
-- SECTION 6: Data Validation Constraints
-- =========================================================================

-- Ensure autograph_type is valid
ALTER TABLE card_grading ADD CONSTRAINT check_autograph_type
  CHECK (autograph_type IS NULL OR autograph_type IN ('on-card', 'sticker', 'unverified', 'none'));

-- Ensure rookie_flag is valid
ALTER TABLE card_grading ADD CONSTRAINT check_rookie_flag
  CHECK (rookie_flag IS NULL OR rookie_flag IN ('yes', 'no', 'potential'));

-- Ensure cross_side_verification_result is valid
ALTER TABLE card_grading ADD CONSTRAINT check_cross_side_verification
  CHECK (cross_side_verification_result IS NULL OR cross_side_verification_result IN (
    'Confirmed Structural Crease',
    'Confirmed Dent / Indentation',
    'Uncertain Artifact',
    'Cleared Reflection'
  ));

-- Ensure weighted_total_pre_cap is valid grade (0.0-10.0)
ALTER TABLE card_grading ADD CONSTRAINT check_weighted_total_pre_cap
  CHECK (weighted_total_pre_cap IS NULL OR (weighted_total_pre_cap >= 0.0 AND weighted_total_pre_cap <= 10.0));

-- =========================================================================
-- SECTION 7: Update Existing Records with Default Values
-- =========================================================================

-- Set default values for existing records
UPDATE card_grading
SET
  conservative_rounding_applied = FALSE,
  autograph_type = 'none',
  rookie_flag = 'no'
WHERE
  conservative_rounding_applied IS NULL
  OR autograph_type IS NULL
  OR rookie_flag IS NULL;

-- =========================================================================
-- SECTION 8: Optional - Create Separate Defect Coordinates Table
-- =========================================================================
-- This is an alternative to storing defects in JSONB columns
-- Uncomment if you prefer normalized storage for complex queries

/*
CREATE TABLE IF NOT EXISTS defect_coordinates (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  side VARCHAR(10) NOT NULL CHECK (side IN ('front', 'back')),
  defect_type VARCHAR(50) NOT NULL,
  coordinate_x INTEGER NOT NULL CHECK (coordinate_x >= 0 AND coordinate_x <= 100),
  coordinate_y INTEGER NOT NULL CHECK (coordinate_y >= 0 AND coordinate_y <= 100),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('Microscopic', 'Minor', 'Moderate', 'Heavy')),
  description TEXT,
  cross_side_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for defect_coordinates table
CREATE INDEX IF NOT EXISTS idx_defect_coords_card_id ON defect_coordinates(card_id);
CREATE INDEX IF NOT EXISTS idx_defect_coords_side ON defect_coordinates(side);
CREATE INDEX IF NOT EXISTS idx_defect_coords_type ON defect_coordinates(defect_type);
CREATE INDEX IF NOT EXISTS idx_defect_coords_severity ON defect_coordinates(severity);

-- Composite index for finding defects by location
CREATE INDEX IF NOT EXISTS idx_defect_coords_location ON defect_coordinates(card_id, side, coordinate_x, coordinate_y);

COMMENT ON TABLE defect_coordinates IS 'Normalized storage for defect coordinates (alternative to JSONB storage)';
*/

-- =========================================================================
-- SECTION 9: Migration Metadata
-- =========================================================================

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT
);

-- Record this migration
INSERT INTO schema_migrations (migration_name, description)
VALUES (
  'conversational_grading_v3_3_migration',
  'Add v3.3 fields: rarity classification, defect coordinates, enhanced metadata, cross-side verification'
)
ON CONFLICT (migration_name) DO NOTHING;

-- =========================================================================
-- Migration Complete
-- =========================================================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'v3.3 Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added Fields:';
  RAISE NOTICE '  - 9 rarity classification fields';
  RAISE NOTICE '  - 4 enhanced grading metadata fields';
  RAISE NOTICE '  - 2 defect coordinate JSONB fields';
  RAISE NOTICE '  - 1 cross-side verification field';
  RAISE NOTICE 'Created Indexes: 6';
  RAISE NOTICE 'Added Constraints: 4';
  RAISE NOTICE '========================================';
END $$;
