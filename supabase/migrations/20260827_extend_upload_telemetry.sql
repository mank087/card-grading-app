-- Capture-quality gate, phase 0: attempt-level telemetry.
--
-- cards.capture_quality can only describe submissions that were SUBMITTED. A
-- user who sees a warning and quits never creates a card row, so abandonment
-- — the guardrail the enforcement phase ships against — is not derivable from
-- card data at any sample size. These events are the only way to measure it.
--
-- Abandonment is then: preflight_rejected with no later grade_started on the
-- same attempt_id.
--
-- upload_telemetry already exists and already writes through the service role,
-- but it has nowhere to put an attempt id, a rule code, or the capture context
-- — hence this migration rather than "just send more events".
--
-- Apply in the Supabase SQL Editor.

alter table public.upload_telemetry add column if not exists attempt_id uuid;
alter table public.upload_telemetry add column if not exists submission_id uuid;
alter table public.upload_telemetry add column if not exists rule_code text;
alter table public.upload_telemetry add column if not exists client_surface text;
alter table public.upload_telemetry add column if not exists capture_source text;
alter table public.upload_telemetry add column if not exists capture_method text;
alter table public.upload_telemetry add column if not exists gate_version text;
alter table public.upload_telemetry add column if not exists metadata jsonb;

comment on column public.upload_telemetry.attempt_id is
  'Groups every event from one capture attempt across sides and screens. Client-generated (uuid), stable from first capture through grade start. This is the join key for abandonment: an attempt with preflight_rejected and no grade_started was abandoned.';

comment on column public.upload_telemetry.rule_code is
  'Which gate rule fired, from the shared reason-code contract (src/lib/grading/captureReasonCodes.ts). One vocabulary across server, web and native — a hand-mirrored enum drifts, and drift here silently undercounts a rule.';

comment on column public.upload_telemetry.metadata is
  'Low-query-frequency detail (measurements, thresholds). Anything you would filter or group by belongs in its own column instead.';

-- attempt_id is the abandonment join; rule_code is the per-rule false-positive
-- read. Both are scanned with a date bound, hence the composite ordering.
create index if not exists idx_upload_telemetry_attempt
  on public.upload_telemetry (attempt_id, created_at)
  where attempt_id is not null;

create index if not exists idx_upload_telemetry_rule
  on public.upload_telemetry (rule_code, created_at desc)
  where rule_code is not null;
