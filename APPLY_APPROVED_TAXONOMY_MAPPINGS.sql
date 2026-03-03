/*
  # Apply Approved Taxonomy Mappings

  ## Overview
  This migration applies approved country_code and exam_code mappings to existing GLOBAL quizzes
  that have been identified as exam-specific content.

  ## Changes Made

  1. **Fix UK → GB Country Code**
     - 1 quiz with incorrect 'UK' code changed to 'GB'
     - Quiz ID: 87f1c5ba-359a-403b-9644-d9f55d08ce03

  2. **Apply GB/A_LEVEL Mapping**
     - 7 quizzes mapped to GB/A_LEVEL
     - All are AQA A-Level Business Studies content
     - destination_scope set to 'COUNTRY_EXAM'

  3. **No Changes to False Positives**
     - 1 quiz remains GLOBAL (false positive from keyword matching)
     - ID: f47183d1-8a7a-4524-9c07-12e048302762

  ## Safety Features
  - Uses WHERE clauses to ensure only intended quizzes are updated
  - Preserves all other fields (approval_status, is_active, etc.)
  - Can be run multiple times safely (idempotent)
  - Includes verification queries at the end

  ## IMPORTANT
  - DO NOT run this until publish trigger behavior is verified
  - Test with 1-2 quizzes first before running full batch
  - Verify routing logic works with updated fields
  - Monitor for any issues post-update
*/

-- ============================================================================
-- STEP 1: Fix UK → GB Country Code
-- ============================================================================

-- Before: country_code='UK'
-- After: country_code='GB'

UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK'
  AND exam_code = 'A_LEVEL';

-- Verification
SELECT
  id,
  title,
  country_code,
  exam_code,
  destination_scope,
  approval_status
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- ============================================================================
-- STEP 2: Apply GB/A_LEVEL Mapping to Confirmed Quizzes
-- ============================================================================

-- These 7 quizzes are confirmed AQA A-Level Business Studies content
-- They should be mapped to GB/A_LEVEL for proper routing

UPDATE question_sets
SET
  country_code = 'GB',
  exam_code = 'A_LEVEL',
  destination_scope = 'COUNTRY_EXAM'
WHERE id IN (
  '47ed7d9f-9759-4a87-ac4e-02c6dc27dce8',  -- A-level BUSINESS Paper 1 Business 1 Past Questions
  'f5486277-5792-4685-89e3-360ddc9ead24',  -- A-level BUSINESS Paper 1 Business 1- Tuesday 14 May 2024
  '47b897e5-5054-4492-96b4-d7b87f1ae0bd',  -- AQA AS Business Paper 1
  '09885113-e14a-4f56-abc0-ec7115b13f5b',  -- AQA A Level Business Studies Objectives Past Questions 1
  'e877d12b-4318-423a-bd0b-35c5d2617b86',  -- Managers, Leadership and Decision-Making (AQA A-Level Business)
  'ad9d37df-091d-43e9-9474-48dd7067f134',  -- Market Share & Business Growth (AQA A-Level Business – Paper 1)
  '3312edb0-57de-46b6-8215-3770e3bb3e3c'   -- What is Business? (Purpose, Objectives & Ownership) – AQA A-Level Business
)
AND school_id IS NULL  -- Safety check: only update GLOBAL quizzes
AND (country_code IS NULL OR country_code = 'GB');  -- Safety check: don't overwrite other mappings

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all 8 updated quizzes
SELECT
  id,
  title,
  country_code,
  exam_code,
  destination_scope,
  approval_status,
  is_active,
  school_id,
  created_at
FROM question_sets
WHERE id IN (
  '87f1c5ba-359a-403b-9644-d9f55d08ce03',  -- UK → GB fix
  '47ed7d9f-9759-4a87-ac4e-02c6dc27dce8',
  'f5486277-5792-4685-89e3-360ddc9ead24',
  '47b897e5-5054-4492-96b4-d7b87f1ae0bd',
  '09885113-e14a-4f56-abc0-ec7115b13f5b',
  'e877d12b-4318-423a-bd0b-35c5d2617b86',
  'ad9d37df-091d-43e9-9474-48dd7067f134',
  '3312edb0-57de-46b6-8215-3770e3bb3e3c'
)
ORDER BY title;

-- Expected result: 8 rows
-- - All should have country_code = 'GB'
-- - All should have exam_code = 'A_LEVEL'
-- - All should have destination_scope = 'COUNTRY_EXAM'
-- - All should have school_id = NULL
-- - All should have approval_status = 'approved'

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Count quizzes by destination
SELECT
  destination_scope,
  COUNT(*) as quiz_count
FROM question_sets
WHERE school_id IS NULL
  AND approval_status = 'approved'
GROUP BY destination_scope
ORDER BY destination_scope;

-- Count quizzes by country/exam combination
SELECT
  country_code,
  exam_code,
  COUNT(*) as quiz_count
FROM question_sets
WHERE school_id IS NULL
  AND approval_status = 'approved'
  AND (country_code IS NOT NULL OR exam_code IS NOT NULL)
GROUP BY country_code, exam_code
ORDER BY country_code, exam_code;

-- ============================================================================
-- ROLLBACK (If Needed)
-- ============================================================================

/*
-- ROLLBACK STEP 1: Revert UK fix
UPDATE question_sets
SET country_code = 'UK'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'GB';

-- ROLLBACK STEP 2: Revert GB/A_LEVEL mappings
UPDATE question_sets
SET
  country_code = NULL,
  exam_code = NULL,
  destination_scope = 'GLOBAL'
WHERE id IN (
  '47ed7d9f-9759-4a87-ac4e-02c6dc27dce8',
  'f5486277-5792-4685-89e3-360ddc9ead24',
  '47b897e5-5054-4492-96b4-d7b87f1ae0bd',
  '09885113-e14a-4f56-abc0-ec7115b13f5b',
  'e877d12b-4318-423a-bd0b-35c5d2617b86',
  'ad9d37df-091d-43e9-9474-48dd7067f134',
  '3312edb0-57de-46b6-8215-3770e3bb3e3c'
);
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/*
Quiz Details:

1. 87f1c5ba-359a-403b-9644-d9f55d08ce03
   - AQA A Level Business Studies Objectives Past Questions 2
   - Change: UK → GB (country_code correction)
   - Already had exam_code='A_LEVEL'

2. 47ed7d9f-9759-4a87-ac4e-02c6dc27dce8
   - A-level BUSINESS Paper 1 Business 1 Past Questions
   - New mapping: NULL → GB/A_LEVEL

3. f5486277-5792-4685-89e3-360ddc9ead24
   - A-level BUSINESS Paper 1 Business 1- Tuesday 14 May 2024
   - New mapping: NULL → GB/A_LEVEL

4. 47b897e5-5054-4492-96b4-d7b87f1ae0bd
   - AQA AS Business Paper 1
   - New mapping: NULL → GB/A_LEVEL (AS is subset of A-Level)

5. 09885113-e14a-4f56-abc0-ec7115b13f5b
   - AQA A Level Business Studies Objectives Past Questions 1
   - New mapping: NULL → GB/A_LEVEL

6. e877d12b-4318-423a-bd0b-35c5d2617b86
   - Managers, Leadership and Decision-Making (AQA A-Level Business)
   - New mapping: NULL → GB/A_LEVEL

7. ad9d37df-091d-43e9-9474-48dd7067f134
   - Market Share & Business Growth (AQA A-Level Business – Paper 1)
   - New mapping: NULL → GB/A_LEVEL

8. 3312edb0-57de-46b6-8215-3770e3bb3e3c
   - What is Business? (Purpose, Objectives & Ownership) – AQA A-Level Business
   - New mapping: NULL → GB/A_LEVEL

NOT UPDATED (False Positive):
- f47183d1-8a7a-4524-9c07-12e048302762
  - Human Resource Management (Motivation & Organisational Structure)
  - Remains GLOBAL (no exam keywords actually present)
*/
