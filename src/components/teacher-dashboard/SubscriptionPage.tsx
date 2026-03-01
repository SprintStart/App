import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CreditCard, CheckCircle, Calendar, ExternalLink, Loader2, Gift } from 'lucide-react';
import { resolveEntitlement, type EntitlementResult } from '../../lib/entitlement';

export function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<EntitlementResult | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const result = await resolveEntitlement({
        userId: user.user.id,
        email: user.user.email || undefined
      });

      setEntitlement(result);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }

  function openStripePortal() {
    alert('Stripe Customer Portal integration coming soon! You\'ll be able to manage your subscription, update payment methods, and view billing history.');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {entitlement?.source === 'admin_grant' ? (
              <Gift className="w-8 h-8 text-green-600" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Premium Access</h2>
              <p className="text-sm text-gray-600">
                {entitlement?.source === 'admin_grant'
                  ? 'Admin Grant'
                  : entitlement?.source === 'stripe'
                  ? 'Stripe Subscription'
                  : entitlement?.source === 'school_domain'
                  ? 'School License'
                  : 'Active'}
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-semibold">
            ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="w-4 h-4" />
              Expires
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {entitlement?.expiresAt
                ? new Date(entitlement.expiresAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : 'Never'}
            </p>
          </div>

          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <CreditCard className="w-4 h-4" />
              Source
            </div>
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {entitlement?.source?.replace('_', ' ') || 'Unknown'}
            </p>
          </div>
        </div>

        {entitlement?.source === 'admin_grant' && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Admin Note:</strong> Your premium access has been granted by an administrator.
              This access will remain active until {entitlement.expiresAt
                ? new Date(entitlement.expiresAt).toLocaleDateString('en-GB')
                : 'revoked'}.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Premium Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Unlimited Quizzes</p>
              <p className="text-sm text-gray-600">Create as many quizzes as you need</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">AI Generation</p>
              <p className="text-sm text-gray-600">Generate quizzes with AI</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Document Upload</p>
              <p className="text-sm text-gray-600">Convert docs to quizzes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Advanced Analytics</p>
              <p className="text-sm text-gray-600">Detailed performance insights</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Export Reports</p>
              <p className="text-sm text-gray-600">CSV and PDF exports</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Priority Support</p>
              <p className="text-sm text-gray-600">Fast email support</p>
            </div>
          </div>
        </div>
      </div>

      {entitlement?.source === 'stripe' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Manage Subscription</h3>
          <p className="text-sm text-gray-600">
            Update your payment method, view billing history, or cancel your subscription
          </p>
          <button
            onClick={openStripePortal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Billing Portal
          </button>
        </div>
      )}
    </div>
  );
}
