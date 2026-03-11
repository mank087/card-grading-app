-- VIP Package Migration
-- Created: 2026-02-09
-- Description: Add VIP fields to user_credits table for the VIP Package feature
--              VIP is a one-time purchase ($99) that gives 150 credits and VIP emblem

-- Add VIP fields to user_credits table
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS show_vip_badge BOOLEAN DEFAULT TRUE;

-- Update the preferred_label_emblem comment to include VIP
-- The column now supports comma-separated values for multiple emblems (max 2)
-- Values: 'founder', 'card_lover', 'vip', 'none', 'auto', or comma-separated like 'founder,vip'
COMMENT ON COLUMN user_credits.is_vip IS 'Whether user has purchased VIP package';
COMMENT ON COLUMN user_credits.show_vip_badge IS 'Whether to show VIP badge on labels';
COMMENT ON COLUMN user_credits.preferred_label_emblem IS 'User preference for label emblems. Supports: founder, card_lover, vip, none, auto, or comma-separated values for multiple emblems (max 2)';
