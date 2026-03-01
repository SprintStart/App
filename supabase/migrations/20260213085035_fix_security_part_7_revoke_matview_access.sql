/*
  # Fix Security Issues - Part 7: Revoke Materialized View Access

  ## Purpose
  Prevent direct access to quiz_feedback_stats materialized view.

  ## Changes
  - Revoke SELECT from anon and authenticated roles
  - Only allow service_role access
  - Force use of RPC functions for controlled access
*/

-- Revoke direct access to materialized view
REVOKE SELECT ON quiz_feedback_stats FROM anon;
REVOKE SELECT ON quiz_feedback_stats FROM authenticated;

-- Grant access only to service role (for RPC functions)
GRANT SELECT ON quiz_feedback_stats TO service_role;
