-- Org brand palette (enterprise Phase 2A follow-up).
--
-- 1-5 hex colors. [0] is the primary accent (kept in sync with the legacy
-- brand_color column, which stays for existing consumers). Seeded from the
-- uploaded color logo's palette on upload when not already customized;
-- null = fall back to brand_color, then DCM defaults.

alter table organizations add column if not exists brand_colors jsonb;

comment on column organizations.brand_colors is
  '1-5 hex colors, [0] = primary accent. Seeded from the logo palette on upload; admin-editable. Null = legacy brand_color/DCM fallback.';
