-- Migration: Add slab detection columns for professional graded cards
-- Date: 2025-10-13
-- Purpose: Support dual-display of professional grades (PSA, BGS, etc.) alongside AI grades

-- Add slab detection fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_company VARCHAR(50); -- 'PSA', 'BGS', 'CGC', 'SGC', 'TAG', etc.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_grade VARCHAR(20); -- '10', '9.5', 'BGS 9.5', etc.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_cert_number VARCHAR(100); -- Certification number from label
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_serial VARCHAR(100); -- Serial number if visible
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_subgrades JSONB; -- For BGS/CGC subgrades: {centering: 9.5, corners: 10, edges: 9.5, surface: 10}
ALTER TABLE cards ADD COLUMN IF NOT EXISTS slab_metadata JSONB; -- Additional slab info: {grade_date: '2024', population: 'Pop 1', label_type: 'Red Label'}
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ai_vs_slab_comparison TEXT; -- Notes comparing AI grade to slab grade

-- Add index for querying slabbed cards
CREATE INDEX IF NOT EXISTS idx_cards_slab_detected ON cards(slab_detected);
CREATE INDEX IF NOT EXISTS idx_cards_slab_company ON cards(slab_company);

-- Comments
COMMENT ON COLUMN cards.slab_detected IS 'TRUE if card is in a professional grading holder/slab';
COMMENT ON COLUMN cards.slab_company IS 'Grading company name: PSA, BGS, CGC, SGC, TAG, etc.';
COMMENT ON COLUMN cards.slab_grade IS 'Professional grade from slab label (e.g., "10", "9.5", "BGS 9.5")';
COMMENT ON COLUMN cards.slab_cert_number IS 'Certification number from grading label';
COMMENT ON COLUMN cards.slab_serial IS 'Serial number if visible on label';
COMMENT ON COLUMN cards.slab_subgrades IS 'BGS/CGC subgrades in JSON format';
COMMENT ON COLUMN cards.slab_metadata IS 'Additional metadata: grade date, population, label type, etc.';
COMMENT ON COLUMN cards.ai_vs_slab_comparison IS 'Comparison notes between AI grade and professional grade';
