-- Email Marketing User List Query
-- Generates a user list with credit statistics and segmentation for email marketing
-- Run this query in Supabase SQL Editor

SELECT
    -- Email address from auth.users
    u.email,

    -- Credit statistics
    COALESCE(uc.total_purchased, 0) AS total_credits_purchased,
    COALESCE(uc.total_used, 0) AS total_credits_used,
    COALESCE(uc.balance, 0) AS current_credit_balance,

    -- Founder status
    COALESCE(uc.is_founder, false) AS is_founder,

    -- User status segmentation
    CASE
        -- Purchased credits (paying customer)
        WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 'purchased_credits'
        -- Used free credit but never purchased
        WHEN COALESCE(uc.total_used, 0) > 0 AND COALESCE(uc.total_purchased, 0) = 0 THEN 'only_used_free_credit'
        -- Has not used any credits yet (including free credit)
        ELSE 'didnt_use_free_credit_yet'
    END AS user_status,

    -- Additional useful fields for segmentation
    u.created_at AS account_created_at,
    uc.founder_purchased_at,
    uc.first_purchase_bonus_claimed,
    uc.signup_bonus_claimed

FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id

-- Optional: Filter to only include users with email confirmed
-- WHERE u.email_confirmed_at IS NOT NULL

ORDER BY u.created_at DESC;


-- ============================================================================
-- ALTERNATIVE: Separate queries for each segment
-- ============================================================================

-- Query 1: Users who purchased credits (paying customers)
/*
SELECT
    u.email,
    uc.total_purchased,
    uc.total_used,
    uc.balance,
    uc.is_founder
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.total_purchased > 0
ORDER BY uc.total_purchased DESC;
*/

-- Query 2: Users who only used free credit (never purchased)
/*
SELECT
    u.email,
    uc.total_used,
    uc.balance,
    u.created_at
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.total_used > 0 AND uc.total_purchased = 0
ORDER BY u.created_at DESC;
*/

-- Query 3: Users who haven't used their free credit yet
/*
SELECT
    u.email,
    uc.balance,
    u.created_at
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE COALESCE(uc.total_used, 0) = 0
ORDER BY u.created_at DESC;
*/


-- ============================================================================
-- SUMMARY STATS: Get counts for each segment
-- ============================================================================

/*
SELECT
    CASE
        WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 'purchased_credits'
        WHEN COALESCE(uc.total_used, 0) > 0 AND COALESCE(uc.total_purchased, 0) = 0 THEN 'only_used_free_credit'
        ELSE 'didnt_use_free_credit_yet'
    END AS user_status,
    COUNT(*) AS user_count,
    SUM(COALESCE(uc.total_purchased, 0)) AS total_credits_purchased,
    SUM(COALESCE(uc.total_used, 0)) AS total_credits_used
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
GROUP BY
    CASE
        WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 'purchased_credits'
        WHEN COALESCE(uc.total_used, 0) > 0 AND COALESCE(uc.total_purchased, 0) = 0 THEN 'only_used_free_credit'
        ELSE 'didnt_use_free_credit_yet'
    END
ORDER BY user_count DESC;
*/


-- ============================================================================
-- FOUNDERS ONLY: Get list of all founders
-- ============================================================================

/*
SELECT
    u.email,
    uc.total_purchased,
    uc.total_used,
    uc.balance,
    uc.founder_purchased_at,
    uc.show_founder_badge
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.is_founder = true
ORDER BY uc.founder_purchased_at DESC;
*/
