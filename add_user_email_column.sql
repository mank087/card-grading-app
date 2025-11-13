-- ========================================
-- Add user_email column to cards table
-- ========================================
-- This migration adds a user_email column to store the email
-- of the user who scanned/uploaded each card
-- Safe to run multiple times
-- ========================================

-- Add user_email column
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Create index on user_email for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_user_email ON cards(user_email);

-- ========================================
-- POPULATE EXISTING RECORDS
-- ========================================
-- Backfill user_email for existing cards by joining with auth.users
UPDATE cards
SET user_email = auth.users.email
FROM auth.users
WHERE cards.user_id = auth.users.id
  AND cards.user_email IS NULL;

-- ========================================
-- CREATE TRIGGER TO AUTO-POPULATE user_email
-- ========================================
-- This function automatically sets user_email when a card is inserted or updated

CREATE OR REPLACE FUNCTION set_user_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- If user_id is set and user_email is not, fetch email from auth.users
    IF NEW.user_id IS NOT NULL AND NEW.user_email IS NULL THEN
        SELECT email INTO NEW.user_email
        FROM auth.users
        WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_user_email ON cards;

-- Create trigger that runs before insert or update
CREATE TRIGGER trigger_set_user_email
    BEFORE INSERT OR UPDATE OF user_id ON cards
    FOR EACH ROW
    EXECUTE FUNCTION set_user_email_from_auth();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON COLUMN cards.user_email IS 'Email of the user who scanned/uploaded this card (auto-populated from auth.users)';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check that column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards' AND column_name = 'user_email';

-- Check how many records have user_email populated
SELECT
    COUNT(*) as total_cards,
    COUNT(user_email) as cards_with_email,
    COUNT(*) - COUNT(user_email) as cards_missing_email
FROM cards;

-- Sample of cards with emails
SELECT id, card_name, user_email, created_at
FROM cards
WHERE user_email IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ user_email column added successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary:';
    RAISE NOTICE '   - user_email column: Created';
    RAISE NOTICE '   - Existing records: Populated from auth.users';
    RAISE NOTICE '   - Trigger: Auto-populates email on new cards';
    RAISE NOTICE '   - Index: Created for performance';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Users will now see "Scanned by: [email]" on card pages';
END $$;
