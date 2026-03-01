/*
  # Fix Topic School ID from Question Sets

  1. Problem
    - Topics were not being updated with school_id when quizzes were published
    - Question sets have the correct school_id, but topics don't
    - School walls query topics by school_id, so quizzes don't show

  2. Solution
    - Update topics to match the school_id from their question sets
    - This ensures topics are properly scoped to schools

  3. Changes
    - Updates topics.school_id to match question_sets.school_id
    - Updates topics.exam_system_id to match question_sets.exam_system_id
    - Only updates topics that have question sets with school_id set
*/

-- Update topics to inherit school_id and exam_system_id from their question sets
-- This handles cases where:
-- 1. Topic has school_id = NULL but question_set has school_id
-- 2. Topic has different school_id than question_set

WITH topic_destinations AS (
  SELECT DISTINCT ON (topic_id)
    topic_id,
    school_id,
    exam_system_id
  FROM question_sets
  WHERE school_id IS NOT NULL
    AND approval_status = 'approved'
  ORDER BY topic_id, created_at DESC
)
UPDATE topics
SET 
  school_id = topic_destinations.school_id,
  exam_system_id = topic_destinations.exam_system_id
FROM topic_destinations
WHERE topics.id = topic_destinations.topic_id
  AND (
    topics.school_id IS DISTINCT FROM topic_destinations.school_id
    OR topics.exam_system_id IS DISTINCT FROM topic_destinations.exam_system_id
  );
