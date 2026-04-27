-- Add card_colors JSONB column for storing extracted dominant colors
-- Used by color-matched label styles in Label Studio
-- Format: { "primary": "#hex", "secondary": "#hex", "palette": ["#hex"...], "isDark": bool }

ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_colors JSONB DEFAULT NULL;

COMMENT ON COLUMN cards.card_colors IS 'Dominant colors extracted from card image for color-matched label styles';
