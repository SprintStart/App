import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CreditCard, CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';

interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  plan: string;
  price_gbp: number;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  profile_name: string | null;
  profile_email: string | null;
}

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  async function loadSubscriptions() {
    setLoading(true);
    try {
      let query = supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: subs, error } = await query;
      if (error) throw error;

      if (!subs || subs.length === 0) {
        setSubscriptions([]);
        return;
      }

      const userIds = [...new Set(subs.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p])
      );

      const enriched: Subscription[] = subs.map((s: any) => {
        const profile = profileMap.get(s.user_id);
        return {
          ...s,
          profile_name: profile?.full_name || null,
          profile_email: profile?.email || null,
        };
      });

      setSubscriptions(enriched);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function extendSubscription(subscriptionId: string, days: number) {
    try {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      if (!subscription) return;

      const currentEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end)
        : new Date();

      currentEnd.setDate(currentEnd.getDate() + days);

      const { error } = await supabase
        .from('subscriptions')
        .update({
          current_period_end: currentEnd.toISOString(),
          status: 'active',
        })
        .eq('id', subscriptionId);

      if (error) throw error;

      alert(`Subscription extended by ${days} days`);
      await loadSubscriptions();
    } catch (error) {
      console.error('Error extending subscription:', error);
      alert('Failed to extend subscription');
    }
  }

  async function cancelSubscription(subscriptionId: string) {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subscriptionId);

      if (error) throw error;
      await loadSubscriptions();
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    trialing: subscriptions.filter(s => s.status === 'trialing').length,
    expiring: subscriptions.filter(s => {
      if (!s.current_period_end) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(s.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && s.status === 'active';
    }).length,
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading subscriptions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Subscription Management</h3>
          <p className="text-gray-600 mt-1">Manage teacher subscriptions and billing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active</p>
                <p className="text-2xl font-bold text-green-900">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Trialing</p>
                <p className="text-2xl font-bold text-purple-900">{stats.trialing}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-900">{stats.expiring}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('trialing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'trialing'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Trialing
          </button>
          <button
            onClick={() => setFilter('canceled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'canceled'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Canceled
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'expired'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expired
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No subscriptions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => {
              const daysUntilExpiry = sub.current_period_end
                ? Math.ceil(
                    (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                : null;

              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

              return (
                <div
                  key={sub.id}
                  className={`p-4 border rounded-lg ${
                    isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <User className="w-5 h-5 text-gray-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">
                            {sub.profile_name || 'Unknown'}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              sub.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : sub.status === 'trialing'
                                ? 'bg-purple-100 text-purple-700'
                                : sub.status === 'past_due'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{sub.profile_email}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Plan: {sub.plan}</span>
                          <span>£{sub.price_gbp}/year</span>
                          {sub.current_period_end && (
                            <span>
                              Expires: {new Date(sub.current_period_end).toLocaleDateString()}
                              {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                                  {' '}({daysUntilExpiry} days)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {sub.stripe_customer_id && (
                          <p className="text-xs text-gray-400 mt-1">
                            Stripe Customer: {sub.stripe_customer_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => extendSubscription(sub.id, 30)}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        +30 days
                      </button>
                      <button
                        onClick={() => extendSubscription(sub.id, 365)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        +1 year
                      </button>
                      {sub.status !== 'canceled' && (
                        <button
                          onClick={() => cancelSubscription(sub.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
