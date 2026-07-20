-- =====================================================
-- FIX STORAGE BUCKET RLS FOR POKEMON UPLOADS
-- Date: October 30, 2025
-- Purpose: Fix RLS policies on storage.objects (cards bucket)
-- =====================================================

-- Check current storage policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- Drop existing storage policies for cards bucket
DROP POLICY IF EXISTS "Authenticated users can upload card images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own card images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own card images" ON storage.objects;
DROP POLICY IF EXISTS "Public card images are viewable" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own card images" ON storage.objects;

-- Create new storage policies that work

-- Policy: Authenticated users can upload to their own folder
CREATE POLICY "Authenticated users can upload card images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own card images
CREATE POLICY "Users can update own card images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own card images
CREATE POLICY "Users can delete own card images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own card images.
-- NOTE (2026-07-20): this policy was previously `TO public USING (bucket_id = 'cards')`,
-- which made every card photo world-readable (privacy audit finding C2). The live
-- database is already scoped to owner-only reads; this file must never recreate the
-- public policy. Public card pages get images via server-side signed URLs
-- (service role), so no anon read policy is needed.
CREATE POLICY "Users can view own card images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check the new policies
SELECT
    policyname,
    cmd AS command
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%card%'
ORDER BY policyname;

-- Expected to see:
-- 1. Authenticated users can upload card images (INSERT)
-- 2. Users can view own card images (SELECT — owner-scoped, NOT public)
-- 3. Users can delete own card images (DELETE)
-- 4. Users can update own card images (UPDATE)

SELECT '✅ Storage RLS policies updated!' as status;
