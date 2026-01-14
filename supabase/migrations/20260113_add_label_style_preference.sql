-- Add label_style preference to user_credits table
-- Default to 'modern' for all users (new and existing)

ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS label_style VARCHAR(20) DEFAULT 'modern';

-- Update any NULL values to 'modern'
UPDATE user_credits SET label_style = 'modern' WHERE label_style IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_credits.label_style IS 'User preference for card label style: modern or traditional';
