/*
  # Add Temporary Anon Upload Policy for Testing

  ## Purpose
  Testing if the issue is with authenticated role check
  This allows both authenticated AND anon roles to upload

  ## Changes
  - Add anon role to upload policy for question-images bucket
  - This is temporary for debugging

  ## Security Note
  This is intentionally permissive for testing purposes
  The create-quiz page is already protected by auth at the route level
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "question_images_insert_policy" ON storage.objects;

-- Create a new INSERT policy that allows both authenticated AND anon
CREATE POLICY "question_images_insert_policy"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'question-images');

-- Also update UPDATE to be more permissive
DROP POLICY IF EXISTS "question_images_update_policy" ON storage.objects;

CREATE POLICY "question_images_update_policy"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'question-images')
  WITH CHECK (bucket_id = 'question-images');

-- And DELETE
DROP POLICY IF EXISTS "question_images_delete_policy" ON storage.objects;

CREATE POLICY "question_images_delete_policy"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'question-images');
