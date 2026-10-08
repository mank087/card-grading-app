-- Migration: admin analytics accuracy fixes
-- Date: 2026-10-08
--
-- Drop-in replacement for the RPCs defined in
-- migrations/add_admin_analytics_rpcs.sql (2026-05-20). Every get_* function
-- keeps its exact argument list and RETURNS jsonb, and every JSON key the
-- admin pages read is preserved. Apply in one go (the get_* bodies call the
-- new helpers, so the helpers are created first).
--
-- Fixes (audited Oct 8):
--   A. Apple IAP price is in thousandths of the transaction currency
--      (2990 = $2.99). get_revenue_analytics' headline total divided by 10000
--      (10x too low) and get_costs_summary divided by 100 (10x too high).
--      All IAP amounts now go through _iap_amount_usd(). Non-USD Apple rows
--      (CAD/GBP/AUD/DKK) fall back to the USD list price instead of being
--      summed as if they were dollars. Google rows carry no price in
--      raw_receipt today (it is the client request body / RTDN payload), so
--      they use the product-id list price; priceAmountMicros is honoured if
--      it ever appears.
--   B. Card counts exclude soft-deleted cards (cards.deleted_at IS NOT NULL)
--      in get_card_analytics, get_grading_analytics and get_user_analytics.
--   C. Grade aggregates use conversational_whole_grade (canonical), falling
--      back to round(conversational_decimal_grade) only when the whole grade
--      is null. Perfect 10s / 9+ / distribution / averages all use it.
--   D. get_conversion_analytics: "Made Purchase %" divides by the signup
--      cohort (same population as the numerator), not all-time users; the
--      package breakdown is filtered to the date range; org (Dealer /
--      Enterprise) purchase rows are bucketed as 'enterprise' instead of
--      being dropped.
--   E. Stripe credit-pack revenue prefers metadata->>'amount_paid_usd'
--      (written by the Stripe webhook from Oct 8 on) and falls back to the
--      list price parsed from the description. Description matching now
--      uses word boundaries so 'promo' no longer matches 'pro'.
--   F. get_costs_summary: months with no openai_daily_costs rows fall back to
--      sum(api_usage_log.cost_usd) (openai_source = 'estimate'); one_time
--      fixed costs count only in the month of effective_from.
--   H. get_revenue_analytics: "today" and the daily trend use America/New_York
--      day boundaries; the daily trend is one grouped pass instead of four
--      correlated subqueries per day.
--
-- Also: EXECUTE on the six SECURITY DEFINER RPCs is revoked from PUBLIC /
-- anon / authenticated (they were callable with the public anon key; only
-- the service-role admin API routes call them).

-- ============================================================================
-- Helpers
-- ============================================================================

-- Stripe credit-pack list price from the description. Same tiers and order as
-- before, but word-boundary matches (\m \M) so 'promo' / 'product' never hit
-- 'pro'. Signature unchanged (extra params are unused, kept for drop-in).
CREATE OR REPLACE FUNCTION public._revenue_amount(
  p_desc text,
  p_unused1 text DEFAULT NULL,
  p_unused2 text DEFAULT NULL,
  p_unused3 text DEFAULT NULL
)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_desc IS NULL THEN 0
    WHEN lower(p_desc) ~ '\mbasic\M'    THEN 2.99
    WHEN lower(p_desc) ~ '\melite\M'    THEN 19.99
    WHEN lower(p_desc) ~ '\mpro\M'      THEN 9.99
    WHEN lower(p_desc) ~ '\mvip\M'      THEN 99.0
    WHEN lower(p_desc) ~ '\mfounders?\M' THEN 99.0
    ELSE 0
  END
$$;

-- What the customer actually paid for a Stripe credit_transactions purchase
-- row: metadata.amount_paid_usd when the webhook recorded it, else list price.
CREATE OR REPLACE FUNCTION public._stripe_paid_amount(p_desc text, p_meta jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_meta->'amount_paid_usd') = 'number'
      THEN (p_meta->>'amount_paid_usd')::numeric
    ELSE public._revenue_amount(p_desc, NULL, NULL, NULL)
  END
$$;

-- Product label for a Stripe credit-pack row (same labels as before).
CREATE OR REPLACE FUNCTION public._stripe_pack_product(p_desc text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_desc, '')) ~ '\mbasic\M'     THEN 'Stripe Basic'
    WHEN lower(coalesce(p_desc, '')) ~ '\melite\M'     THEN 'Stripe Elite'
    WHEN lower(coalesce(p_desc, '')) ~ '\mpro\M'       THEN 'Stripe Pro'
    WHEN lower(coalesce(p_desc, '')) ~ '\mvip\M'       THEN 'Stripe Vip'
    WHEN lower(coalesce(p_desc, '')) ~ '\mfounders?\M' THEN 'Stripe Founders'
    ELSE 'Stripe credit pack'
  END
$$;

-- USD amount for an iap_transactions row.
--   apple:  raw_receipt.price is in thousandths of raw_receipt.currency
--           (JWS transaction: 2990 + "USD" = $2.99). Webhook rows nest the
--           transaction under raw_receipt.txn. Only USD prices are used as-is;
--           other currencies fall back to the USD list price.
--   google: raw_receipt has no price today; priceAmountMicros (1e6 units) is
--           used if present and USD, else the list price.
-- List prices match the store tiers (VIP is $99.99 on the App Store).
CREATE OR REPLACE FUNCTION public._iap_amount_usd(
  p_platform text,
  p_raw_receipt jsonb,
  p_product_id text
)
RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_platform = 'apple'
     AND jsonb_typeof(p_raw_receipt->'price') = 'number'
     AND upper(coalesce(p_raw_receipt->>'currency', 'USD')) = 'USD'
      THEN (p_raw_receipt->>'price')::numeric / 1000
    WHEN p_platform = 'apple'
     AND jsonb_typeof(p_raw_receipt->'txn'->'price') = 'number'
     AND upper(coalesce(p_raw_receipt->'txn'->>'currency', 'USD')) = 'USD'
      THEN (p_raw_receipt->'txn'->>'price')::numeric / 1000
    WHEN p_platform = 'google'
     AND coalesce(p_raw_receipt->>'priceAmountMicros', '') ~ '^[0-9]+$'
     AND upper(coalesce(p_raw_receipt->>'priceCurrencyCode', 'USD')) = 'USD'
      THEN (p_raw_receipt->>'priceAmountMicros')::numeric / 1000000
    WHEN p_product_id = 'dcm.credits.basic' THEN 2.99
    WHEN p_product_id = 'dcm.credits.pro'   THEN 9.99
    WHEN p_product_id = 'dcm.credits.elite' THEN 19.99
    WHEN p_product_id = 'dcm.credits.vip'   THEN 99.99
    ELSE 0
  END
$$;

-- Unified revenue rows (Stripe credit packs + Stripe Card Lovers + Apple IAP
-- + Google IAP) in [p_from, p_to]. Single source of truth for every section
-- of get_revenue_analytics. Not SECURITY DEFINER: it runs with the rights of
-- the calling (definer) RPC, and PUBLIC execute is revoked below.
CREATE OR REPLACE FUNCTION public._dcm_revenue_rows(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  id text,
  source text,
  platform text,
  user_id uuid,
  amount_usd numeric,
  product text,
  created_at timestamptz
)
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT ct.id::text,
         'stripe_credits'::text,
         'web'::text,
         ct.user_id,
         public._stripe_paid_amount(ct.description, ct.metadata),
         public._stripe_pack_product(ct.description),
         ct.created_at
    FROM credit_transactions ct
   WHERE ct.type = 'purchase'
     AND ct.stripe_payment_intent_id IS NOT NULL
     AND ct.created_at >= p_from AND ct.created_at <= p_to
  UNION ALL
  SELECT se.id::text,
         'stripe_subscription'::text,
         'web'::text,
         se.user_id,
         CASE WHEN lower(coalesce(se.plan, '')) = 'annual' THEN 449.0 ELSE 49.99 END,
         CASE WHEN lower(coalesce(se.plan, '')) = 'annual' THEN 'Card Lovers Annual' ELSE 'Card Lovers Monthly' END,
         se.created_at
    FROM subscription_events se
   WHERE se.event_type IN ('subscribed', 'renewed')
     AND se.stripe_subscription_id IS NOT NULL
     AND se.created_at >= p_from AND se.created_at <= p_to
  UNION ALL
  SELECT it.id::text,
         CASE WHEN it.platform = 'apple' THEN 'apple_iap' ELSE 'google_iap' END,
         CASE WHEN it.platform = 'apple' THEN 'ios' ELSE 'android' END,
         it.user_id,
         public._iap_amount_usd(it.platform, it.raw_receipt, it.product_id),
         it.product_id::text,
         it.created_at
    FROM iap_transactions it
   WHERE it.status = 'active'
     AND it.environment = 'production'
     AND it.created_at >= p_from AND it.created_at <= p_to
$$;

REVOKE ALL ON FUNCTION public._dcm_revenue_rows(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._dcm_revenue_rows(timestamptz, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._dcm_revenue_rows(timestamptz, timestamptz) TO service_role;

-- ============================================================================
-- 1. get_user_analytics(from, to)  — B: active users exclude deleted cards
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_analytics(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total_users int;
  v_users_with_cards int;
  v_active_7d int;
  v_active_30d int;
  v_active_90d int;
  v_by_platform jsonb;
  v_weekly jsonb;
  v_growth jsonb;
BEGIN
  -- Totals
  SELECT count(*) INTO v_total_users FROM users;

  -- One pass over live (not soft-deleted) cards
  SELECT
    count(DISTINCT user_id),
    count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days'),
    count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days'),
    count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '90 days')
  INTO v_users_with_cards, v_active_7d, v_active_30d, v_active_90d
  FROM cards
  WHERE deleted_at IS NULL;

  -- All-time signups by platform
  SELECT jsonb_build_object(
    'web',         coalesce(sum((_dcm_platform(signup_source) = 'web')::int), 0),
    'ios_app',     coalesce(sum((_dcm_platform(signup_source) = 'ios_app')::int), 0),
    'android_app', coalesce(sum((_dcm_platform(signup_source) = 'android_app')::int), 0)
  ) INTO v_by_platform
  FROM users;

  -- Weekly acquisition in range, stacked by platform.
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', p_to at time zone 'UTC'),
      interval '7 days'
    ) AS week_start
  ),
  bucketed AS (
    SELECT
      w.week_start,
      coalesce(sum((_dcm_platform(u.signup_source) = 'web')::int) FILTER (WHERE u.created_at IS NOT NULL), 0) AS web,
      coalesce(sum((_dcm_platform(u.signup_source) = 'ios_app')::int) FILTER (WHERE u.created_at IS NOT NULL), 0) AS ios_app,
      coalesce(sum((_dcm_platform(u.signup_source) = 'android_app')::int) FILTER (WHERE u.created_at IS NOT NULL), 0) AS android_app,
      coalesce(count(u.id), 0) AS total
    FROM weeks w
    LEFT JOIN users u
      ON u.created_at >= w.week_start
     AND u.created_at <  w.week_start + interval '7 days'
    GROUP BY w.week_start
    ORDER BY w.week_start
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'week', to_char(week_start, 'Mon DD'),
    'web', web,
    'ios_app', ios_app,
    'android_app', android_app,
    'total', total
  ) ORDER BY week_start), '[]'::jsonb)
  INTO v_weekly
  FROM bucketed;

  -- Daily growth for last 90 days, stacked by platform, with cumulative
  WITH daily AS (
    SELECT
      date_trunc('day', created_at)::date AS day,
      _dcm_platform(signup_source) AS platform,
      count(*) AS n
    FROM users
    GROUP BY 1, 2
  ),
  pivoted AS (
    SELECT
      day,
      coalesce(sum(n) FILTER (WHERE platform = 'web'),         0) AS web,
      coalesce(sum(n) FILTER (WHERE platform = 'ios_app'),     0) AS ios_app,
      coalesce(sum(n) FILTER (WHERE platform = 'android_app'), 0) AS android_app,
      sum(n) AS total
    FROM daily
    GROUP BY day
  ),
  with_cum AS (
    SELECT
      day,
      web, ios_app, android_app, total,
      sum(total) OVER (ORDER BY day) AS cumulative
    FROM pivoted
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(day, 'YYYY-MM-DD'),
    'web', web, 'ios_app', ios_app, 'android_app', android_app,
    'total', total, 'cumulative', cumulative
  ) ORDER BY day), '[]'::jsonb)
  INTO v_growth
  FROM with_cum
  WHERE day >= (current_date - interval '90 days');

  RETURN jsonb_build_object(
    'overview', jsonb_build_object(
      'total_users', v_total_users,
      'active_users_7d', v_active_7d,
      'active_users_30d', v_active_30d,
      'active_users_90d', v_active_90d,
      'engagement_rate', CASE WHEN v_total_users > 0
        THEN round((v_users_with_cards::numeric / v_total_users) * 1000) / 10
        ELSE 0 END,
      'users_with_cards', v_users_with_cards
    ),
    'by_platform', v_by_platform,
    'weekly_acquisition', v_weekly,
    'growth', v_growth,
    'retention', jsonb_build_object(
      'seven_day_active',  v_active_7d,
      'thirty_day_active', v_active_30d,
      'ninety_day_active', v_active_90d
    )
  );
END;
$$;

-- ============================================================================
-- 2. get_grading_analytics(from, to)  — B + C
-- ============================================================================
-- Canonical grade g = conversational_whole_grade, falling back to
-- round(conversational_decimal_grade) for legacy rows with no whole grade.
CREATE OR REPLACE FUNCTION public.get_grading_analytics(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total_graded int;
  v_avg_grade numeric;
  v_perfect_tens int;
  v_high_grades int;
  v_avg_30d numeric;
  v_by_platform jsonb;
  v_distribution jsonb;
  v_by_category jsonb;
  v_weekly jsonb;
BEGIN
  -- Overview + platform split in one pass over live graded cards
  WITH g AS (
    SELECT
      coalesce(conversational_whole_grade::numeric, round(conversational_decimal_grade::numeric)) AS grade,
      created_at,
      graded_from
    FROM cards
    WHERE deleted_at IS NULL
      AND (conversational_whole_grade IS NOT NULL OR conversational_decimal_grade IS NOT NULL)
  )
  SELECT
    count(*),
    round(avg(grade) * 10) / 10,
    count(*) FILTER (WHERE grade = 10),
    count(*) FILTER (WHERE grade >= 9),
    round(avg(grade) FILTER (WHERE created_at >= now() - interval '30 days') * 10) / 10,
    jsonb_build_object(
      'web',         coalesce(sum((_dcm_platform(graded_from) = 'web')::int), 0),
      'ios_app',     coalesce(sum((_dcm_platform(graded_from) = 'ios_app')::int), 0),
      'android_app', coalesce(sum((_dcm_platform(graded_from) = 'android_app')::int), 0)
    )
  INTO v_total_graded, v_avg_grade, v_perfect_tens, v_high_grades, v_avg_30d, v_by_platform
  FROM g;

  -- Grade distribution (canonical whole grade)
  WITH dist AS (
    SELECT
      coalesce(conversational_whole_grade::numeric, round(conversational_decimal_grade::numeric))::int AS grade,
      count(*) AS n
    FROM cards
    WHERE deleted_at IS NULL
      AND (conversational_whole_grade IS NOT NULL OR conversational_decimal_grade IS NOT NULL)
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'grade', grade,
    'count', n,
    'percentage', round((n::numeric / NULLIF(v_total_graded, 0)) * 1000) / 10
  ) ORDER BY grade DESC), '[]'::jsonb)
  INTO v_distribution
  FROM dist;

  -- By category
  WITH per_cat AS (
    SELECT
      coalesce(category, 'Other') AS category,
      count(*) AS total_cards,
      round(avg(coalesce(conversational_whole_grade::numeric, round(conversational_decimal_grade::numeric))) * 10) / 10 AS average_grade
    FROM cards
    WHERE deleted_at IS NULL
      AND (conversational_whole_grade IS NOT NULL OR conversational_decimal_grade IS NOT NULL)
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'category', category,
    'total_cards', total_cards,
    'average_grade', average_grade
  ) ORDER BY total_cards DESC), '[]'::jsonb)
  INTO v_by_category
  FROM per_cat;

  -- Weekly trends in range, stacked by platform + avg_grade
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', p_to at time zone 'UTC'),
      interval '7 days'
    ) AS week_start
  ),
  bucketed AS (
    SELECT
      w.week_start,
      coalesce(sum((_dcm_platform(c.graded_from) = 'web')::int), 0) AS web,
      coalesce(sum((_dcm_platform(c.graded_from) = 'ios_app')::int), 0) AS ios_app,
      coalesce(sum((_dcm_platform(c.graded_from) = 'android_app')::int), 0) AS android_app,
      coalesce(count(c.id), 0) AS total,
      coalesce(round(avg(coalesce(c.conversational_whole_grade::numeric, round(c.conversational_decimal_grade::numeric))) * 10) / 10, 0) AS avg_grade
    FROM weeks w
    LEFT JOIN cards c
      ON c.created_at >= w.week_start
     AND c.created_at <  w.week_start + interval '7 days'
     AND c.deleted_at IS NULL
     AND (c.conversational_whole_grade IS NOT NULL OR c.conversational_decimal_grade IS NOT NULL)
    GROUP BY w.week_start
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'week', to_char(week_start, 'Mon DD'),
    'web', web, 'ios_app', ios_app, 'android_app', android_app,
    'total', total, 'avg_grade', avg_grade
  ) ORDER BY week_start), '[]'::jsonb)
  INTO v_weekly
  FROM bucketed;

  RETURN jsonb_build_object(
    'overview', jsonb_build_object(
      'total_graded', v_total_graded,
      'average_grade', coalesce(v_avg_grade, 0),
      'perfect_tens', v_perfect_tens,
      'perfect_ten_rate', CASE WHEN v_total_graded > 0
        THEN round((v_perfect_tens::numeric / v_total_graded) * 1000) / 10
        ELSE 0 END,
      'high_grades_9_plus', v_high_grades,
      'high_grade_rate', CASE WHEN v_total_graded > 0
        THEN round((v_high_grades::numeric / v_total_graded) * 1000) / 10
        ELSE 0 END,
      'avg_grade_last_30_days', coalesce(v_avg_30d, 0)
    ),
    'by_platform', v_by_platform,
    'distribution', v_distribution,
    'by_category', v_by_category,
    'weekly_trends', v_weekly,
    'quality_control', jsonb_build_object(
      'is_perfect_ten_rate_normal',
        (CASE WHEN v_total_graded > 0 THEN (v_perfect_tens::numeric / v_total_graded) * 100 ELSE 0 END) < 1.5,
      'is_high_grade_rate_normal',
        (CASE WHEN v_total_graded > 0 THEN (v_high_grades::numeric / v_total_graded) * 100 ELSE 0 END) < 20,
      'alert', CASE
        WHEN v_total_graded > 0 AND (v_perfect_tens::numeric / v_total_graded) * 100 > 2
          THEN 'Perfect 10 rate is unusually high'
        ELSE NULL END
    )
  );
END;
$$;

-- ============================================================================
-- 3. get_card_analytics(from, to)  — B: exclude soft-deleted cards
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_card_analytics(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total int;
  v_public int;
  v_private int;
  v_last_7 int;
  v_last_30 int;
  v_by_platform jsonb;
  v_by_category jsonb;
  v_weekly jsonb;
  v_daily jsonb;
BEGIN
  -- `visibility` is the source of truth (legacy is_public is stuck at true).
  -- One pass over live cards for every headline count.
  SELECT
    count(*),
    count(*) FILTER (WHERE visibility = 'public'),
    count(*) FILTER (WHERE visibility = 'private'),
    count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
    jsonb_build_object(
      'web',         coalesce(sum((_dcm_platform(graded_from) = 'web')::int), 0),
      'ios_app',     coalesce(sum((_dcm_platform(graded_from) = 'ios_app')::int), 0),
      'android_app', coalesce(sum((_dcm_platform(graded_from) = 'android_app')::int), 0)
    )
  INTO v_total, v_public, v_private, v_last_7, v_last_30, v_by_platform
  FROM cards
  WHERE deleted_at IS NULL;

  WITH per_cat AS (
    SELECT coalesce(category, 'Other') AS category, count(*) AS n
    FROM cards
    WHERE deleted_at IS NULL
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'category', category,
    'count', n,
    'percentage', to_char(round((n::numeric / NULLIF(v_total, 0)) * 1000) / 10, 'FM999990.0')
  ) ORDER BY n DESC), '[]'::jsonb)
  INTO v_by_category
  FROM per_cat;

  -- Weekly stacked-by-platform in range
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', p_to at time zone 'UTC'),
      interval '7 days'
    ) AS week_start
  ),
  bucketed AS (
    SELECT
      w.week_start,
      coalesce(sum((_dcm_platform(c.graded_from) = 'web')::int), 0) AS web,
      coalesce(sum((_dcm_platform(c.graded_from) = 'ios_app')::int), 0) AS ios_app,
      coalesce(sum((_dcm_platform(c.graded_from) = 'android_app')::int), 0) AS android_app,
      coalesce(count(c.id), 0) AS total
    FROM weeks w
    LEFT JOIN cards c
      ON c.created_at >= w.week_start
     AND c.created_at <  w.week_start + interval '7 days'
     AND c.deleted_at IS NULL
    GROUP BY w.week_start
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'week', to_char(week_start, 'Mon DD'),
    'web', web, 'ios_app', ios_app, 'android_app', android_app, 'total', total
  ) ORDER BY week_start), '[]'::jsonb)
  INTO v_weekly
  FROM bucketed;

  -- Daily uploads last 30 days
  WITH daily AS (
    SELECT date_trunc('day', created_at)::date AS day, count(*) AS n
    FROM cards
    WHERE created_at >= now() - interval '30 days'
      AND deleted_at IS NULL
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(day, 'YYYY-MM-DD'),
    'uploads', n
  ) ORDER BY day), '[]'::jsonb)
  INTO v_daily
  FROM daily;

  RETURN jsonb_build_object(
    'overview', jsonb_build_object(
      'total_cards', v_total,
      'public_cards', v_public,
      'private_cards', v_private,
      'cards_last_7_days', v_last_7,
      'cards_last_30_days', v_last_30,
      'avg_cards_per_day_last_30', round((v_last_30::numeric / 30) * 10) / 10
    ),
    'by_platform', v_by_platform,
    'by_category', v_by_category,
    'top_categories', (
      SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_by_category) AS elem
        LIMIT 5
      ) t
    ),
    'weekly_uploads', v_weekly,
    'daily_uploads', v_daily,
    'visibility', jsonb_build_object(
      'public', v_public,
      'private', v_private,
      'public_percentage', to_char(round((v_public::numeric / NULLIF(v_total, 0)) * 1000) / 10, 'FM999990.0')
    )
  );
END;
$$;

-- ============================================================================
-- 4. get_conversion_analytics(start_date, end_date)  — D (+ E for packages)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_conversion_analytics(
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total_users int;
  v_cohort_size int;
  v_users_graded int;
  v_users_purchased int;
  v_converted int;
  v_conv_rate numeric;
  v_purchase_rate numeric;
  v_founders int;
  v_t2p jsonb;
  v_timing jsonb;
  v_packages jsonb;
  v_weekly jsonb;
  v_by_platform jsonb;
BEGIN
  -- Headline "Total Users" card is labelled "All registered users": keep it.
  SELECT count(*) INTO v_total_users FROM users;

  -- Cohort = users created in the range (or all-time if no range)
  WITH cohort AS (
    SELECT user_id, created_at
    FROM user_credits
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <= p_end)
  ),
  graders AS (
    SELECT DISTINCT user_id FROM credit_transactions WHERE type = 'grade'
  ),
  purchasers AS (
    SELECT user_id FROM credit_transactions WHERE type = 'purchase'
    UNION
    SELECT user_id FROM iap_transactions WHERE status = 'active' AND environment = 'production'
  ),
  cohort_with_flags AS (
    SELECT
      c.user_id,
      (g.user_id IS NOT NULL) AS has_graded,
      (p.user_id IS NOT NULL) AS has_purchased
    FROM cohort c
    LEFT JOIN graders g ON g.user_id = c.user_id
    LEFT JOIN purchasers p ON p.user_id = c.user_id
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE has_graded),
    count(*) FILTER (WHERE has_purchased),
    count(*) FILTER (WHERE has_graded AND has_purchased)
  INTO v_cohort_size, v_users_graded, v_users_purchased, v_converted
  FROM cohort_with_flags;

  v_conv_rate := CASE WHEN v_users_graded > 0
    THEN round((v_converted::numeric / v_users_graded) * 1000) / 10
    ELSE 0 END;
  -- Same population as the numerator (the signup cohort), not all-time users.
  v_purchase_rate := CASE WHEN v_cohort_size > 0
    THEN round((v_users_purchased::numeric / v_cohort_size) * 1000) / 10
    ELSE 0 END;

  SELECT count(*) INTO v_founders FROM user_credits WHERE is_founder = true;

  -- Time-to-purchase stats over the cohort
  WITH cohort AS (
    SELECT user_id, created_at
    FROM user_credits
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <= p_end)
  ),
  first_purchase AS (
    SELECT user_id, min(created_at) AS first_at
    FROM (
      SELECT user_id, created_at FROM credit_transactions WHERE type = 'purchase'
      UNION ALL
      SELECT user_id, created_at FROM iap_transactions WHERE status = 'active' AND environment = 'production'
    ) all_purch
    GROUP BY user_id
  ),
  graders AS (
    SELECT DISTINCT user_id FROM credit_transactions WHERE type = 'grade'
  ),
  t2p AS (
    SELECT
      extract(epoch FROM (fp.first_at - c.created_at)) / 86400 AS days
    FROM cohort c
    JOIN first_purchase fp USING (user_id)
    JOIN graders g USING (user_id)
  )
  SELECT
    jsonb_build_object(
      'average_days', coalesce(round(avg(days) * 10) / 10, 0),
      'median_days',  coalesce(round(percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::numeric * 10) / 10, 0),
      'min_days',     coalesce(round(min(days) * 10) / 10, 0),
      'max_days',     coalesce(round(max(days) * 10) / 10, 0)
    ),
    jsonb_build_object(
      'same_day',       count(*) FILTER (WHERE days < 1),
      'within_3_days',  count(*) FILTER (WHERE days <= 3),
      'within_7_days',  count(*) FILTER (WHERE days <= 7),
      'within_30_days', count(*) FILTER (WHERE days <= 30),
      'over_30_days',   count(*) FILTER (WHERE days > 30),
      'total',          count(*)
    )
  INTO v_t2p, v_timing
  FROM t2p;

  -- Package breakdown for purchases made IN the date range.
  -- Revenue per row = metadata.amount_paid_usd when recorded, else the
  -- bucket's list price. Org (Dealer/Enterprise) rows -> 'enterprise'.
  WITH purch AS (
    SELECT
      lower(coalesce(description, '')) AS desc_lc,
      coalesce(metadata, '{}'::jsonb) AS meta,
      amount,
      org_id
    FROM credit_transactions
    WHERE type = 'purchase'
      AND (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <= p_end)
  ),
  classified AS (
    SELECT
      meta,
      amount,
      CASE
        WHEN org_id IS NOT NULL OR meta->>'org_credit' = 'true' THEN 'enterprise'
        WHEN desc_lc ~ '\mfounders?\M' OR meta->>'package' = 'founders' THEN 'founders'
        WHEN desc_lc ~ '\mvip\M'       OR meta->>'package' = 'vip'      THEN 'vip'
        WHEN meta->>'subscription' = 'card_lovers' OR desc_lc LIKE '%card lovers%' THEN
          CASE WHEN meta->>'plan' = 'annual' OR desc_lc ~ '\mannual\M'
               THEN 'card_lovers_annual' ELSE 'card_lovers_monthly' END
        WHEN desc_lc ~ '\melite\M' OR meta->>'tier' = 'elite' OR amount = 20 THEN 'elite'
        WHEN desc_lc ~ '\mpro\M'   OR meta->>'tier' = 'pro'   OR amount = 5  THEN 'pro'
        WHEN desc_lc ~ '\mbasic\M' OR meta->>'tier' = 'basic' OR amount = 1  THEN 'basic'
        ELSE NULL
      END AS bucket
    FROM purch
  ),
  priced AS (
    SELECT
      bucket,
      CASE
        WHEN jsonb_typeof(meta->'amount_paid_usd') = 'number'
          THEN (meta->>'amount_paid_usd')::numeric
        WHEN bucket = 'basic'               THEN 2.99
        WHEN bucket = 'pro'                 THEN 9.99
        WHEN bucket = 'elite'               THEN 19.99
        WHEN bucket = 'vip'                 THEN 99.0
        WHEN bucket = 'card_lovers_monthly' THEN 49.99
        WHEN bucket = 'card_lovers_annual'  THEN 449.0
        WHEN bucket = 'founders'            THEN 99.0
        -- Enterprise list prices (src/lib/orgPlans.ts): Dealer $199 / 400
        -- grades, Enterprise $399 / 1,000 grades, overage pack $12.50 / 25.
        WHEN bucket = 'enterprise' AND meta->>'source' = 'subscription' AND amount = 400  THEN 199.0
        WHEN bucket = 'enterprise' AND meta->>'source' = 'subscription' AND amount = 1000 THEN 399.0
        WHEN bucket = 'enterprise' AND meta->>'source' = 'topup' THEN amount * 0.5
        ELSE 0
      END AS revenue
    FROM classified
  )
  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'basic',                count(*) FILTER (WHERE bucket = 'basic'),
      'pro',                  count(*) FILTER (WHERE bucket = 'pro'),
      'elite',                count(*) FILTER (WHERE bucket = 'elite'),
      'vip',                  count(*) FILTER (WHERE bucket = 'vip'),
      'card_lovers_monthly',  count(*) FILTER (WHERE bucket = 'card_lovers_monthly'),
      'card_lovers_annual',   count(*) FILTER (WHERE bucket = 'card_lovers_annual'),
      'founders',             count(*) FILTER (WHERE bucket = 'founders'),
      'enterprise',           count(*) FILTER (WHERE bucket = 'enterprise')
    ),
    'revenue', jsonb_build_object(
      'basic',                round(coalesce(sum(revenue) FILTER (WHERE bucket = 'basic'), 0) * 100) / 100,
      'pro',                  round(coalesce(sum(revenue) FILTER (WHERE bucket = 'pro'), 0) * 100) / 100,
      'elite',                round(coalesce(sum(revenue) FILTER (WHERE bucket = 'elite'), 0) * 100) / 100,
      'vip',                  round(coalesce(sum(revenue) FILTER (WHERE bucket = 'vip'), 0) * 100) / 100,
      'card_lovers_monthly',  round(coalesce(sum(revenue) FILTER (WHERE bucket = 'card_lovers_monthly'), 0) * 100) / 100,
      'card_lovers_annual',   round(coalesce(sum(revenue) FILTER (WHERE bucket = 'card_lovers_annual'), 0) * 100) / 100,
      'founders',             round(coalesce(sum(revenue) FILTER (WHERE bucket = 'founders'), 0) * 100) / 100,
      'enterprise',           round(coalesce(sum(revenue) FILTER (WHERE bucket = 'enterprise'), 0) * 100) / 100
    ),
    'total_purchases', count(*) FILTER (WHERE bucket IS NOT NULL),
    'total_revenue', round(coalesce(sum(revenue) FILTER (WHERE bucket IS NOT NULL), 0) * 100) / 100
  )
  INTO v_packages
  FROM priced;

  -- Weekly conversion trend — last 12 weeks ending today
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('day', now() at time zone 'UTC') - interval '11 weeks',
      date_trunc('day', now() at time zone 'UTC'),
      interval '7 days'
    ) AS week_start
  ),
  purchasers AS (
    SELECT user_id FROM credit_transactions WHERE type = 'purchase'
    UNION
    SELECT user_id FROM iap_transactions WHERE status = 'active' AND environment = 'production'
  ),
  bucketed AS (
    SELECT
      w.week_start,
      count(uc.user_id) AS signups,
      count(uc.user_id) FILTER (WHERE p.user_id IS NOT NULL) AS conversions
    FROM weeks w
    LEFT JOIN user_credits uc
      ON uc.created_at >= w.week_start
     AND uc.created_at <  w.week_start + interval '7 days'
    LEFT JOIN purchasers p ON p.user_id = uc.user_id
    GROUP BY w.week_start
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'week', to_char(week_start, 'Mon DD'),
    'signups', signups,
    'conversions', conversions,
    'rate', CASE WHEN signups > 0
      THEN round((conversions::numeric / signups) * 1000) / 10
      ELSE 0 END
  ) ORDER BY week_start), '[]'::jsonb)
  INTO v_weekly
  FROM bucketed;

  -- Per-platform funnel — signups (from user_credits in cohort) → graded → purchased
  WITH cohort AS (
    SELECT uc.user_id, _dcm_platform(u.signup_source) AS platform
    FROM user_credits uc
    LEFT JOIN users u ON u.id = uc.user_id
    WHERE (p_start IS NULL OR uc.created_at >= p_start)
      AND (p_end   IS NULL OR uc.created_at <= p_end)
  ),
  graders AS (
    SELECT DISTINCT user_id FROM credit_transactions WHERE type = 'grade'
  ),
  purchasers AS (
    SELECT user_id FROM credit_transactions WHERE type = 'purchase'
    UNION
    SELECT user_id FROM iap_transactions WHERE status = 'active' AND environment = 'production'
  ),
  flagged AS (
    SELECT
      c.platform,
      (g.user_id IS NOT NULL) AS graded,
      (p.user_id IS NOT NULL) AS purchased
    FROM cohort c
    LEFT JOIN graders g ON g.user_id = c.user_id
    LEFT JOIN purchasers p ON p.user_id = c.user_id
  ),
  per_platform AS (
    SELECT
      platform,
      count(*) AS signups,
      count(*) FILTER (WHERE graded) AS graded,
      count(*) FILTER (WHERE purchased) AS purchased
    FROM flagged
    GROUP BY platform
  ),
  filled AS (
    SELECT plat AS platform,
      coalesce(p.signups,   0) AS signups,
      coalesce(p.graded,    0) AS graded,
      coalesce(p.purchased, 0) AS purchased
    FROM (VALUES ('web'), ('ios_app'), ('android_app')) AS plats(plat)
    LEFT JOIN per_platform p ON p.platform = plats.plat
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'platform', platform,
    'signups', signups,
    'graded', graded,
    'purchased', purchased,
    'graded_rate', CASE WHEN signups > 0 THEN round((graded::numeric / signups) * 1000) / 10 ELSE 0 END,
    'purchase_rate', CASE WHEN signups > 0 THEN round((purchased::numeric / signups) * 1000) / 10 ELSE 0 END,
    'grader_to_buyer_rate', CASE WHEN graded > 0 THEN round((purchased::numeric / graded) * 1000) / 10 ELSE 0 END
  )), '[]'::jsonb)
  INTO v_by_platform
  FROM filled;

  RETURN jsonb_build_object(
    'overview', jsonb_build_object(
      'total_users', v_total_users,
      'cohort_users', v_cohort_size,
      'users_used_free_credit', v_users_graded,
      'users_made_purchase', v_users_purchased,
      'converted_users', v_converted,
      'conversion_rate', v_conv_rate,
      'overall_purchase_rate', v_purchase_rate,
      'total_founders', v_founders
    ),
    'time_to_purchase', coalesce(v_t2p, jsonb_build_object('average_days',0,'median_days',0,'min_days',0,'max_days',0)),
    'purchase_timing', coalesce(v_timing, jsonb_build_object('same_day',0,'within_3_days',0,'within_7_days',0,'within_30_days',0,'over_30_days',0,'total',0)),
    'package_breakdown', coalesce(v_packages, '{}'::jsonb),
    'weekly_trends', v_weekly,
    'by_platform', v_by_platform
  );
END;
$$;

-- ============================================================================
-- 5. get_revenue_analytics(from, to)  — A, E, H
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_revenue_analytics(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tz constant text := 'America/New_York';
  v_today_start timestamptz;
  v_headline jsonb;
  v_source jsonb;
  v_platform jsonb;
  v_product jsonb;
  v_daily jsonb;
  v_top jsonb;
  v_recent jsonb;
  v_total_revenue numeric;
  v_total_txn int;
  v_today numeric;
  v_last_7 numeric;
  v_last_30 numeric;
BEGIN
  -- Midnight America/New_York today, as a timestamptz.
  v_today_start := date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  -- Rolling headline windows: one pass over the last 30 days (today's NY
  -- midnight is always inside that window).
  SELECT
    coalesce(sum(hr.amount_usd) FILTER (WHERE hr.created_at >= v_today_start), 0),
    coalesce(sum(hr.amount_usd) FILTER (WHERE hr.created_at >= now() - interval '7 days'), 0),
    coalesce(sum(hr.amount_usd), 0)
  INTO v_today, v_last_7, v_last_30
  FROM _dcm_revenue_rows(now() - interval '30 days', 'infinity'::timestamptz) hr;

  -- Everything in the requested range, computed from one materialized set.
  WITH r AS MATERIALIZED (
    SELECT * FROM _dcm_revenue_rows(p_from, p_to)
  ),
  src AS (
    SELECT s.source, s.ord,
      coalesce(sum(r.amount_usd), 0) AS revenue,
      count(r.id) AS n
    FROM (VALUES ('stripe_credits', 1), ('stripe_subscription', 2), ('apple_iap', 3), ('google_iap', 4)) AS s(source, ord)
    LEFT JOIN r ON r.source = s.source
    GROUP BY s.source, s.ord
  ),
  plat AS (
    SELECT p.platform, p.ord,
      coalesce(sum(r.amount_usd), 0) AS revenue,
      count(r.id) AS n
    FROM (VALUES ('web', 1), ('ios', 2), ('android', 3)) AS p(platform, ord)
    LEFT JOIN r ON r.platform = p.platform
    GROUP BY p.platform, p.ord
  ),
  prod AS (
    SELECT product, sum(amount_usd) AS revenue, count(*) AS n
    FROM r GROUP BY product
  ),
  days AS (
    SELECT generate_series(
      (p_from AT TIME ZONE v_tz)::date,
      (p_to   AT TIME ZONE v_tz)::date,
      interval '1 day'
    )::date AS day
  ),
  per_day AS (
    SELECT
      (created_at AT TIME ZONE v_tz)::date AS day,
      sum(amount_usd) FILTER (WHERE source = 'stripe_credits')      AS stripe_credits,
      sum(amount_usd) FILTER (WHERE source = 'stripe_subscription') AS stripe_subscription,
      sum(amount_usd) FILTER (WHERE source = 'apple_iap')           AS apple_iap,
      sum(amount_usd) FILTER (WHERE source = 'google_iap')          AS google_iap
    FROM r
    GROUP BY 1
  ),
  daily AS (
    SELECT d.day,
      coalesce(pd.stripe_credits, 0)      AS stripe_credits,
      coalesce(pd.stripe_subscription, 0) AS stripe_subscription,
      coalesce(pd.apple_iap, 0)           AS apple_iap,
      coalesce(pd.google_iap, 0)          AS google_iap
    FROM days d
    LEFT JOIN per_day pd ON pd.day = d.day
  ),
  per_user AS (
    SELECT user_id, sum(amount_usd) AS revenue, count(*) AS transactions
    FROM r GROUP BY user_id
    ORDER BY revenue DESC LIMIT 10
  ),
  recent AS (
    SELECT * FROM r ORDER BY created_at DESC LIMIT 25
  )
  SELECT
    (SELECT sum(amount_usd) FROM r),
    (SELECT count(*) FROM r),
    (SELECT jsonb_agg(jsonb_build_object(
       'source', source, 'revenue', round(revenue * 100) / 100, 'count', n
     ) ORDER BY ord) FROM src),
    (SELECT jsonb_agg(jsonb_build_object(
       'platform', platform, 'revenue', round(revenue * 100) / 100, 'count', n
     ) ORDER BY ord) FROM plat),
    (SELECT jsonb_agg(jsonb_build_object(
       'product', product, 'revenue', round(revenue * 100) / 100, 'count', n
     ) ORDER BY revenue DESC) FROM prod),
    (SELECT jsonb_agg(jsonb_build_object(
       'date', to_char(day, 'YYYY-MM-DD'),
       'stripe_credits',      round(stripe_credits * 100) / 100,
       'stripe_subscription', round(stripe_subscription * 100) / 100,
       'apple_iap',           round(apple_iap * 100) / 100,
       'google_iap',          round(google_iap * 100) / 100,
       'total',               round((stripe_credits + stripe_subscription + apple_iap + google_iap) * 100) / 100
     ) ORDER BY day) FROM daily),
    (SELECT jsonb_agg(jsonb_build_object(
       'user_id', pu.user_id::text,
       'email', coalesce(u.email, substring(pu.user_id::text, 1, 8) || '…'),
       'revenue', round(pu.revenue * 100) / 100,
       'transactions', pu.transactions
     ) ORDER BY pu.revenue DESC)
     FROM per_user pu LEFT JOIN users u ON u.id = pu.user_id),
    (SELECT jsonb_agg(jsonb_build_object(
       'id', un.id,
       'source', un.source,
       'platform', un.platform,
       'user_id', un.user_id::text,
       'email', coalesce(u.email, substring(un.user_id::text, 1, 8) || '…'),
       'product', un.product,
       'amount_usd', round(un.amount_usd * 100) / 100,
       'created_at', un.created_at
     ) ORDER BY un.created_at DESC)
     FROM recent un LEFT JOIN users u ON u.id = un.user_id)
  INTO v_total_revenue, v_total_txn, v_source, v_platform, v_product, v_daily, v_top, v_recent;

  v_headline := jsonb_build_object(
    'total_revenue', round(coalesce(v_total_revenue, 0) * 100) / 100,
    'total_transactions', coalesce(v_total_txn, 0),
    'today', round(v_today * 100) / 100,
    'last_7_days', round(v_last_7 * 100) / 100,
    'last_30_days', round(v_last_30 * 100) / 100
  );

  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'headline', v_headline,
    'source_breakdown', coalesce(v_source, '[]'::jsonb),
    'platform_breakdown', coalesce(v_platform, '[]'::jsonb),
    'product_breakdown', coalesce(v_product, '[]'::jsonb),
    'daily_trend', coalesce(v_daily, '[]'::jsonb),
    'top_spenders', coalesce(v_top, '[]'::jsonb),
    'recent_transactions', coalesce(v_recent, '[]'::jsonb),
    'note', 'Stripe credit packs use the amount actually paid (metadata.amount_paid_usd, recorded from Oct 8 2026) and fall back to the list price from the description for older rows. Card Lovers uses list price. Apple IAP uses raw_receipt.price (thousandths of USD); non-USD and Google rows use the product list price. "Today" and daily buckets are America/New_York days.'
  );
END;
$$;

-- ============================================================================
-- 6. get_costs_summary(month)  — A, E, F
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_costs_summary(p_month date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_trend jsonb;
  v_selected jsonb;
  v_fixed_by_cat jsonb;
  v_fixed_rows jsonb;
  v_iap_fee_rate numeric := 0.30;
  v_window_start timestamp := (date_trunc('month', p_month::timestamp) - interval '11 months');
  v_window_end   timestamp := (date_trunc('month', p_month::timestamp) + interval '1 month');
  v_month_start  date := date_trunc('month', p_month::timestamp)::date;
  v_month_end    date := (date_trunc('month', p_month::timestamp) + interval '1 month - 1 day')::date;
BEGIN
  WITH months AS (
    SELECT generate_series(
      v_window_start::date,
      date_trunc('month', p_month::timestamp)::date,
      interval '1 month'
    )::date AS month_start
  ),
  month_data AS (
    SELECT
      m.month_start,
      to_char(m.month_start, 'YYYY-MM') AS label,
      m.month_start::timestamp AS start_ts,
      (m.month_start + interval '1 month')::timestamp AS end_ts
    FROM months m
  ),
  stripe_credits AS (
    SELECT md.label,
      coalesce(sum(_stripe_paid_amount(ct.description, ct.metadata)), 0) AS revenue,
      count(ct.id) AS count
    FROM month_data md
    LEFT JOIN credit_transactions ct
      ON ct.type='purchase' AND ct.stripe_payment_intent_id IS NOT NULL
     AND ct.created_at >= md.start_ts AND ct.created_at < md.end_ts
    GROUP BY md.label
  ),
  stripe_subs AS (
    SELECT md.label,
      coalesce(sum(CASE WHEN lower(coalesce(se.plan,''))='annual' THEN 449.0 ELSE 49.99 END), 0) AS revenue,
      count(se.id) AS count
    FROM month_data md
    LEFT JOIN subscription_events se
      ON se.event_type IN ('subscribed','renewed') AND se.stripe_subscription_id IS NOT NULL
     AND se.created_at >= md.start_ts AND se.created_at < md.end_ts
    GROUP BY md.label
  ),
  iap_rev AS (
    SELECT md.label,
      coalesce(sum(_iap_amount_usd(it.platform, it.raw_receipt, it.product_id)) FILTER (WHERE it.platform = 'apple'), 0)  AS apple_revenue,
      coalesce(sum(_iap_amount_usd(it.platform, it.raw_receipt, it.product_id)) FILTER (WHERE it.platform = 'google'), 0) AS google_revenue
    FROM month_data md
    LEFT JOIN iap_transactions it
      ON it.status='active' AND it.environment='production'
     AND it.created_at >= md.start_ts AND it.created_at < md.end_ts
    GROUP BY md.label
  ),
  -- OpenAI billing actuals (nightly sync)
  oai_actuals AS (
    SELECT md.label, coalesce(sum(oc.cost_usd), 0) AS cost, count(oc.id) AS row_count
    FROM month_data md
    LEFT JOIN openai_daily_costs oc
      ON oc.date >= md.start_ts::date AND oc.date < md.end_ts::date
    GROUP BY md.label
  ),
  -- Fallback: our own per-call token-cost estimate (one range scan)
  oai_estimate AS (
    SELECT to_char(date_trunc('month', al.created_at), 'YYYY-MM') AS label,
      coalesce(sum(al.cost_usd), 0) AS cost
    FROM api_usage_log al
    WHERE al.created_at >= v_window_start AND al.created_at < v_window_end
      AND al.cost_usd IS NOT NULL
    GROUP BY 1
  ),
  stripe_fees_actuals AS (
    SELECT md.label, coalesce(sum(sf.fee_usd), 0) AS fee, count(sf.id) AS row_count
    FROM month_data md
    LEFT JOIN stripe_daily_fees sf
      ON sf.date >= md.start_ts::date AND sf.date < md.end_ts::date
    GROUP BY md.label
  ),
  -- Cards graded in month. Soft-deleted cards are deliberately INCLUDED:
  -- their grading cost was still incurred.
  card_counts AS (
    SELECT md.label, count(c.id) AS card_count
    FROM month_data md
    LEFT JOIN cards c
      ON (c.conversational_whole_grade IS NOT NULL OR c.conversational_decimal_grade IS NOT NULL)
     AND c.created_at >= md.start_ts AND c.created_at < md.end_ts
    GROUP BY md.label
  ),
  -- Fixed costs: recurring rows while active; one_time rows only in the
  -- month of effective_from.
  fixed_costs AS (
    SELECT md.label, coalesce(sum(mc.amount_usd), 0) AS total
    FROM month_data md
    LEFT JOIN monthly_costs mc
      ON CASE WHEN mc.cost_type = 'one_time'
           THEN date_trunc('month', mc.effective_from)::date = md.month_start
           ELSE mc.effective_from <= (md.end_ts - interval '1 day')::date
            AND (mc.effective_to IS NULL OR mc.effective_to >= md.start_ts::date)
         END
    GROUP BY md.label
  ),
  combined AS (
    SELECT
      md.label AS month,
      coalesce(sc.revenue, 0) AS revenue_stripe_credits,
      coalesce(ss.revenue, 0) AS revenue_stripe_subscription,
      coalesce(ir.apple_revenue, 0) AS revenue_apple_iap,
      coalesce(ir.google_revenue, 0) AS revenue_google_iap,
      coalesce(sc.count, 0) + coalesce(ss.count, 0) AS stripe_txn_count,
      coalesce(oa.cost, 0) AS oai_cost,
      coalesce(oa.row_count, 0) AS oai_row_count,
      coalesce(oe.cost, 0) AS oai_estimate,
      coalesce(sfa.fee, 0) AS sf_fee,
      coalesce(sfa.row_count, 0) AS sf_row_count,
      coalesce(cc.card_count, 0) AS card_count,
      coalesce(fc.total, 0) AS fixed_total
    FROM month_data md
    LEFT JOIN stripe_credits sc       ON sc.label = md.label
    LEFT JOIN stripe_subs ss          ON ss.label = md.label
    LEFT JOIN iap_rev ir              ON ir.label = md.label
    LEFT JOIN oai_actuals oa          ON oa.label = md.label
    LEFT JOIN oai_estimate oe         ON oe.label = md.label
    LEFT JOIN stripe_fees_actuals sfa ON sfa.label = md.label
    LEFT JOIN card_counts cc          ON cc.label = md.label
    LEFT JOIN fixed_costs fc          ON fc.label = md.label
  ),
  with_derived AS (
    SELECT
      month,
      revenue_stripe_credits,
      revenue_stripe_subscription,
      revenue_apple_iap,
      revenue_google_iap,
      (revenue_stripe_credits + revenue_stripe_subscription + revenue_apple_iap + revenue_google_iap) AS revenue_total,
      -- OpenAI: synced billing if any rows in month, else api_usage_log estimate
      CASE WHEN oai_row_count > 0 THEN oai_cost ELSE oai_estimate END AS openai_cost,
      CASE WHEN oai_row_count > 0 THEN 'actual' ELSE 'estimate' END AS openai_source,
      -- Stripe fees: actual if rows exist, else 2.9% + $0.30 per txn
      CASE WHEN sf_row_count > 0
        THEN sf_fee
        ELSE (revenue_stripe_credits + revenue_stripe_subscription) * 0.029 + (stripe_txn_count::numeric * 0.30)
      END AS stripe_fees,
      CASE WHEN sf_row_count > 0 THEN 'actual' ELSE 'estimate' END AS stripe_fees_source,
      (revenue_apple_iap * v_iap_fee_rate)  AS apple_iap_fee,
      (revenue_google_iap * v_iap_fee_rate) AS google_iap_fee,
      fixed_total AS fixed_cost_total,
      card_count
    FROM combined
  ),
  with_totals AS (
    SELECT *,
      (openai_cost + stripe_fees + apple_iap_fee + google_iap_fee) AS variable_cost_total,
      revenue_total - (openai_cost + stripe_fees + apple_iap_fee + google_iap_fee) AS gross_margin,
      revenue_total - (openai_cost + stripe_fees + apple_iap_fee + google_iap_fee) - fixed_cost_total AS net_margin
    FROM with_derived
  )
  SELECT jsonb_agg(jsonb_build_object(
    'month', month,
    'revenue_total',               round(revenue_total * 100) / 100,
    'revenue_stripe_credits',      round(revenue_stripe_credits * 100) / 100,
    'revenue_stripe_subscription', round(revenue_stripe_subscription * 100) / 100,
    'revenue_apple_iap',           round(revenue_apple_iap * 100) / 100,
    'revenue_google_iap',          round(revenue_google_iap * 100) / 100,
    'openai_cost',                 round(openai_cost * 100) / 100,
    'openai_source',               openai_source,
    'stripe_fees',                 round(stripe_fees * 100) / 100,
    'stripe_fees_source',          stripe_fees_source,
    'apple_iap_fee',               round(apple_iap_fee * 100) / 100,
    'google_iap_fee',              round(google_iap_fee * 100) / 100,
    'variable_cost_total',         round(variable_cost_total * 100) / 100,
    'fixed_cost_total',            round(fixed_cost_total * 100) / 100,
    'gross_margin',                round(gross_margin * 100) / 100,
    'gross_margin_pct', CASE WHEN revenue_total > 0
      THEN round((gross_margin / revenue_total) * 1000) / 10 ELSE 0 END,
    'net_margin',                  round(net_margin * 100) / 100,
    'net_margin_pct', CASE WHEN revenue_total > 0
      THEN round((net_margin / revenue_total) * 1000) / 10 ELSE 0 END,
    'card_count', card_count
  ) ORDER BY month)
  INTO v_trend
  FROM with_totals;

  -- Selected month = last entry in trend (newest month, since trend is asc)
  v_selected := v_trend->(jsonb_array_length(v_trend) - 1);

  -- Fixed costs active in the selected month (same one_time rule as above)
  WITH active_fixed AS (
    SELECT *
    FROM monthly_costs
    WHERE CASE WHEN cost_type = 'one_time'
            THEN date_trunc('month', effective_from)::date = v_month_start
            ELSE effective_from <= v_month_end
             AND (effective_to IS NULL OR effective_to >= v_month_start)
          END
  ),
  by_cat AS (
    SELECT category, sum(amount_usd) AS total,
      jsonb_agg(vendor ORDER BY vendor) AS vendors
    FROM active_fixed GROUP BY category
  )
  SELECT jsonb_agg(jsonb_build_object(
    'category', category,
    'total', round(total * 100) / 100,
    'vendors', vendors
  ) ORDER BY total DESC)
  INTO v_fixed_by_cat FROM by_cat;

  SELECT jsonb_agg(to_jsonb(af) ORDER BY af.vendor)
  INTO v_fixed_rows
  FROM (
    SELECT *
    FROM monthly_costs
    WHERE CASE WHEN cost_type = 'one_time'
            THEN date_trunc('month', effective_from)::date = v_month_start
            ELSE effective_from <= v_month_end
             AND (effective_to IS NULL OR effective_to >= v_month_start)
          END
  ) af;

  RETURN jsonb_build_object(
    'month', to_char(p_month, 'YYYY-MM'),
    'iap_fee_rate_pct', v_iap_fee_rate * 100,
    'selected', coalesce(v_selected, '{}'::jsonb),
    'trend', coalesce(v_trend, '[]'::jsonb),
    'fixed_by_category', coalesce(v_fixed_by_cat, '[]'::jsonb),
    'fixed_rows', coalesce(v_fixed_rows, '[]'::jsonb)
  );
END;
$$;

-- ============================================================================
-- Grants: service role only. These are SECURITY DEFINER and return revenue,
-- costs and customer emails; they were executable by PUBLIC (and therefore
-- the anon key) because the original migration never revoked the default.
-- The only callers are the admin API routes, which use the service role.
-- ============================================================================
REVOKE ALL ON FUNCTION public.get_user_analytics(timestamptz, timestamptz)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_grading_analytics(timestamptz, timestamptz)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_card_analytics(timestamptz, timestamptz)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversion_analytics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_revenue_analytics(timestamptz, timestamptz)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_costs_summary(date)                            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_analytics(timestamptz, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grading_analytics(timestamptz, timestamptz)    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_card_analytics(timestamptz, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.get_conversion_analytics(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_analytics(timestamptz, timestamptz)    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_costs_summary(date)                            TO service_role;
