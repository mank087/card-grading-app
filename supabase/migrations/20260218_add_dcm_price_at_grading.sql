-- Add "price at grading" columns to cards table
-- These capture the PriceCharting value at the moment a card is first graded.
-- Used to calculate price movers (current value vs value at grading time).

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS dcm_price_at_grading DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS dcm_price_at_grading_date TIMESTAMPTZ;

COMMENT ON COLUMN cards.dcm_price_at_grading IS 'PriceCharting estimated value at time of initial grading — set once, never overwritten';
COMMENT ON COLUMN cards.dcm_price_at_grading_date IS 'Timestamp when dcm_price_at_grading was recorded';

-- Backfill existing graded cards: use current dcm_price_estimate as a reasonable baseline
-- so movers can start working immediately for existing cards
UPDATE cards
SET
  dcm_price_at_grading = dcm_price_estimate,
  dcm_price_at_grading_date = dcm_price_updated_at
WHERE dcm_price_estimate IS NOT NULL
  AND dcm_price_at_grading IS NULL;
