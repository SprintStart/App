/*
  # Update RLS policies for seed data
  
  1. Changes
    - Update topics policy to allow reading topics with null created_by
    - Update question_sets policy to allow reading question sets with null created_by
    - Allow students to read question text and options (but not correct_index)
    
  2. Security
    - Maintain restriction on correct_index for students
    - Keep all other security policies intact
*/

-- Drop and recreate topics read policy
DROP POLICY IF EXISTS "Anyone can read active topics" ON topics;
CREATE POLICY "Anyone can read active topics"
  ON topics FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by IS NULL OR auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Drop and recreate question_sets read policy
DROP POLICY IF EXISTS "Anyone can read active question sets" ON question_sets;
CREATE POLICY "Anyone can read active question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (is_active = true OR created_by IS NULL OR auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Add policy for students to read question text and options (without correct_index)
CREATE POLICY "Students can read question text and options"
  ON topic_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );
