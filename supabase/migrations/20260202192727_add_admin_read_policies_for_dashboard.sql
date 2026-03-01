/*
  # Add Admin Read Policies for Dashboard

  1. Changes
    - Add admin SELECT policy for profiles table
    - Add admin SELECT policies for stripe_customers table
    - Add admin SELECT policies for stripe_subscriptions table
    
  2. Purpose
    - Allow admins in admin_allowlist to read all profiles for dashboard stats
    - Allow admins to read stripe customer and subscription data for dashboard
    
  3. Security
    - Policies check admin_allowlist table to verify admin status
    - Only authenticated users in admin_allowlist with is_active=true can access
*/

-- Add admin SELECT policy for profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can read all profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_allowlist
          WHERE admin_allowlist.email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
          )
          AND admin_allowlist.is_active = true
        )
      );
  END IF;
END $$;

-- Add admin SELECT policy for stripe_customers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_customers' 
    AND policyname = 'Admins can read all stripe customers'
  ) THEN
    CREATE POLICY "Admins can read all stripe customers"
      ON stripe_customers
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_allowlist
          WHERE admin_allowlist.email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
          )
          AND admin_allowlist.is_active = true
        )
      );
  END IF;
END $$;

-- Add admin SELECT policy for stripe_subscriptions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_subscriptions' 
    AND policyname = 'Admins can read all stripe subscriptions'
  ) THEN
    CREATE POLICY "Admins can read all stripe subscriptions"
      ON stripe_subscriptions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_allowlist
          WHERE admin_allowlist.email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
          )
          AND admin_allowlist.is_active = true
        )
      );
  END IF;
END $$;
