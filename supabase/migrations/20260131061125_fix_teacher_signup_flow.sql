/*
  # Fix Teacher Signup Flow

  ## Changes Made
  
  1. **Profiles Table RLS**
     - Add INSERT policy to allow authenticated users to create their own profile
     - This fixes the critical bug where profile creation fails during signup
  
  2. **Teacher Subscription Trigger**
     - Update `create_teacher_subscription` function to create pending subscriptions
     - Remove automatic "active free" subscription creation
     - Subscriptions will only become active after successful Stripe payment
  
  3. **Business Rules**
     - Teachers must pay £99.99/year before accessing the dashboard
     - Subscriptions start as 'pending' until payment is confirmed via webhook
     - Only 'active' or 'trialing' subscriptions grant dashboard access
  
  ## Security Notes
     - INSERT policy only allows users to create profiles with their own auth.uid()
     - Prevents users from creating profiles for other users
*/

-- 1. Add INSERT policy for profiles table
CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2. Update the teacher subscription trigger to create pending subscriptions
CREATE OR REPLACE FUNCTION create_teacher_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'teacher' THEN
    -- Create a pending subscription that will be activated after payment
    INSERT INTO subscriptions (
      teacher_id, 
      plan_type, 
      status, 
      max_active_quizzes, 
      max_students_per_quiz
    )
    VALUES (
      NEW.id, 
      'teacher_annual', 
      'pending',  -- Changed from 'active' to 'pending'
      5, 
      30
    );
    
    RAISE NOTICE 'Created pending subscription for teacher %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';
