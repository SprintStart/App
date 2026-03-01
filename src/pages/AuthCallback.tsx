import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, AlertCircle } from 'lucide-react';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Finishing setup...');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const code = searchParams.get('code');
      const next = searchParams.get('next') || '/teacher/post-verify';
      const error_code = searchParams.get('error_code');
      const error_description = searchParams.get('error_description');

      if (error_code) {
        console.error('[Auth Callback] Error from Supabase:', error_code, error_description);
        setError(error_description || 'Authentication failed. Please try again.');
        return;
      }

      if (!code) {
        console.error('[Auth Callback] No code provided');
        setError('Invalid confirmation link. Please request a new confirmation email.');
        return;
      }

      console.log('[Auth Callback] Exchanging code for session');
      setStatus('Verifying your email...');

      const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('[Auth Callback] Failed to exchange code:', exchangeError);

        if (exchangeError.message.includes('expired')) {
          setError('This confirmation link has expired. Please request a new one.');
        } else {
          setError(exchangeError.message || 'Failed to verify email. Please try again.');
        }
        return;
      }

      if (!session || !session.user) {
        console.error('[Auth Callback] No session after exchange');
        setError('Failed to create session. Please try logging in.');
        return;
      }

      console.log('[Auth Callback] Email verified successfully for user:', session.user.id);
      setStatus('Loading your profile...');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Auth Callback] Profile fetch error:', profileError);
      }

      if (!profile) {
        console.log('[Auth Callback] No profile found, will be created by trigger');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (retryProfile) {
          console.log('[Auth Callback] Profile found on retry');
        }
      }

      console.log('[Auth Callback] Redirecting to:', next);
      navigate(next, { replace: true });

    } catch (err: any) {
      console.error('[Auth Callback] Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred');
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Verification Failed
            </h1>

            <p className="text-gray-600 mb-6">
              {error}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/teacher')}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Teacher Page
              </button>

              <a
                href="mailto:support@startsprint.com"
                className="block text-sm text-blue-600 hover:text-blue-700"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100">
      <div className="text-center">
        <Loader className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-xl text-gray-700 font-medium">{status}</p>
        <p className="text-sm text-gray-500 mt-2">Please wait...</p>
      </div>
    </div>
  );
}
