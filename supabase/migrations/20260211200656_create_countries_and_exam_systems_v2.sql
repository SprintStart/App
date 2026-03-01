/*
  # Create Countries and Exam Systems Infrastructure

  1. New Tables
    - `countries` - Store countries/regions with emoji and metadata
    - `exam_systems` - Store exam systems per country (GCSE, SAT, WASSCE, etc.)
  
  2. Schema Updates
    - Add `exam_system_id` to `topics` table to tag content by exam
    - Add `exam_system_id` to `question_sets` table for exam-specific quizzes
  
  3. Seed Data
    - 8 Countries: UK, Ghana, USA, Canada, Nigeria, India, Australia, International
    - 38 Exam Systems across all countries as specified in the locked spec
  
  4. Security
    - Public read access for active countries and exam systems
    - Admin-only write access
  
  5. Indexes
    - Foreign key indexes for performance
    - Display order indexes for sorting
*/

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  emoji text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_systems table
CREATE TABLE IF NOT EXISTS exam_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  emoji text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add exam_system_id to topics (nullable for gradual migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'exam_system_id'
  ) THEN
    ALTER TABLE topics ADD COLUMN exam_system_id uuid REFERENCES exam_systems(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add exam_system_id to question_sets (nullable for gradual migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'exam_system_id'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN exam_system_id uuid REFERENCES exam_systems(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_systems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view active countries" ON countries;
DROP POLICY IF EXISTS "Admins can manage countries" ON countries;
DROP POLICY IF EXISTS "Public can view active exam systems" ON exam_systems;
DROP POLICY IF EXISTS "Admins can manage exam systems" ON exam_systems;

-- RLS Policies for countries
CREATE POLICY "Public can view active countries"
  ON countries FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

-- RLS Policies for exam_systems
CREATE POLICY "Public can view active exam systems"
  ON exam_systems FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage exam systems"
  ON exam_systems FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_exam_systems_country_id ON exam_systems(country_id);
CREATE INDEX IF NOT EXISTS idx_topics_exam_system_id ON topics(exam_system_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_exam_system_id ON question_sets(exam_system_id);
CREATE INDEX IF NOT EXISTS idx_countries_display_order ON countries(display_order);
CREATE INDEX IF NOT EXISTS idx_exam_systems_display_order ON exam_systems(display_order);

-- Seed Countries
INSERT INTO countries (name, slug, emoji, description, display_order, is_active) VALUES
('United Kingdom', 'uk', '🇬🇧', 'Old school chalk + board meets modern hustle.', 1, true),
('Ghana', 'ghana', '🇬🇭', 'Building futures through education.', 2, true),
('United States', 'usa', '🇺🇸', 'Land of multiple choice and scantron sheets.', 3, true),
('Canada', 'canada', '🇨🇦', 'Polite education excellence.', 4, true),
('Nigeria', 'nigeria', '🇳🇬', 'Academic excellence and determination.', 5, true),
('India', 'india', '🇮🇳', 'Next-level grind culture.', 6, true),
('Australia', 'australia', '🇦🇺', 'Down under, on top of education.', 7, true),
('International', 'international', '🌍', 'Visa passports of education.', 8, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed Exam Systems
INSERT INTO exam_systems (country_id, name, slug, emoji, description, display_order, is_active)
SELECT 
  c.id,
  e.name,
  e.slug,
  e.emoji,
  e.description,
  e.display_order,
  true
FROM countries c
CROSS JOIN LATERAL (
  VALUES
    -- UK exams
    ('uk', 'GCSE', 'gcse', '📘', 'General Certificate of Secondary Education', 1),
    ('uk', 'IGCSE', 'igcse', '📗', 'International General Certificate of Secondary Education', 2),
    ('uk', 'A-Levels', 'a-levels', '🎓', 'Advanced Level qualifications', 3),
    ('uk', 'BTEC', 'btec', '🛠️', 'Business and Technology Education Council', 4),
    ('uk', 'T-Levels', 't-levels', '📐', 'Technical Level qualifications', 5),
    ('uk', 'Scottish Nationals', 'scottish-nationals', '🏫', 'Scottish National qualifications', 6),
    ('uk', 'Scottish Highers', 'scottish-highers', '🏫', 'Scottish Higher qualifications', 7),
    ('uk', 'Scottish Advanced Highers', 'scottish-advanced-highers', '🏫', 'Scottish Advanced Higher qualifications', 8),
    
    -- Ghana exams
    ('ghana', 'BECE', 'bece', '📚', 'Basic Education Certificate Examination', 1),
    ('ghana', 'WASSCE', 'wassce', '🎓', 'West African Senior School Certificate Examination', 2),
    ('ghana', 'SSCE', 'ssce', '🎓', 'Senior Secondary Certificate Examination', 3),
    ('ghana', 'NVTI', 'nvti', '🧪', 'National Vocational Training Institute', 4),
    ('ghana', 'TVET', 'tvet', '🧪', 'Technical and Vocational Education and Training', 5),
    
    -- USA exams
    ('usa', 'SAT', 'sat', '📝', 'Scholastic Assessment Test', 1),
    ('usa', 'ACT', 'act', '✍️', 'American College Testing', 2),
    ('usa', 'AP Exams', 'ap', '🎓', 'Advanced Placement Exams', 3),
    ('usa', 'GED', 'ged', '📊', 'General Educational Development', 4),
    ('usa', 'GRE', 'gre', '🧠', 'Graduate Record Examination', 5),
    ('usa', 'GMAT', 'gmat', '💼', 'Graduate Management Admission Test', 6),
    
    -- Canada exams
    ('canada', 'OSSD', 'ossd', '📘', 'Ontario Secondary School Diploma', 1),
    ('canada', 'Provincial Exams', 'provincial', '🧮', 'Provincial standardized exams', 2),
    ('canada', 'CEGEP', 'cegep', '🎓', 'Collège d''enseignement général et professionnel', 3),
    
    -- Nigeria exams
    ('nigeria', 'WAEC', 'waec', '📚', 'West African Examinations Council', 1),
    ('nigeria', 'NECO', 'neco', '📝', 'National Examinations Council', 2),
    ('nigeria', 'JAMB', 'jamb', '🚪', 'Joint Admissions and Matriculation Board', 3),
    ('nigeria', 'NABTEB', 'nabteb', '🛠️', 'National Business and Technical Examinations Board', 4),
    
    -- India exams
    ('india', 'CBSE', 'cbse', '📖', 'Central Board of Secondary Education', 1),
    ('india', 'ICSE', 'icse', '📘', 'Indian Certificate of Secondary Education', 2),
    ('india', 'ISC', 'isc', '📘', 'Indian School Certificate', 3),
    ('india', 'JEE', 'jee', '🧪', 'Joint Entrance Examination', 4),
    ('india', 'NEET', 'neet', '🩺', 'National Eligibility cum Entrance Test', 5),
    ('india', 'CUET', 'cuet', '🎓', 'Common University Entrance Test', 6),
    
    -- Australia exams
    ('australia', 'ATAR', 'atar', '📘', 'Australian Tertiary Admission Rank', 1),
    ('australia', 'HSC', 'hsc', '📚', 'Higher School Certificate', 2),
    ('australia', 'VCE', 'vce', '🎓', 'Victorian Certificate of Education', 3),
    ('australia', 'GAMSAT', 'gamsat', '🧠', 'Graduate Australian Medical School Admissions Test', 4),
    ('australia', 'UCAT', 'ucat', '🧠', 'University Clinical Aptitude Test', 5),
    
    -- International exams
    ('international', 'IELTS', 'ielts', '🌐', 'International English Language Testing System', 1),
    ('international', 'TOEFL', 'toefl', '🌐', 'Test of English as a Foreign Language', 2),
    ('international', 'Cambridge International', 'cambridge', '🌐', 'Cambridge International Examinations', 3),
    ('international', 'IB Diploma', 'ib', '🌐', 'International Baccalaureate Diploma Programme', 4),
    ('international', 'PTE Academic', 'pte', '🌐', 'Pearson Test of English Academic', 5)
) AS e(country_slug, name, slug, emoji, description, display_order)
WHERE c.slug = e.country_slug
ON CONFLICT (slug) DO NOTHING;