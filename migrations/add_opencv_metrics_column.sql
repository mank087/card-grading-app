-- Migration: Add opencv_metrics column to cards table
-- Date: 2025-10-16
-- Purpose: Store OpenCV Stage 0 analysis metrics for transparency and debugging

-- Add opencv_metrics JSONB column to store raw OpenCV output
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS opencv_metrics JSONB;

-- Add index for JSONB queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_cards_opencv_metrics ON cards USING GIN (opencv_metrics);

-- Add comment explaining the column
COMMENT ON COLUMN cards.opencv_metrics IS 'Raw OpenCV Stage 0 analysis metrics including centering, edge whitening, corner analysis, surface defects, and glare masking. Generated before LLM grading.';

-- Example of stored data structure:
-- {
--   "version": "stage1_opencv_v1.0",
--   "run_id": "uuid",
--   "front": {
--     "centering": { "lr_ratio": [51.08, 48.92], "tb_ratio": [27.70, 72.30] },
--     "edge_segments": { "top": [...], "bottom": [...], "left": [...], "right": [...] },
--     "corners": [{"corner_name": "tl", "rounding_radius_px": 52.12, ...}],
--     "surface": {"white_dots_count": 0, "scratch_count": 520, ...},
--     "sleeve_indicator": false,
--     "glare_mask_percent": 0.0
--   },
--   "back": { ... }
-- }
