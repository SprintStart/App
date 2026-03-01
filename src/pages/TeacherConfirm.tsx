import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';

export function TeacherConfirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as any)?.email || '';
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleResend() {
    try {
      setSending(true);
      setMessage(null);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/checkout`,
        },
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Verification email sent! Please check your inbox.',
      });
    } catch (err: any) {
      console.error('[Resend Verification] Error:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Failed to resend verification email',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Mail className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Confirm Your Email
          </h1>

          <p className="text-gray-600 mb-6">
            Your account is not yet verified. Please check your inbox and click the confirmation link we sent to:
          </p>

          <p className="font-semibold text-gray-900 mb-6">
            {email || 'your email address'}
          </p>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    message.type === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {message.text}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={sending}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Resend Verification Email'}
            </button>

            <button
              onClick={() => navigate('/teacher')}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Teacher Page
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              Can't find the email?
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Check your spam or junk folder</li>
              <li>• Make sure you entered the correct email</li>
              <li>• Wait a few minutes for the email to arrive</li>
              <li>• Contact support if you still need help</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
