import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export function AdminResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    validateResetSession();
  }, []);

  async function validateResetSession() {
    try {
      console.log('[Admin Reset Password] Validating session');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('[Admin Reset Password] No valid session found');
        setError('Invalid or expired reset link. Please request a new one.');
        setValidating(false);
        return;
      }

      console.log('[Admin Reset Password] Valid reset session found');
      setValidSession(true);

    } catch (err) {
      console.error('[Admin Reset Password] Error validating session:', err);
      setError('Failed to validate reset link');
    } finally {
      setValidating(false);
    }
  }

  async function handleResetPassword() {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      console.log('[Admin Reset Password] Updating password');

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('[Admin Reset Password] Failed to update password:', updateError);
        throw updateError;
      }

      console.log('[Admin Reset Password] Password updated successfully');

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role === 'admin') {
          console.log('[Admin Reset Password] Admin role confirmed');

          await supabase.from('audit_logs').insert({
            actor_admin_id: user.id,
            action_type: 'admin_password_reset',
            target_entity_type: 'auth',
            target_entity_id: user.id,
            metadata: { timestamp: new Date().toISOString() },
          });
        }
      }

      setSuccess(true);

      setTimeout(() => {
        navigate('/admin/login');
      }, 3000);

    } catch (err: any) {
      console.error('[Admin Reset Password] Error:', err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-16 h-16 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-300 text-lg">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-8">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full border-2 border-red-900">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900/50 rounded-full mb-4">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              Invalid Reset Link
            </h1>

            <p className="text-gray-400 mb-6">
              {error || 'This password reset link is invalid or has expired.'}
            </p>

            <button
              onClick={() => navigate('/admin/login')}
              className="w-full bg-red-900 text-white py-3 rounded-lg font-semibold hover:bg-red-800 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-8">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full border-2 border-green-700">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/50 rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              Password Set Successfully
            </h1>

            <p className="text-gray-400 mb-6">
              Your admin password has been set. You will be redirected to the login page shortly.
            </p>

            <button
              onClick={() => navigate('/admin/login')}
              className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Continue to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-8">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full border-2 border-red-900">
        <div className="flex justify-center mb-6">
          <div className="bg-red-900 rounded-full p-4">
            <Shield className="w-12 h-12 text-red-200" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-white mb-2">
          Set Admin Password
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Create a strong password for your admin account
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              New Password
            </label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleResetPassword()}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
            />
          </div>

          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="w-full bg-red-900 text-white py-3 rounded-lg font-semibold hover:bg-red-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-center text-gray-500 text-sm">
            Password requirements: minimum 8 characters
          </p>
        </div>
      </div>
    </div>
  );
}
