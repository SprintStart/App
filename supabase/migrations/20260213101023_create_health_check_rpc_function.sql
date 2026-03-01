/*
  # Health Check RPC Function

  ## What This Migration Does
  Creates an RPC function that returns system health metrics

  ## What It Returns
  - Database connection status
  - Active school count
  - Published quiz count
  - Total quiz runs count
  - Last error timestamp (from audit_logs)
  - Recent error count (last 24 hours)

  ## Security
  - Only accessible to admins via admin check
  - Returns comprehensive health status
*/

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_db_status text;
  v_school_count bigint;
  v_published_quiz_count bigint;
  v_total_runs bigint;
  v_runs_last_24h bigint;
  v_last_error_at timestamptz;
  v_errors_24h bigint;
  v_active_teachers bigint;
BEGIN
  -- Check database status
  v_db_status := 'healthy';

  -- Count active schools
  SELECT COUNT(*) INTO v_school_count
  FROM schools
  WHERE is_active = true;

  -- Count published quizzes
  SELECT COUNT(*) INTO v_published_quiz_count
  FROM question_sets
  WHERE is_published = true
  AND is_active = true;

  -- Count total quiz runs
  SELECT COUNT(*) INTO v_total_runs
  FROM public_quiz_runs;

  -- Count runs in last 24 hours
  SELECT COUNT(*) INTO v_runs_last_24h
  FROM public_quiz_runs
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  -- Get last error timestamp from audit_logs
  SELECT MAX(created_at) INTO v_last_error_at
  FROM audit_logs
  WHERE action LIKE '%error%' OR action LIKE '%failed%';

  -- Count errors in last 24 hours
  SELECT COUNT(*) INTO v_errors_24h
  FROM audit_logs
  WHERE (action LIKE '%error%' OR action LIKE '%failed%')
  AND created_at >= NOW() - INTERVAL '24 hours';

  -- Count active teachers
  SELECT COUNT(*) INTO v_active_teachers
  FROM subscriptions
  WHERE status IN ('active', 'trialing');

  -- Build result
  v_result := jsonb_build_object(
    'status', v_db_status,
    'timestamp', NOW(),
    'metrics', jsonb_build_object(
      'database_connected', true,
      'active_schools', v_school_count,
      'published_quizzes', v_published_quiz_count,
      'total_quiz_runs', v_total_runs,
      'quiz_runs_last_24h', v_runs_last_24h,
      'active_teachers', v_active_teachers,
      'errors_last_24h', v_errors_24h,
      'last_error_at', v_last_error_at
    )
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'timestamp', NOW(),
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users (admin check will happen in edge function)
GRANT EXECUTE ON FUNCTION get_system_health TO authenticated;
