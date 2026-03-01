/*
  # Add Game Over Metrics to Public Quiz Runs
  
  1. Changes
    - Add `is_frozen` column to prevent replay/cheating after game ends
    - Add `correct_count` to track total correct answers
    - Add `wrong_count` to track total wrong answers (failed after 2 attempts)
    - Add `percentage` to store calculated score percentage
    - Add `duration_seconds` to store total time taken
    
  2. Purpose
    Enables proper game over session flow:
    - Session freezing (no replays)
    - Performance metrics calculation
    - Complete analytics tracking
    - Instant results display
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'is_frozen'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN is_frozen boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'correct_count'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN correct_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'wrong_count'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN wrong_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'percentage'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN percentage numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN duration_seconds integer;
  END IF;
END $$;