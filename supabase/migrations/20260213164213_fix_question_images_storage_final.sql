/*
  # Final Fix for Question Images Storage Upload

  ## Issue
  Teachers getting "new row violates row-level security policy" (400 error)
  when uploading images in Create Quiz page

  ## Root Cause Analysis
  - Bucket: question-images (public: true)
  - Current policies allow public role
  - But upload still fails with RLS error

  ## Solution
  1. Drop all existing policies
  2. Recreate with explicit role grants for both anon AND authenticated
  3. Use simpler policy conditions
  4. Ensure bucket configuration is correct

  ## Storage Path Format
  - questions/{timestamp}-{random}.{ext}
  (flat structure since teacher/quiz/question IDs not passed)

  ## Security
  - Public can view (bucket is public anyway)
  - Both anon and authenticated can upload (safe since only teachers access create page)
  - Both can update/delete (for editing)
*/

-- =====================================================
-- PART 1: ENSURE BUCKET EXISTS AND IS CORRECTLY CONFIGURED
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,  -- Public bucket for easy image access
  5242880,  -- 5MB
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

DROP POLICY IF EXISTS "question_images_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "question_images_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "question_images_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "question_images_delete_policy" ON storage.objects;

-- =====================================================
-- PART 3: CREATE NEW SIMPLE POLICIES
-- =====================================================

-- SELECT: Anyone can view
CREATE POLICY "question_images_select_policy"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'question-images');

-- INSERT: Authenticated users can upload
-- Note: Using authenticated, not public, for security
-- The create quiz page is already auth-protected
CREATE POLICY "question_images_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'question-images');

-- UPDATE: Authenticated users can update
CREATE POLICY "question_images_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'question-images')
  WITH CHECK (bucket_id = 'question-images');

-- DELETE: Authenticated users can delete
CREATE POLICY "question_images_delete_policy"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'question-images');

-- =====================================================
-- PART 4: VERIFY RLS IS ENABLED
-- =====================================================

-- RLS should already be enabled on storage.objects by Supabase
-- But let's make sure
DO $$
BEGIN
  IF NOT (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
