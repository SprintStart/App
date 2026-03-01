import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

export function Success() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaid, loading } = useSubscription();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Success Page] User:', user?.id);
    console.log('[Success Page] isPaid:', isPaid);
    console.log('[Success Page] loading:', loading);

    if (!user) {
      console.log('[Success Page] No user, redirecting to /teacher');
      navigate('/teacher');
      return;
    }

    if (!loading) {
      if (isPaid) {
        console.log('[Success Page] Payment verified, subscription active');
        setVerifying(false);
      } else {
        console.log('[Success Page] Payment not yet confirmed, polling...');

        // Poll for subscription updates every 2 seconds
        let pollCount = 0;
        const maxPolls = 15; // 30 seconds total

        const pollInterval = setInterval(() => {
          pollCount++;
          console.log(`[Success Page] Polling attempt ${pollCount}/${maxPolls}`);

          // The useSubscription hook will automatically refetch
          // We just need to wait for isPaid to become true

          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            console.log('[Success Page] Timeout waiting for payment confirmation');
            setError('Payment confirmation is taking longer than expected. Please check your subscription status in your dashboard.');
            setVerifying(false);
          }
        }, 2000);

        return () => clearInterval(pollInterval);
      }
    }
  }, [user, isPaid, loading, navigate]);

  if (!user) {
    return null;
  }

  if (verifying && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-6">
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Verifying Payment...
            </h1>

            <p className="text-gray-600 mb-4">
              Please wait while we confirm your subscription.
            </p>

            <p className="text-sm text-gray-500">
              This usually takes just a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-6">
              <AlertCircle className="h-16 w-16 text-orange-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Checking Payment Status
            </h1>

            <p className="text-gray-600 mb-8">
              {error}
            </p>

            <div className="space-y-3">
              <Link
                to="/teacherdashboard"
                className="inline-flex items-center justify-center w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>

              <p className="text-sm text-gray-500">
                If you continue to have issues, please contact support.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-green-200">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to StartSprint! 🎉
          </h1>

          <p className="text-lg text-gray-700 mb-2">
            Your payment was successful!
          </p>

          <p className="text-gray-600 mb-8">
            Your teacher account is now active. You can start creating quizzes, uploading documents, and accessing AI-powered analytics.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-sm font-semibold text-blue-900 mb-2">What's Next?</p>
            <ul className="text-sm text-blue-800 text-left space-y-1">
              <li>✓ Create your first quiz</li>
              <li>✓ Upload documents for AI generation</li>
              <li>✓ Track student performance</li>
              <li>✓ Access analytics dashboard</li>
            </ul>
          </div>

          <Link
            to="/teacherdashboard"
            className="inline-flex items-center justify-center w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl font-semibold text-lg"
          >
            Go to Teacher Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>

          <p className="mt-6 text-xs text-gray-500">
            Your subscription: £99.99/year • Renews automatically
          </p>
        </div>
      </div>
    </div>
  );
}