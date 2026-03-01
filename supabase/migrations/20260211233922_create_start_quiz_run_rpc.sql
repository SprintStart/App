/*
  # Create start_quiz_run RPC Function

  ## Purpose
  Handles quiz run creation with proper questions_data population
  Replaces direct client-side inserts to public_quiz_runs table

  ## Function Signature
  start_quiz_run(p_question_set_id uuid, p_session_id text)

  ## Returns
  JSON object with:
  - run_id: uuid
  - questions_data: jsonb array of questions
  - question_count: integer

  ## Security
  - SECURITY DEFINER to bypass RLS
  - Validates question set exists and is published
  - Grants execute to anon and authenticated users
*/

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.start_quiz_run(
  p_question_set_id uuid,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_set record;
  v_questions jsonb;
  v_run_id uuid;
BEGIN
  -- 1. Validate question set exists and is approved
  SELECT id, topic_id, approval_status, is_active
  INTO v_question_set
  FROM question_sets
  WHERE id = p_question_set_id
    AND approval_status = 'approved'
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question set not found or not approved';
  END IF;

  -- 2. Fetch questions in correct order and build JSONB payload
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', tq.id,
      'question_text', tq.question_text,
      'options', tq.options,
      'correct_index', tq.correct_index,
      'image_url', tq.image_url,
      'explanation', tq.explanation
    ) ORDER BY tq.order_index
  )
  INTO v_questions
  FROM topic_questions tq
  WHERE tq.question_set_id = p_question_set_id
    AND tq.is_published = true;

  -- Check if questions exist
  IF v_questions IS NULL OR jsonb_array_length(v_questions) = 0 THEN
    RAISE EXCEPTION 'No published questions found for this quiz';
  END IF;

  -- 3. Create quiz run with all required fields
  INSERT INTO public_quiz_runs (
    session_id,
    question_set_id,
    topic_id,
    status,
    score,
    questions_data,
    current_question_index,
    attempts_used,
    started_at
  ) VALUES (
    p_session_id,
    p_question_set_id,
    v_question_set.topic_id,
    'in_progress',
    0,
    v_questions,
    0,
    '{}'::jsonb,
    now()
  )
  RETURNING id INTO v_run_id;

  -- 4. Return run_id and questions_data
  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'questions_data', v_questions,
    'question_count', jsonb_array_length(v_questions)
  );
END;
$$;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.start_quiz_run(uuid, text) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.start_quiz_run(uuid, text) IS 
'Creates a quiz run with properly populated questions_data. Used by QuizPlay component to start quiz gameplay.';
