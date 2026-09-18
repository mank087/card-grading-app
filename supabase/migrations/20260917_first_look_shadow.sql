-- Shadow-mode record of the first-look identification (src/lib/identification/firstLookRunner.ts).
-- Nothing reads this column in production yet; it exists so first-look answers can be compared
-- with the stored identity and with owner corrections. Safe to apply before or after the code:
-- the writer ignores a missing column, and the code only writes when FIRST_LOOK_SHADOW=1.
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS first_look jsonb;
