BEGIN;
-- Additive migration. The first two migrations may already be installed.
ALTER TABLE public.card_grade_reviews DROP CONSTRAINT card_grade_reviews_status_check;
ALTER TABLE public.card_grade_reviews ADD CONSTRAINT card_grade_reviews_status_check CHECK (status IN ('queued','processing','completed','failed','superseded','awaiting_owner'));
ALTER TABLE public.card_grade_reviews DROP CONSTRAINT card_grade_reviews_outcome_check;
ALTER TABLE public.card_grade_reviews ADD CONSTRAINT card_grade_reviews_outcome_check CHECK (outcome IN ('grade_confirmed','report_corrected','grade_corrected','unable_to_verify','change_declined'));
ALTER TABLE public.card_grade_reviews ADD COLUMN original_grade numeric, ADD COLUMN proposed_grade numeric,
  ADD COLUMN pending_patch jsonb, ADD COLUMN pending_expected jsonb, ADD COLUMN owner_decision text CHECK (owner_decision IN ('accept','keep_original')),
  ADD COLUMN decided_at timestamptz, ADD COLUMN decided_by uuid;
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
    WHERE card_id = NEW.id AND status IN ('queued', 'processing', 'failed', 'awaiting_owner');
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
-- Owner decisions contain no client-provided grades or patches.
CREATE FUNCTION public.decide_own_grade_review(p_card_id uuid, p_review_id uuid, p_user_id uuid, p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.cards; r public.card_grade_reviews; run public.card_grade_runs; field record; assignments text;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('accept','keep_original') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO c FROM public.cards WHERE id=p_card_id FOR UPDATE;
  SELECT * INTO r FROM public.card_grade_reviews WHERE id=p_review_id AND card_id=p_card_id FOR UPDATE;
  IF NOT FOUND OR r.requester_id IS DISTINCT FROM p_user_id OR c.user_id IS DISTINCT FROM p_user_id OR p_user_id IS NULL
    OR c.deleted_at IS NOT NULL OR coalesce(c.ownership_status,'owned') <> 'owned' THEN RAISE EXCEPTION 'review_not_available'; END IF;
  SELECT * INTO run FROM public.card_grade_runs WHERE id=r.grade_run_id AND is_current AND grader_user_id=p_user_id;
  IF NOT FOUND OR c.grade_status IS DISTINCT FROM 'complete' THEN RETURN jsonb_build_object('stale',true); END IF;
  -- Same decision is idempotent after an uncertain response. Opposite decisions cannot reverse it.
  IF r.owner_decision IS NOT NULL THEN
    IF r.owner_decision <> p_decision THEN RETURN jsonb_build_object('stale',true); END IF;
    RETURN jsonb_build_object('accepted',r.owner_decision='accept','already_recorded',true);
  END IF;
  IF r.status <> 'awaiting_owner' THEN RETURN jsonb_build_object('stale',true); END IF;
  IF to_jsonb(c.front_path) IS DISTINCT FROM run.snapshot->'front_path'
    OR to_jsonb(c.back_path) IS DISTINCT FROM run.snapshot->'back_path'
    OR to_jsonb(c.conversational_grading) IS DISTINCT FROM run.snapshot->'report'
    OR c.conversational_whole_grade IS DISTINCT FROM r.original_grade THEN
    UPDATE public.card_grade_reviews SET status='superseded' WHERE id=r.id;
    RETURN jsonb_build_object('stale',true);
  END IF;
  IF p_decision='accept' THEN
    IF r.proposal #>> '{verification,agreed}' IS DISTINCT FROM 'true'
      OR jsonb_typeof(r.pending_patch) IS DISTINCT FROM 'object'
      OR NOT (r.pending_patch ? 'conversational_grading' AND r.pending_patch ? 'conversational_whole_grade')
      OR r.proposed_grade IS NULL OR r.proposed_grade NOT BETWEEN 1 AND 10
      OR (r.pending_patch->>'conversational_whole_grade')::numeric IS DISTINCT FROM r.proposed_grade THEN RAISE EXCEPTION 'invalid_correction'; END IF;
    FOR field IN SELECT key,value FROM jsonb_each(r.pending_patch) LOOP
      IF field.key NOT IN ('conversational_grading','conversational_whole_grade','conversational_decimal_grade','raw_decimal_grade','dcm_grade_whole',
        'final_dcm_score','conversational_condition_label','conversational_final_grade_summary','conversational_sub_scores',
        'conversational_weighted_sub_scores','conversational_limiting_factor','conversational_preliminary_grade','conversational_centering_ratios',
        'estimated_professional_grades','professional_grades','ai_grading','label_data') THEN RAISE EXCEPTION 'invalid_correction'; END IF;
      IF NOT (r.pending_expected ? field.key) OR (to_jsonb(c)->field.key) IS DISTINCT FROM (r.pending_expected->field.key) THEN
        UPDATE public.card_grade_reviews SET status='superseded' WHERE id=r.id;
        RETURN jsonb_build_object('stale',true);
      END IF;
    END LOOP;
    SELECT string_agg(format('%I = patch.%I',key,key),', ') INTO assignments FROM jsonb_object_keys(r.pending_patch) key;
    EXECUTE format('UPDATE public.cards SET %s FROM jsonb_populate_record(NULL::public.cards,$1) patch WHERE cards.id=$2',assignments) USING r.pending_patch,c.id;
  END IF;
  UPDATE public.card_grade_reviews SET status='completed', completed_at=now(), owner_decision=p_decision, decided_at=now(), decided_by=p_user_id,
    outcome=CASE WHEN p_decision='accept' THEN 'grade_corrected' ELSE 'change_declined' END,
    applied_patch=CASE WHEN p_decision='accept' THEN pending_patch ELSE '{}'::jsonb END,
    customer_result=CASE WHEN p_decision='accept'
      THEN format('You accepted the grade change from %s to %s. Your card and report have been updated.',r.original_grade,r.proposed_grade)
      ELSE format('You kept your original grade of %s. The suggested change was not applied.',r.original_grade) END
    WHERE id=r.id;
  INSERT INTO public.card_grade_review_events(review_id,event_type,metadata) VALUES (r.id,'owner_decision',
    jsonb_build_object('decision',p_decision,'user_id',p_user_id,'original_grade',r.original_grade,'proposed_grade',r.proposed_grade));
  RETURN jsonb_build_object('accepted',p_decision='accept','already_recorded',false);
END $$;
REVOKE ALL ON FUNCTION public.decide_own_grade_review(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decide_own_grade_review(uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_grade_review(p_id uuid, p_token uuid, p_proposal jsonb, p_metadata jsonb, p_error text DEFAULT NULL,
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
      -- Compare actual values, not the worker outcome label, to guard every numeric change.
      IF (p_patch->>'conversational_whole_grade')::numeric IS DISTINCT FROM c.conversational_whole_grade THEN
        UPDATE public.card_grade_reviews SET status='awaiting_owner', outcome=NULL, completed_at=NULL,
          customer_result=replace(replace(p_result, 'was corrected', 'could be corrected'), 'Your overall grade changed from', 'The proposed grade change is from') || ' Your current grade stays in place until you accept this change.',
          original_grade=c.conversational_whole_grade, proposed_grade=(p_patch->>'conversational_whole_grade')::numeric,
          proposal=p_proposal, before_card=to_jsonb(c), pending_patch=p_patch, pending_expected=p_expected, applied_patch=NULL,
          processing_metadata=p_metadata, lease_token=NULL, lease_expires_at=NULL WHERE id=r.id;
        INSERT INTO public.card_grade_review_events(review_id,event_type,metadata) VALUES (r.id,'owner_decision_requested',
          jsonb_build_object('original_grade',c.conversational_whole_grade,'proposed_grade',p_patch->'conversational_whole_grade'));
        RETURN true;
      END IF;
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
COMMIT;
