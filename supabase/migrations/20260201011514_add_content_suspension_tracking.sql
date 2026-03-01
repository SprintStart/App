/*
  # Add Content Suspension Tracking for Teacher Subscriptions
  
  1. Changes to question_sets
    - Add `suspended_due_to_subscription` - Tracks if content was auto-hidden due to expired subscription
    - Add `published_before_suspension` - Stores original is_active state before suspension
    - Add `suspended_at` - Timestamp when content was suspended
  
  2. Changes to topics
    - Add same suspension tracking fields
  
  3. Purpose
    - When teacher subscription expires, automatically hide all their content
    - When teacher renews, automatically restore content to previous state
    - Prevents expired teachers from having active content on platform
  
  4. Security
    - Only affects teacher-created content (created_by field)
    - Preserves original state for restoration
    - Audit trail via timestamps
*/

-- Add suspension tracking to question_sets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'suspended_due_to_subscription'
  ) THEN
    ALTER TABLE question_sets
    ADD COLUMN suspended_due_to_subscription boolean DEFAULT false,
    ADD COLUMN published_before_suspension boolean,
    ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

-- Add suspension tracking to topics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'suspended_due_to_subscription'
  ) THEN
    ALTER TABLE topics
    ADD COLUMN suspended_due_to_subscription boolean DEFAULT false,
    ADD COLUMN published_before_suspension boolean,
    ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

-- Create function to suspend teacher content
CREATE OR REPLACE FUNCTION suspend_teacher_content(teacher_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Suspend question sets
  UPDATE question_sets
  SET 
    published_before_suspension = is_active,
    suspended_due_to_subscription = true,
    is_active = false,
    suspended_at = now(),
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_active = true
    AND suspended_due_to_subscription = false;

  -- Suspend topics
  UPDATE topics
  SET 
    published_before_suspension = is_active,
    suspended_due_to_subscription = true,
    is_active = false,
    suspended_at = now(),
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_active = true
    AND suspended_due_to_subscription = false;

  RAISE NOTICE 'Suspended content for teacher: %', teacher_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to restore teacher content
CREATE OR REPLACE FUNCTION restore_teacher_content(teacher_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Restore question sets to their previous state
  UPDATE question_sets
  SET 
    is_active = COALESCE(published_before_suspension, false),
    suspended_due_to_subscription = false,
    published_before_suspension = NULL,
    suspended_at = NULL,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND suspended_due_to_subscription = true;

  -- Restore topics to their previous state
  UPDATE topics
  SET 
    is_active = COALESCE(published_before_suspension, false),
    suspended_due_to_subscription = false,
    published_before_suspension = NULL,
    suspended_at = NULL,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND suspended_due_to_subscription = true;

  RAISE NOTICE 'Restored content for teacher: %', teacher_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-suspend content when subscription expires
CREATE OR REPLACE FUNCTION auto_manage_teacher_content()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_old_status text;
  v_new_status text;
  v_old_period_end timestamptz;
  v_new_period_end timestamptz;
  v_is_now_expired boolean;
  v_was_expired boolean;
BEGIN
  v_user_id := NEW.user_id;
  v_new_status := NEW.status;
  v_new_period_end := NEW.current_period_end;

  IF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.status;
    v_old_period_end := OLD.current_period_end;
  ELSE
    v_old_status := 'not_started';
    v_old_period_end := NULL;
  END IF;

  -- Determine if subscription was expired before
  v_was_expired := (
    v_old_status NOT IN ('active', 'trialing')
    OR (v_old_period_end IS NOT NULL AND v_old_period_end < now())
  );

  -- Determine if subscription is expired now
  v_is_now_expired := (
    v_new_status NOT IN ('active', 'trialing')
    OR (v_new_period_end IS NOT NULL AND v_new_period_end < now())
  );

  -- If status changed from active to expired
  IF NOT v_was_expired AND v_is_now_expired THEN
    RAISE NOTICE 'Subscription expired for user %, suspending content', v_user_id;
    PERFORM suspend_teacher_content(v_user_id);
  END IF;

  -- If status changed from expired to active
  IF v_was_expired AND NOT v_is_now_expired THEN
    RAISE NOTICE 'Subscription activated for user %, restoring content', v_user_id;
    PERFORM restore_teacher_content(v_user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on subscriptions table
DROP TRIGGER IF EXISTS trigger_auto_manage_teacher_content ON subscriptions;
CREATE TRIGGER trigger_auto_manage_teacher_content
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION auto_manage_teacher_content();

-- Add index for faster content suspension queries
CREATE INDEX IF NOT EXISTS idx_question_sets_suspended 
  ON question_sets(created_by, suspended_due_to_subscription) 
  WHERE suspended_due_to_subscription = true;

CREATE INDEX IF NOT EXISTS idx_topics_suspended 
  ON topics(created_by, suspended_due_to_subscription) 
  WHERE suspended_due_to_subscription = true;
