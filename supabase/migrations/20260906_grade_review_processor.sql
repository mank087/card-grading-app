BEGIN;
ALTER TABLE public.cards ADD COLUMN grade_review_policy_context jsonb;
ALTER TABLE public.card_grade_reviews
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN proposal jsonb,
  ADD COLUMN processing_metadata jsonb,
  ADD COLUMN last_error_code text,
  ADD COLUMN outcome text CHECK (outcome IN ('grade_confirmed','report_corrected','grade_corrected','unable_to_verify')),
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN before_card jsonb,
  ADD COLUMN applied_patch jsonb;

CREATE OR REPLACE FUNCTION public.capture_grade_review_run() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE captured_policy jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RETURN NEW; END IF;
  IF NEW.grade_status IS DISTINCT FROM 'complete' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.grade_status IS NOT DISTINCT FROM 'complete' THEN RETURN NEW; END IF;
  END IF;
  IF NEW.user_id IS NULL OR NEW.conversational_grading IS NULL THEN RETURN NEW; END IF;
  captured_policy := NEW.grade_review_policy_context;
  IF TG_OP = 'UPDATE' THEN
    -- If capture was disabled for a later re-grade, do not inherit the earlier
    -- run's settings. Enabled capture includes a fresh captured_at timestamp.
    IF NEW.grade_review_policy_context IS NOT DISTINCT FROM OLD.grade_review_policy_context THEN captured_policy := NULL; END IF;
  END IF;
  UPDATE public.card_grade_reviews SET status = 'superseded', lease_token = NULL, lease_expires_at = NULL
    WHERE card_id = NEW.id AND status IN ('queued', 'processing', 'failed');
  UPDATE public.card_grade_runs SET is_current = false WHERE card_id = NEW.id AND is_current;
  INSERT INTO public.card_grade_runs(card_id, grader_user_id, source, snapshot)
    VALUES (NEW.id, NEW.user_id, 'grading_completion', jsonb_build_object(
      'report', NEW.conversational_grading, 'grade', NEW.conversational_whole_grade,
      'front_path', NEW.front_path, 'back_path', NEW.back_path,
      'category', NEW.category, 'grading_model', to_jsonb(NEW)->'grading_model',
      'rubric_version', to_jsonb(NEW)->'conversational_prompt_version',
      'policy_context', captured_policy
    ));
  RETURN NEW;
END $$;

-- Claims share one short transaction-level advisory lock for global ceilings.
-- Always lock card BEFORE review, matching grading completion and intake.
CREATE FUNCTION public.claim_grade_review() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE candidate record; c public.cards; r public.card_grade_reviews; run public.card_grade_runs; token uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(9062026, 1);
  -- Global hourly attempt ceiling and max two live calls. Expired attempts
  -- count toward the budget too; crashing workers cannot create free retries.
  IF (SELECT count(*) FROM public.card_grade_review_events WHERE event_type = 'attempt_started' AND recorded_at > now() - interval '1 hour') >= 20 THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM public.card_grade_reviews WHERE status = 'processing' AND lease_expires_at > now()) >= 2 THEN RETURN NULL; END IF;
  FOR candidate IN SELECT id, card_id FROM public.card_grade_reviews
    WHERE (status = 'queued' AND next_attempt_at <= now()) OR (status = 'processing' AND lease_expires_at <= now())
    ORDER BY requested_at, id LIMIT 20 LOOP
    SELECT * INTO c FROM public.cards WHERE id = candidate.card_id FOR UPDATE;
    SELECT * INTO r FROM public.card_grade_reviews WHERE id = candidate.id FOR UPDATE;
    IF NOT ((r.status = 'queued' AND r.next_attempt_at <= now()) OR (r.status = 'processing' AND r.lease_expires_at <= now())) THEN CONTINUE; END IF;
    SELECT * INTO run FROM public.card_grade_runs WHERE id = r.grade_run_id AND is_current;
    IF NOT FOUND OR c.user_id IS DISTINCT FROM r.requester_id OR c.deleted_at IS NOT NULL
      OR coalesce(c.ownership_status, 'owned') <> 'owned'
      OR to_jsonb(c.front_path) IS DISTINCT FROM run.snapshot->'front_path'
      OR to_jsonb(c.back_path) IS DISTINCT FROM run.snapshot->'back_path'
      OR to_jsonb(c.conversational_grading) IS DISTINCT FROM run.snapshot->'report' THEN
      UPDATE public.card_grade_reviews SET status = 'superseded', lease_token = NULL, lease_expires_at = NULL WHERE id = r.id;
      CONTINUE;
    END IF;
    -- A running/failed full re-grade must not be reviewed as a completed grade.
    IF c.grade_status IS DISTINCT FROM 'complete' THEN CONTINUE; END IF;
    IF r.attempt_count >= 3 THEN
      UPDATE public.card_grade_reviews SET status = 'completed', outcome = 'unable_to_verify', completed_at = now(),
        customer_result = 'The review could not be completed. Your original grade remains unchanged.',
        lease_token = NULL, lease_expires_at = NULL, last_error_code = 'attempt_limit' WHERE id = r.id;
      INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
        VALUES (r.id, 'review_completed', jsonb_build_object('outcome', 'unable_to_verify', 'code', 'attempt_limit'));
      CONTINUE;
    END IF;
    token := gen_random_uuid();
    UPDATE public.card_grade_reviews SET status = 'processing', attempt_count = attempt_count + 1,
      lease_token = token, lease_expires_at = now() + interval '3 minutes', last_error_code = NULL
      WHERE id = r.id RETURNING * INTO r;
    INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
      VALUES (r.id, 'attempt_started', jsonb_build_object('attempt', r.attempt_count));
    RETURN jsonb_build_object('id', r.id, 'card_id', r.card_id, 'lease_token', token,
      'concerns', r.concerns, 'snapshot', run.snapshot, 'card', to_jsonb(c));
  END LOOP;
  RETURN NULL;
END $$;

-- One transaction completes the review and, only for a corroborated correction,
-- updates the allowed grading fields. No human decision or approval queue exists.
CREATE FUNCTION public.finish_grade_review(p_id uuid, p_token uuid, p_proposal jsonb, p_metadata jsonb, p_error text DEFAULT NULL,
  p_outcome text DEFAULT NULL, p_result text DEFAULT NULL, p_expected jsonb DEFAULT '{}'::jsonb, p_patch jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE card_id_to_lock uuid; c public.cards; r public.card_grade_reviews; run public.card_grade_runs; field record; assignments text;
BEGIN
  SELECT card_id INTO card_id_to_lock FROM public.card_grade_reviews WHERE id = p_id;
  SELECT * INTO c FROM public.cards WHERE id = card_id_to_lock FOR UPDATE;
  SELECT * INTO r FROM public.card_grade_reviews WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'processing' OR r.lease_token IS DISTINCT FROM p_token OR r.lease_expires_at <= now() THEN RETURN false; END IF;
  SELECT * INTO run FROM public.card_grade_runs WHERE id = r.grade_run_id AND is_current;
  IF NOT FOUND OR c.grade_status IS DISTINCT FROM 'complete' OR c.user_id IS DISTINCT FROM r.requester_id
    OR c.deleted_at IS NOT NULL OR coalesce(c.ownership_status, 'owned') <> 'owned'
    OR to_jsonb(c.front_path) IS DISTINCT FROM run.snapshot->'front_path'
    OR to_jsonb(c.back_path) IS DISTINCT FROM run.snapshot->'back_path'
    OR to_jsonb(c.conversational_grading) IS DISTINCT FROM run.snapshot->'report' THEN
    UPDATE public.card_grade_reviews SET status = 'superseded', lease_token = NULL, lease_expires_at = NULL WHERE id = r.id;
    RETURN false;
  END IF;
  IF p_error IS NOT NULL THEN
    UPDATE public.card_grade_reviews SET status = CASE WHEN attempt_count >= 3 THEN 'completed' ELSE 'queued' END,
      outcome = CASE WHEN attempt_count >= 3 THEN 'unable_to_verify' ELSE NULL END,
      completed_at = CASE WHEN attempt_count >= 3 THEN now() ELSE NULL END,
      customer_result = CASE WHEN attempt_count >= 3 THEN 'The review could not be completed. Your original grade remains unchanged.' ELSE NULL END,
      next_attempt_at = now() + make_interval(secs => 30 * attempt_count * attempt_count),
      last_error_code = left(p_error, 80), processing_metadata = p_metadata, lease_token = NULL, lease_expires_at = NULL WHERE id = r.id;
    INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
      VALUES (r.id, 'attempt_failed', jsonb_build_object('code', left(p_error, 80), 'attempt', r.attempt_count, 'usage', p_metadata));
  ELSE
    IF p_proposal IS NULL OR jsonb_typeof(p_proposal) <> 'object' THEN RAISE EXCEPTION 'invalid_proposal'; END IF;
    IF p_outcome IS NULL OR p_outcome NOT IN ('grade_confirmed','report_corrected','grade_corrected','unable_to_verify')
      OR p_result IS NULL OR char_length(p_result) NOT BETWEEN 1 AND 4000
      OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_result'; END IF;
    IF p_outcome IN ('report_corrected','grade_corrected') THEN
      IF p_proposal #>> '{verification,agreed}' IS DISTINCT FROM 'true'
        OR NOT (p_proposal ? 'first' AND p_proposal ? 'confirmation')
        OR NOT (p_patch ? 'conversational_grading' AND p_patch ? 'conversational_whole_grade') THEN RAISE EXCEPTION 'unverified_correction'; END IF;
      FOR field IN SELECT key,value FROM jsonb_each(p_patch) LOOP
        IF field.key NOT IN ('conversational_grading','conversational_whole_grade','conversational_decimal_grade','raw_decimal_grade','dcm_grade_whole',
          'final_dcm_score','conversational_condition_label','conversational_final_grade_summary','conversational_sub_scores',
          'conversational_weighted_sub_scores','conversational_limiting_factor','conversational_preliminary_grade','conversational_centering_ratios',
          'estimated_professional_grades','professional_grades','ai_grading','label_data') OR NOT (p_expected ? field.key) THEN RAISE EXCEPTION 'invalid_correction_field'; END IF;
        IF (to_jsonb(c)->field.key) IS DISTINCT FROM (p_expected->field.key) THEN
          UPDATE public.card_grade_reviews SET status='superseded', lease_token=NULL, lease_expires_at=NULL WHERE id=r.id;
          RETURN false;
        END IF;
      END LOOP;
      IF (p_patch->>'conversational_whole_grade') IS NULL OR (p_patch->>'conversational_whole_grade')::numeric NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_grade'; END IF;
      SELECT string_agg(format('%I = patch.%I', key, key), ', ') INTO assignments FROM jsonb_object_keys(p_patch) key;
      EXECUTE format('UPDATE public.cards SET %s FROM jsonb_populate_record(NULL::public.cards, $1) patch WHERE cards.id = $2', assignments) USING p_patch,c.id;
    ELSIF p_patch <> '{}'::jsonb THEN RAISE EXCEPTION 'unexpected_correction';
    END IF;
    UPDATE public.card_grade_reviews SET status = 'completed', outcome = p_outcome, completed_at = now(), customer_result = p_result,
      proposal = p_proposal, before_card = to_jsonb(c), applied_patch = p_patch,
      processing_metadata = p_metadata, lease_token = NULL, lease_expires_at = NULL WHERE id = r.id;
    INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
      VALUES (r.id, 'review_completed', jsonb_build_object('attempt', r.attempt_count, 'outcome', p_outcome,
        'original_grade', c.conversational_whole_grade, 'reviewed_grade', coalesce(p_patch->'conversational_whole_grade',to_jsonb(c.conversational_whole_grade))));
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_grade_review(), public.finish_grade_review(uuid, uuid, jsonb, jsonb, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_grade_review(), public.finish_grade_review(uuid, uuid, jsonb, jsonb, text, text, text, jsonb, jsonb) TO service_role;
COMMIT;
