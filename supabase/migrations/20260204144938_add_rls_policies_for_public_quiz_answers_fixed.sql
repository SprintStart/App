/*
  # Add RLS Policies for public_quiz_answers

  The table had RLS enabled but no SELECT policies, blocking all reads.
  Add policies to allow:
  1. Teachers to view answers for their quizzes (for analytics)
  2. Users to view their own answers
*/

-- Teachers can view answers for quizzes they created
CREATE POLICY "Teachers can view answers for own quizzes"
  ON public_quiz_answers
  FOR SELECT
  TO authenticated
  USING (
    run_id IN (
      SELECT pqr.id 
      FROM public_quiz_runs pqr
      JOIN question_sets qs ON pqr.question_set_id = qs.id
      WHERE qs.created_by = auth.uid()
    )
  );

-- Users can view their own answers
CREATE POLICY "Users can view own answers"
  ON public_quiz_answers
  FOR SELECT
  TO authenticated
  USING (
    run_id IN (
      SELECT id FROM public_quiz_runs 
      WHERE quiz_session_id IN (
        SELECT id FROM quiz_sessions WHERE user_id = auth.uid()
      )
    )
  );

-- Anonymous users can view their answers
CREATE POLICY "Anonymous users can view own answers"
  ON public_quiz_answers
  FOR SELECT
  TO anon
  USING (
    run_id IN (
      SELECT id FROM public_quiz_runs WHERE quiz_session_id IS NULL
    )
  );
