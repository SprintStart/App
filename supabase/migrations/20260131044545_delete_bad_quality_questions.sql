/*
  # Delete Bad Quality Questions and Question Sets
  
  ## Problem
  - 11,000 out of 12,015 questions contain poor quality content
  - Questions have placeholder text like "Identify the answer"
  - Options expose correct answers with "(Correct)" labels
  - This is a critical security and integrity issue
  
  ## Changes
  1. Delete all questions with poor quality indicators:
     - Question text containing "identify the answer"
     - Options containing "(Correct)" or "(incorrect)"
  2. Mark affected question sets as inactive
  3. Clean up orphaned question sets
  
  ## Impact
  - Removes 11,000 bad quality questions
  - Marks ~1,100 question sets as inactive
  - Keeps ~100 good quality question sets active
*/

-- First, mark question sets with bad questions as inactive
UPDATE question_sets
SET is_active = false,
    is_published = false
WHERE id IN (
  SELECT DISTINCT qs.id
  FROM question_sets qs
  JOIN topic_questions tq ON tq.question_set_id = qs.id
  WHERE tq.question_text ILIKE '%identify the answer%'
     OR tq.options::text ILIKE '%(Correct)%'
     OR tq.options::text ILIKE '%(incorrect)%'
);

-- Delete the bad quality questions
DELETE FROM topic_questions
WHERE question_text ILIKE '%identify the answer%'
   OR options::text ILIKE '%(Correct)%'
   OR options::text ILIKE '%(incorrect)%';

-- Mark question sets with no questions as inactive
UPDATE question_sets
SET is_active = false,
    is_published = false
WHERE id NOT IN (
  SELECT DISTINCT question_set_id
  FROM topic_questions
);
