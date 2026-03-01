import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, X, ArrowLeft, Mail } from 'lucide-react';

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Use server-side verification (single source of truth)
      try {
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

        if (response.ok && result.is_admin === true) {
          navigate('/admindashboard');
        } else {
          setAuthError('Access denied: Admin privileges required');
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('[Admin Login] Verification error:', err);
        await supabase.auth.signOut();
      }
    }
  }

  async function handleAuth() {
    try {
      setAuthError(null);
      setResetSuccess(false);
      setLoading(true);

      console.log('[Admin Login] Attempting login for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Admin Login] Login failed:', error);

        await logFailedLoginAttempt(email);

        // Show more specific error message
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Email not confirmed. Please check your email.');
        } else {
          throw new Error(error.message || 'Access denied');
        }
      }

      if (data.user && data.session) {
        console.log('[Admin Login] User authenticated:', data.user.id);

        // Use server-side verification (single source of truth - checks admin_allowlist)
        const verifyResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-admin`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const verifyResult = await verifyResponse.json();

        if (!verifyResponse.ok || verifyResult.is_admin !== true) {
          console.error('[Admin Login] User is not admin');
          setAuthError('Access denied: Admin privileges required');

          await logFailedLoginAttempt(email);
          await supabase.auth.signOut();
          return;
        }

        console.log('[Admin Login] Admin access granted, redirecting to dashboard');
        navigate('/admindashboard');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Access denied');
    } finally {
      setLoading(false);
    }
  }

  // Note: Audit logging is now handled server-side only via edge functions
  // Client cannot insert into audit_logs due to RLS restrictions
  function logFailedLoginAttempt(attemptEmail: string) {
    // Failed login attempts are logged by the verify-admin edge function
    console.log('[Admin Login] Failed login attempt for:', attemptEmail);
  }

  async function handleSendPasswordReset() {
    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }

    try {
      setAuthError(null);
      setResetSuccess(false);
      setSendingReset(true);

      console.log('[Admin Login] Checking if email is allowlisted:', email);

      const ADMIN_ALLOWLIST = ['lesliekweku.addae@gmail.com'];

      if (!ADMIN_ALLOWLIST.includes(email.toLowerCase())) {
        console.error('[Admin Login] Email not in allowlist:', email);
        await logFailedLoginAttempt(email);
        setAuthError('Access denied: Email not authorized');
        return;
      }

      console.log('[Admin Login] Requesting password setup for:', email);

      // Call Edge Function to ensure admin user exists and send password setup email
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-admin-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          sendPasswordResetEmail: true,
        }),
      });

      const data = await response.json();

      console.log('[Admin Login] Response from create-admin-user:', data);

      if (!response.ok || !data.success) {
        console.error('[Admin Login] Failed to send password setup:', data);
        throw new Error(data.error || 'Failed to send password setup email');
      }

      console.log('[Admin Login] Password setup response:', data);

      if (data.setupLink) {
        console.log('[Admin Login] Setup link available:', data.setupLink);
        setSetupLink(data.setupLink);
      }

      setResetSuccess(true);
      setPassword('');

    } catch (err: any) {
      console.error('[Admin Login] Error:', err);
      setAuthError(err.message || 'Failed to send password setup email');
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-8">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full relative border-2 border-red-900">
        <button
          onClick={() => navigate('/teacher')}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-200 flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex justify-center mb-6 mt-8">
          <div className="bg-red-900 rounded-full p-4">
            <Shield className="w-12 h-12 text-red-200" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-white mb-2">
          Admin Portal
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Restricted access - Admin credentials required
        </p>

        {authError && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm">
            {authError}
          </div>
        )}

        {resetSuccess && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-700 text-green-200 rounded">
            <p className="font-semibold mb-2">Password setup link ready!</p>
            {setupLink ? (
              <>
                <p className="text-xs text-green-300 mb-3">
                  Click the button below to set your admin password. This link expires in 1 hour.
                </p>
                <a
                  href={setupLink}
                  className="block w-full text-center px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Set Admin Password
                </a>
              </>
            ) : (
              <p className="text-xs text-green-300">
                Check <strong>{email}</strong> for a password setup link from StartSprint.
                The link expires in 1 hour.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
          />
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-red-900 text-white py-3 rounded-lg font-semibold hover:bg-red-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Admin Sign In'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleSendPasswordReset}
              disabled={sendingReset || !email}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-gray-200 py-2.5 rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Mail className="w-4 h-4" />
              {sendingReset ? 'Sending...' : 'Send Password Setup Link'}
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={handleSendPasswordReset}
              disabled={sendingReset || !email}
              className="text-sm text-gray-400 hover:text-gray-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-center text-red-400 text-sm font-semibold mb-2">
            This portal is restricted. All access attempts are logged.
          </p>
          <p className="text-center text-gray-500 text-xs">
            Authorized administrators only.
          </p>
        </div>
      </div>
    </div>
  );
}
