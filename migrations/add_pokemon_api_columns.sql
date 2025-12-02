-- Pokemon TCG API Integration Migration
-- Run each statement separately in Supabase SQL Editor if needed

-- Step 1: Add pokemon_api_id column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_id TEXT;

-- Step 2: Add pokemon_api_data column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_data JSONB;

-- Step 3: Add pokemon_api_verified column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_verified BOOLEAN DEFAULT FALSE;

-- Step 4: Add pokemon_api_verified_at column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_verified_at TIMESTAMPTZ;

-- Step 5: Add pokemon_api_confidence column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_confidence TEXT;

-- Step 6: Add pokemon_api_method column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pokemon_api_method TEXT;
