-- Phase 1: durable, private request intake. Feature remains disabled by default.
-- Run identifiers are private rows, not mutable client-supplied card columns.
BEGIN;

CREATE TABLE public.card_grade_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  grader_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('grading_completion', 'verified_legacy')),
  snapshot jsonb NOT NULL,
  is_current boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX card_grade_runs_one_current ON public.card_grade_runs(card_id) WHERE is_current;

CREATE TABLE public.card_grade_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  grade_run_id uuid NOT NULL UNIQUE REFERENCES public.card_grade_runs(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'superseded')),
  concerns jsonb NOT NULL CHECK (jsonb_typeof(concerns) = 'array' AND jsonb_array_length(concerns) BETWEEN 1 AND 5),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  customer_result text,
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile'))
);
CREATE INDEX card_grade_reviews_queue ON public.card_grade_reviews(status, requested_at);
CREATE INDEX card_grade_reviews_requester ON public.card_grade_reviews(requester_id, requested_at DESC);
CREATE INDEX card_grade_reviews_card ON public.card_grade_reviews(card_id, requested_at DESC);

CREATE TABLE public.card_grade_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.card_grade_reviews(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX card_grade_review_events_review ON public.card_grade_review_events(review_id, recorded_at);

-- No browser reads/writes, including snapshots and customer notes. All access
-- goes through authenticated server endpoints with explicit ownership checks.
ALTER TABLE public.card_grade_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_grade_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_grade_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.card_grade_runs, public.card_grade_reviews, public.card_grade_review_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_grade_runs, public.card_grade_reviews, public.card_grade_review_events TO service_role;

CREATE FUNCTION public.capture_grade_review_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Only the server grading writer may establish an entitlement. A cache read
  -- or a correction that leaves status complete cannot create another run.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RETURN NEW; END IF;
  IF NEW.grade_status IS DISTINCT FROM 'complete' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.grade_status IS NOT DISTINCT FROM 'complete' THEN RETURN NEW; END IF;
  END IF;
  IF NEW.user_id IS NULL OR NEW.conversational_grading IS NULL THEN RETURN NEW; END IF;

  UPDATE public.card_grade_reviews SET status = 'superseded'
    WHERE card_id = NEW.id AND status IN ('queued', 'processing', 'failed');
  UPDATE public.card_grade_runs SET is_current = false WHERE card_id = NEW.id AND is_current;
  INSERT INTO public.card_grade_runs(card_id, grader_user_id, source, snapshot)
    VALUES (NEW.id, NEW.user_id, 'grading_completion', jsonb_build_object(
      'report', NEW.conversational_grading,
      'grade', NEW.conversational_whole_grade,
      'front_path', NEW.front_path, 'back_path', NEW.back_path,
      'category', NEW.category,
      'grading_model', to_jsonb(NEW)->'grading_model'
    ));
  RETURN NEW;
END $$;
CREATE TRIGGER capture_grade_review_run AFTER INSERT OR UPDATE OF grade_status ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.capture_grade_review_run();

CREATE FUNCTION public.record_grade_review_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.card_grade_review_events(review_id, event_type, actor_id)
      VALUES (NEW.id, 'requested', NEW.requester_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
      VALUES (NEW.id, 'status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_grade_review_event AFTER INSERT OR UPDATE OF status ON public.card_grade_reviews
FOR EACH ROW EXECUTE FUNCTION public.record_grade_review_event();

-- Card lock serializes intake with full re-grade writes. Checking the expected
-- run prevents a stale browser from spending the newer grade's entitlement.
CREATE FUNCTION public.request_card_grade_review(p_card_id uuid, p_user_id uuid, p_run_id uuid, p_concerns jsonb, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c public.cards; r public.card_grade_runs; existing_id uuid; result_id uuid; item jsonb;
BEGIN
  SELECT * INTO c FROM public.cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND OR c.user_id IS DISTINCT FROM p_user_id OR c.deleted_at IS NOT NULL
    OR coalesce(c.ownership_status, 'owned') <> 'owned' THEN
    RAISE EXCEPTION 'review_not_available';
  END IF;
  SELECT * INTO r FROM public.card_grade_runs WHERE card_id = c.id AND id = p_run_id AND is_current;
  IF NOT FOUND OR r.grader_user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'review_not_available'; END IF;
  SELECT id INTO existing_id FROM public.card_grade_reviews WHERE grade_run_id = r.id;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  IF c.grade_status IS DISTINCT FROM 'complete' OR c.conversational_whole_grade IS NULL
    OR c.conversational_whole_grade <= 0 OR c.front_path IS NULL OR c.back_path IS NULL
    OR c.conversational_grading IS NULL THEN RAISE EXCEPTION 'review_not_available'; END IF;
  IF jsonb_typeof(p_concerns) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_review'; END IF;
  IF jsonb_array_length(p_concerns) NOT BETWEEN 1 AND 5 OR p_note IS NULL OR char_length(p_note) > 1000 THEN RAISE EXCEPTION 'invalid_review'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_concerns) LOOP
    IF coalesce(item->>'category', '') NOT IN ('centering', 'corners', 'edges', 'surface', 'explanation')
      OR coalesce(item->>'side', '') NOT IN ('front', 'back', 'both') THEN RAISE EXCEPTION 'invalid_review'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'category') FROM jsonb_array_elements(p_concerns)) <> jsonb_array_length(p_concerns) THEN RAISE EXCEPTION 'invalid_review'; END IF;
  INSERT INTO public.card_grade_reviews(card_id, grade_run_id, requester_id, concerns, note)
    VALUES (c.id, r.id, p_user_id, p_concerns, p_note) RETURNING id INTO result_id;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.request_card_grade_review(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_card_grade_review(uuid, uuid, uuid, jsonb, text) TO service_role;
REVOKE ALL ON FUNCTION public.capture_grade_review_run(), public.record_grade_review_event() FROM PUBLIC, anon, authenticated;

-- No automatic legacy backfill: current ownership alone does not prove who
-- submitted an old grade. A verified legacy backfill is a rollout prerequisite.
COMMIT;
