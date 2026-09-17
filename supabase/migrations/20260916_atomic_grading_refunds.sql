-- Apply before deploying the matching application code. No historical balances change.
BEGIN;

ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS refund_of_transaction_id uuid
  REFERENCES public.credit_transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS credit_refund_once_per_charge
  ON public.credit_transactions(refund_of_transaction_id)
  WHERE refund_of_transaction_id IS NOT NULL;

-- The old helper refunded the original 'grade' charge. Link only unambiguous
-- historical pairs; ambiguous histories require review, never another payout.
UPDATE public.credit_transactions r SET refund_of_transaction_id = c.id
FROM public.credit_transactions c
WHERE r.type = 'refund' AND r.refund_of_transaction_id IS NULL
  AND c.type = 'grade' AND c.amount = -1 AND r.amount = 1
  AND c.card_id = r.card_id AND c.user_id = r.user_id
  AND c.org_id IS NOT DISTINCT FROM r.org_id AND c.created_at <= r.created_at
  AND (SELECT count(*) FROM public.credit_transactions x WHERE x.card_id = c.card_id AND x.type = 'grade') = 1
  AND (SELECT count(*) FROM public.credit_transactions x WHERE x.card_id = r.card_id AND x.type = 'refund') = 1
  AND NOT EXISTS (SELECT 1 FROM public.credit_transactions x WHERE x.refund_of_transaction_id = c.id);

CREATE OR REPLACE FUNCTION public.refund_grading_charge(
  p_user_id uuid, p_card_id uuid, p_charge_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  charge public.credit_transactions%ROWTYPE;
  new_balance integer;
  pool_balance integer;
BEGIN
  -- Serializes duplicates for THIS charge. A delayed refund can never select
  -- a newer charge because the caller supplies the exact immutable ledger ID.
  SELECT * INTO charge FROM public.credit_transactions WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND OR charge.user_id IS DISTINCT FROM p_user_id
    OR charge.card_id IS DISTINCT FROM p_card_id
    OR charge.type NOT IN ('grade', 'regrade') OR charge.amount <> -1 THEN
    RETURN jsonb_build_object('status', 'invalid_charge');
  END IF;
  IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE refund_of_transaction_id = charge.id) THEN
    RETURN jsonb_build_object('status', 'already_refunded');
  END IF;
  IF EXISTS (SELECT 1 FROM public.credit_transactions
    WHERE card_id = p_card_id AND type = 'refund' AND refund_of_transaction_id IS NULL) THEN
    RETURN jsonb_build_object('status', 'needs_review');
  END IF;

  IF charge.org_id IS NOT NULL THEN
    UPDATE public.organizations SET overage_credits = overage_credits + 1
      WHERE id = charge.org_id RETURNING grade_credits INTO pool_balance;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'failed'); END IF;
    SELECT balance INTO new_balance FROM public.user_credits WHERE user_id = p_user_id;
  ELSE
    UPDATE public.user_credits SET balance = balance + 1, total_used = greatest(0, total_used - 1)
      WHERE user_id = p_user_id RETURNING balance INTO new_balance;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'failed'); END IF;
  END IF;

  -- Any insert failure rolls back the balance update in the same transaction.
  INSERT INTO public.credit_transactions
    (user_id, org_id, card_id, type, amount, balance_after, description, metadata, refund_of_transaction_id)
  VALUES (p_user_id, charge.org_id, p_card_id, 'refund', 1,
    coalesce(pool_balance, new_balance), left('Grading credit returned: ' || coalesce(p_reason, ''), 250),
    jsonb_build_object('refund_version', 2, 'org_credit', charge.org_id IS NOT NULL), charge.id);
  RETURN jsonb_build_object('status', 'refunded', 'new_balance', new_balance, 'org_balance', pool_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_grading_charge(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_grading_charge(uuid, uuid, uuid, text) TO service_role;
COMMIT;
