import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, CheckCircle, CreditCard, AlertCircle, Check } from 'lucide-react';

type PricingPlan = 'monthly' | 'annual';

const PRICING_OPTIONS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 9.99,
    priceId: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_monthly_placeholder',
    interval: 'month',
    savings: null,
  },
  annual: {
    id: 'annual',
    name: 'Annual Plan',
    price: 99.99,
    priceId: import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID || 'price_1SuxE0R2rhkSk4b6BP4RXkyn',
    interval: 'year',
    savings: '17% OFF',
  },
};

export function TeacherCheckout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('annual');

  const isMonthlyAvailable = PRICING_OPTIONS.monthly.priceId.startsWith('price_') &&
    !PRICING_OPTIONS.monthly.priceId.includes('placeholder') &&
    !PRICING_OPTIONS.monthly.priceId.includes('NEEDS_TO_BE_CREATED');

  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode');

  useEffect(() => {
    checkAuthAndProfile();
  }, []);

  async function checkAuthAndProfile() {
    try {
      console.log('[Teacher Checkout] Checking authentication');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('[Teacher Checkout] No session found');
        navigate('/teacher');
        return;
      }

      setUser(session.user);
      console.log('[Teacher Checkout] User authenticated:', session.user.id);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Teacher Checkout] Profile error:', profileError);
        setError('Failed to load profile. Please try again.');
        setLoading(false);
        return;
      }

      let currentProfile = profileData;

      if (!currentProfile) {
        console.warn('[Teacher Checkout] No profile found, creating one');

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            role: 'teacher',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('[Teacher Checkout] Failed to create profile:', createError);
          setError('Failed to create profile. Please contact support.');
          setLoading(false);
          return;
        }

        console.log('[Teacher Checkout] Profile created:', newProfile);
        currentProfile = newProfile;
      }

      if (currentProfile.role !== 'teacher') {
        console.error('[Teacher Checkout] User is not a teacher');
        navigate('/');
        return;
      }

      setProfile(currentProfile);

      console.log('[Teacher Checkout] Checking premium access status');
      const { data: accessStatus, error: accessError } = await supabase.functions.invoke('get-teacher-access-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (accessError) {
        console.error('[Teacher Checkout] Error checking access status:', accessError);
      } else if (accessStatus?.hasPremium && mode !== 'renew') {
        console.log('[Teacher Checkout] User has premium access via:', accessStatus.premiumSource);
        navigate('/teacherdashboard');
        return;
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (subscription) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const notExpired = subscription.current_period_end && new Date(subscription.current_period_end) > new Date();

        if (!isActive || !notExpired) {
          console.log('[Teacher Checkout] Subscription expired, showing renewal');
          setIsRenewal(true);
        }
      }

      setLoading(false);

    } catch (err: any) {
      console.error('[Teacher Checkout] Error:', err);
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  }

  async function handleCreateCheckout() {
    try {
      setCreatingCheckout(true);
      setError(null);

      const selectedOption = PRICING_OPTIONS[selectedPlan];
      console.log('[Teacher Checkout] Creating Stripe checkout session for:', selectedOption.name);

      if (!selectedOption.priceId.startsWith('price_') ||
          selectedOption.priceId.includes('placeholder') ||
          selectedOption.priceId.includes('NEEDS_TO_BE_CREATED')) {
        throw new Error('The selected plan is not yet configured. Please contact support or try the Annual Plan.');
      }

      console.log('[Teacher Checkout] Getting current session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        console.error('[Teacher Checkout] No session found:', sessionError);
        throw new Error('Your session has expired. Please log out and log back in to continue.');
      }

      const accessToken = sessionData.session.access_token;
      if (!accessToken) {
        console.error('[Teacher Checkout] No access token in session');
        throw new Error('No authentication token found. Please log out and log back in.');
      }

      console.log('[Teacher Checkout] Session active, user:', sessionData.session.user.id);
      console.log('[Teacher Checkout] Access token present:', !!accessToken);
      console.log('[Teacher Checkout] Token expires at:', new Date(sessionData.session.expires_at! * 1000).toISOString());
      console.log('[Teacher Checkout] Calling Stripe checkout function with Authorization header');

      const { data, error: functionError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          price_id: selectedOption.priceId,
          plan: selectedPlan,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('[Teacher Checkout] Function response - data:', data);
      console.log('[Teacher Checkout] Function response - error:', functionError);

      if (functionError) {
        console.error('[Teacher Checkout] Function error:', functionError);
        console.error('[Teacher Checkout] Function error context:', functionError.context);
        console.error('[Teacher Checkout] Function error data:', data);

        const status = functionError.context?.status;
        const errorMessage = data?.error || functionError.message || 'Failed to create checkout session';
        const debugInfo = data?.debug || {};

        console.error('[Teacher Checkout] Status:', status);
        console.error('[Teacher Checkout] Error message:', errorMessage);
        console.error('[Teacher Checkout] Debug info:', debugInfo);

        if (status === 401) {
          throw new Error('Authentication failed. Please log out and log back in to continue.');
        }

        if (status === 500) {
          if (debugInfo.missing || errorMessage.includes('configuration')) {
            const missingVars = debugInfo.missing?.join(', ') || 'required secrets';
            throw new Error(`Server configuration error: ${missingVars}. Please contact support.`);
          }

          if (debugInfo.stripe_error_message) {
            throw new Error(`Stripe error: ${debugInfo.stripe_error_message}`);
          }

          throw new Error(errorMessage);
        }

        throw new Error(errorMessage);
      }

      if (!data || !data.ok) {
        console.error('[Teacher Checkout] Response not OK:', data);
        const errorMessage = data?.error || 'Failed to create checkout session';
        const debugInfo = data?.debug || {};
        console.error('[Teacher Checkout] Error:', errorMessage);
        console.error('[Teacher Checkout] Debug:', debugInfo);
        throw new Error(errorMessage);
      }

      if (!data.url) {
        console.error('[Teacher Checkout] No URL in response:', data);
        throw new Error('No checkout URL returned from payment processor');
      }

      console.log('[Teacher Checkout] ✓ Checkout session created:', data.sessionId);
      console.log('[Teacher Checkout] ✓ Redirecting to Stripe:', data.url);
      window.location.href = data.url;

    } catch (err: any) {
      console.error('[Teacher Checkout] Error:', err);
      setError(err.message || 'Failed to create checkout session');
      setCreatingCheckout(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100">
        <div className="text-center">
          <Loader className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Checkout Error
            </h1>

            <p className="text-gray-600 mb-6">
              {error}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>

              {error.includes('Session') || error.includes('JWT') ? (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate('/login');
                  }}
                  className="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Log Out and Sign In Again
                </button>
              ) : null}

              <button
                onClick={() => navigate('/teacher')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back to Teacher Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {isRenewal ? 'Subscription Expired' : 'Email Verified Successfully!'}
            </h1>

            <p className="text-lg text-gray-600 mb-2">
              Welcome{isRenewal && ' back'}, {user?.email}
            </p>

            <p className="text-gray-600">
              {isRenewal
                ? 'Renew your subscription to restore access to your dashboard and republish your content'
                : 'Complete your payment to activate your Teacher Pro account'
              }
            </p>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Choose Your Plan</h3>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {Object.entries(PRICING_OPTIONS).map(([key, plan]) => {
                const isDisabled = key === 'monthly' && !isMonthlyAvailable;
                return (
                  <button
                    key={key}
                    onClick={() => !isDisabled && setSelectedPlan(key as PricingPlan)}
                    disabled={isDisabled}
                    className={`relative p-6 rounded-xl border-2 transition-all ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        : selectedPlan === key
                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                  {plan.savings && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.savings}
                    </span>
                  )}

                  <div className="text-center mb-4">
                    <h4 className="font-bold text-gray-900 mb-2">{plan.name}</h4>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-black text-gray-900">£{plan.price}</span>
                      <span className="text-gray-600">/{plan.interval}</span>
                    </div>
                    {key === 'monthly' && (
                      <p className="text-xs text-gray-500 mt-1">£119.88 per year</p>
                    )}
                  </div>

                  {isDisabled && (
                    <div className="text-xs text-gray-500 text-center mt-2">
                      Coming soon
                    </div>
                  )}

                  {selectedPlan === key && !isDisabled && (
                    <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold">
                      <Check className="w-5 h-5" />
                      <span>Selected</span>
                    </div>
                  )}
                </button>
              );
              })}
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-blue-200 p-6 mb-6">
              <h4 className="font-bold text-gray-900 mb-4 text-center">Teacher Pro Features</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Unlimited quiz creation</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">AI quiz generator + document upload</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">AI analytics dashboard</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">Auto-publish to student platform</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateCheckout}
              disabled={creatingCheckout}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-6 h-6" />
              {creatingCheckout ? 'Redirecting to payment...' : `Continue with ${PRICING_OPTIONS[selectedPlan].name}`}
            </button>
          </div>

          <p className="text-sm text-gray-500 text-center">
            Secure payment powered by Stripe. Your subscription will renew automatically each {PRICING_OPTIONS[selectedPlan].interval}.
          </p>
        </div>
      </div>
    </div>
  );
}
