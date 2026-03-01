import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

type TeacherState = 'NEW' | 'SIGNED_UP_UNVERIFIED' | 'VERIFIED_UNPAID' | 'ACTIVE' | 'EXPIRED';

interface TeacherStateResponse {
  state: TeacherState;
  userId?: string;
  email?: string;
  emailConfirmed: boolean;
  hasSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionExpiry?: string;
  redirectTo: string;
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Check Teacher State] Looking up email:', email);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError) {
      console.error('[Check Teacher State] Profile lookup error:', profileError);
      throw profileError;
    }

    if (!profile) {
      console.log('[Check Teacher State] No profile found for email:', email);
      return new Response(
        JSON.stringify({
          state: 'NEW',
          emailConfirmed: false,
          hasSubscription: false,
          redirectTo: '/teacher',
          message: 'No account exists for this email',
        } as TeacherStateResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Allow both teachers and admins to proceed
    if (profile.role !== 'teacher' && profile.role !== 'admin') {
      console.log('[Check Teacher State] Not a teacher or admin account:', profile.role);
      return new Response(
        JSON.stringify({
          state: 'NEW',
          emailConfirmed: false,
          hasSubscription: false,
          redirectTo: '/teacher',
          message: 'Not a teacher or admin account',
        } as TeacherStateResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.id);

    if (userError) {
      console.error('[Check Teacher State] User lookup error:', userError);
      throw userError;
    }

    if (!user) {
      console.error('[Check Teacher State] User not found for profile:', profile.id);
      throw new Error('User not found');
    }

    const emailConfirmed = user.email_confirmed_at !== null;
    console.log('[Check Teacher State] Email confirmed:', emailConfirmed);

    if (!emailConfirmed) {
      return new Response(
        JSON.stringify({
          state: 'SIGNED_UP_UNVERIFIED',
          userId: user.id,
          email: user.email,
          emailConfirmed: false,
          hasSubscription: false,
          redirectTo: '/teacher/confirm',
          message: 'Email not confirmed',
        } as TeacherStateResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check entitlements (single source of truth)
    console.log('[Check Teacher State] Checking entitlements for user:', user.id);
    await supabase.rpc('expire_old_entitlements');

    const { data: activeEntitlement } = await supabase.rpc('get_active_entitlement', {
      user_id: user.id
    }).maybeSingle();

    if (activeEntitlement) {
      console.log('[Check Teacher State] Active entitlement found:', activeEntitlement.source);
      return new Response(
        JSON.stringify({
          state: 'ACTIVE',
          userId: user.id,
          email: user.email,
          emailConfirmed: true,
          hasSubscription: true,
          subscriptionStatus: 'active',
          subscriptionExpiry: activeEntitlement.expires_at,
          redirectTo: '/teacherdashboard',
          message: `Active premium access via ${activeEntitlement.source}`,
        } as TeacherStateResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Check Teacher State] No active entitlement found, checking external sources');

    // Check for Stripe subscription
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
        console.log('[Check Teacher State] Found active Stripe subscription, creating entitlement');

        const expiresAt = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toISOString()
          : null;

        // Create entitlement record
        await supabase.from('teacher_entitlements').insert({
          teacher_user_id: user.id,
          source: 'stripe',
          status: 'active',
          expires_at: expiresAt,
          metadata: {
            subscription_id: stripeSub.subscription_id,
            customer_id: stripeSub.customer_id,
          },
        });

        return new Response(
          JSON.stringify({
            state: 'ACTIVE',
            userId: user.id,
            email: user.email,
            emailConfirmed: true,
            hasSubscription: true,
            subscriptionStatus: stripeSub.status,
            subscriptionExpiry: expiresAt,
            redirectTo: '/teacherdashboard',
            message: 'Active Stripe subscription',
          } as TeacherStateResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check school domain license (method 1: via school_licenses table)
    const emailDomain = user.email?.split('@')[1];
    if (emailDomain) {
      const { data: schoolLicense } = await supabase.rpc('get_active_school_license', {
        email_domain: emailDomain,
      }).maybeSingle();

      if (schoolLicense) {
        console.log('[Check Teacher State] Found school license, creating entitlement');

        // Create entitlement record
        await supabase.from('teacher_entitlements').insert({
          teacher_user_id: user.id,
          source: 'school_domain',
          status: 'active',
          expires_at: schoolLicense.ends_at,
          metadata: {
            school_id: schoolLicense.school_id,
            domain: emailDomain,
          },
        });

        return new Response(
          JSON.stringify({
            state: 'ACTIVE',
            userId: user.id,
            email: user.email,
            emailConfirmed: true,
            hasSubscription: true,
            subscriptionStatus: 'active',
            subscriptionExpiry: schoolLicense.ends_at,
            redirectTo: '/teacherdashboard',
            message: 'Active school license',
          } as TeacherStateResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Method 2: Check schools table directly if no school_licenses found
      console.log('[Check Teacher State] No school license found, checking schools.email_domains');
      const { data: schools } = await supabase
        .from('schools')
        .select('id, name, email_domains, is_active, auto_approve_teachers')
        .eq('is_active', true);

      if (schools && schools.length > 0) {
        for (const school of schools) {
          if (school.email_domains && Array.isArray(school.email_domains)) {
            const domainMatch = school.email_domains.some(
              (domain: string) => domain.toLowerCase() === emailDomain.toLowerCase()
            );

            if (domainMatch && school.auto_approve_teachers) {
              console.log('[Check Teacher State] Found matching school via email_domains:', school.name);

              // Create entitlement record
              await supabase.from('teacher_entitlements').insert({
                teacher_user_id: user.id,
                source: 'school_domain',
                status: 'active',
                expires_at: null, // School domain access doesn't expire
                metadata: {
                  school_id: school.id,
                  school_name: school.name,
                  domain: emailDomain,
                },
              });

              return new Response(
                JSON.stringify({
                  state: 'ACTIVE',
                  userId: user.id,
                  email: user.email,
                  emailConfirmed: true,
                  hasSubscription: true,
                  subscriptionStatus: 'active',
                  redirectTo: '/teacherdashboard',
                  message: `Active school access via ${school.name}`,
                } as TeacherStateResponse),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          }
        }
      }

      console.log('[Check Teacher State] No school domain match found for:', emailDomain);
    }

    // Check if user is admin (admins always have premium)
    if (profile.role === 'admin') {
      console.log('[Check Teacher State] Admin user, creating permanent entitlement');

      await supabase.from('teacher_entitlements').insert({
        teacher_user_id: user.id,
        source: 'admin_grant',
        status: 'active',
        expires_at: null,
        note: 'Admin user - permanent premium access',
      });

      return new Response(
        JSON.stringify({
          state: 'ACTIVE',
          userId: user.id,
          email: user.email,
          emailConfirmed: true,
          hasSubscription: true,
          subscriptionStatus: 'active',
          redirectTo: '/teacherdashboard',
          message: 'Admin access',
        } as TeacherStateResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // No active entitlement found
    console.log('[Check Teacher State] No entitlement found, needs payment');
    return new Response(
      JSON.stringify({
        state: 'VERIFIED_UNPAID',
        userId: user.id,
        email: user.email,
        emailConfirmed: true,
        hasSubscription: false,
        redirectTo: '/teacher/checkout',
        message: 'No active premium access',
      } as TeacherStateResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking teacher state:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
