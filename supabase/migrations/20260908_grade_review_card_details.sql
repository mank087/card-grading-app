-- Manual grade review: card-details disputes.
-- Owners can flag wrong identification (name, set, year, number) alongside or
-- instead of a grade dispute. An admin correction of those details applies
-- immediately (no owner acceptance), updates the run snapshot so a grade
-- proposal in the same review still passes the stale checks, and is reported
-- in the customer email.
BEGIN;

ALTER TABLE public.card_grade_reviews
  ADD COLUMN details_claim jsonb,
  ADD COLUMN details_patch jsonb,
  ADD COLUMN details_changes jsonb,
  ADD COLUMN details_applied_at timestamptz,
  ADD COLUMN details_admin_id uuid REFERENCES public.admin_users(id);

-- 1. Request: accept a 'details' concern and the owner's claimed values.
DROP FUNCTION IF EXISTS public.request_card_grade_review(uuid, uuid, uuid, jsonb, text);
CREATE FUNCTION public.request_card_grade_review(p_card_id uuid, p_user_id uuid, p_run_id uuid, p_concerns jsonb, p_note text, p_details jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c public.cards; r public.card_grade_runs; existing_id uuid; result_id uuid; item jsonb; k text;
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
  IF jsonb_array_length(p_concerns) NOT BETWEEN 1 AND 6 OR p_note IS NULL OR char_length(p_note) > 1000 THEN RAISE EXCEPTION 'invalid_review'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_concerns) LOOP
    IF coalesce(item->>'category', '') NOT IN ('centering', 'corners', 'edges', 'surface', 'explanation', 'details')
      OR coalesce(item->>'side', '') NOT IN ('front', 'back', 'both') THEN RAISE EXCEPTION 'invalid_review'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'category') FROM jsonb_array_elements(p_concerns)) <> jsonb_array_length(p_concerns) THEN RAISE EXCEPTION 'invalid_review'; END IF;
  IF p_details IS NOT NULL THEN
    IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_review'; END IF;
    FOR k IN SELECT jsonb_object_keys(p_details) LOOP
      IF k NOT IN ('card_name', 'set_name', 'year', 'card_number', 'other')
        OR jsonb_typeof(p_details->k) IS DISTINCT FROM 'string'
        OR char_length(p_details->>k) > 200 THEN RAISE EXCEPTION 'invalid_review'; END IF;
    END LOOP;
  END IF;
  INSERT INTO public.card_grade_reviews(card_id, grade_run_id, requester_id, concerns, note, details_claim)
    VALUES (c.id, r.id, p_user_id, p_concerns, p_note, p_details) RETURNING id INTO result_id;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.request_card_grade_review(uuid, uuid, uuid, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_card_grade_review(uuid, uuid, uuid, jsonb, text, jsonb) TO service_role;

-- 2. Admin applies an identification correction immediately.
CREATE FUNCTION public.apply_grade_review_details(p_id uuid, p_admin_id uuid, p_patch jsonb, p_expected jsonb, p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.card_grade_reviews; c public.cards; run public.card_grade_runs; cid uuid; field record; assignments text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_admin_id AND is_active) THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR p_patch='{}'::jsonb THEN RAISE EXCEPTION 'invalid_result'; END IF;
  SELECT card_id INTO cid FROM public.card_grade_reviews WHERE id=p_id;
  SELECT * INTO c FROM public.cards WHERE id=cid FOR UPDATE;
  SELECT * INTO r FROM public.card_grade_reviews WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.review_mode <> 'manual' THEN RAISE EXCEPTION 'review_not_available'; END IF;
  IF r.details_applied_at IS NOT NULL THEN RETURN jsonb_build_object('already_recorded',true); END IF;
  IF r.admin_reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'review_not_available'; END IF;
  SELECT * INTO run FROM public.card_grade_runs WHERE id=r.grade_run_id AND is_current AND grader_user_id=r.requester_id FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('queued','processing') OR c.grade_status IS DISTINCT FROM 'complete'
    OR c.user_id IS DISTINCT FROM r.requester_id OR c.deleted_at IS NOT NULL OR coalesce(c.ownership_status,'owned')<>'owned'
    OR to_jsonb(c.conversational_grading) IS DISTINCT FROM run.snapshot->'report' THEN RETURN jsonb_build_object('stale',true); END IF;
  FOR field IN SELECT key,value FROM jsonb_each(p_patch) LOOP
    IF field.key NOT IN ('card_name','card_set','card_number','release_date','featured','manufacturer_name',
      'conversational_card_info','conversational_grading','ai_grading','label_data','original_label_data')
      OR NOT(p_expected ? field.key) THEN RAISE EXCEPTION 'invalid_correction'; END IF;
    IF (to_jsonb(c)->field.key) IS DISTINCT FROM (p_expected->field.key) THEN RETURN jsonb_build_object('stale',true); END IF;
  END LOOP;
  SELECT string_agg(format('%I=patch.%I',key,key),', ') INTO assignments FROM jsonb_object_keys(p_patch) key;
  EXECUTE format('UPDATE public.cards SET %s FROM jsonb_populate_record(NULL::public.cards,$1) patch WHERE cards.id=$2',assignments) USING p_patch,c.id;
  -- Keep the run snapshot in step so a grade proposal on this same review still passes the stale checks.
  IF p_patch ? 'conversational_grading' THEN
    UPDATE public.card_grade_runs SET snapshot = snapshot || jsonb_build_object('report', p_patch->'conversational_grading') WHERE id=run.id;
  END IF;
  UPDATE public.card_grade_reviews SET details_patch=p_patch, details_changes=p_changes, details_applied_at=now(), details_admin_id=p_admin_id WHERE id=r.id;
  INSERT INTO public.card_grade_review_events(review_id,event_type,metadata)
    VALUES (r.id,'details_corrected',jsonb_build_object('admin_id',p_admin_id,'changes',p_changes));
  RETURN jsonb_build_object('applied',true,'already_recorded',false);
END $$;
REVOKE ALL ON FUNCTION public.apply_grade_review_details(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_grade_review_details(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;

-- 3. Customer email payload carries the applied detail changes.
CREATE OR REPLACE FUNCTION public.queue_manual_review_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE kind text; payload jsonb;
BEGIN
  IF NEW.review_mode <> 'manual' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN kind:='admin_requested';
  ELSIF NEW.admin_reviewed_at IS NOT NULL AND OLD.admin_reviewed_at IS NULL THEN kind:='customer_reviewed';
  ELSE RETURN NEW; END IF;
  SELECT jsonb_build_object('requester_id',NEW.requester_id,'card_id',NEW.card_id,'category',c.category,
    'card_name',coalesce(c.card_name,c.serial,NEW.card_id::text),'notes',NEW.admin_notes,'verdict',NEW.manual_verdict,
    'original_grade',NEW.original_grade,'proposed_grade',NEW.proposed_grade,'awaiting_owner',NEW.status='awaiting_owner',
    'details_claim',NEW.details_claim,'details_changes',NEW.details_changes)
    INTO payload FROM public.cards c WHERE c.id=NEW.card_id;
  INSERT INTO public.grade_review_notifications(review_id,kind,payload) VALUES(NEW.id,kind,payload) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

COMMIT;
