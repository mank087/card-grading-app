-- Migration: Add conversational_corners_edges_surface column to cards table
-- Date: 2025-10-27
-- Purpose: Store detailed corners/edges/surface analysis from conversational AI v3.5 PATCHED v5

-- Add the column (stores JSON object with all corner/edge/surface details)
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS conversational_corners_edges_surface JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN cards.conversational_corners_edges_surface IS 'Detailed corners/edges/surface analysis from conversational AI v3.5: {front_corners, back_corners, front_edges, back_edges, front_surface, back_surface}';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_corners_edges_surface
ON cards USING GIN (conversational_corners_edges_surface);
