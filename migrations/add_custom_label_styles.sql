-- Add custom_label_styles JSONB column to user_credits
-- Stores up to 4 custom label style configurations
-- Each entry: { id: 'custom-1'..'custom-4', name: string, config: CustomLabelConfig }
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS custom_label_styles JSONB DEFAULT '[]'::jsonb;

-- label_style column already exists and accepts 'modern' | 'traditional'
-- It now also accepts 'custom-1' through 'custom-4'
