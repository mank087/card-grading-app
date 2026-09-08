-- Grade review: let an accepted correction also refresh the per-face defect
-- narrative (conversational_corners_edges_surface) and the uncertainty range.
-- The PDF report and org report read both, so after a 9->10 edges correction
-- the report still described a scratch on the front edge. Function bodies are
-- copied from 20260907_manual_grade_reviews.sql with two columns added to the
-- allowlists; nothing else changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.complete_manual_grade_review(p_id uuid,p_admin_id uuid,p_verdict text,p_notes text,p_patch jsonb,p_expected jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.card_grade_reviews; c public.cards; run public.card_grade_runs; cid uuid; field record; assignments text; changed boolean; proposed numeric;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_admin_id AND is_active) THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_verdict IS NULL OR p_verdict NOT IN ('confirm','clarify','request_photos','propose_change') OR p_notes IS NULL OR char_length(trim(p_notes)) NOT BETWEEN 10 AND 3000
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_result'; END IF;
  SELECT card_id INTO cid FROM public.card_grade_reviews WHERE id=p_id;
  SELECT * INTO c FROM public.cards WHERE id=cid FOR UPDATE;
  SELECT * INTO r FROM public.card_grade_reviews WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.review_mode <> 'manual' THEN RAISE EXCEPTION 'review_not_available'; END IF;
  IF r.admin_reviewed_at IS NOT NULL THEN RETURN jsonb_build_object('already_recorded',true); END IF;
  SELECT * INTO run FROM public.card_grade_runs WHERE id=r.grade_run_id AND is_current AND grader_user_id=r.requester_id;
  IF NOT FOUND OR r.status NOT IN ('queued','processing') OR c.grade_status IS DISTINCT FROM 'complete'
    OR c.user_id IS DISTINCT FROM r.requester_id OR c.deleted_at IS NOT NULL OR coalesce(c.ownership_status,'owned')<>'owned'
    OR to_jsonb(c.front_path) IS DISTINCT FROM run.snapshot->'front_path' OR to_jsonb(c.back_path) IS DISTINCT FROM run.snapshot->'back_path'
    OR to_jsonb(c.conversational_grading) IS DISTINCT FROM run.snapshot->'report'
    OR to_jsonb(c.conversational_whole_grade) IS DISTINCT FROM run.snapshot->'grade' THEN RETURN jsonb_build_object('stale',true); END IF;
  FOR field IN SELECT key,value FROM jsonb_each(p_patch) LOOP
    IF field.key NOT IN ('conversational_grading','conversational_whole_grade','conversational_decimal_grade','raw_decimal_grade','dcm_grade_whole',
      'final_dcm_score','conversational_condition_label','conversational_final_grade_summary','conversational_sub_scores','conversational_weighted_sub_scores',
      'conversational_limiting_factor','conversational_preliminary_grade','conversational_centering_ratios','estimated_professional_grades','professional_grades','ai_grading','label_data',
        'conversational_corners_edges_surface','conversational_grade_uncertainty')
      OR NOT(p_expected ? field.key) THEN RAISE EXCEPTION 'invalid_correction'; END IF;
    IF (to_jsonb(c)->field.key) IS DISTINCT FROM (p_expected->field.key) THEN RETURN jsonb_build_object('stale',true); END IF;
  END LOOP;
  proposed:=coalesce((p_patch->>'conversational_whole_grade')::numeric,c.conversational_whole_grade);
  changed:=proposed IS DISTINCT FROM c.conversational_whole_grade;
  IF p_verdict='propose_change' THEN
    IF NOT changed OR proposed NOT BETWEEN 1 AND 10 OR proposed<>trunc(proposed)
      OR NOT(p_patch ? 'conversational_grading' AND p_patch ? 'conversational_whole_grade') THEN RAISE EXCEPTION 'invalid_correction'; END IF;
  ELSIF changed OR (p_verdict<>'clarify' AND p_patch<>'{}'::jsonb) THEN RAISE EXCEPTION 'unexpected_correction'; END IF;
  IF NOT changed AND p_patch<>'{}'::jsonb THEN
    SELECT string_agg(format('%I=patch.%I',key,key),', ') INTO assignments FROM jsonb_object_keys(p_patch) key;
    EXECUTE format('UPDATE public.cards SET %s FROM jsonb_populate_record(NULL::public.cards,$1) patch WHERE cards.id=$2',assignments) USING p_patch,c.id;
  END IF;
  UPDATE public.card_grade_reviews SET reviewed_by=p_admin_id,admin_reviewed_at=now(),admin_notes=trim(p_notes),manual_verdict=p_verdict,
    original_grade=c.conversational_whole_grade,proposed_grade=CASE WHEN changed THEN proposed END,
    status=CASE WHEN changed THEN 'awaiting_owner' ELSE 'completed' END,completed_at=CASE WHEN changed THEN NULL ELSE now() END,
    outcome=CASE WHEN changed THEN NULL WHEN p_verdict='request_photos' THEN 'unable_to_verify' WHEN p_verdict='clarify' THEN 'report_corrected' ELSE 'grade_confirmed' END,
    customer_result=trim(p_notes)||CASE WHEN changed THEN ' Your current grade stays in place until you accept the proposed change.' ELSE '' END,
    proposal=jsonb_build_object('manual_admin_id',p_admin_id,'verdict',p_verdict),before_card=to_jsonb(c),
    pending_patch=CASE WHEN changed THEN p_patch END,pending_expected=CASE WHEN changed THEN p_expected END,
    applied_patch=CASE WHEN changed THEN NULL ELSE p_patch END,lease_token=NULL,lease_expires_at=NULL WHERE id=r.id;
  INSERT INTO public.card_grade_review_events(review_id,event_type,actor_id,metadata) VALUES(r.id,'manual_review_completed',p_admin_id,
    jsonb_build_object('verdict',p_verdict,'notes',trim(p_notes),'original_grade',c.conversational_whole_grade,'proposed_grade',CASE WHEN changed THEN proposed END));
  RETURN jsonb_build_object('awaiting_owner',changed,'already_recorded',false);
END $$;
CREATE OR REPLACE FUNCTION public.decide_own_grade_review(p_card_id uuid, p_review_id uuid, p_user_id uuid, p_decision text)
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
    IF ((r.review_mode='manual' AND (r.reviewed_by IS NULL OR r.admin_reviewed_at IS NULL OR r.proposal->>'manual_admin_id' IS DISTINCT FROM r.reviewed_by::text)) OR (r.review_mode='automatic' AND r.proposal #>> '{verification,agreed}' IS DISTINCT FROM 'true'))
      OR jsonb_typeof(r.pending_patch) IS DISTINCT FROM 'object'
      OR NOT (r.pending_patch ? 'conversational_grading' AND r.pending_patch ? 'conversational_whole_grade')
      OR r.proposed_grade IS NULL OR r.proposed_grade NOT BETWEEN 1 AND 10
      OR (r.pending_patch->>'conversational_whole_grade')::numeric IS DISTINCT FROM r.proposed_grade THEN RAISE EXCEPTION 'invalid_correction'; END IF;
    FOR field IN SELECT key,value FROM jsonb_each(r.pending_patch) LOOP
      IF field.key NOT IN ('conversational_grading','conversational_whole_grade','conversational_decimal_grade','raw_decimal_grade','dcm_grade_whole',
        'final_dcm_score','conversational_condition_label','conversational_final_grade_summary','conversational_sub_scores',
        'conversational_weighted_sub_scores','conversational_limiting_factor','conversational_preliminary_grade','conversational_centering_ratios',
        'estimated_professional_grades','professional_grades','ai_grading','label_data',
        'conversational_corners_edges_surface','conversational_grade_uncertainty') THEN RAISE EXCEPTION 'invalid_correction'; END IF;
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
    customer_result=coalesce(r.admin_notes || ' ', '') || CASE WHEN p_decision='accept'
      THEN format('You accepted the grade change from %s to %s. Your card and report have been updated.',r.original_grade,r.proposed_grade)
      ELSE format('You kept your original grade of %s. The suggested change was not applied.',r.original_grade) END
    WHERE id=r.id;
  INSERT INTO public.card_grade_review_events(review_id,event_type,metadata) VALUES (r.id,'owner_decision',
    jsonb_build_object('decision',p_decision,'user_id',p_user_id,'original_grade',r.original_grade,'proposed_grade',r.proposed_grade));
  RETURN jsonb_build_object('accepted',p_decision='accept','already_recorded',false);
END $$;
COMMIT;
