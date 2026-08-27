-- Capture-quality gate, phase 0: persist what the pipeline already measures.
--
-- Every grade already asks the vision model for front/back frame-fill
-- percentages and both four-corner quads (zoomInspection.detectCardGeometry).
-- Until now that answer was console.log'd and discarded, so nothing could
-- report how often a card was photographed too far away — the top customer
-- complaint. These two columns are the baseline the whole gate calibrates on.
--
-- TWO columns, not one, because they have different writers:
--   capture_quality — written SERVER-side, right after preflight runs
--   capture_source  — written by the CLIENT on insert, before anything grades
-- Folding the source into the quality jsonb would mean the client writing into
-- a column the server owns, at a different point in the request lifecycle.
--
-- Both are light and independently queryable — no need to touch the heavy
-- conversational_grading report JSON to answer "how many cards were too far".
--
-- Apply in the Supabase SQL Editor.

alter table cards add column if not exists capture_quality jsonb;
alter table cards add column if not exists capture_source jsonb;

comment on column cards.capture_quality is
  'Capture-gate observation (P0). Server-written immediately after preflight, BEFORE the grading ensemble — a card that crashes downstream must still leave its measurement behind, otherwise the dataset silently omits exactly the poor-quality submissions the gate exists to study. Shape: { measured_at, gate_version, gate_model, front: {...}, back: {...}, zoom_outcome, latency_ms, failed_open }. zoom_outcome is full | card_relative | abandoned.';

comment on column cards.capture_source is
  'How each side was captured (P0). Client-written on insert. Per-side because a card can pair a camera front with a gallery back, and a combined verdict hides an unusable back behind an excellent front. Shape: { client_surface, front: { source, capture_method }, back: { ... } }. client_surface is web_desktop | web_mobile | native_ios | native_android; source is camera | gallery | file | crop; capture_method distinguishes a true ImageCapture still from a video frame grab.';

-- Partial indexes: every query against these filters on "was it measured at
-- all", and most cards predate the column. Indexing only non-null rows keeps
-- these small while the backfill-free rollout fills forward.
create index if not exists idx_cards_capture_quality_present
  on cards (created_at desc)
  where capture_quality is not null;

create index if not exists idx_cards_capture_source_present
  on cards (created_at desc)
  where capture_source is not null;
