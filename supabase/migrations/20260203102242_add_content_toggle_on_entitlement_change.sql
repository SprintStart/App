/*
  # Content Visibility Toggle on Entitlement Changes
  
  1. Purpose
    - Automatically suspend teacher content when entitlement expires or is revoked
    - Automatically restore teacher content when entitlement is granted or renewed
  
  2. Functions
    - toggle_teacher_content_on_entitlement_change() - Called when entitlement status changes
    - suspend_teacher_content(teacher_id) - Marks all teacher content as suspended
    - restore_teacher_content(teacher_id) - Restores all teacher content
  
  3. Trigger
    - Automatically runs when teacher_entitlements table is updated
*/

-- Function to suspend all content for a teacher
CREATE OR REPLACE FUNCTION suspend_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update topics to mark as suspended
  UPDATE topics
  SET 
    is_published = false,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_published = true;
  
  -- Log the suspension
  INSERT INTO audit_logs (
    action_type,
    target_entity_type,
    target_entity_id,
    reason,
    metadata
  ) VALUES (
    'suspend_content',
    'teacher',
    teacher_user_id,
    'Content suspended due to expired/revoked entitlement',
    jsonb_build_object(
      'suspended_at', now(),
      'automatic', true
    )
  );
END;
$$;

-- Function to restore all content for a teacher
CREATE OR REPLACE FUNCTION restore_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update topics to restore publication status
  UPDATE topics
  SET 
    is_published = true,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_published = false;
  
  -- Log the restoration
  INSERT INTO audit_logs (
    action_type,
    target_entity_type,
    target_entity_id,
    reason,
    metadata
  ) VALUES (
    'restore_content',
    'teacher',
    teacher_user_id,
    'Content restored due to active entitlement',
    jsonb_build_object(
      'restored_at', now(),
      'automatic', true
    )
  );
END;
$$;

-- Function to handle content toggle on entitlement changes
CREATE OR REPLACE FUNCTION toggle_teacher_content_on_entitlement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If entitlement becomes active, restore content
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    PERFORM restore_teacher_content(NEW.teacher_user_id);
  END IF;
  
  -- If entitlement becomes revoked or expired, suspend content
  IF (NEW.status = 'revoked' OR NEW.status = 'expired') AND OLD.status = 'active' THEN
    PERFORM suspend_teacher_content(NEW.teacher_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on teacher_entitlements
DROP TRIGGER IF EXISTS trigger_toggle_content_on_entitlement_change ON teacher_entitlements;
CREATE TRIGGER trigger_toggle_content_on_entitlement_change
  AFTER INSERT OR UPDATE ON teacher_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION toggle_teacher_content_on_entitlement_change();

-- Enhanced expire_old_entitlements to also handle content suspension
CREATE OR REPLACE FUNCTION expire_old_entitlements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_teacher_id uuid;
BEGIN
  -- Get all teachers with entitlements that need to be expired
  FOR expired_teacher_id IN
    SELECT DISTINCT teacher_user_id
    FROM teacher_entitlements
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    -- Update entitlements to expired status (trigger will handle content suspension)
    UPDATE teacher_entitlements
    SET status = 'expired',
        updated_at = now()
    WHERE teacher_user_id = expired_teacher_id
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now();
  END LOOP;
END;
$$;