import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface TeacherEntitlement {
  id: string;
  teacher_user_id: string;
  source: 'stripe' | 'admin_grant' | 'school_domain';
  status: 'active' | 'expired' | 'revoked';
  starts_at: string;
  expires_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<TeacherEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const pollCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    pollCountRef.current = 0;

    if (!user) {
      setEntitlement(null);
      setLoading(false);
      return;
    }

    const fetchEntitlement = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        console.log('[useSubscription] Fetching entitlement for user:', user.id);

        const { data, error } = await supabase
          .from('teacher_entitlements')
          .select('*')
          .eq('teacher_user_id', user.id)
          .eq('status', 'active')
          .lte('starts_at', new Date().toISOString())
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (!isMountedRef.current) return;

        if (error) {
          console.error('[useSubscription] Error:', error);
          setError(error.message);
        } else {
          console.log('[useSubscription] Entitlement data:', data);
          setEntitlement(data);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('[useSubscription] Failed to fetch:', err);
        setError('Failed to fetch entitlement');
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        fetchingRef.current = false;
      }
    };

    fetchEntitlement();

    const pollInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      pollCountRef.current++;

      if (pollCountRef.current > 12) {
        clearInterval(pollInterval);
        return;
      }

      if (!entitlement) {
        console.log('[useSubscription] Polling for entitlement updates...');
        fetchEntitlement();
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(pollInterval);
    };
  }, [user?.id]);

  const isActive = entitlement?.status === 'active';

  // Check if entitlement is expired based on expires_at date
  const isExpiredByDate = entitlement?.expires_at
    ? new Date(entitlement.expires_at).getTime() < Date.now()
    : false;

  const isExpired = entitlement?.status === 'expired' ||
                    entitlement?.status === 'revoked' ||
                    isExpiredByDate;

  // Consider paid if active AND not expired
  const isPaid = isActive && !isExpired;

  const daysUntilExpiry = entitlement?.expires_at
    ? Math.ceil((new Date(entitlement.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 14 && daysUntilExpiry > 0;

  return {
    subscription: entitlement, // Keep same property name for backwards compatibility
    entitlement,
    loading,
    error,
    isActive,
    isTrialing: false, // Not applicable in new system
    isPaid,
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
    planType: entitlement?.source === 'stripe' ? 'premium' : entitlement?.source === 'admin_grant' ? 'admin' : 'school',
  };
}