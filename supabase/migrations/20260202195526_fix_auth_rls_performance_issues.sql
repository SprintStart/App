/*
  # Fix Auth RLS Performance Issues
  
  1. Problem
    - Several RLS policies call auth functions without SELECT wrapper
    - This causes the function to be re-evaluated for each row
    - Results in poor query performance at scale
  
  2. Changes
    - Replace `auth.uid()` with `(select auth.uid())` in affected policies
    - Policies affected:
      - profiles: "Admins can read all profiles"
      - system_health_checks: "Admins can view health checks"
      - stripe_customers: "Admins can read all stripe customers"
      - stripe_subscriptions: "Admins can read all stripe subscriptions"
  
  3. Security
    - No security changes, only performance optimization
    - Same access control logic maintained
*/

-- Fix profiles table admin policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- Fix system_health_checks table admin policy
DROP POLICY IF EXISTS "Admins can view health checks" ON system_health_checks;
CREATE POLICY "Admins can view health checks"
  ON system_health_checks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- Fix stripe_customers table admin policy
DROP POLICY IF EXISTS "Admins can read all stripe customers" ON stripe_customers;
CREATE POLICY "Admins can read all stripe customers"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- Fix stripe_subscriptions table admin policy
DROP POLICY IF EXISTS "Admins can read all stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "Admins can read all stripe subscriptions"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );
