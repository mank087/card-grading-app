-- WS7.3: Star Wars variant disambiguation
-- PriceCharting encodes each foil/parallel as a separate product whose ONLY
-- variant marker is the bracket suffix in the product name
-- (e.g. "Luke Skywalker [Foil] #100" vs "Luke Skywalker #100").
-- Store that bracket content in its own column so the matcher can distinguish
-- base rows from variant rows sharing the same card_number.

ALTER TABLE starwars_cards ADD COLUMN IF NOT EXISTS variant_text TEXT;

CREATE INDEX IF NOT EXISTS idx_starwars_cards_variant ON starwars_cards(variant_text);

COMMENT ON COLUMN starwars_cards.variant_text IS
  'Bracket content extracted from the PriceCharting product name (e.g. "Foil", "Mojo Refractor"). Multiple bracket groups are joined with a single space. NULL = base (non-variant) card.';
