-- Migration: Move vector extension from public to extensions schema
-- Date: January 23, 2026
-- Purpose: Fix Supabase linter warning about extension in public schema

-- ============================================================================
-- 1. CREATE EXTENSIONS SCHEMA (if not exists)
-- ============================================================================
-- Supabase recommends putting extensions in a dedicated schema

CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to relevant roles so the extension functions are accessible
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- 2. MOVE VECTOR EXTENSION TO EXTENSIONS SCHEMA
-- ============================================================================
-- This moves all vector extension objects (types, functions, operators)
-- from public to extensions schema

ALTER EXTENSION vector SET SCHEMA extensions;

-- ============================================================================
-- 3. UPDATE DATABASE SEARCH PATH
-- ============================================================================
-- Add extensions schema to the search path so vector types/functions
-- can be used without schema qualification

-- Update the database default search_path to include extensions
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Also set it for the current session
SET search_path TO public, extensions;

-- ============================================================================
-- 4. GRANT PERMISSIONS ON EXTENSION OBJECTS
-- ============================================================================
-- Ensure all roles can use the vector extension

GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration worked:

-- Check extension is now in extensions schema:
-- SELECT extname, extnamespace::regnamespace as schema
-- FROM pg_extension
-- WHERE extname = 'vector';

-- Check search_path includes extensions:
-- SHOW search_path;

-- Test that vector operations still work:
-- SELECT '[1,2,3]'::vector;
