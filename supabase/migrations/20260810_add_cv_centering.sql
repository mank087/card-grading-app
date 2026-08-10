-- v9.13: persist CV centering shadow measurements next to the model's estimate.
-- One jsonb per card: { measured_at, mode, grading_model, front, back,
-- model_front, model_back }. Light column, queryable without touching the
-- heavy conversational_grading report JSON. Apply in the Supabase SQL Editor.

alter table cards add column if not exists cv_centering jsonb;

comment on column cards.cv_centering is
  'CV centering shadow record (v9.13): deterministic border measurement + the ensemble''s visual estimate, per face. mode=advisory when the measurement was shown to the grading prompt.';
