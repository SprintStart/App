/*
  # Add Monitoring Hardening Columns

  1. New Columns for health_checks
    - `check_category` (text) - Categorizes the type of check ('route', 'api', 'database', 'ssl')
    - `is_critical` (boolean) - Marks if failure should trigger immediate alert
    - `performance_baseline_ms` (integer) - Expected baseline response time

  2. New Columns for health_alerts
    - `last_seen_at` (timestamptz) - When this alert was last seen
    - `cooldown_until` (timestamptz) - Prevents duplicate alerts until this time
    - `severity` (text) - Alert severity level ('critical', 'warning', 'info')

  3. Security
    - All columns are nullable
    - No RLS changes
    - No constraints beyond defaults
*/

-- Add columns to health_checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'check_category'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN check_category text DEFAULT 'route';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'is_critical'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN is_critical boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'performance_baseline_ms'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN performance_baseline_ms integer DEFAULT 2000;
  END IF;
END $$;

-- Add columns to health_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN last_seen_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'cooldown_until'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN cooldown_until timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'severity'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN severity text DEFAULT 'critical';
  END IF;
END $$;
