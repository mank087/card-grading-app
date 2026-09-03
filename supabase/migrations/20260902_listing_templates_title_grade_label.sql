-- eBay listing titles: per-account grade label.
--
-- Every DCM listing title ends "DCM {grade}", even when the slab in the photo
-- says "Kings Kards". This column lets an enterprise store put its own brand
-- there, so the title stays truthful to what is in the photo (which is what
-- eBay's graded-card rules care about).
--
-- NULL = the built-in "DCM". The API validates the value: 2-20 characters,
-- letters/digits/spaces only, no rival grading company name, and for org scope
-- it must match the org's storefront brand name (case-insensitive) — we render
-- that label ourselves, so we can check it.
--
-- Apply manually in the Supabase SQL Editor.

alter table listing_templates
  add column if not exists title_grade_label text;

comment on column listing_templates.title_grade_label is
  'Grade brand for eBay title tails, e.g. "Kings Kards" -> "... Kings Kards 9". NULL means "DCM".';
