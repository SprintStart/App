-- Diagnostic queries to check why quiz 4480b5ac-2aeb-470d-8ede-4ff182ac3215 has no questions

-- 1. Check if the question_set exists
SELECT
  id,
  title,
  approval_status,
  is_active,
  question_count,
  created_by,
  created_at
FROM question_sets
WHERE id = '4480b5ac-2aeb-470d-8ede-4ff182ac3215';

-- 2. Check if questions exist for this quiz (regardless of is_published)
SELECT
  id,
  question_text,
  is_published,
  created_by,
  created_at,
  order_index
FROM topic_questions
WHERE question_set_id = '4480b5ac-2aeb-470d-8ede-4ff182ac3215'
ORDER BY order_index;

-- 3. Check the count
SELECT COUNT(*) as total_questions
FROM topic_questions
WHERE question_set_id = '4480b5ac-2aeb-470d-8ede-4ff182ac3215';

-- 4. Check published questions count
SELECT COUNT(*) as published_questions
FROM topic_questions
WHERE question_set_id = '4480b5ac-2aeb-470d-8ede-4ff182ac3215'
AND is_published = true;

-- 5. Check the topic
SELECT
  t.id,
  t.name,
  t.is_published,
  t.is_active,
  t.subject
FROM topics t
JOIN question_sets qs ON qs.topic_id = t.id
WHERE qs.id = '4480b5ac-2aeb-470d-8ede-4ff182ac3215';

-- 6. Check RLS policies on topic_questions
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'topic_questions'
ORDER BY policyname;
