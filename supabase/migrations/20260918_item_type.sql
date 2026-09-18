-- What kind of item was submitted, as decided by first look (src/lib/identification/itemType.ts).
-- NULL means "treat as a standard trading card". A non-null value (sticker_or_decal,
-- accessory_not_a_card, oversized_or_jumbo, custom_or_fan_made, reproduction_or_reprint_marked,
-- photo_of_a_screen_or_printout, not_a_collectible) makes the card carry the label
-- "Not a standard trading card" and show no market price. Owner policy, Sept 17 2026.
--
-- APPLY BEFORE DEPLOYING the code that reads these columns: the collection, portfolio and
-- listing queries select item_type and would fail without it. No backfill, no table rewrite.
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS item_type text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS item_type_evidence text;
