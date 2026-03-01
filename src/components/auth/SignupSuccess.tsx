import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Mail, RefreshCw, LogIn, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SignupSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, userId } = location.state || {};
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!email || !userId) {
      navigate('/teacher');
      return;
    }

    const checkEmailConfirmationStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          console.log('[SignupSuccess] User already has a session, redirecting to checkout');
          navigate('/teacher/checkout');
        }
      } catch (err) {
        console.error('[SignupSuccess] Error checking session:', err);
      }
    };

    checkEmailConfirmationStatus();
  }, [email, userId, navigate]);

  const handleCheckConfirmation = async () => {
    console.log('[SignupSuccess] Manually checking confirmation status');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        console.log('[SignupSuccess] Session found, user is confirmed');
        navigate('/teacher/checkout');
      } else {
        console.log('[SignupSuccess] No session, trying to sign in');
        navigate('/login');
      }
    } catch (err) {
      console.error('[SignupSuccess] Error checking confirmation:', err);
      setResendError('Unable to check confirmation status. Please try signing in.');
    }
  };

  const handleResendConfirmation = async () => {
    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/checkout`,
        },
      });

      if (error) {
        setResendError(error.message);
      } else {
        setResendSuccess(true);
      }
    } catch (err) {
      setResendError('Failed to resend confirmation email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <Mail className="w-12 h-12 text-blue-600" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Check your email to confirm your account
            </h1>

            <p className="text-lg text-gray-600 mb-8">
              Before you can sign in, you need to verify your email address.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <div className="flex items-start">
                <Mail className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Confirmation email sent
                  </h3>
                  <p className="text-sm text-gray-700 mb-2">
                    We sent a confirmation link to:
                  </p>
                  <p className="text-sm font-medium text-blue-700 mb-3 break-all">
                    {email}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Click the link in the email to verify your account. The link will expire in 24 hours.
                  </p>
                  <div className="bg-white border border-blue-100 rounded-md p-3 text-xs text-gray-600">
                    <strong className="block mb-1">Don't see the email?</strong>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                      <li>Check your spam or junk folder</li>
                      <li>Make sure you entered the correct email</li>
                      <li>Wait a few minutes for the email to arrive</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {resendSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <p className="text-sm text-green-700">
                    Confirmation email sent successfully! Check your inbox.
                  </p>
                </div>
              </div>
            )}

            {resendError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{resendError}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleCheckConfirmation}
                className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                My account is ready - Continue to checkout
              </button>

              <button
                onClick={handleResendConfirmation}
                disabled={resending || resendSuccess}
                className="w-full flex items-center justify-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Resending...' : 'Resend confirmation email'}
              </button>

              <Link
                to="/login"
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                <LogIn className="w-5 h-5 mr-2" />
                I've confirmed my email - Sign in
              </Link>
            </div>

            <p className="text-sm text-gray-500 mt-6">
              After confirming your email, you can sign in and complete payment to activate your Teacher Pro account.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a href="mailto:support@startsprint.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
