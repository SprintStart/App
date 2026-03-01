/*
  # Fix Topics Missing is_published Flag

  1. Changes
    - Sets `is_published = true` for all active topics created by teachers
    - This fixes the issue where quizzes don't show on topic pages because
      the topics were created without is_published flag

  2. Why This Is Needed
    - CreateQuizWizard was creating topics with is_active=true but not is_published=true
    - School topic pages filter for is_published=true, so quizzes weren't visible
    - This migration backfills the missing flag for existing topics
*/

-- Update all active topics that don't have is_published set
UPDATE topics
SET is_published = true
WHERE is_active = true
  AND (is_published IS NULL OR is_published = false);
