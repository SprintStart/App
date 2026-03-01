import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, ArrowRight, Loader } from 'lucide-react';

export function EmailConfirmed() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user && user.email_confirmed_at) {
          setVerified(true);
        }
      } catch (error) {
        console.error('Error checking verification:', error);
      } finally {
        setLoading(false);
      }
    };

    checkVerification();
  }, []);

  const handleContinue = () => {
    navigate('/teacher-dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Email Verified!
          </h2>

          <p className="text-gray-600 mb-6">
            {verified
              ? "Your email has been successfully verified. You can now access your Teacher Dashboard."
              : "Your email verification is complete. Please sign in to continue."
            }
          </p>

          <div className="space-y-3">
            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>

            <p className="text-sm text-gray-500">
              Next step: Complete your subscription to unlock all Teacher Pro features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
