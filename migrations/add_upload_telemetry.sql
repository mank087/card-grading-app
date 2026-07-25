-- Client-side upload failure telemetry (Jul 24 2026).
--
-- Two customer-blocking upload failures in one week (stalled-upload retry
-- storm; toast-crash wiping scanner uploads) happened entirely in the browser
-- with zero server visibility — we only learned about them when unusually
-- patient customers emailed. Clients now beacon rejection/failure events to
-- /api/telemetry/upload-event, which inserts here via the service role.
--
-- Writes go through the service role only — no client grants, no RLS
-- policies needed beyond enabling RLS to keep anon/authenticated locked out.

CREATE TABLE IF NOT EXISTS public.upload_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,                      -- nullable: pre-auth failures still report
  event text NOT NULL,               -- e.g. 'min_res_reject', 'compress_error'
  side text,                         -- 'front' | 'back' | null
  reason text,                       -- short machine reason / error message
  image_width int,
  image_height int,
  file_type text,
  file_size_bytes bigint,
  user_agent text,
  page text                          -- originating page path
);

ALTER TABLE public.upload_telemetry ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_upload_telemetry_created
  ON public.upload_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_telemetry_event
  ON public.upload_telemetry (event, created_at DESC);
