import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, ArrowRight, GraduationCap } from 'lucide-react';

export function TeacherPostVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { schoolMatched, schoolName } = location.state || {};
  const [status, setStatus] = useState<'checking' | 'premium' | 'needs_payment' | 'error'>('checking');
  const [premiumSource, setPremiumSource] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkAccessStatus();
  }, []);

  async function checkAccessStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('[Post-Verify] No active session');
        navigate('/teacher/create');
        return;
      }

      console.log('[Post-Verify] Checking access status for user:', session.user.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-teacher-access-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check access status');
      }

      const data = await response.json();
      console.log('[Post-Verify] Access status:', data);

      if (data.hasPremium) {
        setStatus('premium');
        setPremiumSource(data.premiumSource);

        setTimeout(() => {
          navigate('/teacherdashboard');
        }, 2000);
      } else {
        setStatus('needs_payment');

        setTimeout(() => {
          navigate('/teacher/checkout');
        }, 2000);
      }
    } catch (err: any) {
      console.error('[Post-Verify] Error:', err);
      setError(err.message || 'Something went wrong');
      setStatus('error');

      setTimeout(() => {
        navigate('/teacher/checkout');
      }, 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {status === 'checking' && (
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {schoolMatched ? 'School Account Detected!' : 'Email Verified!'}
            </h1>
            <p className="text-gray-600">
              {schoolMatched && schoolName ? (
                <>Setting up your access for <strong>{schoolName}</strong>...</>
              ) : (
                'Setting up your account...'
              )}
            </p>
          </div>
        )}

        {status === 'premium' && (
          <div className="text-center">
            {premiumSource === 'school_domain' ? (
              <GraduationCap className="w-16 h-16 text-green-600 mx-auto mb-4" />
            ) : (
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {premiumSource === 'school_domain' ? 'School Access Granted!' : 'Welcome Back!'}
            </h1>
            <p className="text-gray-600 mb-4">
              {premiumSource === 'stripe' && 'Your premium subscription is active.'}
              {premiumSource === 'school_domain' && schoolName && `You have full access through ${schoolName}. No payment required!`}
              {premiumSource === 'school_domain' && !schoolName && 'You have premium access through your school. No payment required!'}
              {premiumSource === 'admin_override' && 'You have admin-granted premium access.'}
              {premiumSource === 'admin_grant' && 'You have admin-granted premium access.'}
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <span className="text-sm font-medium">Taking you to your dashboard</span>
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </div>
          </div>
        )}

        {status === 'needs_payment' && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Email Verified!
            </h1>
            <p className="text-gray-600 mb-4">
              To complete your setup and access the teacher dashboard, you'll need to subscribe.
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <span className="text-sm font-medium">Taking you to checkout</span>
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              {error || 'Unable to verify your access status'}
            </p>
            <p className="text-sm text-gray-500">
              Taking you to checkout...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
