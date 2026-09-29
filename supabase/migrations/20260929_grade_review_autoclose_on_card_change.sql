-- Close open grade reviews when the card can no longer receive a verdict.
--
-- Sept 2026: an owner deleted a card with a queued manual review. The admin
-- queue kept offering the review and every submit failed as "stale" until an
-- admin closed it by hand (the 'close' action in
-- src/app/api/admin/grade-reviews/[id]/route.ts).
--
-- Why a trigger rather than a helper called from each route: a card leaves
-- its owner through many writers (owner soft delete, admin soft delete, manual
-- sold/archived, the eBay sync marking a listing sold, transfers, any future
-- script). A trigger on the columns blockedReason() checks catches all of them
-- in the same transaction and cannot be forgotten by the next route.
--
-- Scope mirrors src/lib/gradeReview/blockedReason.ts for card-level changes:
--   deleted_at        NULL -> set          ("The owner deleted this card")
--   ownership_status  owned -> sold/archived
--   user_id           changed              ("belongs to a different account")
-- Re-grades are already closed by capture_grade_review_run (new run supersedes
-- open reviews). Photo/report edits are NOT handled here: the manual-review
-- completion itself edits the report, and the admin 'close' action covers the
-- rest.
--
-- Same effect as the admin close: status 'superseded', lease cleared, one
-- event row. No verdict and no admin_reviewed_at, so
-- queue_manual_review_notification queues no customer email.
-- Restore (deleted_at set -> NULL) deliberately does NOT reopen anything.
BEGIN;

CREATE OR REPLACE FUNCTION public.close_grade_reviews_on_card_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE reason text; closed_id uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    reason := 'card_deleted';
  ELSIF coalesce(NEW.ownership_status, 'owned') <> 'owned'
    AND coalesce(OLD.ownership_status, 'owned') = 'owned' THEN
    reason := 'card_' || NEW.ownership_status;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    reason := 'card_owner_changed';
  ELSE
    RETURN NEW;
  END IF;

  FOR closed_id IN
    UPDATE public.card_grade_reviews
       SET status = 'superseded', lease_token = NULL, lease_expires_at = NULL
     WHERE card_id = NEW.id
       AND status IN ('queued', 'processing')
       AND admin_reviewed_at IS NULL
    RETURNING id
  LOOP
    INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
      VALUES (closed_id, 'auto_closed_card_changed', jsonb_build_object('reason', reason));
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS close_grade_reviews_on_card_change ON public.cards;
CREATE TRIGGER close_grade_reviews_on_card_change
  AFTER UPDATE OF deleted_at, ownership_status, user_id ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.close_grade_reviews_on_card_change();

REVOKE ALL ON FUNCTION public.close_grade_reviews_on_card_change() FROM PUBLIC, anon, authenticated;

-- One-time cleanup: reviews already stranded on deleted / sold / transferred
-- cards (the admin queue shows these as "blocked").
WITH stranded AS (
  UPDATE public.card_grade_reviews r
     SET status = 'superseded', lease_token = NULL, lease_expires_at = NULL
    FROM public.cards c
   WHERE c.id = r.card_id
     AND r.status IN ('queued', 'processing')
     AND r.admin_reviewed_at IS NULL
     AND (c.deleted_at IS NOT NULL
          OR coalesce(c.ownership_status, 'owned') <> 'owned'
          OR c.user_id IS DISTINCT FROM r.requester_id)
  RETURNING r.id
)
INSERT INTO public.card_grade_review_events(review_id, event_type, metadata)
SELECT id, 'auto_closed_card_changed', jsonb_build_object('reason', 'backfill_20260929') FROM stranded;

COMMIT;
