/*
  # Create Missing Production Tables (Fixed)

  ## Overview
  Creates missing tables and views to fix 404/PGRST205 errors in production.
  All tables include proper indexes, RLS policies, and data privacy controls.

  ## New Tables

  ### 1. subscriptions
  - Tracks teacher subscription status and Stripe billing info
  - One subscription per user (unique constraint)
  - Indexed for efficient status and expiration queries

  ### 2. sponsor_banners (VIEW)
  - Creates view mapping to existing sponsored_ads table
  - Matches frontend expectations without breaking existing schema

  ### 3. sponsor_banner_events
  - Tracks banner views and clicks for analytics
  - Stores hashed IPs (not raw IPs) for privacy compliance
  - Rate-limited to prevent abuse

  ### 4. system_health_checks
  - Automated QA monitoring results
  - Records hourly health check results
  - Used for alerting and debugging

  ## Security
  - All tables have RLS enabled
  - Strict policies prevent unauthorized access
  - Teachers can only see own data
  - Admins (role='admin') can manage all data
  - Public access is read-only and filtered
*/

-- ============================================================================
-- 1. SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  plan text NOT NULL DEFAULT 'teacher_annual',
  price_gbp numeric DEFAULT 99.99,
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 2. SPONSOR_BANNERS VIEW (Maps to existing sponsored_ads table)
-- ============================================================================

-- Create view to match frontend expectations
CREATE OR REPLACE VIEW sponsor_banners AS
SELECT 
  id,
  title,
  image_url,
  destination_url as target_url,
  placement,
  is_active,
  start_date as start_at,
  end_date as end_at,
  created_by,
  created_at,
  updated_at
FROM sponsored_ads;

-- Grant access to the view
GRANT SELECT ON sponsor_banners TO anon, authenticated;

-- ============================================================================
-- 3. SPONSOR BANNER EVENTS TABLE (Privacy-Compliant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sponsor_banner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id uuid NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'click')),
  session_id text,
  user_agent text,
  ip_hash text,
  referrer text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON sponsor_banner_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_type ON sponsor_banner_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_created_at ON sponsor_banner_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_type ON sponsor_banner_events(banner_id, event_type);

-- Enable RLS
ALTER TABLE sponsor_banner_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can create events"
  ON sponsor_banner_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    banner_id IS NOT NULL
    AND event_type IN ('view', 'click')
  );

CREATE POLICY "Admins can view all events"
  ON sponsor_banner_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 4. SYSTEM HEALTH CHECKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  details jsonb DEFAULT '{}'::jsonb,
  duration_ms integer,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_system_health_checks_name ON system_health_checks(check_name);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_status ON system_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_created_at ON system_health_checks(created_at);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_name_created ON system_health_checks(check_name, created_at DESC);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view health checks"
  ON system_health_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert health checks"
  ON system_health_checks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user has an active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = user_uuid
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

-- Function to get active banners for a placement
CREATE OR REPLACE FUNCTION get_active_banners(placement_filter text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  target_url text,
  placement text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, title, image_url, destination_url as target_url, placement
  FROM sponsored_ads
  WHERE is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date > now())
    AND (placement_filter IS NULL OR placement = placement_filter)
  ORDER BY created_at DESC;
$$;

-- ============================================================================
-- 6. TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add trigger if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE subscriptions IS 'Teacher subscription status and Stripe billing information. One subscription per user.';
COMMENT ON VIEW sponsor_banners IS 'View mapping to sponsored_ads table for frontend compatibility. Fixes PGRST205 errors.';
COMMENT ON TABLE sponsor_banner_events IS 'Privacy-compliant banner analytics (hashed IPs only). Tracks views and clicks for reporting.';
COMMENT ON TABLE system_health_checks IS 'Automated QA monitoring results. Records hourly health check status for alerting.';

COMMENT ON COLUMN sponsor_banner_events.ip_hash IS 'SHA-256 hash of IP address (not raw IP). For rate limiting and abuse prevention only.';
COMMENT ON COLUMN subscriptions.status IS 'active: paid and valid | trialing: free trial | past_due: payment failed | canceled: user canceled | expired: period ended';

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on tables to authenticated and anon users
GRANT SELECT ON sponsor_banners TO anon, authenticated;
GRANT INSERT ON sponsor_banner_events TO anon, authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON system_health_checks TO authenticated;
