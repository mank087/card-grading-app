-- Catalog name search that ignores punctuation and spacing (Sept 2026).
--
-- The Pokemon catalog keeps the official names ("Espeon-GX", "Mewtwo-EX",
-- "Pikachu & Zekrom-GX"); graders and owners type what is printed ("Espeon GX").
-- The local lookups match names with a substring ILIKE, so "Espeon GX" never
-- found "Espeon-GX". name_search is the name lowercased with every
-- non-alphanumeric character removed; the code searches it with the input
-- normalized the same way. The official name column is untouched.
--
-- After applying: set CATALOG_NAME_SEARCH=1 in Vercel (the code falls back to
-- the old name search until then).

BEGIN;

ALTER TABLE public.pokemon_cards
  ADD COLUMN IF NOT EXISTS name_search text
  GENERATED ALWAYS AS (lower(regexp_replace(coalesce(name, ''), '[^[:alnum:]]', '', 'g'))) STORED;

-- Substring search needs a trigram index (pg_trgm lives in the extensions schema,
-- see 20260111_fix_card_shows_security.sql).
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_search_trgm
  ON public.pokemon_cards USING gin (name_search extensions.gin_trgm_ops);

COMMIT;

-- Check after applying:
--   SELECT name, name_search FROM pokemon_cards WHERE id IN ('sm1-140', 'xy12-103', 'sv8pt5-161');
--   -- expected: espeongx, mewtwoex, umbreonex
