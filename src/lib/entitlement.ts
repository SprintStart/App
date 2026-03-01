import { supabase } from './supabase';

export interface EntitlementResult {
  isPremium: boolean;
  source: 'stripe' | 'admin_grant' | 'school_domain' | null;
  expiresAt: string | null;
  reason: string;
  userId: string | null;
  email: string | null;
  rawRowsCount: number;
  lastCheckedAt: string;
  entitlementId: string | null;
  startsAt: string | null;
}

/**
 * Server-verified entitlement resolver
 * Checks if a user has premium teacher access based on teacher_entitlements table
 *
 * Rules:
 * - Premium = any active entitlement not expired (expires_at IS NULL OR > now())
 * - Matches by teacher_user_id = auth.uid() (primary)
 * - Returns detailed information for debugging and UI display
 */
export async function resolveEntitlement({
  userId,
  email
}: {
  userId?: string;
  email?: string;
}): Promise<EntitlementResult> {
  const lastCheckedAt = new Date().toISOString();

  // If no userId provided, try to get from current session
  let effectiveUserId = userId;
  let effectiveEmail = email;

  if (!effectiveUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    effectiveUserId = user?.id || null;
    effectiveEmail = effectiveEmail || user?.email || null;
  }

  // If still no userId, cannot check entitlement
  if (!effectiveUserId) {
    return {
      isPremium: false,
      source: null,
      expiresAt: null,
      reason: 'No user ID provided or found in session',
      userId: null,
      email: effectiveEmail,
      rawRowsCount: 0,
      lastCheckedAt,
      entitlementId: null,
      startsAt: null,
    };
  }

  try {
    // Fetch all entitlements for this user
    const { data: allEntitlements, error: allError } = await supabase
      .from('teacher_entitlements')
      .select('*')
      .eq('teacher_user_id', effectiveUserId);

    if (allError) {
      console.error('[resolveEntitlement] Error fetching entitlements:', allError);
      return {
        isPremium: false,
        source: null,
        expiresAt: null,
        reason: `Database error: ${allError.message}`,
        userId: effectiveUserId,
        email: effectiveEmail,
        rawRowsCount: 0,
        lastCheckedAt,
        entitlementId: null,
        startsAt: null,
      };
    }

    const rawRowsCount = allEntitlements?.length || 0;

    // Fetch active entitlement
    const { data: entitlement, error } = await supabase
      .from('teacher_entitlements')
      .select('*')
      .eq('teacher_user_id', effectiveUserId)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) {
      console.error('[resolveEntitlement] Error fetching active entitlement:', error);
      return {
        isPremium: false,
        source: null,
        expiresAt: null,
        reason: `Database error: ${error.message}`,
        userId: effectiveUserId,
        email: effectiveEmail,
        rawRowsCount,
        lastCheckedAt,
        entitlementId: null,
        startsAt: null,
      };
    }

    // No active entitlement found
    if (!entitlement) {
      return {
        isPremium: false,
        source: null,
        expiresAt: null,
        reason: rawRowsCount > 0
          ? `Found ${rawRowsCount} entitlement(s) but none are currently active`
          : 'No entitlements found for this user',
        userId: effectiveUserId,
        email: effectiveEmail,
        rawRowsCount,
        lastCheckedAt,
        entitlementId: null,
        startsAt: null,
      };
    }

    // Check if expired
    const now = Date.now();
    const expiresAt = entitlement.expires_at ? new Date(entitlement.expires_at).getTime() : null;
    const isExpired = expiresAt !== null && expiresAt < now;

    if (isExpired) {
      return {
        isPremium: false,
        source: entitlement.source,
        expiresAt: entitlement.expires_at,
        reason: `Entitlement expired on ${new Date(entitlement.expires_at).toLocaleDateString()}`,
        userId: effectiveUserId,
        email: effectiveEmail,
        rawRowsCount,
        lastCheckedAt,
        entitlementId: entitlement.id,
        startsAt: entitlement.starts_at,
      };
    }

    // Active premium entitlement found
    return {
      isPremium: true,
      source: entitlement.source,
      expiresAt: entitlement.expires_at,
      reason: entitlement.expires_at
        ? `Active ${entitlement.source} entitlement until ${new Date(entitlement.expires_at).toLocaleDateString()}`
        : `Active ${entitlement.source} entitlement (no expiration)`,
      userId: effectiveUserId,
      email: effectiveEmail,
      rawRowsCount,
      lastCheckedAt,
      entitlementId: entitlement.id,
      startsAt: entitlement.starts_at,
    };
  } catch (err) {
    console.error('[resolveEntitlement] Unexpected error:', err);
    return {
      isPremium: false,
      source: null,
      expiresAt: null,
      reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      userId: effectiveUserId,
      email: effectiveEmail,
      rawRowsCount: 0,
      lastCheckedAt,
      entitlementId: null,
      startsAt: null,
    };
  }
}
