/*
  # Temporary Debug: Make Storage Fully Permissive

  ## Purpose
  Temporarily make the storage INSERT policy as permissive as possible
  to determine if this is a policy issue or something else

  ## Changes
  - Allow INSERT for PUBLIC (not just authenticated)
  - Remove all checks except bucket_id
  
  ## Note
  This is for debugging only - we'll tighten it back after confirming uploads work
*/

DROP POLICY IF EXISTS "question_images_insert_policy" ON storage.objects;

-- Super permissive policy for debugging
CREATE POLICY "question_images_insert_policy"
  ON storage.objects
  FOR INSERT
  TO public  -- Allow both authenticated and anon
  WITH CHECK (bucket_id = 'question-images');
