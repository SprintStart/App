/*
  # Create Stripe Integration Tables
  
  1. New Tables
    - `stripe_customers`
      - Maps Supabase user_id to Stripe customer_id
      - Enables customer lookup for checkout and webhooks
    - `stripe_subscriptions`
      - Intermediate table for Stripe subscription sync
      - Gets populated by webhook, then syncs to main subscriptions table
  
  2. Security
    - Enable RLS on all tables
    - Only allow authenticated users to read their own data
    - Service role can manage all data
  
  3. Indexes
    - Add indexes on foreign keys and lookup columns
    - Optimize for user_id and customer_id queries
*/

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id text UNIQUE NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text UNIQUE NOT NULL,
  subscription_id text UNIQUE,
  price_id text,
  status text NOT NULL DEFAULT 'not_started',
  current_period_start bigint,
  current_period_end bigint,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_brand text,
  payment_method_last4 text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_customers
CREATE POLICY "Users can view own stripe customer"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage stripe customers"
  ON stripe_customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for stripe_subscriptions
CREATE POLICY "Users can view own stripe subscription"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage stripe subscriptions"
  ON stripe_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id ON stripe_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id ON stripe_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_subscription_id ON stripe_subscriptions(subscription_id);

-- Create trigger to sync stripe_subscriptions to subscriptions table
CREATE OR REPLACE FUNCTION sync_stripe_subscription_to_subscriptions()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_status text;
  v_period_end timestamptz;
BEGIN
  -- Get user_id from customer_id
  SELECT user_id INTO v_user_id
  FROM stripe_customers
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
    v_period_end := to_timestamp(NEW.current_period_end);
  END IF;

  -- Upsert into subscriptions table
  INSERT INTO subscriptions (
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
    CASE WHEN NEW.current_period_start IS NOT NULL THEN to_timestamp(NEW.current_period_start) END,
    v_period_end,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_stripe_subscription ON stripe_subscriptions;
CREATE TRIGGER trigger_sync_stripe_subscription
  AFTER INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_stripe_subscription_to_subscriptions();
