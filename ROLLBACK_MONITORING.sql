-- ============================================================================
-- STARTSPRINT HEALTH MONITORING - ROLLBACK SCRIPT
-- ============================================================================
-- Use this script to completely remove the health monitoring system
-- Safe to run: YES (only removes monitoring tables, no production data)
-- ============================================================================

-- ============================================================================
-- SECTION 1: STOP CRON JOBS
-- ============================================================================

DO $$
BEGIN
  -- Unschedule all monitoring cron jobs
  PERFORM cron.unschedule('startsprint-health-checks');
  PERFORM cron.unschedule('startsprint-storage-checks');
  PERFORM cron.unschedule('automated-health-checks-5min');
  PERFORM cron.unschedule('automated-storage-checks-5min');
  PERFORM cron.unschedule('run-health-checks');

  RAISE NOTICE 'Cron jobs unscheduled ✓';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some cron jobs may not exist (this is OK)';
END $$;

-- Verify cron jobs removed
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%health%' OR jobname LIKE '%storage%';

-- Should return no rows

-- ============================================================================
-- SECTION 2: DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS invoke_health_checks_via_net() CASCADE;
DROP FUNCTION IF EXISTS check_storage_health() CASCADE;
DROP FUNCTION IF EXISTS log_storage_error(text, text, text, integer, text, uuid) CASCADE;

RAISE NOTICE 'Functions dropped ✓';

-- ============================================================================
-- SECTION 3: DROP TABLES
-- ============================================================================

-- Drop in reverse order (no foreign keys, but for clarity)
DROP TABLE IF EXISTS storage_error_logs CASCADE;
DROP TABLE IF EXISTS health_alerts CASCADE;
DROP TABLE IF EXISTS health_checks CASCADE;

RAISE NOTICE 'Tables dropped ✓';

-- ============================================================================
-- SECTION 4: VERIFICATION
-- ============================================================================

-- Verify tables removed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_checks') THEN
    RAISE EXCEPTION 'Table health_checks still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_alerts') THEN
    RAISE EXCEPTION 'Table health_alerts still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_error_logs') THEN
    RAISE EXCEPTION 'Table storage_error_logs still exists';
  END IF;

  RAISE NOTICE 'All monitoring tables removed successfully ✓';
END $$;

-- Verify functions removed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoke_health_checks_via_net') THEN
    RAISE EXCEPTION 'Function invoke_health_checks_via_net still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_storage_health') THEN
    RAISE EXCEPTION 'Function check_storage_health still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_storage_error') THEN
    RAISE EXCEPTION 'Function log_storage_error still exists';
  END IF;

  RAISE NOTICE 'All monitoring functions removed successfully ✓';
END $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- The monitoring system has been completely removed.
--
-- What was removed:
-- - 3 tables: health_checks, health_alerts, storage_error_logs
-- - 3 functions: invoke_health_checks_via_net, check_storage_health, log_storage_error
-- - 2 cron jobs: startsprint-health-checks, startsprint-storage-checks
--
-- What was NOT affected:
-- - No quiz tables modified
-- - No payment data touched
-- - No user authentication affected
-- - No RLS policies changed (except monitoring tables)
-- - No production routes affected
--
-- To re-deploy:
-- - Run DEPLOYMENT_MIGRATION_WITH_ROLLBACK.sql
-- ============================================================================
