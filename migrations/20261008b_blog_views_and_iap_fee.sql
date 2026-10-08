-- Migration: true blog view counts + 15% IAP store fee
-- Date: 2026-10-08
--
-- Apply AFTER migrations/20261008_fix_admin_analytics_accuracy.sql: the
-- get_costs_summary body below calls the helpers that file creates
-- (_iap_amount_usd, _dcm_revenue_rows, ...).
--
-- 1. increment_blog_view(slug): atomic +1 on blog_posts.view_count for a
--    published, already-live post. Called by POST /api/blog/view (service
--    role) once per browser session per post. Replaces the read-modify-write
--    increment that ran inside the blog page's ISR render (counted
--    regenerations, not readers, and lost concurrent updates).
--
-- 2. get_costs_summary(month): identical to the 20261008 definition (section
--    6) except v_iap_fee_rate 0.30 -> 0.15. DCM is in the Apple App Store
--    Small Business Program (and Google Play's 15% tier), so the store fee is
--    15%, not 30%.

-- ============================================================================
-- 1. increment_blog_view(p_slug)
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_blog_view(p_slug text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = p_slug AND status = 'published' AND published_at <= now(); $$;

REVOKE ALL ON FUNCTION public.increment_blog_view(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_blog_view(text) TO service_role;

-- ============================================================================
-- 2. get_costs_summary(month)  — IAP fee rate 15% (Small Business Program)
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
  v_iap_fee_rate numeric := 0.15;
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

REVOKE ALL ON FUNCTION public.get_costs_summary(date)                            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_costs_summary(date)                            TO service_role;
