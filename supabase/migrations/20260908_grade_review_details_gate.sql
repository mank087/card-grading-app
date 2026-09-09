-- Card-details-only disputes are free for every owner.
-- Identification mistakes (wrong name/year/number) are ours, so an owner who
-- only asks for the card details to be corrected must not be blocked by the
-- VIP / Card Lovers gate. Grade disputes keep the gate.
BEGIN;
CREATE OR REPLACE FUNCTION public.manual_review_purchase_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE details_only boolean;
BEGIN
  IF NEW.review_mode <> 'manual' THEN RAISE EXCEPTION 'automatic_reviews_retired'; END IF;
  SELECT bool_and(coalesce(value->>'category','') = 'details') INTO details_only
    FROM jsonb_array_elements(NEW.concerns);
  IF coalesce(details_only, false) THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_credits WHERE user_id=NEW.requester_id AND
    (is_vip IS TRUE OR (is_card_lover IS TRUE AND card_lover_current_period_end > now()))) THEN
    RAISE EXCEPTION 'review_membership_required';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
