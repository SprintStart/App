import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(body: any, status = 200): Response {
  try {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Failed to create response', debug: String(e) }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

Deno.serve(async (req) => {
  try {
    console.log('[Stripe Checkout] === REQUEST START ===');
    console.log('[Stripe Checkout] Method:', req.method);
    console.log('[Stripe Checkout] Has Auth:', !!req.headers.get('Authorization'));

    if (req.method === 'OPTIONS') {
      console.log('[Stripe Checkout] OPTIONS request');
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      console.log('[Stripe Checkout] Invalid method:', req.method);
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
    }

    console.log('[Stripe Checkout] Checking environment variables...');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
    const SITE_URL = Deno.env.get('SITE_URL') || '';

    console.log('[Stripe Checkout] ENV CHECK:');
    console.log('  SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
    console.log('  STRIPE_SECRET_KEY:', STRIPE_SECRET_KEY ? (STRIPE_SECRET_KEY.startsWith('sk_') ? 'VALID' : 'INVALID_FORMAT') : 'MISSING');
    console.log('  SITE_URL:', SITE_URL || 'MISSING');

    const missingVars: string[] = [];
    if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!STRIPE_SECRET_KEY) missingVars.push('STRIPE_SECRET_KEY');
    else if (!STRIPE_SECRET_KEY.startsWith('sk_')) missingVars.push('STRIPE_SECRET_KEY (invalid format, must start with sk_)');
    if (!SITE_URL) missingVars.push('SITE_URL');

    if (missingVars.length > 0) {
      console.error('[Stripe Checkout] MISSING ENV VARS:', missingVars);
      return jsonResponse({
        ok: false,
        error: 'Server configuration error',
        debug: {
          message: 'Required environment variables are not configured',
          missing: missingVars,
        },
      }, 500);
    }

    console.log('[Stripe Checkout] Environment validation passed');

    console.log('[Stripe Checkout] Loading Stripe module...');
    const { default: Stripe } = await import('npm:stripe@17.7.0');
    console.log('[Stripe Checkout] Stripe module loaded');

    console.log('[Stripe Checkout] Loading Supabase module...');
    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');
    console.log('[Stripe Checkout] Supabase module loaded');

    console.log('[Stripe Checkout] Checking Authorization header...');
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    console.log('[Stripe Checkout] Auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Stripe Checkout] Missing or invalid Authorization header');
      return jsonResponse({
        ok: false,
        error: 'Missing bearer token',
        debug: { message: 'Authorization header must include Bearer token' },
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Stripe Checkout] Token extracted, length:', token.length);

    console.log('[Stripe Checkout] Creating anon client for user validation...');
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('[Stripe Checkout] Validating user token...');
    const { data: userData, error: getUserError } = await supabaseAnon.auth.getUser(token);

    if (getUserError) {
      console.error('[Stripe Checkout] Token validation failed:', getUserError.message);
      console.error('[Stripe Checkout] Error code:', getUserError.code);
      console.error('[Stripe Checkout] Error status:', getUserError.status);
      return jsonResponse({
        ok: false,
        error: 'Invalid token',
        debug: {
          message: getUserError.message,
          code: getUserError.code,
          status: getUserError.status,
        },
      }, 401);
    }

    if (!userData?.user) {
      console.error('[Stripe Checkout] No user in response');
      return jsonResponse({
        ok: false,
        error: 'User not found',
        debug: { message: 'No user associated with token' },
      }, 401);
    }

    const user = userData.user;
    console.log('[Stripe Checkout] ✓ User authenticated:', user.id);
    console.log('[Stripe Checkout] User email:', user.email);

    console.log('[Stripe Checkout] Creating service role client for DB operations...');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('[Stripe Checkout] Service role client created');

    console.log('[Stripe Checkout] Creating Stripe client...');
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
    console.log('[Stripe Checkout] Stripe client created');

    const body = await req.json();
    const STRIPE_PRICE_ID = body.price_id;
    const plan = body.plan || 'unknown';

    console.log('[Stripe Checkout] Request body:', { price_id: STRIPE_PRICE_ID, plan });
    console.log('[Stripe Checkout] Plan:', plan);
    console.log('[Stripe Checkout] Price ID:', STRIPE_PRICE_ID);

    if (!STRIPE_PRICE_ID || !STRIPE_PRICE_ID.startsWith('price_')) {
      console.error('[Stripe Checkout] Invalid or missing price_id:', STRIPE_PRICE_ID);
      return jsonResponse({
        ok: false,
        error: 'Invalid price ID format',
        debug: { message: 'price_id must be provided and start with price_' },
      }, 400);
    }

    console.log('[Stripe Checkout] Looking up customer for user:', user.id);
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (customerError) {
      console.error('[Stripe Checkout] DB error looking up customer:', customerError.message);
      return jsonResponse({
        ok: false,
        error: 'Database error',
        debug: { message: customerError.message },
      }, 500);
    }

    let customerId: string;

    if (!customerData?.customer_id) {
      console.log('[Stripe Checkout] Creating new customer...');

      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });

      console.log('[Stripe Checkout] Stripe customer created:', newCustomer.id);

      const { error: insertError } = await supabaseAdmin.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: newCustomer.id,
      });

      if (insertError) {
        console.error('[Stripe Checkout] Failed to save customer:', insertError.message);
        await stripe.customers.del(newCustomer.id).catch(e => console.error('Cleanup failed:', e));
        return jsonResponse({
          ok: false,
          error: 'Failed to create customer',
          debug: { message: insertError.message },
        }, 500);
      }

      const { error: subError } = await supabaseAdmin.from('stripe_subscriptions').insert({
        customer_id: newCustomer.id,
        status: 'not_started',
      });

      if (subError) {
        console.error('[Stripe Checkout] Failed to create subscription record:', subError.message);
        return jsonResponse({
          ok: false,
          error: 'Failed to create subscription',
          debug: { message: subError.message },
        }, 500);
      }

      customerId = newCustomer.id;
      console.log('[Stripe Checkout] Customer setup complete:', customerId);
    } else {
      customerId = customerData.customer_id;
      console.log('[Stripe Checkout] Using existing customer:', customerId);
    }

    console.log('[Stripe Checkout] Creating checkout session...');
    console.log('[Stripe Checkout] Customer:', customerId);
    console.log('[Stripe Checkout] Price:', STRIPE_PRICE_ID);

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: STRIPE_PRICE_ID,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${SITE_URL}/teacher/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/teacher/checkout`,
        metadata: {
          user_id: user.id,
          email: user.email || '',
          plan: plan,
        },
      });
    } catch (stripeError: any) {
      if (stripeError.code === 'resource_missing' && stripeError.message?.includes('No such customer')) {
        console.log('[Stripe Checkout] Customer not found in Stripe, creating new one...');

        await supabaseAdmin
          .from('stripe_customers')
          .delete()
          .eq('customer_id', customerId);

        const newCustomer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });

        console.log('[Stripe Checkout] New customer created:', newCustomer.id);

        const { error: insertError } = await supabaseAdmin.from('stripe_customers').insert({
          user_id: user.id,
          customer_id: newCustomer.id,
        });

        if (insertError) {
          console.error('[Stripe Checkout] Failed to save new customer:', insertError.message);
          return jsonResponse({
            ok: false,
            error: 'Failed to save customer',
            debug: { message: insertError.message },
          }, 500);
        }

        const { error: subError } = await supabaseAdmin.from('stripe_subscriptions').insert({
          customer_id: newCustomer.id,
          status: 'not_started',
        });

        if (subError) {
          console.error('[Stripe Checkout] Failed to create subscription:', subError.message);
        }

        customerId = newCustomer.id;
        console.log('[Stripe Checkout] Retrying checkout session with new customer...');

        session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [{
            price: STRIPE_PRICE_ID,
            quantity: 1,
          }],
          mode: 'subscription',
          success_url: `${SITE_URL}/teacher/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${SITE_URL}/teacher/checkout`,
          metadata: {
            user_id: user.id,
            email: user.email || '',
            plan: plan,
          },
        });
      } else {
        throw stripeError;
      }
    }

    console.log('[Stripe Checkout] ✓ Session created:', session.id);
    console.log('[Stripe Checkout] ✓ URL:', session.url);

    return jsonResponse({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('[Stripe Checkout] CRITICAL ERROR:', error);
    console.error('[Stripe Checkout] Error type:', error.constructor?.name);
    console.error('[Stripe Checkout] Error message:', error.message);
    console.error('[Stripe Checkout] Error stack:', error.stack);

    const errorInfo: any = {
      ok: false,
      error: error.message || 'Internal server error',
      debug: {
        type: error.constructor?.name || 'Unknown',
        message: error.message || 'Unknown error',
      },
    };

    if (error.type) {
      errorInfo.debug.stripe_type = error.type;
    }
    if (error.code) {
      errorInfo.debug.stripe_code = error.code;
    }

    return jsonResponse(errorInfo, 500);
  }
});
