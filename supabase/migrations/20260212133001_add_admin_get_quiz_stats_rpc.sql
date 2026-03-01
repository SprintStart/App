/*
  # Add Admin RPC Function for Quiz Stats

  1. Issue
    - RLS policies blocking admin HEAD/count requests
    - Complex workaround: Create RPC functions that admins can call directly
  
  2. Solution
    - Create SECURITY DEFINER RPC functions for admin stats
    - These bypass RLS but verify admin status internally
    - Return aggregated stats directly
  
  3. Security
    - Functions verify caller is active admin before returning data
    - All data access is controlled within the function
*/

-- Function to get quiz run counts for admin dashboard
CREATE OR REPLACE FUNCTION admin_get_quiz_run_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
  result jsonb;
BEGIN
  -- Verify the caller is an admin
  SELECT EXISTS (
    SELECT 1 
    FROM admin_allowlist al
    INNER JOIN auth.users u ON u.email = al.email
    WHERE u.id = auth.uid()
    AND al.is_active = true
  ) INTO is_admin_user;
  
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get all the stats
  SELECT jsonb_build_object(
    'total_plays', (SELECT COUNT(*) FROM public_quiz_runs),
    'plays_7_days', (
      SELECT COUNT(*) 
      FROM public_quiz_runs 
      WHERE started_at >= NOW() - INTERVAL '7 days'
    ),
    'plays_30_days', (
      SELECT COUNT(*) 
      FROM public_quiz_runs 
      WHERE started_at >= NOW() - INTERVAL '30 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION admin_get_quiz_run_stats() TO authenticated;