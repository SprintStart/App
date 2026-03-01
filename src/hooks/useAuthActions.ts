import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function useAuthActions() {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      console.log('[Auth] Starting logout process...');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Logout error:', error);
        throw error;
      }

      console.log('[Auth] Successfully signed out from Supabase');

      // Clear all localStorage keys used by the app
      const keysToRemove = [
        'supabase.auth.token',
        'sb-auth-token',
        'anonymous-session-id',
        'entitlement-cache',
        'teacher-state-cache'
      ];

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`[Auth] Could not remove ${key}:`, e);
        }
      });

      console.log('[Auth] Cleared localStorage');

      // Verify session is cleared
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Auth] Session after logout:', session ? 'STILL EXISTS (ERROR!)' : 'null (SUCCESS)');

      // Redirect to teacher marketing page with success message
      navigate('/teacher', { replace: true, state: { message: 'Logged out successfully' } });

      // Force a hard navigation after a brief delay to ensure clean slate
      setTimeout(() => {
        window.location.href = '/teacher';
      }, 100);

    } catch (error) {
      console.error('[Auth] Failed to logout:', error);
      // Even if logout fails, redirect to login
      navigate('/teacher', { replace: true });
    }
  };

  return { logout };
}
