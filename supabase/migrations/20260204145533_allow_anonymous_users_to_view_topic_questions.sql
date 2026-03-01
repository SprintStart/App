/*
  # Allow Anonymous Users to View Topic Questions

  Students need to access questions when playing quizzes.
  Add RLS policy allowing anonymous users to SELECT questions from approved question sets.
*/

CREATE POLICY "Anonymous users can view questions from approved sets"
  ON topic_questions
  FOR SELECT
  TO anon
  USING (
    question_set_id IN (
      SELECT id FROM question_sets 
      WHERE is_active = true AND approval_status = 'approved'
    )
  );
