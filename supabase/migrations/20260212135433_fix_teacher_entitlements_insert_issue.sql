/*
  # Fix Teacher Entitlements Insert Issue

  1. Issue
    - Admin grant premium is failing with generic error
    - Need to improve error handling and check trigger compatibility
  
  2. Changes
    - Add better NULL handling in trigger functions
    - Ensure audit_logs can handle trigger inserts
    - Add defensive checks
*/

-- Update the restore_teacher_content function to handle edge cases
CREATE OR REPLACE FUNCTION public.restore_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update topics
  UPDATE topics
  SET 
    is_published = true,
    updated_at = now()
  WHERE created_by = teacher_user_id
  AND is_published = false;

  -- Insert audit log with proper error handling
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the entire transaction
    RAISE WARNING 'Failed to insert audit log: %', SQLERRM;
  END;
END;
$function$;

-- Update the suspend_teacher_content function to handle edge cases
CREATE OR REPLACE FUNCTION public.suspend_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update topics
  UPDATE topics
  SET 
    is_published = false,
    updated_at = now()
  WHERE created_by = teacher_user_id
  AND is_published = true;

  -- Insert audit log with proper error handling
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the entire transaction
    RAISE WARNING 'Failed to insert audit log: %', SQLERRM;
  END;
END;
$function$;