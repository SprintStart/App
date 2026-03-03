-- ============================================================================
-- GLOBAL QUIZ LIBRARY TAXONOMY CORRECTION
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- This script corrects the classification of the Global Quiz Library to contain
-- ONLY non-curriculum, non-national content.
--
-- CRITICAL: This is a classification correction ONLY.
-- - NO quizzes are deleted
-- - NO analytics are reset
-- - NO play counts are lost
-- - NO schema redesign occurs
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD GLOBAL_CATEGORY FIELD TO TOPICS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'global_category'
  ) THEN
    ALTER TABLE topics ADD COLUMN global_category text;
    RAISE NOTICE 'Added global_category column to topics table';
  ELSE
    RAISE NOTICE 'global_category column already exists';
  END IF;
END $$;

-- Add check constraint for valid global categories
ALTER TABLE topics DROP CONSTRAINT IF EXISTS valid_global_category;
ALTER TABLE topics ADD CONSTRAINT valid_global_category
  CHECK (
    global_category IS NULL OR
    global_category IN ('aptitude', 'career_prep', 'general_knowledge', 'life_skills')
  );

COMMENT ON COLUMN topics.global_category IS 'Global quiz category. NULL = curriculum-based topic. Values: aptitude (psychometric tests), career_prep (career/employment), general_knowledge (trivia/quizzes), life_skills (driving, digital literacy, etc.)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_topics_global_category ON topics(global_category) WHERE global_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topics_global_category_active ON topics(global_category, is_active) WHERE global_category IS NOT NULL;

-- ============================================================================
-- STEP 2: BEFORE STATE ANALYSIS
-- ============================================================================

DO $$
DECLARE
  total_global_before integer;
  total_country_exam_before integer;
  total_school_before integer;
BEGIN
  SELECT COUNT(*) INTO total_global_before
  FROM question_sets
  WHERE country_id IS NULL AND exam_system_id IS NULL AND school_id IS NULL
    AND is_active = true AND approval_status = 'approved';

  SELECT COUNT(*) INTO total_country_exam_before
  FROM question_sets
  WHERE (country_id IS NOT NULL OR exam_system_id IS NOT NULL)
    AND school_id IS NULL
    AND is_active = true AND approval_status = 'approved';

  SELECT COUNT(*) INTO total_school_before
  FROM question_sets
  WHERE school_id IS NOT NULL
    AND is_active = true AND approval_status = 'approved';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BEFORE STATE:';
  RAISE NOTICE 'Total GLOBAL quizzes: %', total_global_before;
  RAISE NOTICE 'Total COUNTRY/EXAM quizzes: %', total_country_exam_before;
  RAISE NOTICE 'Total SCHOOL quizzes: %', total_school_before;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 3: AUTO-CATEGORIZE TRULY GLOBAL TOPICS
-- ============================================================================

-- Mark aptitude/psychometric test topics
UPDATE topics
SET global_category = 'aptitude'
WHERE global_category IS NULL
  AND (
    name ~* 'numerical reasoning|verbal reasoning|logical reasoning|abstract reasoning|situational judgement|psychometric|aptitude'
    OR (subject = 'other' AND name ~* 'reasoning|test|assessment')
  )
  AND school_id IS NULL
  AND exam_system_id IS NULL;

-- Mark career prep topics
UPDATE topics
SET global_category = 'career_prep'
WHERE global_category IS NULL
  AND name ~* 'interview|workplace|career|employment|cv|resume|entrepreneurship|leadership|financial literacy|employability'
  AND school_id IS NULL
  AND exam_system_id IS NULL;

-- Mark general knowledge topics
UPDATE topics
SET global_category = 'general_knowledge'
WHERE global_category IS NULL
  AND name ~* 'general knowledge|trivia|world capitals|billionaire|history quiz|science quiz|sports quiz|current affairs|geography quiz|tech trivia'
  AND school_id IS NULL
  AND exam_system_id IS NULL;

-- Mark life skills topics
UPDATE topics
SET global_category = 'life_skills'
WHERE global_category IS NULL
  AND name ~* 'driving theory|digital literacy|study skills|productivity|life skills|ai basics|technology basics'
  AND school_id IS NULL
  AND exam_system_id IS NULL;

-- ============================================================================
-- STEP 4: IDENTIFY MISCLASSIFIED QUIZZES (CURRICULUM CONTENT IN GLOBAL)
-- ============================================================================

-- This creates a temporary view to identify curriculum quizzes misclassified as global
CREATE OR REPLACE VIEW misclassified_global_quizzes AS
SELECT
  qs.id,
  qs.title,
  t.name as topic_name,
  t.subject,
  -- Detect which country this belongs to
  CASE
    WHEN qs.title ~* 'A-Level|A Level|GCSE|IGCSE|BTEC|T-Level|Scottish' THEN 'UK'
    WHEN qs.title ~* 'BECE|WASSCE|SSCE' OR t.name ~* 'BECE|WASSCE|SSCE' THEN 'Ghana'
    WHEN qs.title ~* '\mSAT\M|\mACT\M|AP Exam|GED|GRE|GMAT' OR t.name ~* '\mSAT\M|\mACT\M|AP Exam|GED' THEN 'USA'
    WHEN qs.title ~* 'OSSD|Provincial|CEGEP' OR t.name ~* 'OSSD|Provincial|CEGEP' THEN 'Canada'
    WHEN qs.title ~* 'WAEC|NECO|JAMB|NABTEB' OR t.name ~* 'WAEC|NECO|JAMB' THEN 'Nigeria'
    WHEN qs.title ~* 'CBSE|ICSE|ISC|JEE|NEET|CUET' OR t.name ~* 'CBSE|ICSE|JEE|NEET' THEN 'India'
    WHEN qs.title ~* 'ATAR|HSC|VCE|GAMSAT|UCAT' OR t.name ~* 'ATAR|HSC|VCE' THEN 'Australia'
    WHEN qs.title ~* 'IELTS|TOEFL|Cambridge|IB Diploma|PTE' OR t.name ~* 'IELTS|TOEFL|IB' THEN 'International'
    ELSE NULL
  END as suggested_country,
  -- Detect which exam system
  CASE
    WHEN qs.title ~* '\bA-Level\b|\bA Level\b' OR t.name ~* '\bA-Level\b|\bA Level\b' THEN 'A-Levels'
    WHEN qs.title ~* '\bGCSE\b' OR t.name ~* '\bGCSE\b' THEN 'GCSE'
    WHEN qs.title ~* '\bIGCSE\b' OR t.name ~* '\bIGCSE\b' THEN 'IGCSE'
    WHEN qs.title ~* '\bBTEC\b' OR t.name ~* '\bBTEC\b' THEN 'BTEC'
    WHEN qs.title ~* 'T-Level' OR t.name ~* 'T-Level' THEN 'T-Levels'
    WHEN qs.title ~* '\bBECE\b' OR t.name ~* '\bBECE\b' THEN 'BECE'
    WHEN qs.title ~* '\bWASSCE\b' OR t.name ~* '\bWASSCE\b' THEN 'WASSCE'
    WHEN qs.title ~* '\bSSCE\b' OR t.name ~* '\bSSCE\b' THEN 'SSCE'
    WHEN qs.title ~* '\mSAT\M' OR t.name ~* '\mSAT\M' THEN 'SAT'
    WHEN qs.title ~* '\mACT\M' OR t.name ~* '\mACT\M' THEN 'ACT'
    WHEN qs.title ~* 'AP Exam|Advanced Placement' OR t.name ~* 'AP Exam' THEN 'AP Exams'
    WHEN qs.title ~* '\bGED\b' OR t.name ~* '\bGED\b' THEN 'GED'
    WHEN qs.title ~* '\bWAEC\b' OR t.name ~* '\bWAEC\b' THEN 'WAEC'
    WHEN qs.title ~* '\bNECO\b' OR t.name ~* '\bNECO\b' THEN 'NECO'
    WHEN qs.title ~* '\bJAMB\b' OR t.name ~* '\bJAMB\b' THEN 'JAMB'
    WHEN qs.title ~* '\bCBSE\b' OR t.name ~* '\bCBSE\b' THEN 'CBSE'
    WHEN qs.title ~* '\bICSE\b' OR t.name ~* '\bICSE\b' THEN 'ICSE'
    WHEN qs.title ~* '\bJEE\b' OR t.name ~* '\bJEE\b' THEN 'JEE'
    WHEN qs.title ~* '\bNEET\b' OR t.name ~* '\bNEET\b' THEN 'NEET'
    ELSE NULL
  END as suggested_exam
FROM question_sets qs
LEFT JOIN topics t ON qs.topic_id = t.id
WHERE qs.country_id IS NULL
  AND qs.exam_system_id IS NULL
  AND qs.school_id IS NULL
  AND qs.is_active = true
  AND (
    qs.title ~* 'A-Level|GCSE|IGCSE|BTEC|BECE|WASSCE|SSCE|SAT|ACT|AP Exam|GED|WAEC|NECO|JAMB|CBSE|ICSE|JEE|NEET|IELTS|TOEFL'
    OR t.name ~* 'A-Level|GCSE|IGCSE|BTEC|BECE|WASSCE|SSCE|SAT|ACT|AP Exam|GED|WAEC|NECO|JAMB|CBSE|ICSE|JEE|NEET|IELTS|TOEFL'
  );

-- Show misclassified quizzes
DO $$
DECLARE
  misclassified_count integer;
BEGIN
  SELECT COUNT(*) INTO misclassified_count FROM misclassified_global_quizzes;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MISCLASSIFIED QUIZZES FOUND: %', misclassified_count;
  RAISE NOTICE '========================================';

  IF misclassified_count > 0 THEN
    RAISE NOTICE 'Run this query to see details:';
    RAISE NOTICE 'SELECT * FROM misclassified_global_quizzes ORDER BY suggested_country, suggested_exam;';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: ADD SCOPE VALIDATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_quiz_scope()
RETURNS TRIGGER AS $$
DECLARE
  scope_count integer := 0;
BEGIN
  -- School scope
  IF NEW.school_id IS NOT NULL THEN
    scope_count := scope_count + 1;
  END IF;

  -- Country/Exam scope
  IF NEW.country_id IS NOT NULL OR NEW.exam_system_id IS NOT NULL THEN
    scope_count := scope_count + 1;
  END IF;

  -- Prevent multiple scopes
  IF scope_count > 1 THEN
    RAISE EXCEPTION 'Quiz cannot belong to multiple scopes. Set either school_id OR (country_id/exam_system_id) OR neither (for global).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_quiz_scope ON question_sets;
CREATE TRIGGER enforce_quiz_scope
  BEFORE INSERT OR UPDATE ON question_sets
  FOR EACH ROW
  EXECUTE FUNCTION validate_quiz_scope();

-- ============================================================================
-- STEP 6: CREATE SCOPE CLASSIFICATION VIEW
-- ============================================================================

CREATE OR REPLACE VIEW quiz_scope_classification AS
SELECT
  qs.id,
  qs.title,
  qs.country_id,
  qs.exam_system_id,
  qs.school_id,
  qs.approval_status,
  qs.is_active,
  t.name as topic_name,
  t.global_category,
  c.name as country_name,
  e.name as exam_name,
  s.name as school_name,
  CASE
    WHEN qs.school_id IS NOT NULL THEN 'SCHOOL'
    WHEN qs.country_id IS NOT NULL OR qs.exam_system_id IS NOT NULL THEN 'COUNTRY/EXAM'
    WHEN qs.country_id IS NULL AND qs.exam_system_id IS NULL AND qs.school_id IS NULL THEN 'GLOBAL'
    ELSE 'UNKNOWN'
  END as scope_type,
  CASE
    WHEN qs.country_id IS NULL AND qs.exam_system_id IS NULL AND qs.school_id IS NULL
         AND (qs.title ~* 'A-Level|GCSE|BECE|WASSCE|SAT|ACT|WAEC|NECO|CBSE|ICSE|JEE|NEET'
              OR t.name ~* 'A-Level|GCSE|BECE|WASSCE|SAT|ACT|WAEC|NECO|CBSE|ICSE|JEE|NEET')
    THEN true
    ELSE false
  END as possibly_misclassified
FROM question_sets qs
LEFT JOIN topics t ON qs.topic_id = t.id
LEFT JOIN countries c ON qs.country_id = c.id
LEFT JOIN exam_systems e ON qs.exam_system_id = e.id
LEFT JOIN schools s ON qs.school_id = s.id
WHERE qs.is_active = true;

-- ============================================================================
-- STEP 7: ADD PERFORMANCE INDEXES
-- ============================================================================

-- Global quiz queries
CREATE INDEX IF NOT EXISTS idx_question_sets_global_scope
  ON question_sets(approval_status, is_active, created_at DESC)
  WHERE country_id IS NULL AND exam_system_id IS NULL AND school_id IS NULL;

-- Country/Exam queries
CREATE INDEX IF NOT EXISTS idx_question_sets_country_exam_scope
  ON question_sets(country_id, exam_system_id, approval_status, is_active, created_at DESC)
  WHERE school_id IS NULL;

-- School queries
CREATE INDEX IF NOT EXISTS idx_question_sets_school_scope
  ON question_sets(school_id, approval_status, is_active, created_at DESC)
  WHERE school_id IS NOT NULL;

-- ============================================================================
-- STEP 8: FINAL REPORT
-- ============================================================================

DO $$
DECLARE
  total_global_after integer;
  total_country_exam_after integer;
  total_school_after integer;
  misclassified_count integer;
  global_with_category integer;
  global_without_category integer;
BEGIN
  SELECT COUNT(*) INTO total_global_after
  FROM question_sets
  WHERE country_id IS NULL AND exam_system_id IS NULL AND school_id IS NULL
    AND is_active = true AND approval_status = 'approved';

  SELECT COUNT(*) INTO total_country_exam_after
  FROM question_sets
  WHERE (country_id IS NOT NULL OR exam_system_id IS NOT NULL)
    AND school_id IS NULL
    AND is_active = true AND approval_status = 'approved';

  SELECT COUNT(*) INTO total_school_after
  FROM question_sets
  WHERE school_id IS NOT NULL
    AND is_active = true AND approval_status = 'approved';

  SELECT COUNT(*) INTO misclassified_count
  FROM quiz_scope_classification
  WHERE possibly_misclassified = true AND approval_status = 'approved';

  SELECT COUNT(DISTINCT t.id) INTO global_with_category
  FROM topics t
  WHERE t.global_category IS NOT NULL AND t.is_active = true;

  SELECT COUNT(DISTINCT qs.id) INTO global_without_category
  FROM question_sets qs
  LEFT JOIN topics t ON qs.topic_id = t.id
  WHERE qs.country_id IS NULL
    AND qs.exam_system_id IS NULL
    AND qs.school_id IS NULL
    AND qs.approval_status = 'approved'
    AND qs.is_active = true
    AND t.global_category IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'GLOBAL QUIZ TAXONOMY CORRECTION - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AFTER STATE:';
  RAISE NOTICE 'Total GLOBAL quizzes: %', total_global_after;
  RAISE NOTICE 'Total COUNTRY/EXAM quizzes: %', total_country_exam_after;
  RAISE NOTICE 'Total SCHOOL quizzes: %', total_school_after;
  RAISE NOTICE '';
  RAISE NOTICE 'GLOBAL BREAKDOWN:';
  RAISE NOTICE 'Topics with global_category set: %', global_with_category;
  RAISE NOTICE 'Quizzes without category (needs review): %', global_without_category;
  RAISE NOTICE 'Possibly misclassified (curriculum): %', misclassified_count;
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Review: SELECT * FROM misclassified_global_quizzes;';
  RAISE NOTICE '2. Manually reassign curriculum quizzes to correct country/exam';
  RAISE NOTICE '3. Update UI to filter by global_category';
  RAISE NOTICE '========================================';
END $$;
