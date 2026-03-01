/*
  # Add Session Freeze and Analytics Tracking

  ## Overview
  Enhances the topic_runs table to properly freeze game sessions on completion,
  prevent replays, and track detailed analytics.

  ## Changes
  
  1. **New Fields on topic_runs**
    - `is_frozen` (boolean) - Prevents any further modifications once set
    - `total_questions` (integer) - Total number of questions in the quiz
    - `percentage` (numeric) - Score percentage (0-100)
    - `device_info` (jsonb) - Optional device/browser information
    
  2. **Update trigger function**
    - Auto-calculate percentage when correct_count changes
    - Auto-calculate duration_seconds on completion
    - Set is_frozen = true when status changes to completed/game_over

  3. **Security**
    - Prevent updates to frozen sessions
    - Add check constraints for valid percentages

  4. **Indexes**
    - Add index on is_frozen for queries
    - Add index on percentage for leaderboards
*/

-- ============================================================================
-- 1. ADD NEW FIELDS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_runs' AND column_name = 'is_frozen'
  ) THEN
    ALTER TABLE topic_runs ADD COLUMN is_frozen boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_runs' AND column_name = 'total_questions'
  ) THEN
    ALTER TABLE topic_runs ADD COLUMN total_questions integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_runs' AND column_name = 'percentage'
  ) THEN
    ALTER TABLE topic_runs ADD COLUMN percentage numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_runs' AND column_name = 'device_info'
  ) THEN
    ALTER TABLE topic_runs ADD COLUMN device_info jsonb;
  END IF;
END $$;

-- ============================================================================
-- 2. ADD CONSTRAINTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'valid_percentage'
  ) THEN
    ALTER TABLE topic_runs ADD CONSTRAINT valid_percentage 
      CHECK (percentage >= 0 AND percentage <= 100);
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topic_runs_is_frozen ON topic_runs(is_frozen);
CREATE INDEX IF NOT EXISTS idx_topic_runs_percentage ON topic_runs(percentage DESC);
CREATE INDEX IF NOT EXISTS idx_topic_runs_completed_at ON topic_runs(completed_at) WHERE completed_at IS NOT NULL;

-- ============================================================================
-- 4. CREATE TRIGGER FUNCTION TO AUTO-FREEZE AND CALCULATE STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION freeze_and_calculate_run_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent updates to frozen sessions
  IF OLD.is_frozen = true AND TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Cannot modify a frozen session';
  END IF;

  -- Auto-calculate duration when completed
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL AND NEW.duration_seconds IS NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::integer;
  END IF;

  -- Auto-calculate percentage
  IF NEW.total_questions > 0 THEN
    NEW.percentage := ROUND((NEW.correct_count::numeric / NEW.total_questions::numeric) * 100, 2);
  END IF;

  -- Freeze session when completed or game over
  IF (NEW.status = 'completed' OR NEW.status = 'game_over') AND NEW.is_frozen = false THEN
    NEW.is_frozen := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_freeze_and_calculate_run_stats ON topic_runs;
CREATE TRIGGER trigger_freeze_and_calculate_run_stats
  BEFORE UPDATE ON topic_runs
  FOR EACH ROW
  EXECUTE FUNCTION freeze_and_calculate_run_stats();

-- ============================================================================
-- 5. UPDATE EXISTING ROWS WITH CALCULATED VALUES
-- ============================================================================

-- Calculate duration for completed runs without duration
UPDATE topic_runs
SET duration_seconds = EXTRACT(EPOCH FROM (completed_at - started_at))::integer
WHERE completed_at IS NOT NULL 
  AND started_at IS NOT NULL 
  AND duration_seconds IS NULL;

-- Freeze all completed and game_over sessions
UPDATE topic_runs
SET is_frozen = true
WHERE status IN ('completed', 'game_over') 
  AND is_frozen = false;