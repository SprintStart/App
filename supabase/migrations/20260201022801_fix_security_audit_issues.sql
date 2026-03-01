/*
  # Fix Security Audit Issues

  ## Changes Made
  
  ### 1. Fix SECURITY DEFINER View Issue
  - Drop and recreate `sponsor_banners` view without SECURITY DEFINER
  - Use `security_invoker = true` option for explicit security invoker behavior
  - The view now respects RLS policies on the underlying `sponsored_ads` table
  - Public users can only see active banners within date range (enforced by RLS)
  
  ### 2. Fix Function Search Path Mutable Warning
  - Update both `sync_stripe_subscription_to_subscriptions` functions:
    - Set explicit `search_path = pg_catalog, public`
    - Schema-qualify all table references with `public.`
    - Maintain SECURITY DEFINER for webhook functionality
  - Revoke execute permissions from anon/authenticated users
  - Grant execute only to service_role (for Edge Functions/webhooks)
  
  ## Security Improvements
  - No more SECURITY DEFINER view bypass of RLS
  - No more search_path attack surface on functions
  - Functions can only be called by service role (server-side only)
  - All user-facing access goes through proper RLS policies
*/

-- =====================================================
-- Part 1: Fix SECURITY DEFINER View
-- =====================================================

-- Drop existing view
DROP VIEW IF EXISTS public.sponsor_banners CASCADE;

-- Recreate as normal view with security_invoker
CREATE VIEW public.sponsor_banners
WITH (security_invoker = true)
AS
SELECT 
  id,
  title,
  image_url,
  destination_url AS target_url,
  placement,
  is_active,
  start_date AS start_at,
  end_date AS end_at,
  display_order,
  created_by,
  created_at,
  updated_at
FROM public.sponsored_ads
WHERE is_active = true 
  AND (start_date IS NULL OR start_date <= CURRENT_DATE) 
  AND (end_date IS NULL OR end_date >= CURRENT_DATE);

-- Grant SELECT to anon and authenticated (RLS will control access)
GRANT SELECT ON public.sponsor_banners TO anon, authenticated;

-- =====================================================
-- Part 2: Fix Function Search Path Issues
-- =====================================================

-- Fix the trigger function (no parameters)
CREATE OR REPLACE FUNCTION public.sync_stripe_subscription_to_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid;
  v_status text;
  v_period_end timestamptz;
BEGIN
  -- Get user_id from customer_id
  SELECT user_id INTO v_user_id
  FROM public.stripe_customers
  WHERE customer_id = NEW.customer_id;

  IF v_user_id IS NULL THEN
    RAISE WARNING 'No user found for customer_id: %', NEW.customer_id;
    RETURN NEW;
  END IF;

  -- Map Stripe status to our status
  v_status := CASE
    WHEN NEW.status IN ('active', 'trialing') THEN NEW.status
    WHEN NEW.status = 'past_due' THEN 'past_due'
    WHEN NEW.status IN ('canceled', 'unpaid') THEN 'canceled'
    ELSE 'expired'
  END;

  -- Convert Unix timestamp to timestamptz
  IF NEW.current_period_end IS NOT NULL THEN
    v_period_end := pg_catalog.to_timestamp(NEW.current_period_end);
  END IF;

  -- Upsert into subscriptions table
  INSERT INTO public.subscriptions (
    user_id,
    status,
    plan,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    updated_at
  ) VALUES (
    v_user_id,
    v_status,
    'teacher_annual',
    NEW.customer_id,
    NEW.subscription_id,
    CASE WHEN NEW.current_period_start IS NOT NULL 
      THEN pg_catalog.to_timestamp(NEW.current_period_start) 
    END,
    v_period_end,
    pg_catalog.now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = pg_catalog.now();

  RETURN NEW;
END;
$function$;

-- Fix the parameterized function
CREATE OR REPLACE FUNCTION public.sync_stripe_subscription_to_subscriptions(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    status,
    current_period_start,
    current_period_end,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    pg_catalog.now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = pg_catalog.now();
END;
$function$;

-- =====================================================
-- Part 3: Lock Down Function Permissions
-- =====================================================

-- Revoke all from public/anon/authenticated on trigger function
REVOKE ALL ON FUNCTION public.sync_stripe_subscription_to_subscriptions() 
FROM public, anon, authenticated;

-- Revoke all from public/anon/authenticated on parameterized function
REVOKE ALL ON FUNCTION public.sync_stripe_subscription_to_subscriptions(
  uuid, text, text, timestamptz, timestamptz
) FROM public, anon, authenticated;

-- Grant execute only to service_role (for Edge Functions/webhooks)
GRANT EXECUTE ON FUNCTION public.sync_stripe_subscription_to_subscriptions() 
TO service_role;

GRANT EXECUTE ON FUNCTION public.sync_stripe_subscription_to_subscriptions(
  uuid, text, text, timestamptz, timestamptz
) TO service_role;
