/*
  # Fix Teacher Payment Flow - Database Integration
  
  1. Purpose
    - Sync stripe_subscriptions table with subscriptions table
    - Add database trigger to automatically sync subscription data
    - Ensure teacher accounts are properly linked to Stripe customers
    
  2. Changes
    - Add function to sync stripe subscription data to subscriptions table
    - Create trigger on stripe_subscriptions to auto-sync
    - Add helper function to get user_id from stripe customer_id
    
  3. Security
    - Function runs with security definer to allow system-level syncing
    - Maintains proper RLS on subscriptions table
    
  4. Important Notes
    - This ensures the app's useSubscription hook (which reads subscriptions table)
      stays in sync with Stripe webhook updates (which write to stripe_subscriptions)
    - The two-table approach provides separation between Stripe integration and app logic
*/

-- ============================================================================
-- Helper function to get user_id from stripe customer_id
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_id_from_customer(stripe_customer_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT user_id INTO user_uuid
  FROM stripe_customers
  WHERE customer_id = stripe_customer_id
    AND deleted_at IS NULL
  LIMIT 1;
  
  RETURN user_uuid;
END;
$$;

-- ============================================================================
-- Function to sync stripe_subscriptions to subscriptions table
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_stripe_subscription_to_subscriptions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  teacher_user_id UUID;
  subscription_status_value TEXT;
BEGIN
  -- Get the user_id from stripe_customers table
  SELECT user_id INTO teacher_user_id
  FROM stripe_customers
  WHERE customer_id = NEW.customer_id
    AND deleted_at IS NULL
  LIMIT 1;
  
  -- If we can't find the user, log and exit
  IF teacher_user_id IS NULL THEN
    RAISE WARNING 'sync_stripe_subscription: No user_id found for customer_id %', NEW.customer_id;
    RETURN NEW;
  END IF;
  
  -- Map stripe status to our subscription status
  subscription_status_value := NEW.status::TEXT;
  
  -- Upsert into subscriptions table
  INSERT INTO subscriptions (
    teacher_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan_type,
    status,
    current_period_start,
    current_period_end,
    updated_at
  ) VALUES (
    teacher_user_id,
    NEW.customer_id,
    NEW.subscription_id,
    'teacher_annual',
    subscription_status_value,
    to_timestamp(NEW.current_period_start),
    to_timestamp(NEW.current_period_end),
    NOW()
  )
  ON CONFLICT (teacher_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
  
  RAISE NOTICE 'sync_stripe_subscription: Synced subscription for user % with status %', teacher_user_id, subscription_status_value;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Create trigger to auto-sync on stripe_subscriptions changes
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_stripe_subscription ON stripe_subscriptions;

CREATE TRIGGER trigger_sync_stripe_subscription
  AFTER INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_stripe_subscription_to_subscriptions();

-- ============================================================================
-- Ensure email column exists on profiles (for Stripe checkout)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;
END $$;
