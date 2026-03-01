import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    performLogout();
  }, []);

  async function performLogout() {
    try {
      console.log('[Logout Page] Starting logout...');

      // Clear all localStorage keys including draft keys
      try {
        const keysToRemove: string[] = [];

        // Collect all keys first
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            // Remove all Supabase auth, quiz drafts, and cache keys
            if (
              key.startsWith('sb-') ||
              key.startsWith('supabase') ||
              key.startsWith('startsprint:createQuizDraft:') ||
              key.includes('anonymous-session') ||
              key.includes('entitlement') ||
              key.includes('teacher-state')
            ) {
              keysToRemove.push(key);
            }
          }
        }

        // Remove collected keys
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            console.log(`[Logout] Removed: ${key}`);
          } catch (e) {
            console.warn(`Could not remove ${key}:`, e);
          }
        });

        console.log(`[Logout] Cleared ${keysToRemove.length} localStorage keys`);
      } catch (e) {
        console.error('[Logout] Error clearing localStorage:', e);
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Logout Page] Error signing out:', error);
      } else {
        console.log('[Logout Page] Successfully signed out');
      }

      // Verify session is cleared
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Logout Page] Session after logout:', session ? 'STILL EXISTS' : 'null (SUCCESS)');

      // Redirect to teacher page
      navigate('/teacher', { replace: true });

      // Force hard navigation to ensure clean slate
      setTimeout(() => {
        window.location.href = '/teacher';
      }, 100);

    } catch (error) {
      console.error('[Logout Page] Failed to logout:', error);
      // Even on error, redirect
      window.location.href = '/teacher';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Logging out...</p>
      </div>
    </div>
  );
}
