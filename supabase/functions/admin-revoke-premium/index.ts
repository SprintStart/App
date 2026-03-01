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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user?.email) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminCheck } = await supabase
      .from('admin_allowlist')
      .select('role')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Not authorized - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { teacher_id, reason } = await req.json();

    if (!teacher_id) {
      return new Response(JSON.stringify({ error: 'teacher_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: teacher } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', teacher_id)
      .maybeSingle();

    if (!teacher) {
      return new Response(JSON.stringify({ error: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Revoke all active entitlements for this teacher (all sources)
    const { error: revokeEntitlementError } = await supabase
      .from('teacher_entitlements')
      .update({
        status: 'revoked',
        note: reason || 'Revoked by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('teacher_user_id', teacher_id)
      .eq('status', 'active');

    if (revokeEntitlementError) {
      console.error('Error revoking entitlement:', revokeEntitlementError);
      return new Response(JSON.stringify({ error: 'Failed to revoke premium access', details: revokeEntitlementError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also update teacher_premium_overrides for backwards compatibility
    await supabase
      .from('teacher_premium_overrides')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by_admin_id: user.id,
      })
      .eq('teacher_id', teacher_id);

    await supabase.from('audit_logs').insert({
      actor_admin_id: user.id,
      actor_email: user.email,
      action_type: 'revoke_premium',
      target_entity_type: 'teacher',
      target_entity_id: teacher_id,
      reason: reason || 'Admin revoked premium access',
      metadata: {
        teacher_email: teacher.email,
        revoked_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Premium access revoked successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error revoking premium:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
