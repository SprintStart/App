/*
  # Add school_id to topics + backfill

  1. Changes to `topics` table:
    - Add `school_id` column (uuid, references schools)
    - Backfill all existing topics to the Global school
    - Add index on school_id for fast queries

  2. Changes to `question_sets` table:
    - Add `school_id` column for faster direct queries
    - Backfill from parent topic

  3. Important:
    - All existing topics and question_sets are assigned to the Global school
    - New teacher-created content will be assigned to their school
*/

DO $$
DECLARE
  global_id uuid;
BEGIN
  SELECT id INTO global_id FROM public.schools WHERE slug = 'global' LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN school_id uuid REFERENCES public.schools(id);
  END IF;

  UPDATE public.topics SET school_id = global_id WHERE school_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE public.question_sets ADD COLUMN school_id uuid REFERENCES public.schools(id);
  END IF;

  UPDATE public.question_sets qs
  SET school_id = t.school_id
  FROM public.topics t
  WHERE qs.topic_id = t.id AND qs.school_id IS NULL;

  UPDATE public.question_sets SET school_id = global_id WHERE school_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_topics_school_id ON public.topics(school_id);
CREATE INDEX IF NOT EXISTS idx_topics_school_published ON public.topics(school_id, is_published, is_active)
  WHERE is_published = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_question_sets_school_id ON public.question_sets(school_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_school_approved ON public.question_sets(school_id, approval_status, is_active)
  WHERE approval_status = 'approved' AND is_active = true;
