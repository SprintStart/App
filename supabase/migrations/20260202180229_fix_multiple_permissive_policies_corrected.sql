/*
  # Fix Multiple Permissive Policies (Column Names Corrected)
  
  ## Summary
  Resolve policy conflicts by consolidating overlapping permissive policies.
*/

-- 1. AUDIT_LOGS
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "View audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    target_entity_id = (SELECT auth.uid()) OR
    actor_admin_id = (SELECT auth.uid())
  );

-- 2. PUBLIC_QUIZ_ANSWERS (keep restrictive deny, simplify view)
DROP POLICY IF EXISTS "Anyone can view answers for own runs" ON public.public_quiz_answers;
CREATE POLICY "View quiz answers"
  ON public.public_quiz_answers FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.public_quiz_runs
      WHERE public_quiz_runs.id = public_quiz_answers.run_id
    )
  );

-- 3. PUBLIC_QUIZ_RUNS (keep restrictive deny, simplify others)
DROP POLICY IF EXISTS "Anyone can view own runs" ON public.public_quiz_runs;
DROP POLICY IF EXISTS "Anyone can update own runs" ON public.public_quiz_runs;
CREATE POLICY "View quiz runs"
  ON public.public_quiz_runs FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY "Update quiz runs"
  ON public.public_quiz_runs FOR UPDATE TO authenticated, anon
  USING (true) WITH CHECK (true);

-- 4. QUESTION_SETS
DROP POLICY IF EXISTS "Teachers can create question sets" ON public.question_sets;
DROP POLICY IF EXISTS "Public can view active approved question sets" ON public.question_sets;
DROP POLICY IF EXISTS "Teachers can view own question sets" ON public.question_sets;
DROP POLICY IF EXISTS "Teachers can update own question sets" ON public.question_sets;
CREATE POLICY "Manage question sets"
  ON public.question_sets FOR ALL TO authenticated
  USING (is_admin_by_id((SELECT auth.uid())) OR created_by = (SELECT auth.uid()))
  WITH CHECK (is_admin_by_id((SELECT auth.uid())) OR created_by = (SELECT auth.uid()));
CREATE POLICY "View active question sets"
  ON public.question_sets FOR SELECT TO anon
  USING (is_active = true AND approval_status = 'approved');

-- 5. QUIZ_SESSIONS
DROP POLICY IF EXISTS "Authenticated users can create own session" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Anyone can view own session by session_id" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Anyone can update own session" ON public.quiz_sessions;
CREATE POLICY "Manage quiz sessions"
  ON public.quiz_sessions FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

-- 6. SCHOOLS
DROP POLICY IF EXISTS "Teachers can view own school" ON public.schools;
CREATE POLICY "View schools"
  ON public.schools FOR SELECT TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.teacher_school_membership
      WHERE teacher_school_membership.school_id = schools.id
      AND teacher_school_membership.teacher_id = (SELECT auth.uid())
      AND teacher_school_membership.is_active = true
    )
  );

-- 7. SPONSORED_ADS
DROP POLICY IF EXISTS "Public can view active sponsored ads" ON public.sponsored_ads;
DROP POLICY IF EXISTS "Anon can view active sponsored ads" ON public.sponsored_ads;
CREATE POLICY "View active ads"
  ON public.sponsored_ads FOR SELECT TO authenticated, anon
  USING (is_active = true AND end_date > now());

-- 8. SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Manage subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (is_admin_by_id((SELECT auth.uid())) OR user_id = (SELECT auth.uid()))
  WITH CHECK (is_admin_by_id((SELECT auth.uid())) OR user_id = (SELECT auth.uid()));

-- 9. TOPIC_QUESTIONS
DROP POLICY IF EXISTS "Teachers can delete own questions" ON public.topic_questions;
DROP POLICY IF EXISTS "Teachers can create questions" ON public.topic_questions;
DROP POLICY IF EXISTS "Public can view questions for approved sets" ON public.topic_questions;
DROP POLICY IF EXISTS "Teachers can view own questions" ON public.topic_questions;
DROP POLICY IF EXISTS "Teachers can update own questions" ON public.topic_questions;
CREATE POLICY "Manage questions"
  ON public.topic_questions FOR ALL TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );
CREATE POLICY "View approved questions"
  ON public.topic_questions FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.is_active = true
      AND qs.approval_status = 'approved'
    )
  );

-- 10. TOPIC_RUN_ANSWERS
DROP POLICY IF EXISTS "Teachers can view answers for own content" ON public.topic_run_answers;
DROP POLICY IF EXISTS "Users can view answers for own runs" ON public.topic_run_answers;
CREATE POLICY "View run answers"
  ON public.topic_run_answers FOR SELECT TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (SELECT 1 FROM public.topic_runs tr WHERE tr.id = topic_run_answers.run_id AND tr.user_id = (SELECT auth.uid())) OR
    EXISTS (SELECT 1 FROM public.topic_runs tr JOIN public.topics t ON t.id = tr.topic_id WHERE tr.id = topic_run_answers.run_id AND t.created_by = (SELECT auth.uid()))
  );

-- 11. TOPIC_RUNS
DROP POLICY IF EXISTS "Teachers can view runs for own content" ON public.topic_runs;
DROP POLICY IF EXISTS "Users can view own runs" ON public.topic_runs;
CREATE POLICY "View topic runs"
  ON public.topic_runs FOR SELECT TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    user_id = (SELECT auth.uid()) OR
    EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_runs.topic_id AND t.created_by = (SELECT auth.uid()))
  );

-- 12. TOPICS
DROP POLICY IF EXISTS "Teachers can create topics" ON public.topics;
DROP POLICY IF EXISTS "Public can view active topics" ON public.topics;
DROP POLICY IF EXISTS "Teachers can update own topics" ON public.topics;
CREATE POLICY "Manage topics"
  ON public.topics FOR ALL TO authenticated
  USING (is_admin_by_id((SELECT auth.uid())) OR created_by = (SELECT auth.uid()))
  WITH CHECK (is_admin_by_id((SELECT auth.uid())) OR created_by = (SELECT auth.uid()));
CREATE POLICY "View active topics"
  ON public.topics FOR SELECT TO anon
  USING (is_active = true);
