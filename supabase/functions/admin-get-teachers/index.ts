import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log('[Admin Get Teachers] Starting request');
    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[Admin Get Teachers] Checking auth header');
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Admin Get Teachers] No auth header or invalid format');
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Admin Get Teachers] Token received, length:', token.length);

    console.log('[Admin Get Teachers] Creating anon client for user validation');
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    console.log('[Admin Get Teachers] Validating user token');
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      console.error('[Admin Get Teachers] Auth error:', authError?.message || 'No user returned');
      return new Response(JSON.stringify({
        error: 'Invalid JWT',
        details: authError?.message || 'No user found'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Get Teachers] User validated, ID:', user.id, 'Email:', user.email);

    console.log('[Admin Get Teachers] Creating service role client for DB queries');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Admin Get Teachers] Checking admin allowlist');
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_allowlist')
      .select('role')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      console.error('[Admin Get Teachers] User not in admin allowlist:', user.email);
      return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Get Teachers] Admin check passed, role:', adminCheck.role);

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    const premiumFilter = url.searchParams.get('premium') || 'all';

    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError);
      throw authUsersError;
    }

    if (!authUsers || !authUsers.users) {
      return new Response(
        JSON.stringify({ teachers: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const teacherUserIds = authUsers.users
      .filter(u => u.email && u.email_confirmed_at)
      .map(u => u.id);

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('id', teacherUserIds);

    const { data: stripeCustomers } = await supabaseAdmin
      .from('stripe_customers')
      .select('user_id, customer_id')
      .in('user_id', teacherUserIds)
      .is('deleted_at', null);

    const customerMap = new Map(stripeCustomers?.map(c => [c.user_id, c.customer_id]) || []);

    const customerIds = Array.from(customerMap.values());
    let stripeSubs: any[] = [];
    if (customerIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('stripe_subscriptions')
        .select('*')
        .in('customer_id', customerIds);
      stripeSubs = data || [];
    }

    const subsByCustomer = new Map(stripeSubs?.map(s => [s.customer_id, s]) || []);

    const { data: topics } = await supabaseAdmin
      .from('topics')
      .select('id, created_by')
      .in('created_by', teacherUserIds);

    const topicCountByTeacher = new Map<string, number>();
    topics?.forEach(t => {
      if (t.created_by) {
        topicCountByTeacher.set(t.created_by, (topicCountByTeacher.get(t.created_by) || 0) + 1);
      }
    });

    const { data: memberships } = await supabaseAdmin
      .from('teacher_school_membership')
      .select('teacher_id, school_id, premium_granted')
      .in('teacher_id', teacherUserIds)
      .eq('is_active', true);

    const schoolMembershipMap = new Map(memberships?.map(m => [m.teacher_id, m]) || []);

    const { data: premiumOverrides, error: premiumOverridesError } = await supabaseAdmin
      .from('teacher_premium_overrides')
      .select('teacher_id, expires_at, is_active')
      .in('teacher_id', teacherUserIds)
      .eq('is_active', true);

    if (premiumOverridesError) {
      console.error('[Admin Get Teachers] Error fetching premium overrides:', premiumOverridesError);
    }

    const premiumOverrideMap = new Map(premiumOverrides?.map(p => [p.teacher_id, p]) || []);

    const teachers = authUsers.users
      .filter(u => u.email && u.email_confirmed_at)
      .map(u => {
        const profile = profiles?.find(p => p.id === u.id);
        const customerId = customerMap.get(u.id);
        const subscription = customerId ? subsByCustomer.get(customerId) : null;
        const schoolMembership = schoolMembershipMap.get(u.id);
        const premiumOverride = premiumOverrideMap.get(u.id);

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

        const teacherStatus = subscription?.status === 'canceled' || subscription?.status === 'past_due'
          ? 'expired'
          : premiumStatus
          ? 'active'
          : 'inactive';

        return {
          id: u.id,
          email: u.email,
          full_name: profile?.full_name || 'N/A',
          email_verified: !!u.email_confirmed_at,
          premium_status: premiumStatus,
          premium_source: premiumSource,
          expires_at: expiresAt,
          status: teacherStatus,
          created_at: u.created_at,
          quiz_count: topicCountByTeacher.get(u.id) || 0,
        };
      });

    let filtered = teachers;

    if (search) {
      filtered = filtered.filter(t =>
        t.email?.toLowerCase().includes(search.toLowerCase()) ||
        t.full_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter(t => t.status === status);
    }

    if (premiumFilter === 'premium') {
      filtered = filtered.filter(t => t.premium_status);
    } else if (premiumFilter === 'free') {
      filtered = filtered.filter(t => !t.premium_status);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(
      JSON.stringify({ teachers: filtered }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
