/*
  # Fix Cron Frequency to 5 Minutes

  Updates the health check cron job from 10 minutes to 5 minutes to match documentation.

  Changes:
  - Unschedules existing 10-minute job
  - Reschedules to run every 5 minutes (*/5 * * * *)

  Security:
  - No table changes
  - No RLS changes
  - Only modifies cron schedule
*/

-- Unschedule the existing 10-minute job if it exists
SELECT cron.unschedule('run-health-checks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run-health-checks'
);

-- Reschedule to run every 5 minutes
SELECT cron.schedule(
  'run-health-checks',
  '*/5 * * * *',
  'SELECT trigger_health_checks();'
);
