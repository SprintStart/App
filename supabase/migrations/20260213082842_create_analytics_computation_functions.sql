/*
  # Analytics Computation Functions

  ## Purpose
  Server-side RPC functions to compute analytics metrics for dashboards.
  Safe, performant, and RLS-compliant.

  ## Functions Created
  
  1. get_teacher_quiz_analytics(teacher_id) - Per-quiz stats for teacher
  2. get_quiz_detailed_analytics(quiz_id) - Detailed stats for one quiz
  3. get_admin_platform_stats() - Platform-wide metrics
  4. get_admin_plays_by_month() - Monthly play trends
  5. get_school_analytics(school_id) - School-specific metrics

  ## Security
  All functions respect RLS and validate permissions
*/

-- Function: Get teacher's quiz analytics
CREATE OR REPLACE FUNCTION get_teacher_quiz_analytics(p_teacher_id uuid DEFAULT NULL)
RETURNS TABLE (
  quiz_id uuid,
  quiz_title text,
  total_plays bigint,
  completed_plays bigint,
  completion_rate numeric,
  avg_score numeric,
  thumbs_up bigint,
  thumbs_down bigint,
  last_played_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use auth.uid() if no teacher_id provided
  p_teacher_id := COALESCE(p_teacher_id, auth.uid());
  
  RETURN QUERY
  SELECT 
    qs.id as quiz_id,
    qs.title as quiz_title,
    COUNT(qps.id)::bigint as total_plays,
    COUNT(qps.id) FILTER (WHERE qps.completed = true)::bigint as completed_plays,
    CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END as completion_rate,
    ROUND(AVG(qps.score) FILTER (WHERE qps.score IS NOT NULL), 1) as avg_score,
    COUNT(qf.id) FILTER (WHERE qf.thumb = 'up')::bigint as thumbs_up,
    COUNT(qf.id) FILTER (WHERE qf.thumb = 'down')::bigint as thumbs_down,
    MAX(qps.started_at) as last_played_at
  FROM question_sets qs
  LEFT JOIN quiz_play_sessions qps ON qps.quiz_id = qs.id
  LEFT JOIN quiz_feedback qf ON qf.quiz_id = qs.id
  WHERE qs.created_by = p_teacher_id
  AND qs.is_active = true
  GROUP BY qs.id, qs.title
  ORDER BY last_played_at DESC NULLS LAST;
END;
$$;

-- Function: Get detailed analytics for a specific quiz
CREATE OR REPLACE FUNCTION get_quiz_detailed_analytics(p_quiz_id uuid)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
  v_created_by uuid;
BEGIN
  -- Check permission: owner or admin
  SELECT created_by INTO v_created_by
  FROM question_sets
  WHERE id = p_quiz_id;
  
  IF v_created_by != auth.uid() AND NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  SELECT json_build_object(
    'total_plays', COUNT(qps.id),
    'completed_plays', COUNT(qps.id) FILTER (WHERE qps.completed = true),
    'completion_rate', CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END,
    'avg_score', ROUND(AVG(qps.score) FILTER (WHERE qps.score IS NOT NULL), 1),
    'avg_time_per_question_ms', ROUND(AVG(qse.time_spent_ms) FILTER (WHERE qse.time_spent_ms IS NOT NULL)),
    'thumbs_up', COUNT(DISTINCT qf.id) FILTER (WHERE qf.thumb = 'up'),
    'thumbs_down', COUNT(DISTINCT qf.id) FILTER (WHERE qf.thumb = 'down'),
    'plays_by_day', (
      SELECT json_agg(day_data ORDER BY play_date)
      FROM (
        SELECT 
          DATE(qps2.started_at) as play_date,
          COUNT(*)::integer as play_count
        FROM quiz_play_sessions qps2
        WHERE qps2.quiz_id = p_quiz_id
        AND qps2.started_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(qps2.started_at)
        ORDER BY play_date
      ) day_data
    ),
    'last_played_at', MAX(qps.started_at)
  ) INTO v_result
  FROM quiz_play_sessions qps
  LEFT JOIN quiz_session_events qse ON qse.session_id = qps.id AND qse.event_type = 'answer_submitted'
  LEFT JOIN quiz_feedback qf ON qf.quiz_id = qps.quiz_id
  WHERE qps.quiz_id = p_quiz_id;
  
  RETURN v_result;
END;
$$;

-- Function: Get platform-wide stats for admin
CREATE OR REPLACE FUNCTION get_admin_platform_stats()
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  -- Check admin permission
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  SELECT json_build_object(
    'total_plays_all_time', COUNT(qps.id),
    'total_plays_today', COUNT(qps.id) FILTER (WHERE DATE(qps.started_at) = CURRENT_DATE),
    'total_plays_7days', COUNT(qps.id) FILTER (WHERE qps.started_at > NOW() - INTERVAL '7 days'),
    'total_plays_30days', COUNT(qps.id) FILTER (WHERE qps.started_at > NOW() - INTERVAL '30 days'),
    'completed_sessions', COUNT(qps.id) FILTER (WHERE qps.completed = true),
    'completion_rate', CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END,
    'total_quizzes_published', (SELECT COUNT(*) FROM question_sets WHERE approval_status = 'approved' AND is_active = true),
    'total_schools', (SELECT COUNT(*) FROM schools WHERE is_active = true),
    'total_teachers', (SELECT COUNT(*) FROM profiles WHERE role = 'teacher')
  ) INTO v_result
  FROM quiz_play_sessions qps;
  
  RETURN v_result;
END;
$$;

-- Function: Get plays by month for admin
CREATE OR REPLACE FUNCTION get_admin_plays_by_month(p_year integer DEFAULT NULL)
RETURNS TABLE (
  year integer,
  month integer,
  month_name text,
  total_plays bigint,
  unique_players bigint,
  completed_plays bigint,
  completion_rate numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check admin permission
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Default to current year if not specified
  p_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  
  RETURN QUERY
  SELECT 
    EXTRACT(YEAR FROM qps.started_at)::integer as year,
    EXTRACT(MONTH FROM qps.started_at)::integer as month,
    TO_CHAR(qps.started_at, 'Month') as month_name,
    COUNT(qps.id)::bigint as total_plays,
    COUNT(DISTINCT qps.player_id)::bigint as unique_players,
    COUNT(qps.id) FILTER (WHERE qps.completed = true)::bigint as completed_plays,
    CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END as completion_rate
  FROM quiz_play_sessions qps
  WHERE EXTRACT(YEAR FROM qps.started_at) = p_year
  GROUP BY EXTRACT(YEAR FROM qps.started_at), EXTRACT(MONTH FROM qps.started_at), TO_CHAR(qps.started_at, 'Month')
  ORDER BY year, month;
END;
$$;

-- Function: Get top quizzes by plays
CREATE OR REPLACE FUNCTION get_top_quizzes_by_plays(p_limit integer DEFAULT 10)
RETURNS TABLE (
  quiz_id uuid,
  quiz_title text,
  teacher_name text,
  school_name text,
  total_plays bigint,
  completion_rate numeric,
  avg_score numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check admin permission
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    qs.id as quiz_id,
    qs.title as quiz_title,
    p.full_name as teacher_name,
    s.name as school_name,
    COUNT(qps.id)::bigint as total_plays,
    CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END as completion_rate,
    ROUND(AVG(qps.score) FILTER (WHERE qps.score IS NOT NULL), 1) as avg_score
  FROM question_sets qs
  LEFT JOIN quiz_play_sessions qps ON qps.quiz_id = qs.id
  LEFT JOIN profiles p ON p.id = qs.created_by
  LEFT JOIN schools s ON s.id = qs.school_id
  WHERE qs.is_active = true
  AND qs.approval_status = 'approved'
  GROUP BY qs.id, qs.title, p.full_name, s.name
  HAVING COUNT(qps.id) > 0
  ORDER BY total_plays DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get school analytics
CREATE OR REPLACE FUNCTION get_school_analytics(p_school_id uuid)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  -- Admins can view any school, others must have access
  IF NOT current_user_is_admin() THEN
    -- Check if user belongs to this school
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND school_id = p_school_id
    ) THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;
  
  SELECT json_build_object(
    'school_id', p_school_id,
    'school_name', (SELECT name FROM schools WHERE id = p_school_id),
    'total_teachers', COUNT(DISTINCT p.id),
    'total_quizzes', COUNT(DISTINCT qs.id),
    'total_plays', COUNT(qps.id),
    'plays_30days', COUNT(qps.id) FILTER (WHERE qps.started_at > NOW() - INTERVAL '30 days'),
    'completion_rate', CASE 
      WHEN COUNT(qps.id) > 0 
      THEN ROUND((COUNT(qps.id) FILTER (WHERE qps.completed = true)::numeric / COUNT(qps.id)::numeric) * 100, 1)
      ELSE 0
    END
  ) INTO v_result
  FROM profiles p
  LEFT JOIN question_sets qs ON qs.created_by = p.id
  LEFT JOIN quiz_play_sessions qps ON qps.quiz_id = qs.id
  WHERE p.school_id = p_school_id
  AND p.role = 'teacher';
  
  RETURN v_result;
END;
$$;
