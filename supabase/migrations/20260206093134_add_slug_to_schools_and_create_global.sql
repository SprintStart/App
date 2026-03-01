/*
  # Add Slug to Schools + Create Global School

  1. Changes to `schools` table:
    - Add `slug` column (text, unique) for URL-based routing
    - Add index on `slug` for fast lookups
    - Add `updated_at` trigger

  2. Default Data:
    - Insert "Global" school for all existing/unassigned content

  3. Validation:
    - Slug must be lowercase alphanumeric + hyphens
    - Must start with a letter
    - 2-12 characters
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.schools ADD COLUMN slug text;
  END IF;
END $$;

UPDATE public.schools SET slug = lower(replace(replace(school_name, ' ', '-'), '''', '')) WHERE slug IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_slug_key'
  ) THEN
    ALTER TABLE public.schools ADD CONSTRAINT schools_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_slug ON public.schools(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schools_active ON public.schools(is_active) WHERE is_active = true;

INSERT INTO public.schools (school_name, slug, email_domains, default_plan, is_active, auto_approve_teachers)
SELECT 'Global', 'global', '{}', 'standard', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'global');

CREATE OR REPLACE FUNCTION public.update_schools_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_schools_updated_at ON public.schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schools_updated_at();
