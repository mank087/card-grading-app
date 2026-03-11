-- Add custom label data columns for user-editable label overrides
-- custom_label_data: stores user's custom overrides (partial — only changed fields)
-- original_label_data: stores the AI-generated label data before any user edits (for revert)

ALTER TABLE cards ADD COLUMN IF NOT EXISTS custom_label_data jsonb DEFAULT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS original_label_data jsonb DEFAULT NULL;

-- Index for quickly finding cards with custom labels
CREATE INDEX IF NOT EXISTS idx_cards_custom_label ON cards (id) WHERE custom_label_data IS NOT NULL;
