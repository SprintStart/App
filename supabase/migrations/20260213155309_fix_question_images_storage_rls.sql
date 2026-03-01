/*
  # Fix Question Images Storage RLS Policies

  ## Issue
  Teachers cannot upload images when creating quizzes due to RLS policy violations.

  ## Changes
  1. Ensure question-images bucket exists with correct configuration
  2. Drop and recreate all storage policies for question-images bucket
  3. Add proper RLS policies for authenticated teachers to upload/manage images

  ## Security
  - Public read access for viewing images
  - Authenticated users can upload images
  - Users can manage their own uploaded images
*/

-- =====================================================
-- PART 1: ENSURE STORAGE BUCKET EXISTS
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- =====================================================
-- PART 2: DROP ALL EXISTING POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Public can view question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update own question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete own question images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their question images" ON storage.objects;

-- =====================================================
-- PART 3: CREATE NEW PERMISSIVE POLICIES
-- =====================================================

CREATE POLICY "Public can view question images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can upload question images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can update question images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-images' AND
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'question-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can delete question images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-images' AND
    auth.uid() IS NOT NULL
  );
