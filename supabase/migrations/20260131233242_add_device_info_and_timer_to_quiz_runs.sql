/*
  # Add Device Tracking and Timer Support
  
  1. Changes
    - Add `device_info` column to `public_quiz_runs` for analytics
    - Add `timer_seconds` column to `public_quiz_runs` for timer-based games
    
  2. Details
    - `device_info`: JSONB column storing browser, OS, screen size, platform info
    - `timer_seconds`: Integer storing total timer duration for the quiz (optional)
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'device_info'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN device_info jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_quiz_runs' AND column_name = 'timer_seconds'
  ) THEN
    ALTER TABLE public_quiz_runs ADD COLUMN timer_seconds integer;
  END IF;
END $$;