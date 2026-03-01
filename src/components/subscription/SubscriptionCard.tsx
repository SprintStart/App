import React, { useState } from 'react';
import { CreditCard, Crown, Loader2 } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../hooks/useAuth';
import { authenticatedPost } from '../../lib/authenticatedFetch';
import { products } from '../../stripe-config';

export function SubscriptionCard() {
  const { user } = useAuth();
  const { subscription, loading, isPaid, plan } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (priceId: string) => {
    if (!user) return;

    setCheckoutLoading(true);
    setError('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const { data, error: checkoutError } = await authenticatedPost(apiUrl, {
        price_id: priceId,
        success_url: `${window.location.origin}/success`,
        cancel_url: `${window.location.origin}/dashboard`,
        mode: 'subscription',
      });

      if (checkoutError) {
        throw checkoutError;
      }

      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Crown className="h-6 w-6 text-yellow-500 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {isPaid && plan ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Plan</span>
            <span className="font-medium text-green-600">{plan.name}</span>
          </div>
          
          {subscription?.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Billing</span>
              <span className="text-sm text-gray-900">
                {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
              </span>
            </div>
          )}

          {subscription?.payment_method_last4 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Payment Method</span>
              <div className="flex items-center">
                <CreditCard className="h-4 w-4 text-gray-400 mr-1" />
                <span className="text-sm text-gray-900">
                  •••• {subscription.payment_method_last4}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Active Subscription
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upgrade to access premium features and create unlimited quizzes.
          </p>

          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{product.name}</h4>
                  <span className="text-lg font-bold text-gray-900">
                    £{product.price}/year
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                <button
                  onClick={() => handleSubscribe(product.priceId)}
                  disabled={checkoutLoading}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {checkoutLoading ? 'Processing...' : 'Subscribe Now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}