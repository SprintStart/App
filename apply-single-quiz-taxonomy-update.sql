/*
  # Apply Taxonomy Update to Single Quiz (Test)

  Updates quiz 87f1c5ba-359a-403b-9644-d9f55d08ce03
  Changes country_code from 'UK' to 'GB'
  exam_code already set to 'A_LEVEL'
*/

-- Show BEFORE state
SELECT
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status,
  is_active,
  created_by
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- Apply update
UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK';

-- Show AFTER state
SELECT
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status,
  is_active,
  created_by
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- Verify the change
SELECT
  CASE
    WHEN country_code = 'GB' AND exam_code = 'A_LEVEL' THEN '✅ SUCCESS: Quiz updated correctly'
    ELSE '❌ FAILED: Quiz not updated correctly'
  END as status,
  country_code,
  exam_code
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';
