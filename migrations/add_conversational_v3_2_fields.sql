-- Migration: Add Conversational Grading v3.2 Fields
-- Date: 2025-10-22
-- Description: Adds new fields for v3.2 structured grading with condition labels,
--              image confidence, validation checklists, and analysis summaries

-- Add condition label (user-friendly grade label)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_condition_label VARCHAR(50);

COMMENT ON COLUMN cards.conversational_condition_label IS 'Human-readable condition label from v3.2: Gem Mint (GM), Mint (M), Near Mint (NM), Excellent (EX), Good (G), Fair (F), Poor (P), or Authentic Altered (AA)';

-- Add image confidence grade (A/B/C/D rating)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_image_confidence VARCHAR(1);

COMMENT ON COLUMN cards.conversational_image_confidence IS 'Image quality confidence grade (A=excellent, B=good, C=fair, D=poor) from v3.2';

-- Add validation checklist (structured validation results)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_validation_checklist JSONB;

COMMENT ON COLUMN cards.conversational_validation_checklist IS 'v3.2 validation checklist with fields: autograph_verified, handwritten_markings, structural_damage, both_sides_present, confidence_letter, condition_label_assigned, all_steps_completed';

-- Add front analysis summary
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_front_summary TEXT;

COMMENT ON COLUMN cards.conversational_front_summary IS 'Summary of front-side analysis from v3.2 [STEP 3]';

-- Add back analysis summary
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_back_summary TEXT;

COMMENT ON COLUMN cards.conversational_back_summary IS 'Summary of back-side analysis from v3.2 [STEP 4]';

-- Add prompt version tracking
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_prompt_version VARCHAR(50);

COMMENT ON COLUMN cards.conversational_prompt_version IS 'Version of prompt used for conversational grading (e.g., "Conversational_Grading_v3.2")';

-- Add meta timestamp (when grading was performed)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_evaluated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN cards.conversational_evaluated_at IS 'UTC timestamp when conversational grading was performed';

-- Create index on condition label for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_cards_conversational_condition_label
ON cards(conversational_condition_label);

-- Create index on image confidence for quality filtering
CREATE INDEX IF NOT EXISTS idx_cards_conversational_image_confidence
ON cards(conversational_image_confidence);

-- Create index on prompt version for tracking different versions
CREATE INDEX IF NOT EXISTS idx_cards_conversational_prompt_version
ON cards(conversational_prompt_version);

-- Create GIN index on validation checklist JSONB for efficient querying
CREATE INDEX IF NOT EXISTS idx_cards_conversational_validation_checklist
ON cards USING GIN (conversational_validation_checklist);

-- Verify existing fields are present (these should already exist from v2)
-- If they don't exist, create them
DO $$
BEGIN
    -- Check for conversational_grading field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_grading'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_grading TEXT;
        COMMENT ON COLUMN cards.conversational_grading IS 'Full markdown text from conversational AI grading';
    END IF;

    -- Check for conversational_decimal_grade
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_decimal_grade'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_decimal_grade NUMERIC(3,1);
        COMMENT ON COLUMN cards.conversational_decimal_grade IS 'Decimal grade (1.0-10.0) from conversational grading';
    END IF;

    -- Check for conversational_whole_grade
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_whole_grade'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_whole_grade INTEGER;
        COMMENT ON COLUMN cards.conversational_whole_grade IS 'Whole number grade (1-10) from conversational grading';
    END IF;

    -- Check for conversational_grade_uncertainty
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_grade_uncertainty'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_grade_uncertainty VARCHAR(20);
        COMMENT ON COLUMN cards.conversational_grade_uncertainty IS 'Grade uncertainty range (e.g., ±0.5) from conversational grading';
    END IF;

    -- Check for conversational_sub_scores
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_sub_scores'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_sub_scores JSONB;
        COMMENT ON COLUMN cards.conversational_sub_scores IS 'Sub-scores for centering, corners, edges, surface from conversational grading';
    END IF;

    -- Check for conversational_weighted_summary
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_weighted_summary'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_weighted_summary JSONB;
        COMMENT ON COLUMN cards.conversational_weighted_summary IS 'Weighted summary with front_weight, back_weight, weighted_total, grade_cap_reason';
    END IF;

    -- Check for conversational_card_info
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_card_info'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_card_info JSONB;
        COMMENT ON COLUMN cards.conversational_card_info IS 'Card information extracted from conversational grading';
    END IF;

    -- Check for conversational_centering_ratios
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards'
        AND column_name = 'conversational_centering_ratios'
    ) THEN
        ALTER TABLE cards ADD COLUMN conversational_centering_ratios JSONB;
        COMMENT ON COLUMN cards.conversational_centering_ratios IS 'Centering ratios (front_lr, front_tb, back_lr, back_tb)';
    END IF;
END $$;

-- Migration complete
-- Run this SQL against your Supabase database to add v3.2 fields

COMMENT ON TABLE cards IS 'Trading cards with conversational AI grading v3.2 support';
