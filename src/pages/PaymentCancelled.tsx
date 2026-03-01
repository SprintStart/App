import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-100 px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-orange-100 rounded-full mb-6">
              <XCircle className="w-16 h-16 text-orange-600" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Payment Cancelled
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Your payment was cancelled. No charges have been made to your account.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3">Ready to get started?</h3>
              <p className="text-gray-700 mb-4">
                Complete your payment to unlock:
              </p>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Unlimited quiz creation with AI</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Document upload for instant quiz generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>AI-powered analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Auto-publish to student platform</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate('/teacher/checkout')}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-lg shadow-lg transition-colors"
              >
                Try Payment Again
                <ArrowRight className="w-6 h-6" />
              </button>

              <button
                onClick={() => navigate('/teacher')}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-lg border-2 border-gray-300 hover:bg-gray-50 font-semibold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Teacher Page
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-6">
              Questions about pricing or payment?{' '}
              <a href="mailto:support@startsprint.com" className="text-blue-600 hover:text-blue-700 font-medium">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
