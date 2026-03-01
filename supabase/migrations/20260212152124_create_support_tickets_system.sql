/*
  # Create Support Tickets System
  
  1. New Tables
    - `support_tickets` - Main ticket tracking
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `created_by_user_id` (uuid, references profiles)
      - `created_by_email` (text)
      - `school_id` (uuid, nullable, references schools)
      - `category` (text) - bug/billing/content/other
      - `subject` (text)
      - `message` (text)
      - `status` (text) - open/waiting_on_teacher/resolved/closed
      - `priority` (text) - low/medium/high
      - `last_reply_at` (timestamp)
      - `assigned_to_admin_email` (text, nullable)
      - `updated_at` (timestamp)
    
    - `support_ticket_messages` - Messages/replies on tickets
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references support_tickets)
      - `created_at` (timestamp)
      - `author_user_id` (uuid, nullable)
      - `author_email` (text)
      - `author_type` (text) - teacher/admin
      - `message` (text)
      - `is_internal_note` (boolean) - admin-only notes
    
    - `system_events` - System event logging
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `event_type` (text) - email_failed, ticket_created, etc.
      - `severity` (text) - info/warning/error
      - `context` (jsonb) - additional data
      - `message` (text)
  
  2. Security
    - Enable RLS on all tables
    - Teachers can view/update own tickets
    - Admins can view/update all tickets
    - System events are admin-only
*/

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by_user_id uuid REFERENCES profiles(id),
  created_by_email text NOT NULL,
  school_id uuid REFERENCES schools(id),
  category text NOT NULL CHECK (category IN ('bug', 'billing', 'content', 'feature', 'other')),
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'waiting_on_teacher', 'resolved', 'closed')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  last_reply_at timestamptz DEFAULT now(),
  assigned_to_admin_email text,
  updated_at timestamptz DEFAULT now()
);

-- Create support_ticket_messages table
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  author_user_id uuid,
  author_email text NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('teacher', 'admin')),
  message text NOT NULL,
  is_internal_note boolean DEFAULT false
);

-- Create system_events table
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  context jsonb DEFAULT '{}'::jsonb,
  message text NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_user_id 
ON support_tickets(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_school_id 
ON support_tickets(school_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority 
ON support_tickets(priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at 
ON support_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id 
ON support_ticket_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_created_at 
ON support_ticket_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type 
ON system_events(event_type);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at 
ON system_events(created_at DESC);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets

-- Teachers can view own tickets
CREATE POLICY "Teachers can view own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (created_by_user_id = (SELECT auth.uid()));

-- Teachers can create tickets
CREATE POLICY "Teachers can create tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = (SELECT auth.uid()));

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING ((SELECT current_user_is_admin()));

-- Admins can update all tickets
CREATE POLICY "Admins can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING ((SELECT current_user_is_admin()))
  WITH CHECK ((SELECT current_user_is_admin()));

-- RLS Policies for support_ticket_messages

-- Teachers can view messages on own tickets
CREATE POLICY "Teachers can view messages on own tickets"
  ON support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    is_internal_note = false
    AND ticket_id IN (
      SELECT id FROM support_tickets
      WHERE created_by_user_id = (SELECT auth.uid())
    )
  );

-- Teachers can create messages on own tickets
CREATE POLICY "Teachers can create messages on own tickets"
  ON support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE created_by_user_id = (SELECT auth.uid())
    )
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON support_ticket_messages
  FOR SELECT
  TO authenticated
  USING ((SELECT current_user_is_admin()));

-- Admins can create messages
CREATE POLICY "Admins can create messages"
  ON support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT current_user_is_admin()));

-- RLS Policies for system_events

-- Only admins can view system events
CREATE POLICY "Admins can view system events"
  ON system_events
  FOR SELECT
  TO authenticated
  USING ((SELECT current_user_is_admin()));

-- System can insert events (via service role)
CREATE POLICY "System can insert events"
  ON system_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to update ticket last_reply_at
CREATE OR REPLACE FUNCTION update_ticket_last_reply()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET last_reply_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create trigger to auto-update last_reply_at
DROP TRIGGER IF EXISTS trigger_update_ticket_last_reply ON support_ticket_messages;
CREATE TRIGGER trigger_update_ticket_last_reply
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_reply();
