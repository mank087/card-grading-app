-- Export Users for Email Marketing (EmailOctopus format)
-- Run in Supabase SQL Editor
-- Matches the EmailOctopus import format with all required fields

SELECT
  u.id AS "Identifier",
  u.email AS "Email address",
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    SPLIT_PART(COALESCE(u.raw_user_meta_data->>'name', ''), ' ', 1),
    ''
  ) AS "First name",
  COALESCE(
    CASE
      WHEN u.raw_user_meta_data->>'full_name' IS NOT NULL
           AND POSITION(' ' IN u.raw_user_meta_data->>'full_name') > 0
        THEN SUBSTRING(u.raw_user_meta_data->>'full_name' FROM POSITION(' ' IN u.raw_user_meta_data->>'full_name') + 1)
      WHEN u.raw_user_meta_data->>'name' IS NOT NULL
           AND POSITION(' ' IN u.raw_user_meta_data->>'name') > 0
        THEN SUBSTRING(u.raw_user_meta_data->>'name' FROM POSITION(' ' IN u.raw_user_meta_data->>'name') + 1)
      ELSE ''
    END,
    ''
  ) AS "Last name",
  CASE
    WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 'purchased_credits'
    WHEN COALESCE(uc.total_used, 0) > 0 THEN 'only_used_free_credit'
    WHEN COALESCE(uc.balance, 0) > 0 THEN 'didnt_use_free_credit_yet'
    ELSE 'didnt_use_free_credit_yet'
  END AS "User Status",
  CASE
    WHEN uc.is_founder = true AND uc.is_vip = true THEN 'TRUE (Founder + VIP)'
    WHEN uc.is_founder = true THEN 'TRUE (Founder)'
    WHEN uc.is_vip = true THEN 'TRUE (VIP)'
    ELSE 'FALSE'
  END AS "Founder/VIP Status",
  COALESCE(uc.total_purchased, 0) AS "Credits Purchased",
  COALESCE(uc.total_used, 0) AS "Credits Used",
  COALESCE(uc.balance, 0) AS "Credits Balance",
  CASE WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 'Yes' ELSE 'No' END AS "Paying Customer",
  '' AS "Tags"
FROM auth.users u
LEFT JOIN user_credits uc ON uc.user_id = u.id
ORDER BY
  CASE
    WHEN COALESCE(uc.total_purchased, 0) > 0 THEN 0
    WHEN COALESCE(uc.total_used, 0) > 0 THEN 1
    WHEN COALESCE(uc.balance, 0) > 0 THEN 2
    ELSE 3
  END,
  COALESCE(uc.total_purchased, 0) DESC,
  u.created_at DESC;
