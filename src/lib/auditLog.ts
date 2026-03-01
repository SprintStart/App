/**
 * Audit Logging - Server-Side Only
 *
 * SECURITY: Audit logs can only be written by edge functions with service role.
 * Client-side audit logging is disabled to prevent tampering and forgery.
 *
 * This file provides a client-side stub that:
 * - Does NOT write to the database (RLS will block it anyway)
 * - Logs to console for development/debugging
 * - Reminds developers to implement proper edge function logging
 *
 * How to implement proper audit logging:
 * 1. Create an edge function for your admin action
 * 2. Use service role client in the edge function
 * 3. Insert audit log within the edge function
 * 4. Call the edge function from the frontend instead of direct DB access
 */

interface AuditLogEntry {
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  target_entity_type?: string;
  target_entity_id?: string;
  before_state?: any;
  after_state?: any;
  metadata?: any;
  reason?: string;
}

/**
 * Client-side audit log stub - Does NOT write to database
 * Use edge functions for real audit logging
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  // Log to console for development visibility
  console.log('[Audit Log - CLIENT STUB] Action would be logged server-side:', {
    action: entry.action_type,
    entity: entry.entity_type || entry.target_entity_type,
    id: entry.entity_id || entry.target_entity_id,
    timestamp: new Date().toISOString(),
  });

  // Note: Actual audit logging must be done in edge functions
  // Client cannot write to audit_logs table due to RLS restrictions

  // This function intentionally does nothing to prevent breaking existing code
  // that calls it, but the actual logging is disabled for security reasons
}

/**
 * Check if client-side audit logging is enabled
 * Always returns false - audit logging is server-side only
 */
export function isAuditLoggingEnabled(): boolean {
  return false;
}
