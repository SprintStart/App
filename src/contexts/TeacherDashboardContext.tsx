import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { resolveTeacherAccess, type TeacherAccessResult } from '../lib/teacherAccess';
import { supabase } from '../lib/supabase';
import { callFunction } from '../lib/functionsFetch';
import { Loader2 } from 'lucide-react';

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

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
}

interface TeacherDashboardContextValue {
  accessResult: TeacherAccessResult | null;
  entitlement: TeacherEntitlement | null;
  school: SchoolInfo | null;
  isActive: boolean;
  isPaid: boolean;
  isTrialing: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  planType: string;
  loading: boolean;
  error: string | null;
}

const TeacherDashboardContext = createContext<TeacherDashboardContextValue | null>(null);

export function TeacherDashboardProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accessResult, setAccessResult] = useState<TeacherAccessResult | null>(null);
  const [entitlement, setEntitlement] = useState<TeacherEntitlement | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedRef = useRef(false);
  const checkingRef = useRef(false);
  const isMountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  const verifyCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const currentUserId = user?.id || null;

    if (authLoading) {
      return;
    }

    if (!user) {
      if (isMountedRef.current) {
        console.log('[TeacherDashboardProvider] No user, redirecting to /teacher');
        navigate('/teacher', { replace: true });
      }
      return;
    }

    if (currentUserId !== userIdRef.current) {
      hasCheckedRef.current = false;
      userIdRef.current = currentUserId;
    }

    if (hasCheckedRef.current || checkingRef.current) {
      return;
    }

    checkingRef.current = true;

    const checkAccessAndEntitlement = async () => {
      try {
        verifyCountRef.current++;
        console.log(`[TeacherDashboardProvider] 🔍 ACCESS CHECK #${verifyCountRef.current} - User: ${user.id}`);
        console.count('[TeacherDashboardProvider] verify-teacher called');

        const result = await resolveTeacherAccess();

        if (!isMountedRef.current) return;

        console.log('[TeacherDashboardProvider] Access result:', result.state);
        setAccessResult(result);

        if (result.state === 'logged_out') {
          console.log('[TeacherDashboardProvider] Not logged in, redirecting');
          navigate('/teacher', { replace: true });
          return;
        }

        if (result.state === 'unverified') {
          console.log('[TeacherDashboardProvider] Unverified, redirecting to post-verify');
          navigate('/teacher/post-verify', { replace: true });
          return;
        }

        if (result.state === 'verified_unpaid') {
          console.log('[TeacherDashboardProvider] Unpaid, redirecting to checkout');
          navigate('/teacher/checkout', { replace: true });
          return;
        }

        if (result.state === 'blocked') {
          console.log('[TeacherDashboardProvider] Blocked, redirecting');
          navigate('/teacher', { replace: true });
          return;
        }

        if (result.state === 'verified_paid') {
          console.log(`[TeacherDashboardProvider] ✅ Access granted (Check #${verifyCountRef.current}) - Fetching entitlement`);

          const { data: entitlementData, error: entitlementError } = await supabase
            .from('teacher_entitlements')
            .select('*')
            .eq('teacher_user_id', user.id)
            .eq('status', 'active')
            .lte('starts_at', new Date().toISOString())
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
            .order('created_at', { ascending: false })
            .maybeSingle();

          if (!isMountedRef.current) return;

          if (entitlementError) {
            console.error('[TeacherDashboardProvider] Entitlement error:', entitlementError);
            setError(entitlementError.message);
          } else {
            console.log('[TeacherDashboardProvider] Entitlement loaded:', entitlementData);
            setEntitlement(entitlementData);
          }

          const { data: schoolData } = await callFunction<{
            status: string;
            assigned: boolean;
            school?: { id: string; name: string; slug: string };
          }>('resolve-teacher-school', {}, { method: 'POST' });

          if (isMountedRef.current && schoolData?.school) {
            setSchool(schoolData.school);
          }

          hasCheckedRef.current = true;
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('[TeacherDashboardProvider] Error checking access:', err);

        // DO NOT redirect on transient errors (network issues, API failures)
        // Only redirect if the user is actually not authenticated
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.log('[TeacherDashboardProvider] No session after error, redirecting to /teacher');
          setError('Session expired. Please log in again.');
          navigate('/teacher', { replace: true });
        } else {
          console.log('[TeacherDashboardProvider] Session exists despite error, staying on page');
          setError('Failed to verify access. Please refresh the page.');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          checkingRef.current = false;
        }
      }
    };

    checkAccessAndEntitlement();
  }, [user?.id, authLoading, navigate]);

  const isActive = entitlement?.status === 'active';
  const isExpiredByDate = entitlement?.expires_at
    ? new Date(entitlement.expires_at).getTime() < Date.now()
    : false;
  const isExpired = entitlement?.status === 'expired' ||
                    entitlement?.status === 'revoked' ||
                    isExpiredByDate;
  const isPaid = isActive && !isExpired;
  const daysUntilExpiry = entitlement?.expires_at
    ? Math.ceil((new Date(entitlement.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 14 && daysUntilExpiry > 0;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!accessResult || accessResult.state !== 'verified_paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const value: TeacherDashboardContextValue = {
    accessResult,
    entitlement,
    school,
    isActive,
    isPaid,
    isTrialing: false,
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
    planType: entitlement?.source === 'stripe' ? 'premium' : entitlement?.source === 'admin_grant' ? 'admin' : 'school',
    loading,
    error,
  };

  return (
    <TeacherDashboardContext.Provider value={value}>
      {children}
    </TeacherDashboardContext.Provider>
  );
}

export function useTeacherDashboard() {
  const context = useContext(TeacherDashboardContext);
  if (!context) {
    throw new Error('useTeacherDashboard must be used within TeacherDashboardProvider');
  }
  return context;
}
