-- Add flavor_name column to mtg_cards for Universes Beyond / Secret Lair crossover names
-- Scryfall provides flavor_name for cards that have a crossover/alternate name
-- e.g., "Doc Ock, Armed and Dangerous" is the flavor_name for "Lorthos, the Tidemaker"

ALTER TABLE mtg_cards ADD COLUMN IF NOT EXISTS flavor_name TEXT;

-- Create trigram index for fuzzy search on flavor_name
CREATE INDEX IF NOT EXISTS idx_mtg_cards_flavor_name ON mtg_cards USING gin (flavor_name gin_trgm_ops);
