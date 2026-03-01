import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader, ShieldX } from 'lucide-react';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * AdminProtectedRoute - Server-Side Verification ONLY
 *
 * Security Model:
 * - NO frontend checks (can be bypassed)
 * - ALL verification done server-side via /verify-admin edge function
 * - Edge function uses service role to check admin_allowlist
 * - Audit logging done server-side only
 *
 * Attack Prevention:
 * - Cannot bypass by modifying localStorage/sessionStorage
 * - Cannot bypass by tampering with JWT
 * - Cannot bypass by modifying React state
 * - Cannot forge audit logs
 */
export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);
  const hasVerifiedRef = useRef(false);
  const location = useLocation();

  useEffect(() => {
    // Prevent verification loops - only check once per mount
    if (hasVerifiedRef.current || isVerifyingRef.current) {
      return;
    }

    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    // Prevent concurrent verification calls
    if (isVerifyingRef.current || hasVerifiedRef.current) {
      return;
    }

    isVerifyingRef.current = true;

    try {
      console.log('[Admin Protected Route] Starting server-side verification');

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session || !session.access_token) {
        console.error('[Admin Protected Route] No valid session found');
        setHasSession(false);
        setIsAdmin(false);
        setErrorMessage('No active session');
        setLoading(false);
        hasVerifiedRef.current = true;
        return;
      }

      setHasSession(true);
      console.log('[Admin Protected Route] Session found, calling verify-admin edge function');

      // Call server-side verification (ONLY source of truth)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-admin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[Admin Protected Route] Server verification failed:', response.status, result);
        setIsAdmin(false);

        if (response.status === 401) {
          setErrorMessage('Authentication failed. Please log in again.');
          setHasSession(false);
        } else if (response.status === 403) {
          setErrorMessage('Access denied. You do not have admin privileges.');
        } else {
          setErrorMessage(`Server error: ${result.error || 'Unknown error'}`);
        }

        setLoading(false);
        hasVerifiedRef.current = true;
        return;
      }

      console.log('[Admin Protected Route] Server verification result:', result);

      if (result.is_admin === true) {
        console.log('[Admin Protected Route] ✅ Admin access granted by server');
        setIsAdmin(true);
        setErrorMessage(null);
      } else {
        console.error('[Admin Protected Route] ❌ Admin access denied by server');
        setIsAdmin(false);
        setErrorMessage('Access denied. You do not have admin privileges.');
      }

    } catch (err) {
      console.error('[Admin Protected Route] Verification error:', err);
      setIsAdmin(false);
      setErrorMessage('Failed to verify admin access. Please try again.');
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
      hasVerifiedRef.current = true;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // If no session and not on login page, redirect to login
  if (!hasSession && location.pathname !== '/admin/login') {
    console.log('[Admin Protected Route] No session, redirecting to login');
    return <Navigate to="/admin/login" replace />;
  }

  // If has session but not admin, show access denied page (no redirect loop)
  if (hasSession && !isAdmin) {
    console.log('[Admin Protected Route] Access denied, showing error page');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            {errorMessage || 'You do not have permission to access the admin dashboard.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
