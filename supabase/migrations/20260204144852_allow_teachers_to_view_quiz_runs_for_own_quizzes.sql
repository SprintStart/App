/*
  # Allow Teachers to View Quiz Runs for Their Quizzes

  Teachers need to see analytics for quizzes they created.
  Add RLS policy allowing teachers to SELECT from public_quiz_runs
  for their own question sets.
*/

CREATE POLICY "Teachers can view quiz runs for own quizzes"
  ON public_quiz_runs
  FOR SELECT
  TO authenticated
  USING (
    question_set_id IN (
      SELECT id FROM question_sets WHERE created_by = auth.uid()
    )
  );
