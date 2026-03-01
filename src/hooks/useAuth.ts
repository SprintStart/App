import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try {
      console.log('[Auth] Logout initiated');

      // Clear all localStorage keys
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
          console.warn(`Could not remove ${key}:`, e);
        }
      });

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Logout error:', error);
        throw error;
      }

      console.log('[Auth] Logout successful');
      setUser(null);

    } catch (error) {
      console.error('[Auth] Failed to logout:', error);
      throw error;
    }
  };

  return { user, loading, logout };
}