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

-- Policy: Public images are viewable by everyone
CREATE POLICY "Public card images are viewable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cards');

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
-- 2. Public card images are viewable (SELECT)
-- 3. Users can delete own card images (DELETE)
-- 4. Users can update own card images (UPDATE)

SELECT '✅ Storage RLS policies updated!' as status;
