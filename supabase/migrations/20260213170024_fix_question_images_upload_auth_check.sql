/*
  # Fix Question Images Upload - Add Explicit Auth Check

  ## Issue
  Teachers still getting "new row violates row-level security policy" when uploading images
  
  ## Root Cause
  The current policy only checks bucket_id, but doesn't verify the user is actually authenticated
  Supabase may require explicit auth check in the WITH CHECK clause

  ## Solution
  Add explicit auth.uid() IS NOT NULL check to ensure user is authenticated
  This makes the policy more explicit about authentication requirements

  ## Changes
  - Update INSERT policy with auth check
  - Keep policy simple but explicit
*/

-- Drop and recreate the INSERT policy with explicit auth check
DROP POLICY IF EXISTS "question_images_insert_policy" ON storage.objects;

CREATE POLICY "question_images_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images' 
    AND auth.uid() IS NOT NULL
  );
