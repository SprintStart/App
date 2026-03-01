/*
  # Allow Anonymous Users to View Published Question Sets

  Students need to access approved question sets when playing quizzes.
  Add RLS policy allowing anonymous users to SELECT approved question sets.
*/

CREATE POLICY "Anonymous users can view approved question sets"
  ON question_sets
  FOR SELECT
  TO anon
  USING (is_active = true AND approval_status = 'approved');
