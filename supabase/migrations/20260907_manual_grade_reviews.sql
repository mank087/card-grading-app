BEGIN;
ALTER TABLE public.card_grade_reviews
  ADD COLUMN review_mode text NOT NULL DEFAULT 'automatic' CHECK(review_mode IN ('automatic','manual')),
  ADD COLUMN reviewed_by uuid REFERENCES public.admin_users(id),
  ADD COLUMN admin_reviewed_at timestamptz,
  ADD COLUMN admin_notes text,
  ADD COLUMN manual_verdict text CHECK(manual_verdict IN ('confirm','clarify','request_photos','propose_change'));
ALTER TABLE public.card_grade_reviews ALTER COLUMN review_mode SET DEFAULT 'manual';
-- Stop automatic claims, including older deployed workers. Preserve finished history.
CREATE OR REPLACE FUNCTION public.claim_grade_review() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN RETURN NULL; END $$;
UPDATE public.card_grade_reviews SET review_mode='manual',status='queued',lease_token=NULL,lease_expires_at=NULL
  WHERE status IN ('queued','processing','failed');

CREATE TABLE public.grade_review_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.card_grade_reviews(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('admin_requested','customer_reviewed')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz, attempt_count int NOT NULL DEFAULT 0,
  lease_token uuid, lease_expires_at timestamptz,
  sent_at timestamptz, provider_id text, recipient_email text, delivery_message jsonb, last_error text, failed_at timestamptz,
  UNIQUE(review_id,kind)
);
ALTER TABLE public.grade_review_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grade_review_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.grade_review_notifications TO service_role;
CREATE INDEX grade_review_notifications_pending ON public.grade_review_notifications(next_attempt_at) WHERE sent_at IS NULL AND failed_at IS NULL;

CREATE FUNCTION public.manual_review_purchase_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.review_mode <> 'manual' THEN RAISE EXCEPTION 'automatic_reviews_retired'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_credits WHERE user_id=NEW.requester_id AND
    (is_vip IS TRUE OR (is_card_lover IS TRUE AND card_lover_current_period_end > now()))) THEN
    RAISE EXCEPTION 'review_membership_required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER manual_review_purchase_gate BEFORE INSERT ON public.card_grade_reviews FOR EACH ROW EXECUTE FUNCTION public.manual_review_purchase_gate();

CREATE FUNCTION public.queue_manual_review_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE kind text; payload jsonb;
BEGIN
  IF NEW.review_mode <> 'manual' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN kind:='admin_requested';
  ELSIF NEW.admin_reviewed_at IS NOT NULL AND OLD.admin_reviewed_at IS NULL THEN kind:='customer_reviewed';
  ELSE RETURN NEW; END IF;
  SELECT jsonb_build_object('requester_id',NEW.requester_id,'card_id',NEW.card_id,'category',c.category,
    'card_name',coalesce(c.card_name,c.serial,NEW.card_id::text),'notes',NEW.admin_notes,'verdict',NEW.manual_verdict,
    'original_grade',NEW.original_grade,'proposed_grade',NEW.proposed_grade,'awaiting_owner',NEW.status='awaiting_owner')
    INTO payload FROM public.cards c WHERE c.id=NEW.card_id;
  INSERT INTO public.grade_review_notifications(review_id,kind,payload) VALUES(NEW.id,kind,payload) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_manual_review_notification AFTER INSERT OR UPDATE OF admin_reviewed_at ON public.card_grade_reviews
FOR EACH ROW EXECUTE FUNCTION public.queue_manual_review_notification();
-- Alert the administrator about pending requests converted from the old queue.
INSERT INTO public.grade_review_notifications(review_id,kind,payload)
SELECT r.id,'admin_requested',jsonb_build_object('requester_id',r.requester_id,'card_id',r.card_id,'category',c.category,'card_name',coalesce(c.card_name,c.serial,c.id::text))
FROM public.card_grade_reviews r JOIN public.cards c ON c.id=r.card_id WHERE r.review_mode='manual' AND r.status='queued' ON CONFLICT DO NOTHING;

CREATE FUNCTION public.claim_grade_review_notification() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.grade_review_notifications;
BEGIN
  -- Resend idempotency expires after 24 hours. Stop ambiguous retries before then.
  UPDATE public.grade_review_notifications SET failed_at=now(),last_error='delivery_reconciliation_required'
    WHERE sent_at IS NULL AND failed_at IS NULL AND first_attempt_at < now()-interval '23 hours';
  SELECT * INTO n FROM public.grade_review_notifications WHERE sent_at IS NULL AND failed_at IS NULL
    AND next_attempt_at<=now() AND (lease_expires_at IS NULL OR lease_expires_at<now())
    ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.grade_review_notifications SET lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',
    first_attempt_at=coalesce(first_attempt_at,now()),attempt_count=attempt_count+1 WHERE id=n.id RETURNING * INTO n;
  RETURN to_jsonb(n);
END $$;

CREATE FUNCTION public.complete_manual_grade_review(p_id uuid,p_admin_id uuid,p_verdict text,p_notes text,p_patch jsonb,p_expected jsonb)
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
      'conversational_limiting_factor','conversational_preliminary_grade','conversational_centering_ratios','estimated_professional_grades','professional_grades','ai_grading','label_data')
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
REVOKE ALL ON FUNCTION public.manual_review_purchase_gate(),public.queue_manual_review_notification(),public.claim_grade_review_notification(),public.complete_manual_grade_review(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_grade_review_notification(),public.complete_manual_grade_review(uuid,uuid,text,text,jsonb,jsonb) TO service_role;
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
    customer_result=coalesce(r.admin_notes || ' ', '') || CASE WHEN p_decision='accept'
      THEN format('You accepted the grade change from %s to %s. Your card and report have been updated.',r.original_grade,r.proposed_grade)
      ELSE format('You kept your original grade of %s. The suggested change was not applied.',r.original_grade) END
    WHERE id=r.id;
  INSERT INTO public.card_grade_review_events(review_id,event_type,metadata) VALUES (r.id,'owner_decision',
    jsonb_build_object('decision',p_decision,'user_id',p_user_id,'original_grade',r.original_grade,'proposed_grade',r.proposed_grade));
  RETURN jsonb_build_object('accepted',p_decision='accept','already_recorded',false);
END $$;
REVOKE ALL ON FUNCTION public.decide_own_grade_review(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decide_own_grade_review(uuid,uuid,uuid,text) TO service_role;


COMMIT;
