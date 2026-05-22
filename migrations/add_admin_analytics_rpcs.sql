-- Migration: server-side analytics RPCs
-- Purpose: Replace client-side aggregation in /api/admin/analytics/* and
--          /api/admin/{revenue,costs/summary}. The previous approach pulled
--          thousands of rows over PostgREST and grouped them in Node — but
--          the project's Max Rows setting (default 1000) silently truncates
--          the response, so every aggregation was computed against a 1000-row
--          sample. These RPCs run the aggregations in Postgres and return a
--          single JSONB blob — no row cap applies.
-- Date: 2026-05-20
--
-- All functions are SECURITY DEFINER + fixed search_path so they execute with
-- service-role privileges no matter who calls them. Callers (the API routes)
-- enforce admin session auth before invoking.

-- ============================================================================
-- shared helpers (declared first so all RPCs below can reference them)
-- ============================================================================

-- Normalize a signup_source / graded_from value
CREATE OR REPLACE FUNCTION public._dcm_platform(s text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN s IN ('web', 'ios_app', 'android_app') THEN s ELSE 'web' END
$$;

-- Map a Stripe credit_transactions description to a USD amount.
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
    WHEN lower(p_desc) LIKE '%basic%'   THEN 2.99
    WHEN lower(p_desc) LIKE '%elite%'   THEN 19.99
    WHEN lower(p_desc) LIKE '%pro%'     THEN 9.99
    WHEN lower(p_desc) LIKE '%vip%'     THEN 99.0
    WHEN lower(p_desc) LIKE '%founder%' THEN 99.0
    ELSE 0
  END
$$;

-- ============================================================================
-- 1. get_user_analytics(from, to)
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

  SELECT count(DISTINCT user_id) INTO v_users_with_cards FROM cards;

  SELECT count(DISTINCT user_id) INTO v_active_7d
    FROM cards WHERE created_at >= now() - interval '7 days';
  SELECT count(DISTINCT user_id) INTO v_active_30d
    FROM cards WHERE created_at >= now() - interval '30 days';
  SELECT count(DISTINCT user_id) INTO v_active_90d
    FROM cards WHERE created_at >= now() - interval '90 days';

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
-- 2. get_grading_analytics(from, to)
-- ============================================================================
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
  SELECT count(*) INTO v_total_graded
    FROM cards WHERE conversational_decimal_grade IS NOT NULL;

  SELECT round(avg(conversational_decimal_grade) * 10) / 10 INTO v_avg_grade
    FROM cards WHERE conversational_decimal_grade IS NOT NULL;

  SELECT count(*) INTO v_perfect_tens
    FROM cards WHERE conversational_decimal_grade = 10;

  SELECT count(*) INTO v_high_grades
    FROM cards WHERE conversational_decimal_grade >= 9;

  SELECT round(avg(conversational_decimal_grade) * 10) / 10 INTO v_avg_30d
    FROM cards
    WHERE conversational_decimal_grade IS NOT NULL
      AND created_at >= now() - interval '30 days';

  -- All-time graded by platform
  SELECT jsonb_build_object(
    'web',         coalesce(sum((_dcm_platform(graded_from) = 'web')::int), 0),
    'ios_app',     coalesce(sum((_dcm_platform(graded_from) = 'ios_app')::int), 0),
    'android_app', coalesce(sum((_dcm_platform(graded_from) = 'android_app')::int), 0)
  ) INTO v_by_platform
  FROM cards WHERE conversational_decimal_grade IS NOT NULL;

  -- Grade distribution (rounded to nearest int)
  WITH dist AS (
    SELECT
      round(conversational_decimal_grade)::int AS grade,
      count(*) AS n
    FROM cards
    WHERE conversational_decimal_grade IS NOT NULL
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
      round(avg(conversational_decimal_grade) * 10) / 10 AS average_grade
    FROM cards
    WHERE conversational_decimal_grade IS NOT NULL
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
      coalesce(round(avg(c.conversational_decimal_grade) * 10) / 10, 0) AS avg_grade
    FROM weeks w
    LEFT JOIN cards c
      ON c.created_at >= w.week_start
     AND c.created_at <  w.week_start + interval '7 days'
     AND c.conversational_decimal_grade IS NOT NULL
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
-- 3. get_card_analytics(from, to)
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
  SELECT count(*) INTO v_total FROM cards;
  -- `visibility` is the source of truth. The legacy `is_public` boolean got
  -- stuck at true for every row by the Oct 2025 visibility migration and is
  -- no longer maintained. Using it here would always show 100% public.
  SELECT count(*) INTO v_public  FROM cards WHERE visibility = 'public';
  SELECT count(*) INTO v_private FROM cards WHERE visibility = 'private';

  SELECT count(*) INTO v_last_7  FROM cards WHERE created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_last_30 FROM cards WHERE created_at >= now() - interval '30 days';

  SELECT jsonb_build_object(
    'web',         coalesce(sum((_dcm_platform(graded_from) = 'web')::int), 0),
    'ios_app',     coalesce(sum((_dcm_platform(graded_from) = 'ios_app')::int), 0),
    'android_app', coalesce(sum((_dcm_platform(graded_from) = 'android_app')::int), 0)
  ) INTO v_by_platform
  FROM cards;

  WITH per_cat AS (
    SELECT coalesce(category, 'Other') AS category, count(*) AS n
    FROM cards GROUP BY 1
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
    FROM cards WHERE created_at >= now() - interval '30 days'
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
    -- top 5 categories — pull the first 5 elements out of the by_category array
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
-- 4. get_conversion_analytics(start_date, end_date)
-- ============================================================================
-- Signature mirrors the existing endpoint's params for compatibility. The
-- 'start_date'/'end_date' filter applies to user_credits.created_at (the
-- signups cohort) — matches the original behavior.
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
  -- Total users from public.users for the headline (matches the original code)
  SELECT count(*) INTO v_total_users FROM users;

  -- Cohort = users created in the range (or all-time if no range)
  WITH cohort AS (
    SELECT user_id, created_at
    FROM user_credits
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <= p_end)
  ),
  -- Anyone who has ever graded
  graders AS (
    SELECT DISTINCT user_id FROM credit_transactions WHERE type = 'grade'
  ),
  -- Anyone who has ever purchased — Stripe OR production IAP
  purchasers AS (
    SELECT user_id FROM credit_transactions WHERE type = 'purchase'
    UNION
    SELECT user_id FROM iap_transactions WHERE status = 'active' AND environment = 'production'
  ),
  -- Earliest purchase per user (for time-to-purchase)
  first_purchase AS (
    SELECT user_id, min(created_at) AS first_at
    FROM (
      SELECT user_id, created_at FROM credit_transactions WHERE type = 'purchase'
      UNION ALL
      SELECT user_id, created_at FROM iap_transactions WHERE status = 'active' AND environment = 'production'
    ) all_purch
    GROUP BY user_id
  ),
  cohort_with_flags AS (
    SELECT
      c.user_id,
      c.created_at AS signup_at,
      (g.user_id IS NOT NULL) AS has_graded,
      (p.user_id IS NOT NULL) AS has_purchased,
      fp.first_at AS first_purchase_at
    FROM cohort c
    LEFT JOIN graders g ON g.user_id = c.user_id
    LEFT JOIN purchasers p ON p.user_id = c.user_id
    LEFT JOIN first_purchase fp ON fp.user_id = c.user_id
  )
  SELECT
    count(*) FILTER (WHERE has_graded),
    count(*) FILTER (WHERE has_purchased),
    count(*) FILTER (WHERE has_graded AND has_purchased)
  INTO v_users_graded, v_users_purchased, v_converted
  FROM cohort_with_flags;

  v_conv_rate := CASE WHEN v_users_graded > 0
    THEN round((v_converted::numeric / v_users_graded) * 1000) / 10
    ELSE 0 END;
  v_purchase_rate := CASE WHEN v_total_users > 0
    THEN round((v_users_purchased::numeric / v_total_users) * 1000) / 10
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

  -- Package breakdown — same description-parsing logic as the JS endpoint
  WITH purch AS (
    SELECT
      lower(coalesce(description, '')) AS desc_lc,
      coalesce(metadata, '{}'::jsonb) AS meta,
      amount
    FROM credit_transactions
    WHERE type = 'purchase'
  ),
  classified AS (
    -- Note: column from `purch` was originally named `desc` which is a
    -- reserved word in PostgreSQL (ORDER BY x DESC). Postgres rejects it
    -- as a column identifier even with lower case. Use desc_lc.
    SELECT
      CASE
        WHEN desc_lc LIKE '%founder%' OR meta->>'package' = 'founders' THEN 'founders'
        WHEN desc_lc LIKE '%vip%'     OR meta->>'package' = 'vip'      THEN 'vip'
        WHEN meta->>'subscription' = 'card_lovers' OR desc_lc LIKE '%card lovers%' THEN
          CASE WHEN meta->>'plan' = 'annual' OR desc_lc LIKE '%annual%'
               THEN 'card_lovers_annual' ELSE 'card_lovers_monthly' END
        WHEN desc_lc LIKE '%elite%' OR meta->>'tier' = 'elite' OR amount = 20 THEN 'elite'
        WHEN desc_lc LIKE '%pro%'   OR meta->>'tier' = 'pro'   OR amount = 5  THEN 'pro'
        WHEN desc_lc LIKE '%basic%' OR meta->>'tier' = 'basic' OR amount = 1  THEN 'basic'
        ELSE NULL
      END AS bucket
    FROM purch
  )
  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'basic',                count(*) FILTER (WHERE bucket = 'basic'),
      'pro',                  count(*) FILTER (WHERE bucket = 'pro'),
      'elite',                count(*) FILTER (WHERE bucket = 'elite'),
      'vip',                  count(*) FILTER (WHERE bucket = 'vip'),
      'card_lovers_monthly',  count(*) FILTER (WHERE bucket = 'card_lovers_monthly'),
      'card_lovers_annual',   count(*) FILTER (WHERE bucket = 'card_lovers_annual'),
      'founders',             count(*) FILTER (WHERE bucket = 'founders')
    ),
    'revenue', jsonb_build_object(
      'basic',                count(*) FILTER (WHERE bucket = 'basic')                * 2.99,
      'pro',                  count(*) FILTER (WHERE bucket = 'pro')                  * 9.99,
      'elite',                count(*) FILTER (WHERE bucket = 'elite')                * 19.99,
      'vip',                  count(*) FILTER (WHERE bucket = 'vip')                  * 99.0,
      'card_lovers_monthly',  count(*) FILTER (WHERE bucket = 'card_lovers_monthly')  * 49.99,
      'card_lovers_annual',   count(*) FILTER (WHERE bucket = 'card_lovers_annual')   * 449.0,
      'founders',             count(*) FILTER (WHERE bucket = 'founders')             * 99.0
    ),
    'total_purchases', count(*) FILTER (WHERE bucket IS NOT NULL),
    'total_revenue',
      round((
        count(*) FILTER (WHERE bucket = 'basic')               * 2.99 +
        count(*) FILTER (WHERE bucket = 'pro')                 * 9.99 +
        count(*) FILTER (WHERE bucket = 'elite')               * 19.99 +
        count(*) FILTER (WHERE bucket = 'vip')                 * 99.0 +
        count(*) FILTER (WHERE bucket = 'card_lovers_monthly') * 49.99 +
        count(*) FILTER (WHERE bucket = 'card_lovers_annual')  * 449.0 +
        count(*) FILTER (WHERE bucket = 'founders')            * 99.0
      ) * 100) / 100
  )
  INTO v_packages
  FROM classified;

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
    -- ensure every platform appears even when 0
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
-- 5. get_revenue_analytics(from, to)
-- ============================================================================
-- Returns the same shape /api/admin/analytics/revenue currently returns.
CREATE OR REPLACE FUNCTION public.get_revenue_analytics(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_headline jsonb;
  v_source jsonb;
  v_platform jsonb;
  v_product jsonb;
  v_daily jsonb;
  v_top jsonb;
  v_recent jsonb;
  v_total_revenue numeric;
  v_total_txn int;
BEGIN
  -- Unified rows: Stripe credit packs + Stripe subs + Apple IAP + Google IAP
  WITH stripe_credits AS (
    SELECT
      id::text,
      'stripe_credits' AS source,
      'web' AS platform,
      user_id,
      CASE
        WHEN lower(coalesce(description,'')) LIKE '%basic%'   THEN 2.99
        WHEN lower(coalesce(description,'')) LIKE '%elite%'   THEN 19.99
        WHEN lower(coalesce(description,'')) LIKE '%pro%'     THEN 9.99
        WHEN lower(coalesce(description,'')) LIKE '%vip%'     THEN 99.0
        WHEN lower(coalesce(description,'')) LIKE '%founder%' THEN 99.0
        ELSE 0 END AS amount_usd,
      CASE
        WHEN lower(coalesce(description,'')) LIKE '%basic%'   THEN 'Stripe Basic'
        WHEN lower(coalesce(description,'')) LIKE '%elite%'   THEN 'Stripe Elite'
        WHEN lower(coalesce(description,'')) LIKE '%pro%'     THEN 'Stripe Pro'
        WHEN lower(coalesce(description,'')) LIKE '%vip%'     THEN 'Stripe Vip'
        WHEN lower(coalesce(description,'')) LIKE '%founder%' THEN 'Stripe Founders'
        ELSE 'Stripe credit pack' END AS product,
      created_at
    FROM credit_transactions
    WHERE type = 'purchase'
      AND stripe_payment_intent_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  stripe_subs AS (
    SELECT
      id::text,
      'stripe_subscription' AS source,
      'web' AS platform,
      user_id,
      CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END AS amount_usd,
      CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 'Card Lovers Annual' ELSE 'Card Lovers Monthly' END AS product,
      created_at
    FROM subscription_events
    WHERE event_type IN ('subscribed', 'renewed')
      AND stripe_subscription_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  iap AS (
    SELECT
      id::text,
      CASE WHEN platform = 'apple' THEN 'apple_iap' ELSE 'google_iap' END AS source,
      CASE WHEN platform = 'apple' THEN 'ios'       ELSE 'android'    END AS platform,
      user_id,
      CASE
        -- Apple JWS-decoded transaction.price is in millicents (1000 = $1.00).
        -- $9.99 -> 9990, divide by 1000 to get dollars. Earlier version
        -- divided by 100 which yielded ~$99.90 for every Pro IAP.
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 10000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END AS amount_usd,
      product_id AS product,
      created_at
    FROM iap_transactions
    WHERE status = 'active'
      AND environment = 'production'
      AND created_at >= p_from AND created_at <= p_to
  ),
  unified AS (
    SELECT * FROM stripe_credits
    UNION ALL SELECT * FROM stripe_subs
    UNION ALL SELECT * FROM iap
  )
  -- Build all aggregations in one CTE chain
  SELECT
    sum(amount_usd),
    count(*)
  INTO v_total_revenue, v_total_txn
  FROM unified;

  -- Headline
  v_headline := jsonb_build_object(
    'total_revenue', round(coalesce(v_total_revenue, 0) * 100) / 100,
    'total_transactions', coalesce(v_total_txn, 0),
    'today', (SELECT round(coalesce(sum(a), 0) * 100) / 100 FROM (
      SELECT _revenue_amount(description, NULL, NULL, NULL) AS a
        FROM credit_transactions
        WHERE type = 'purchase' AND stripe_payment_intent_id IS NOT NULL
          AND created_at >= date_trunc('day', now())
      UNION ALL
      SELECT CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END
        FROM subscription_events
        WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
          AND created_at >= date_trunc('day', now())
      UNION ALL
      SELECT CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END
        FROM iap_transactions
        WHERE status='active' AND environment='production'
          AND created_at >= date_trunc('day', now())
    ) t),
    'last_7_days', (SELECT round(coalesce(sum(a), 0) * 100) / 100 FROM (
      SELECT _revenue_amount(ct.description, NULL, NULL, NULL) AS a
        FROM credit_transactions ct WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
          AND created_at >= now() - interval '7 days'
      UNION ALL
      SELECT CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END
        FROM subscription_events WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
          AND created_at >= now() - interval '7 days'
      UNION ALL
      SELECT CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END
        FROM iap_transactions WHERE status='active' AND environment='production'
          AND created_at >= now() - interval '7 days'
    ) t),
    'last_30_days', (SELECT round(coalesce(sum(a), 0) * 100) / 100 FROM (
      SELECT _revenue_amount(ct.description, NULL, NULL, NULL) AS a
        FROM credit_transactions ct WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
          AND created_at >= now() - interval '30 days'
      UNION ALL
      SELECT CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END
        FROM subscription_events WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
          AND created_at >= now() - interval '30 days'
      UNION ALL
      SELECT CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END
        FROM iap_transactions WHERE status='active' AND environment='production'
          AND created_at >= now() - interval '30 days'
    ) t)
  );

  -- Source breakdown
  WITH stripe_credits AS (
    SELECT 'stripe_credits' AS source, _revenue_amount(description, NULL, NULL, NULL) AS amount_usd
    FROM credit_transactions
    WHERE type = 'purchase' AND stripe_payment_intent_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  stripe_subs AS (
    SELECT 'stripe_subscription' AS source,
      CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END AS amount_usd
    FROM subscription_events
    WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  iap AS (
    SELECT
      CASE WHEN platform = 'apple' THEN 'apple_iap' ELSE 'google_iap' END AS source,
      CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END AS amount_usd
    FROM iap_transactions WHERE status='active' AND environment='production'
      AND created_at >= p_from AND created_at <= p_to
  ),
  all_rows AS (
    SELECT * FROM stripe_credits UNION ALL SELECT * FROM stripe_subs UNION ALL SELECT * FROM iap
  ),
  grouped AS (
    SELECT source, sum(amount_usd) AS revenue, count(*) AS n
    FROM all_rows GROUP BY source
  ),
  filled AS (
    SELECT s AS source,
      coalesce(g.revenue, 0) AS revenue,
      coalesce(g.n, 0) AS count
    FROM (VALUES ('stripe_credits'),('stripe_subscription'),('apple_iap'),('google_iap')) AS srcs(s)
    LEFT JOIN grouped g ON g.source = srcs.s
  )
  SELECT jsonb_agg(jsonb_build_object(
    'source', source,
    'revenue', round(revenue * 100) / 100,
    'count', count
  ))
  INTO v_source FROM filled;

  -- Platform breakdown — derived from source (web = stripe; ios = apple; android = google)
  WITH plats AS (
    SELECT 'web' AS platform,
      (SELECT sum(_revenue_amount(description, NULL, NULL, NULL)) FROM credit_transactions
        WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
          AND created_at >= p_from AND created_at <= p_to) +
      coalesce((SELECT sum(CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END)
                FROM subscription_events
                WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
                  AND created_at >= p_from AND created_at <= p_to), 0) AS revenue,
      (SELECT count(*) FROM credit_transactions
         WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
           AND created_at >= p_from AND created_at <= p_to)
      + (SELECT count(*) FROM subscription_events
         WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
           AND created_at >= p_from AND created_at <= p_to) AS count
    UNION ALL
    SELECT 'ios',
      coalesce((SELECT sum(CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0 ELSE 0 END)
        FROM iap_transactions WHERE status='active' AND environment='production' AND platform='apple'
          AND created_at >= p_from AND created_at <= p_to), 0),
      coalesce((SELECT count(*) FROM iap_transactions WHERE status='active' AND environment='production' AND platform='apple'
          AND created_at >= p_from AND created_at <= p_to), 0)
    UNION ALL
    SELECT 'android',
      coalesce((SELECT sum(CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0 ELSE 0 END)
        FROM iap_transactions WHERE status='active' AND environment='production' AND platform='google'
          AND created_at >= p_from AND created_at <= p_to), 0),
      coalesce((SELECT count(*) FROM iap_transactions WHERE status='active' AND environment='production' AND platform='google'
          AND created_at >= p_from AND created_at <= p_to), 0)
  )
  SELECT jsonb_agg(jsonb_build_object(
    'platform', platform, 'revenue', round(revenue * 100) / 100, 'count', count
  )) INTO v_platform FROM plats;

  -- Product breakdown
  WITH stripe_credits AS (
    SELECT
      CASE
        WHEN lower(coalesce(description,'')) LIKE '%basic%'   THEN 'Stripe Basic'
        WHEN lower(coalesce(description,'')) LIKE '%elite%'   THEN 'Stripe Elite'
        WHEN lower(coalesce(description,'')) LIKE '%pro%'     THEN 'Stripe Pro'
        WHEN lower(coalesce(description,'')) LIKE '%vip%'     THEN 'Stripe Vip'
        WHEN lower(coalesce(description,'')) LIKE '%founder%' THEN 'Stripe Founders'
        ELSE 'Stripe credit pack' END AS product,
      _revenue_amount(description, NULL, NULL, NULL) AS amount
    FROM credit_transactions
    WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  stripe_subs AS (
    SELECT CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 'Card Lovers Annual' ELSE 'Card Lovers Monthly' END,
      CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END
    FROM subscription_events WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
  ),
  iap AS (
    SELECT product_id,
      CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0
        ELSE 0 END
    FROM iap_transactions WHERE status='active' AND environment='production'
      AND created_at >= p_from AND created_at <= p_to
  ),
  all_p AS (
    SELECT * FROM stripe_credits UNION ALL SELECT * FROM stripe_subs UNION ALL SELECT * FROM iap
  ),
  grouped AS (
    SELECT product, sum(amount) AS revenue, count(*) AS count
    FROM all_p GROUP BY product
  )
  SELECT jsonb_agg(jsonb_build_object(
    'product', product, 'revenue', round(revenue * 100) / 100, 'count', count
  ) ORDER BY revenue DESC) INTO v_product FROM grouped;

  -- Daily trend stacked by source
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', p_to at time zone 'UTC'),
      interval '1 day'
    )::date AS day
  ),
  bucketed AS (
    SELECT
      d.day,
      coalesce((SELECT sum(_revenue_amount(description, NULL, NULL, NULL)) FROM credit_transactions
        WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
          AND date_trunc('day', created_at)::date = d.day), 0) AS stripe_credits,
      coalesce((SELECT sum(CASE WHEN lower(coalesce(plan,'')) = 'annual' THEN 449.0 ELSE 49.99 END)
                FROM subscription_events
                WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
                  AND date_trunc('day', created_at)::date = d.day), 0) AS stripe_subscription,
      coalesce((SELECT sum(CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0 ELSE 0 END)
        FROM iap_transactions WHERE status='active' AND environment='production' AND platform='apple'
          AND date_trunc('day', created_at)::date = d.day), 0) AS apple_iap,
      coalesce((SELECT sum(CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id = 'dcm.credits.basic' THEN 2.99
        WHEN product_id = 'dcm.credits.pro'   THEN 9.99
        WHEN product_id = 'dcm.credits.elite' THEN 19.99
        WHEN product_id = 'dcm.credits.vip'   THEN 99.0 ELSE 0 END)
        FROM iap_transactions WHERE status='active' AND environment='production' AND platform='google'
          AND date_trunc('day', created_at)::date = d.day), 0) AS google_iap
    FROM days d
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(day, 'YYYY-MM-DD'),
    'stripe_credits',       round(stripe_credits * 100) / 100,
    'stripe_subscription',  round(stripe_subscription * 100) / 100,
    'apple_iap',            round(apple_iap * 100) / 100,
    'google_iap',           round(google_iap * 100) / 100,
    'total',                round((stripe_credits + stripe_subscription + apple_iap + google_iap) * 100) / 100
  ) ORDER BY day) INTO v_daily FROM bucketed;

  -- Top 10 spenders + emails
  WITH unified AS (
    SELECT user_id, _revenue_amount(description, NULL, NULL, NULL) AS amt
      FROM credit_transactions WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
        AND created_at >= p_from AND created_at <= p_to
    UNION ALL
    SELECT user_id, CASE WHEN lower(coalesce(plan,''))='annual' THEN 449.0 ELSE 49.99 END
      FROM subscription_events WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
        AND created_at >= p_from AND created_at <= p_to
    UNION ALL
    SELECT user_id, CASE
      WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
        THEN (raw_receipt->>'price')::numeric / 1000
      WHEN product_id = 'dcm.credits.basic' THEN 2.99
      WHEN product_id = 'dcm.credits.pro'   THEN 9.99
      WHEN product_id = 'dcm.credits.elite' THEN 19.99
      WHEN product_id = 'dcm.credits.vip'   THEN 99.0 ELSE 0 END
    FROM iap_transactions WHERE status='active' AND environment='production'
      AND created_at >= p_from AND created_at <= p_to
  ),
  per_user AS (
    SELECT user_id, sum(amt) AS revenue, count(*) AS transactions
    FROM unified GROUP BY user_id
    ORDER BY revenue DESC LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', pu.user_id::text,
    'email', coalesce(u.email, substring(pu.user_id::text, 1, 8) || '…'),
    'revenue', round(pu.revenue * 100) / 100,
    'transactions', pu.transactions
  ) ORDER BY pu.revenue DESC)
  INTO v_top
  FROM per_user pu
  LEFT JOIN users u ON u.id = pu.user_id;

  -- Recent 25 transactions
  WITH unified AS (
    SELECT id::text, 'stripe_credits' AS source, 'web' AS platform, user_id,
      _revenue_amount(description, NULL, NULL, NULL) AS amount_usd,
      CASE
        WHEN lower(coalesce(description,'')) LIKE '%basic%'   THEN 'Stripe Basic'
        WHEN lower(coalesce(description,'')) LIKE '%elite%'   THEN 'Stripe Elite'
        WHEN lower(coalesce(description,'')) LIKE '%pro%'     THEN 'Stripe Pro'
        WHEN lower(coalesce(description,'')) LIKE '%vip%'     THEN 'Stripe Vip'
        WHEN lower(coalesce(description,'')) LIKE '%founder%' THEN 'Stripe Founders'
        ELSE 'Stripe credit pack' END AS product,
      created_at
    FROM credit_transactions WHERE type='purchase' AND stripe_payment_intent_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
    UNION ALL
    SELECT id::text, 'stripe_subscription', 'web', user_id,
      CASE WHEN lower(coalesce(plan,''))='annual' THEN 449.0 ELSE 49.99 END,
      CASE WHEN lower(coalesce(plan,''))='annual' THEN 'Card Lovers Annual' ELSE 'Card Lovers Monthly' END,
      created_at
    FROM subscription_events WHERE event_type IN ('subscribed','renewed') AND stripe_subscription_id IS NOT NULL
      AND created_at >= p_from AND created_at <= p_to
    UNION ALL
    SELECT id::text,
      CASE WHEN platform='apple' THEN 'apple_iap' ELSE 'google_iap' END,
      CASE WHEN platform='apple' THEN 'ios' ELSE 'android' END,
      user_id,
      CASE
        WHEN raw_receipt ? 'price' AND jsonb_typeof(raw_receipt->'price') = 'number'
          THEN (raw_receipt->>'price')::numeric / 1000
        WHEN product_id='dcm.credits.basic' THEN 2.99
        WHEN product_id='dcm.credits.pro'   THEN 9.99
        WHEN product_id='dcm.credits.elite' THEN 19.99
        WHEN product_id='dcm.credits.vip'   THEN 99.0 ELSE 0 END,
      product_id, created_at
    FROM iap_transactions WHERE status='active' AND environment='production'
      AND created_at >= p_from AND created_at <= p_to
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', un.id,
    'source', un.source,
    'platform', un.platform,
    'user_id', un.user_id::text,
    'email', coalesce(u.email, substring(un.user_id::text, 1, 8) || '…'),
    'product', un.product,
    'amount_usd', round(un.amount_usd * 100) / 100,
    'created_at', un.created_at
  ) ORDER BY un.created_at DESC)
  INTO v_recent
  FROM (SELECT * FROM unified ORDER BY created_at DESC LIMIT 25) un
  LEFT JOIN users u ON u.id = un.user_id;

  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'headline', v_headline,
    'source_breakdown', coalesce(v_source, '[]'::jsonb),
    'platform_breakdown', coalesce(v_platform, '[]'::jsonb),
    'product_breakdown', coalesce(v_product, '[]'::jsonb),
    'daily_trend', coalesce(v_daily, '[]'::jsonb),
    'top_spenders', coalesce(v_top, '[]'::jsonb),
    'recent_transactions', coalesce(v_recent, '[]'::jsonb),
    'note', 'Stripe credit-pack dollar values are derived from description text → tier mapping. IAP dollar values come from raw_receipt.price (cents) with a product-id fallback table.'
  );
END;
$$;

-- ============================================================================
-- 6. get_costs_summary(month)  — selected month plus 12-month trend
-- ============================================================================
-- p_month is a date in the YYYY-MM-01 form. The function computes the
-- selected month + the 11 previous months in one shot.
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
BEGIN
  -- Per-month breakdown for the 12-month window ending at p_month
  WITH months AS (
    SELECT generate_series(
      (date_trunc('month', p_month::timestamp) - interval '11 months')::date,
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
  -- Stripe credits revenue
  stripe_credits AS (
    SELECT md.label,
      coalesce(sum(_revenue_amount(ct.description, NULL, NULL, NULL)), 0) AS revenue,
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
  apple_rev AS (
    SELECT md.label,
      coalesce(sum(CASE
        WHEN it.raw_receipt ? 'price' AND jsonb_typeof(it.raw_receipt->'price') = 'number'
          THEN (it.raw_receipt->>'price')::numeric / 100
        WHEN it.product_id='dcm.credits.basic' THEN 2.99
        WHEN it.product_id='dcm.credits.pro'   THEN 9.99
        WHEN it.product_id='dcm.credits.elite' THEN 19.99
        WHEN it.product_id='dcm.credits.vip'   THEN 99.0 ELSE 0 END), 0) AS revenue
    FROM month_data md
    LEFT JOIN iap_transactions it
      ON it.status='active' AND it.environment='production' AND it.platform='apple'
     AND it.created_at >= md.start_ts AND it.created_at < md.end_ts
    GROUP BY md.label
  ),
  google_rev AS (
    SELECT md.label,
      coalesce(sum(CASE
        WHEN it.raw_receipt ? 'price' AND jsonb_typeof(it.raw_receipt->'price') = 'number'
          THEN (it.raw_receipt->>'price')::numeric / 100
        WHEN it.product_id='dcm.credits.basic' THEN 2.99
        WHEN it.product_id='dcm.credits.pro'   THEN 9.99
        WHEN it.product_id='dcm.credits.elite' THEN 19.99
        WHEN it.product_id='dcm.credits.vip'   THEN 99.0 ELSE 0 END), 0) AS revenue
    FROM month_data md
    LEFT JOIN iap_transactions it
      ON it.status='active' AND it.environment='production' AND it.platform='google'
     AND it.created_at >= md.start_ts AND it.created_at < md.end_ts
    GROUP BY md.label
  ),
  -- OpenAI actuals
  oai_actuals AS (
    SELECT md.label, coalesce(sum(oc.cost_usd), 0) AS cost, count(oc.id) AS row_count
    FROM month_data md
    LEFT JOIN openai_daily_costs oc
      ON oc.date >= md.start_ts::date AND oc.date < md.end_ts::date
    GROUP BY md.label
  ),
  -- Stripe fees actuals
  stripe_fees_actuals AS (
    SELECT md.label, coalesce(sum(sf.fee_usd), 0) AS fee, count(sf.id) AS row_count
    FROM month_data md
    LEFT JOIN stripe_daily_fees sf
      ON sf.date >= md.start_ts::date AND sf.date < md.end_ts::date
    GROUP BY md.label
  ),
  -- Card count in month
  card_counts AS (
    SELECT md.label, count(c.id) AS card_count
    FROM month_data md
    LEFT JOIN cards c
      ON c.conversational_decimal_grade IS NOT NULL
     AND c.created_at >= md.start_ts AND c.created_at < md.end_ts
    GROUP BY md.label
  ),
  -- Active fixed costs each month
  fixed_costs AS (
    SELECT md.label, coalesce(sum(mc.amount_usd), 0) AS total
    FROM month_data md
    LEFT JOIN monthly_costs mc
      ON mc.effective_from <= (md.end_ts - interval '1 day')::date
     AND (mc.effective_to IS NULL OR mc.effective_to >= md.start_ts::date)
    GROUP BY md.label
  ),
  combined AS (
    SELECT
      md.label AS month,
      coalesce(sc.revenue, 0) AS revenue_stripe_credits,
      coalesce(ss.revenue, 0) AS revenue_stripe_subscription,
      coalesce(ar.revenue, 0) AS revenue_apple_iap,
      coalesce(gr.revenue, 0) AS revenue_google_iap,
      coalesce(sc.count, 0) + coalesce(ss.count, 0) AS stripe_txn_count,
      coalesce(oa.cost, 0) AS oai_cost,
      oa.row_count AS oai_row_count,
      coalesce(sfa.fee, 0) AS sf_fee,
      sfa.row_count AS sf_row_count,
      coalesce(cc.card_count, 0) AS card_count,
      coalesce(fc.total, 0) AS fixed_total
    FROM month_data md
    LEFT JOIN stripe_credits sc       ON sc.label = md.label
    LEFT JOIN stripe_subs ss          ON ss.label = md.label
    LEFT JOIN apple_rev ar            ON ar.label = md.label
    LEFT JOIN google_rev gr           ON gr.label = md.label
    LEFT JOIN oai_actuals oa          ON oa.label = md.label
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
      -- OpenAI: actual if any rows in month, else estimate (0 here — we
      -- rely on the cron to populate, the previous JS estimate is removed)
      oai_cost AS openai_cost,
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

  -- Fixed costs grouped by category (rows active in the selected month)
  WITH active_fixed AS (
    SELECT *
    FROM monthly_costs
    WHERE effective_from <= (p_month + interval '1 month - 1 day')::date
      AND (effective_to IS NULL OR effective_to >= p_month)
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
    WHERE effective_from <= (p_month + interval '1 month - 1 day')::date
      AND (effective_to IS NULL OR effective_to >= p_month)
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
-- Grants — service role is implicit via SECURITY DEFINER, but be explicit
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_analytics(timestamptz, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grading_analytics(timestamptz, timestamptz)    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_card_analytics(timestamptz, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.get_conversion_analytics(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_analytics(timestamptz, timestamptz)    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_costs_summary(date)                            TO service_role;
