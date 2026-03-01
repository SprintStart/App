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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Admin Teacher Detail] Missing or invalid auth header');
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Admin Teacher Detail] Token length:', token.length);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error('[Admin Teacher Detail] Auth error:', authError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Invalid JWT', details: authError?.message || 'No user found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Teacher Detail] User validated:', user.id, user.email);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminCheck } = await supabaseAdmin
      .from('admin_allowlist')
      .select('role')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      console.error('[Admin Teacher Detail] User not in admin allowlist:', user.email);
      return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Teacher Detail] Admin check passed');

    const { teacher_id } = await req.json();

    if (!teacher_id) {
      return new Response(JSON.stringify({ error: 'teacher_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(teacher_id);

    if (authUserError || !authUser.user) {
      return new Response(JSON.stringify({ error: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', teacher_id)
      .maybeSingle();

    const { data: stripeCustomer } = await supabaseAdmin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', teacher_id)
      .is('deleted_at', null)
      .maybeSingle();

    let subscription = null;
    if (stripeCustomer?.customer_id) {
      const { data } = await supabaseAdmin
        .from('stripe_subscriptions')
        .select('*')
        .eq('customer_id', stripeCustomer.customer_id)
        .maybeSingle();
      subscription = data;
    }

    const { data: schoolMembership } = await supabaseAdmin
      .from('teacher_school_membership')
      .select('*, schools(school_name)')
      .eq('teacher_id', teacher_id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: premiumOverride } = await supabaseAdmin
      .from('teacher_premium_overrides')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('is_active', true)
      .maybeSingle();

    const { data: topics } = await supabaseAdmin
      .from('topics')
      .select('id, name, slug, subject, is_active, created_at')
      .eq('created_by', teacher_id)
      .order('created_at', { ascending: false });

    const { data: quizRuns } = await supabaseAdmin
      .from('public_quiz_runs')
      .select('id, score, status, started_at, completed_at')
      .in('topic_id', topics?.map(t => t.id) || [])
      .order('started_at', { ascending: false })
      .limit(50);

    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .or(`entity_id.eq.${teacher_id},target_entity_id.eq.${teacher_id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    let premiumStatus = false;
    let premiumSource: 'stripe' | 'school_domain' | 'admin_override' | 'none' = 'none';
    let expiresAt: string | null = null;

    if (subscription?.status === 'active') {
      premiumStatus = true;
      premiumSource = 'stripe';
      if (subscription.current_period_end) {
        expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
      }
    } else if (premiumOverride?.is_active) {
      const overrideExpiry = premiumOverride.expires_at ? new Date(premiumOverride.expires_at) : null;
      if (!overrideExpiry || overrideExpiry > new Date()) {
        premiumStatus = true;
        premiumSource = 'admin_override';
        expiresAt = premiumOverride.expires_at;
      }
    } else if (schoolMembership?.premium_granted) {
      premiumStatus = true;
      premiumSource = 'school_domain';
    } else if (profile?.role === 'admin') {
      premiumStatus = true;
      premiumSource = 'admin_override';
    }

    const detail = {
      id: authUser.user.id,
      email: authUser.user.email,
      full_name: profile?.full_name || 'N/A',
      email_verified: !!authUser.user.email_confirmed_at,
      email_confirmed_at: authUser.user.email_confirmed_at,
      created_at: authUser.user.created_at,
      last_sign_in_at: authUser.user.last_sign_in_at,
      premium_status: premiumStatus,
      premium_source: premiumSource,
      expires_at: expiresAt,
      subscription: subscription ? {
        status: subscription.status,
        subscription_id: subscription.subscription_id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        payment_method_brand: subscription.payment_method_brand,
        payment_method_last4: subscription.payment_method_last4,
      } : null,
      school_membership: schoolMembership ? {
        school_id: schoolMembership.school_id,
        school_name: schoolMembership.schools?.school_name || 'Unknown',
        premium_granted: schoolMembership.premium_granted,
        joined_via: schoolMembership.joined_via,
      } : null,
      topics: topics || [],
      recent_activity: quizRuns || [],
      audit_logs: auditLogs || [],
    };

    return new Response(
      JSON.stringify({ teacher: detail }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching teacher detail:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
