-- Add username and display_name columns to profiles table for shared collections
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Case-insensitive unique index for username lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON profiles (LOWER(username));

-- Constraint: 3-30 chars, lowercase alphanumeric + hyphens (no leading/trailing hyphens)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
