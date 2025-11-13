-- Pokemon Database Migration
-- Add Pokemon-specific columns to the cards table

-- Pokemon-specific fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_featured TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_stage TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS trainer_subtype TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS energy_subtype TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS holofoil TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS first_print_rookie TEXT;

-- Add comments for clarity
COMMENT ON COLUMN cards.card_type IS 'Pokemon card type: Pokémon, Trainer, Energy';
COMMENT ON COLUMN cards.pokemon_featured IS 'Name of Pokemon featured (if Pokemon card)';
COMMENT ON COLUMN cards.pokemon_stage IS 'Pokemon stage: Basic, Stage 1, Stage 2, GX, V, VMAX, etc.';
COMMENT ON COLUMN cards.pokemon_type IS 'Pokemon type: Grass, Fire, Water, Lightning, etc.';
COMMENT ON COLUMN cards.trainer_subtype IS 'Trainer subtype: Item, Supporter, Stadium, Tool';
COMMENT ON COLUMN cards.energy_subtype IS 'Energy subtype: Basic Energy, Special Energy, etc.';
COMMENT ON COLUMN cards.holofoil IS 'Holofoil details: Standard Holo, Reverse Holo, Full Art, etc.';
COMMENT ON COLUMN cards.first_print_rookie IS 'First print/rookie status for Pokemon cards';

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN (
  'card_type', 'pokemon_featured', 'pokemon_stage', 'pokemon_type',
  'trainer_subtype', 'energy_subtype', 'holofoil', 'first_print_rookie'
)
ORDER BY column_name;