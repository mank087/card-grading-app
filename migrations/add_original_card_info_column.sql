-- Add original_card_info column to preserve AI-extracted card details before user edits
-- This allows:
--   1. Tracking what the AI originally detected vs what the user changed
--   2. Reverting to AI values if needed
--   3. Auditing edit history at the card info level

ALTER TABLE cards ADD COLUMN IF NOT EXISTS original_card_info JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN cards.original_card_info IS 'Snapshot of conversational_card_info before first user edit. Preserved for audit/revert purposes.';
