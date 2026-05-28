-- =====================================================
-- DCM Grading - Bump Signup Bonus from 1 to 2 Free Credits
-- Run this in Supabase SQL Editor
--
-- Context: Conversion improvement (2026-05-28). A single free
-- credit gives a user no comparison point — if they don't love
-- their first grade, they bounce. Bumping to 2 lets new users
-- try a known card AND a wildcard before deciding to buy.
-- =====================================================

-- Replace the auth.users INSERT trigger function to grant 2 credits
-- (the original lived in database/create_credits_tables.sql and migrations/add_signup_bonus.sql)
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
DECLARE
  new_credit_id UUID;
BEGIN
  -- Insert user credits record with 2 free signup credits
  INSERT INTO public.user_credits (user_id, balance, total_purchased, total_used, signup_bonus_claimed)
  VALUES (NEW.id, 2, 0, 0, TRUE)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO new_credit_id;

  -- If we successfully created the record (not a conflict), create the transaction
  IF new_credit_id IS NOT NULL THEN
    INSERT INTO public.credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      metadata
    ) VALUES (
      NEW.id,
      'bonus',
      2,
      2,
      'Welcome bonus - 2 free credits for signing up',
      '{"bonus_type": "signup"}'::jsonb
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't block user creation
  RAISE WARNING 'initialize_user_credits failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it points at the new function definition
DROP TRIGGER IF EXISTS trigger_initialize_user_credits ON auth.users;
CREATE TRIGGER trigger_initialize_user_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

-- Update the column default so any direct INSERTs that omit balance
-- also get the new amount.
ALTER TABLE user_credits
  ALTER COLUMN balance SET DEFAULT 2;

-- =====================================================
-- Verification
-- =====================================================
-- Confirm function body now references the value 2:
-- SELECT prosrc FROM pg_proc WHERE proname = 'initialize_user_credits';

-- Confirm column default updated:
-- SELECT column_name, column_default FROM information_schema.columns
-- WHERE table_name = 'user_credits' AND column_name = 'balance';

-- Existing users are NOT backfilled. They already redeemed their welcome
-- credit; granting more retroactively would inflate the bonus pool with
-- no behavior change. New signups after this migration runs will get 2.
