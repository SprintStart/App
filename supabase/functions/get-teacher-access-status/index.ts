import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Get Teacher Access] Checking entitlement for user:', user.id);

    // First, expire any old entitlements
    await supabase.rpc('expire_old_entitlements');

    // Check for existing active entitlement (single source of truth)
    const { data: activeEntitlement } = await supabase.rpc('get_active_entitlement', {
      user_id: user.id
    }).maybeSingle();

    if (activeEntitlement) {
      console.log('[Get Teacher Access] Found active entitlement:', activeEntitlement.source);
      return new Response(
        JSON.stringify({
          hasPremium: true,
          premiumSource: activeEntitlement.source,
          expiresAt: activeEntitlement.expires_at,
          needsPayment: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Get Teacher Access] No active entitlement found, checking external sources');

    // If no entitlement found, check external sources and create entitlements
    const userEmail = user.email || '';
    const emailDomain = userEmail.split('@')[1];

    let hasPremium = false;
    let premiumSource: 'stripe' | 'school_domain' | 'admin_grant' | 'none' = 'none';
    let expiresAt: string | null = null;
    let metadata: any = {};

    // Check Stripe subscription
    const { data: stripeCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (stripeCustomer?.customer_id) {
      const { data: stripeSub } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('customer_id', stripeCustomer.customer_id)
        .maybeSingle();

      if (stripeSub && stripeSub.status === 'active') {
        hasPremium = true;
        premiumSource = 'stripe';
        if (stripeSub.current_period_end) {
          expiresAt = new Date(stripeSub.current_period_end * 1000).toISOString();
        }
        metadata = {
          subscription_id: stripeSub.subscription_id,
          customer_id: stripeSub.customer_id,
        };

        // Create entitlement record
        await supabase.from('teacher_entitlements').insert({
          teacher_user_id: user.id,
          source: 'stripe',
          status: 'active',
          expires_at: expiresAt,
          metadata: metadata,
        });

        console.log('[Get Teacher Access] Created Stripe entitlement');
      }
    }

    // Check school domain license
    if (!hasPremium && emailDomain) {
      const { data: schoolLicense } = await supabase.rpc('get_active_school_license', {
        email_domain: emailDomain,
      }).maybeSingle();

      if (schoolLicense) {
        hasPremium = true;
        premiumSource = 'school_domain';
        expiresAt = schoolLicense.ends_at;
        metadata = {
          school_id: schoolLicense.school_id,
          domain: emailDomain,
        };

        // Create entitlement record
        await supabase.from('teacher_entitlements').insert({
          teacher_user_id: user.id,
          source: 'school_domain',
          status: 'active',
          expires_at: expiresAt,
          metadata: metadata,
        });

        // Update membership table
        await supabase.from('teacher_school_membership').upsert({
          teacher_id: user.id,
          school_id: schoolLicense.school_id,
          joined_via: 'email_domain',
          premium_granted: true,
          premium_granted_at: new Date().toISOString(),
          is_active: true,
        }, {
          onConflict: 'teacher_id,school_id',
        });

        console.log('[Get Teacher Access] Created school domain entitlement');
      }
    }

    // Check if user is admin (admins always have premium)
    if (!hasPremium) {
      const { data: adminCheck } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (adminCheck?.role === 'admin') {
        hasPremium = true;
        premiumSource = 'admin_grant';

        // Create permanent entitlement for admin
        await supabase.from('teacher_entitlements').insert({
          teacher_user_id: user.id,
          source: 'admin_grant',
          status: 'active',
          expires_at: null,
          note: 'Admin user - permanent premium access',
        });

        console.log('[Get Teacher Access] Created admin entitlement');
      }
    }

    return new Response(
      JSON.stringify({
        hasPremium,
        premiumSource,
        expiresAt,
        needsPayment: !hasPremium,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking access status:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
