-- Add Direct Vision Grader v1 (DVG v1) fields to cards table
-- DVG v1 is a simplified grading system using a single GPT-4o vision API call
-- Replaces complex 3-stage pipeline (OpenCV + 2 AI stages)

-- Core DVG v1 grading result (stores complete JSON response)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_grading JSONB;

-- Grade values
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_decimal_grade DECIMAL(4,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_whole_grade INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_grade_uncertainty TEXT;

-- Image quality assessment
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_image_quality TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_reshoot_required BOOLEAN DEFAULT FALSE;

-- Centering measurements
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_centering_front_lr TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_centering_front_tb TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_centering_back_lr TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_centering_back_tb TEXT;

-- Analysis summary
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_positives TEXT[];
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_negatives TEXT[];

-- Metadata
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_model TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS dvg_version TEXT;

-- Add comments for clarity
COMMENT ON COLUMN cards.dvg_grading IS 'Complete DVG v1 grading result (JSON)';
COMMENT ON COLUMN cards.dvg_decimal_grade IS 'DVG v1 decimal grade (1.0-10.0)';
COMMENT ON COLUMN cards.dvg_whole_grade IS 'DVG v1 whole number grade (1-10)';
COMMENT ON COLUMN cards.dvg_grade_uncertainty IS 'Grade uncertainty: ±0.0, ±0.5, or ±1.0';
COMMENT ON COLUMN cards.dvg_image_quality IS 'Image quality grade: A, B, C, or D';
COMMENT ON COLUMN cards.dvg_reshoot_required IS 'Whether image reshoot is recommended (C or D quality)';
COMMENT ON COLUMN cards.dvg_centering_front_lr IS 'Front left/right centering ratio (e.g., 52/48)';
COMMENT ON COLUMN cards.dvg_centering_front_tb IS 'Front top/bottom centering ratio (e.g., 54/46)';
COMMENT ON COLUMN cards.dvg_centering_back_lr IS 'Back left/right centering ratio (e.g., 53/47)';
COMMENT ON COLUMN cards.dvg_centering_back_tb IS 'Back top/bottom centering ratio (e.g., 50/50)';
COMMENT ON COLUMN cards.dvg_positives IS 'Array of positive aspects identified by DVG v1';
COMMENT ON COLUMN cards.dvg_negatives IS 'Array of defects/issues identified by DVG v1';
COMMENT ON COLUMN cards.dvg_model IS 'OpenAI model used (gpt-4o or gpt-4o-mini)';
COMMENT ON COLUMN cards.dvg_version IS 'DVG system version (dvg-v1)';

-- Create index on dvg_grading for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_cards_dvg_grading ON cards USING GIN (dvg_grading);

-- Create index on dvg_decimal_grade for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_cards_dvg_decimal_grade ON cards(dvg_decimal_grade);

-- Create index on dvg_version for filtering by grading system version
CREATE INDEX IF NOT EXISTS idx_cards_dvg_version ON cards(dvg_version);

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name LIKE 'dvg_%'
ORDER BY column_name;
