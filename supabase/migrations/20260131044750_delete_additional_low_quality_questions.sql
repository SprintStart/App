/*
  # Delete Additional Low Quality Questions
  
  ## Problem
  - 1,000 more questions contain generic placeholder text
  - Questions say "Select the correct option" without actual question content
  - These do not meet educational standards
  
  ## Changes
  1. Mark question sets containing low quality questions as inactive
  2. Delete low quality questions with generic placeholders
  3. Update question set counts
  
  ## Impact
  - Removes 1,000 additional low quality questions
  - Marks affected question sets as inactive
  - Ensures only high-quality educational content remains
*/

-- Mark question sets with low quality questions as inactive
UPDATE question_sets
SET is_active = false,
    is_published = false
WHERE id IN (
  SELECT DISTINCT qs.id
  FROM question_sets qs
  JOIN topic_questions tq ON tq.question_set_id = qs.id
  WHERE tq.question_text ILIKE '%select the correct option%'
     OR tq.question_text ILIKE '%identify the answer%'
     OR tq.question_text ILIKE '%choose the right%'
);

-- Delete the low quality questions
DELETE FROM topic_questions
WHERE question_text ILIKE '%select the correct option%'
   OR question_text ILIKE '%identify the answer%'
   OR question_text ILIKE '%choose the right%';

-- Mark question sets with no questions as inactive
UPDATE question_sets
SET is_active = false,
    is_published = false
WHERE id NOT IN (
  SELECT DISTINCT question_set_id
  FROM topic_questions
);
