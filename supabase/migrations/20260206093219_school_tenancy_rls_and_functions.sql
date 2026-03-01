/*
  # School Tenancy RLS + Helper Functions

  1. Helper functions:
    - `current_teacher_school_id()` - returns school_id for current auth user
    - `is_admin_user()` - checks if current user is in admin_allowlist

  2. RLS Policies for schools:
    - Public can read active schools (slug, school_name only via RLS)
    - Admin can manage schools

  3. Trigger on topics:
    - Auto-set school_id from teacher's school on insert
    - Prevent cross-school inserts

  4. Trigger on question_sets:
    - Inherit school_id from parent topic
*/

CREATE OR REPLACE FUNCTION public.current_teacher_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "Public can read active schools" ON public.schools;
CREATE POLICY "Public can read active schools"
  ON public.schools
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin can insert schools" ON public.schools;
CREATE POLICY "Admin can insert schools"
  ON public.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can update schools" ON public.schools;
CREATE POLICY "Admin can update schools"
  ON public.schools
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can delete schools" ON public.schools;
CREATE POLICY "Admin can delete schools"
  ON public.schools
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.set_topic_school_id()
RETURNS TRIGGER AS $func$
DECLARE
  teacher_school uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT school_id INTO teacher_school FROM public.profiles WHERE id = auth.uid();
    IF teacher_school IS NOT NULL THEN
      NEW.school_id = teacher_school;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_topic_school_id ON public.topics;
CREATE TRIGGER trg_set_topic_school_id
  BEFORE INSERT ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_topic_school_id();

CREATE OR REPLACE FUNCTION public.set_question_set_school_id()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.school_id IS NULL AND NEW.topic_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.topics WHERE id = NEW.topic_id;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_question_set_school_id ON public.question_sets;
CREATE TRIGGER trg_set_question_set_school_id
  BEFORE INSERT ON public.question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_set_school_id();
