import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Loader, ArrowRight, RefreshCw } from 'lucide-react';

export function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    verifyPayment();
  }, []);

  async function verifyPayment() {
    try {
      const sessionId = searchParams.get('session_id');

      if (!sessionId) {
        console.error('[Payment Success] No session ID provided');
        setLoading(false);
        setShowRetry(true);
        return;
      }

      console.log('[Payment Success] Verifying payment for session:', sessionId);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('[Payment Success] No auth session found');
        navigate('/teacher');
        return;
      }

      const maxAttempts = 15;
      let currentAttempt = 0;

      while (currentAttempt < maxAttempts) {
        currentAttempt++;
        setAttempts(currentAttempt);

        const delayMs = Math.min(1000 * Math.pow(1.3, currentAttempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        console.log(`[Payment Success] Checking subscription (attempt ${currentAttempt}/${maxAttempts})`);

        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('[Payment Success] Subscription fetch error:', error);
          continue;
        }

        if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
          console.log('[Payment Success] Subscription verified as active');
          setVerified(true);
          setLoading(false);
          return;
        }
      }

      console.log('[Payment Success] Max attempts reached, subscription still not confirmed');
      setLoading(false);
      setShowRetry(true);

    } catch (err) {
      console.error('[Payment Success] Error:', err);
      setLoading(false);
      setShowRetry(true);
    }
  }

  function handleRetry() {
    setLoading(true);
    setShowRetry(false);
    setAttempts(0);
    verifyPayment();
  }

  function handleContinue() {
    navigate('/teacherdashboard');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-cyan-100">
        <div className="text-center">
          <Loader className="h-16 w-16 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">Verifying your payment...</p>
          <p className="text-sm text-gray-500 mt-2">
            {attempts > 0 ? `Checking subscription status (attempt ${attempts}/15)...` : 'This may take a few moments'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-cyan-100 px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Payment Successful!
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              {verified
                ? "Your Teacher Pro subscription is now active"
                : "Your payment has been received and is being processed"}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3">What's next?</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Access your Teacher Dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Create unlimited quizzes with AI or document upload</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Track student performance with AI analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Your quizzes are now live on the student platform</span>
                </li>
              </ul>
            </div>

            {showRetry && !verified && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Subscription Still Processing</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Your payment was successful, but we're still confirming your subscription. This sometimes takes a minute.
                </p>
                <button
                  onClick={handleRetry}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Check Again
                </button>
                <p className="text-xs text-gray-600 mt-3">
                  Session ID: {searchParams.get('session_id')?.slice(0, 20)}...
                </p>
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-lg shadow-lg transition-colors"
            >
              {verified ? 'Go to Dashboard' : 'Continue Anyway'}
              <ArrowRight className="w-6 h-6" />
            </button>

            <p className="text-sm text-gray-500 mt-6">
              A confirmation email has been sent to your inbox with your subscription details.
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
