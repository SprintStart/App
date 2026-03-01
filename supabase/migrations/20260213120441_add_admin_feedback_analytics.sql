/*
  # Admin Feedback Analytics

  ## Purpose
  Provide admin dashboard with comprehensive quiz feedback analytics.

  ## Functions

  1. get_admin_feedback_overview()
     - Total feedback count
     - Likes vs dislikes ratio
     - Most common feedback reasons
     - Recent feedback comments

  2. get_quizzes_by_feedback()
     - Quizzes ranked by feedback (best/worst)
     - Includes feedback details and reasons
*/

-- Function: Get admin feedback overview
CREATE OR REPLACE FUNCTION get_admin_feedback_overview()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_total_feedback bigint;
  v_total_likes bigint;
  v_total_dislikes bigint;
  v_feedback_this_month bigint;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Get total feedback
  SELECT COUNT(*) INTO v_total_feedback
  FROM quiz_feedback;

  -- Get likes
  SELECT COUNT(*) INTO v_total_likes
  FROM quiz_feedback
  WHERE rating = 1;

  -- Get dislikes
  SELECT COUNT(*) INTO v_total_dislikes
  FROM quiz_feedback
  WHERE rating = -1;

  -- Get feedback this month
  SELECT COUNT(*) INTO v_feedback_this_month
  FROM quiz_feedback
  WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE);

  -- Build result with reason breakdown
  v_result := jsonb_build_object(
    'total_feedback', COALESCE(v_total_feedback, 0),
    'total_likes', COALESCE(v_total_likes, 0),
    'total_dislikes', COALESCE(v_total_dislikes, 0),
    'feedback_this_month', COALESCE(v_feedback_this_month, 0),
    'like_ratio', CASE
      WHEN v_total_feedback > 0 THEN
        ROUND((v_total_likes::numeric / v_total_feedback) * 100, 1)
      ELSE 0
    END,
    'reasons', (
      SELECT jsonb_build_object(
        'too_hard', COUNT(*) FILTER (WHERE reason = 'too_hard'),
        'too_easy', COUNT(*) FILTER (WHERE reason = 'too_easy'),
        'unclear_questions', COUNT(*) FILTER (WHERE reason = 'unclear_questions'),
        'too_long', COUNT(*) FILTER (WHERE reason = 'too_long'),
        'bugs_lag', COUNT(*) FILTER (WHERE reason = 'bugs_lag')
      )
      FROM quiz_feedback
      WHERE reason IS NOT NULL
    ),
    'recent_feedback', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'quiz_title', qs.title,
          'rating', qf.rating,
          'reason', qf.reason,
          'comment', qf.comment,
          'created_at', qf.created_at,
          'school_name', COALESCE(s.name, 'Global')
        ) ORDER BY qf.created_at DESC
      )
      FROM (
        SELECT * FROM quiz_feedback
        WHERE comment IS NOT NULL AND comment != ''
        ORDER BY created_at DESC
        LIMIT 10
      ) qf
      JOIN question_sets qs ON qs.id = qf.quiz_id
      LEFT JOIN schools s ON s.id = qs.school_id
    )
  );

  RETURN v_result;
END;
$$;

-- Function: Get quizzes by feedback rating
CREATE OR REPLACE FUNCTION get_admin_quizzes_by_feedback(
  p_sort_order text DEFAULT 'worst',
  p_limit integer DEFAULT 20
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_sort_direction text;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  v_sort_direction := CASE
    WHEN p_sort_order = 'best' THEN 'DESC'
    ELSE 'ASC'
  END;

  -- Get quizzes with feedback stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'quiz_id', qs.id,
      'quiz_title', qs.title,
      'school_name', COALESCE(s.name, 'Global'),
      'teacher_email', p.email,
      'likes_count', qfs.likes_count,
      'dislikes_count', qfs.dislikes_count,
      'total_feedback', qfs.total_feedback,
      'feedback_score', qfs.feedback_score,
      'reasons', (
        SELECT jsonb_build_object(
          'too_hard', COUNT(*) FILTER (WHERE reason = 'too_hard'),
          'too_easy', COUNT(*) FILTER (WHERE reason = 'too_easy'),
          'unclear_questions', COUNT(*) FILTER (WHERE reason = 'unclear_questions'),
          'too_long', COUNT(*) FILTER (WHERE reason = 'too_long'),
          'bugs_lag', COUNT(*) FILTER (WHERE reason = 'bugs_lag')
        )
        FROM quiz_feedback
        WHERE quiz_id = qs.id AND reason IS NOT NULL
      )
    ) ORDER BY
      CASE
        WHEN p_sort_order = 'best' THEN qfs.feedback_score
      END DESC,
      CASE
        WHEN p_sort_order = 'worst' THEN qfs.feedback_score
      END ASC
  )
  INTO v_result
  FROM quiz_feedback_stats qfs
  JOIN question_sets qs ON qs.id = qfs.quiz_id
  LEFT JOIN schools s ON s.id = qs.school_id
  LEFT JOIN profiles p ON p.id = qs.created_by
  WHERE qfs.total_feedback >= 5
  LIMIT p_limit;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_feedback_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_quizzes_by_feedback TO authenticated;
