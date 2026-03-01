/*
  # Fix Security Issues - Part 1: Add Missing Foreign Key Indexes

  ## Purpose
  Add indexes for all foreign keys to improve query performance.

  ## Changes
  - Add 12 missing foreign key indexes
  - Improves JOIN performance and foreign key constraint checks
*/

-- attempt_answers.question_id
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id 
  ON attempt_answers(question_id);

-- quiz_attempts foreign keys
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id 
  ON quiz_attempts(question_set_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_retry_of_attempt_id 
  ON quiz_attempts(retry_of_attempt_id) 
  WHERE retry_of_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id 
  ON quiz_attempts(topic_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id 
  ON quiz_attempts(user_id);

-- quiz_feedback foreign keys
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_school_id 
  ON quiz_feedback(school_id) 
  WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_feedback_session_id 
  ON quiz_feedback(session_id) 
  WHERE session_id IS NOT NULL;

-- support_tickets.school_id
CREATE INDEX IF NOT EXISTS idx_support_tickets_school_id 
  ON support_tickets(school_id) 
  WHERE school_id IS NOT NULL;

-- teacher_documents.generated_quiz_id
CREATE INDEX IF NOT EXISTS idx_teacher_documents_generated_quiz_id 
  ON teacher_documents(generated_quiz_id) 
  WHERE generated_quiz_id IS NOT NULL;

-- teacher_entitlements.teacher_user_id
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_teacher_user_id 
  ON teacher_entitlements(teacher_user_id);

-- teacher_quiz_drafts.published_topic_id
CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_published_topic_id 
  ON teacher_quiz_drafts(published_topic_id) 
  WHERE published_topic_id IS NOT NULL;

-- teacher_review_prompts.quiz_id
CREATE INDEX IF NOT EXISTS idx_teacher_review_prompts_quiz_id 
  ON teacher_review_prompts(quiz_id);
