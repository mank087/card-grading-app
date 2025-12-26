-- =====================================================
-- DCM Grading - Add Signup Bonus Credit
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add signup_bonus_claimed column to track signup bonus
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS signup_bonus_claimed BOOLEAN DEFAULT FALSE;

-- Step 2: Update the initialize_user_credits function to give 1 free credit
-- and create a transaction record for audit trail
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER AS $$
DECLARE
  new_credit_id UUID;
BEGIN
  -- Insert user credits record with 1 free signup credit
  INSERT INTO user_credits (user_id, balance, total_purchased, total_used, signup_bonus_claimed)
  VALUES (NEW.id, 1, 0, 0, TRUE)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO new_credit_id;

  -- If we successfully created the record (not a conflict), create the transaction
  IF new_credit_id IS NOT NULL THEN
    INSERT INTO credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      metadata
    ) VALUES (
      NEW.id,
      'bonus',
      1,
      1,
      'Welcome bonus - 1 free credit for signing up',
      '{"bonus_type": "signup"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the trigger (in case function signature changed)
DROP TRIGGER IF EXISTS trigger_initialize_user_credits ON auth.users;
CREATE TRIGGER trigger_initialize_user_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_credits();

-- =====================================================
-- OPTIONAL: Backfill existing users who never purchased
-- This gives 1 free credit to existing users with 0 balance
-- who have never made a transaction
-- Uncomment and run separately if desired
-- =====================================================

-- UPDATE user_credits uc
-- SET
--   balance = 1,
--   signup_bonus_claimed = TRUE
-- WHERE uc.balance = 0
--   AND uc.signup_bonus_claimed = FALSE
--   AND NOT EXISTS (
--     SELECT 1 FROM credit_transactions ct
--     WHERE ct.user_id = uc.user_id
--   );

-- -- Create transaction records for backfilled users
-- INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
-- SELECT
--   uc.user_id,
--   'bonus',
--   1,
--   1,
--   'Welcome bonus - 1 free credit (backfill)',
--   '{"bonus_type": "signup_backfill"}'::jsonb
-- FROM user_credits uc
-- WHERE uc.signup_bonus_claimed = TRUE
--   AND uc.balance = 1
--   AND NOT EXISTS (
--     SELECT 1 FROM credit_transactions ct
--     WHERE ct.user_id = uc.user_id
--       AND ct.description LIKE 'Welcome bonus%'
--   );

-- =====================================================
-- Verification queries
-- =====================================================
-- Check the function was updated:
-- SELECT prosrc FROM pg_proc WHERE proname = 'initialize_user_credits';

-- Check column exists:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_credits' AND column_name = 'signup_bonus_claimed';

-- Check recent signups got the bonus:
-- SELECT uc.user_id, uc.balance, uc.signup_bonus_claimed, ct.description
-- FROM user_credits uc
-- LEFT JOIN credit_transactions ct ON ct.user_id = uc.user_id AND ct.type = 'bonus'
-- ORDER BY uc.created_at DESC
-- LIMIT 10;
