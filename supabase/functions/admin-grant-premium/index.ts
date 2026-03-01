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

    const token = authHeader.replace('Bearer ', '');

    // Create client with anon key to verify user token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user?.email) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for database operations
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

    const { teacher_id, expires_at, reason } = await req.json();

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

    const expiryDate = expires_at ? new Date(expires_at) : null; // null = permanent access

    // First, revoke any existing active entitlements for this teacher
    const { error: revokeError } = await supabase
      .from('teacher_entitlements')
      .update({
        status: 'revoked',
        note: 'Revoked due to new admin grant',
      })
      .eq('teacher_user_id', teacher_id)
      .eq('source', 'admin_grant')
      .eq('status', 'active');

    if (revokeError) {
      console.error('Error revoking previous entitlements:', revokeError);
    }

    // Create new entitlement using service role (bypasses RLS)
    const { data: insertData, error: insertError } = await supabase
      .from('teacher_entitlements')
      .insert({
        teacher_user_id: teacher_id,
        source: 'admin_grant',
        status: 'active',
        expires_at: expiryDate ? expiryDate.toISOString() : null,
        created_by_admin_id: user.id,
        note: reason || 'Admin granted premium access',
        metadata: {
          granted_by: user.email,
          granted_at: new Date().toISOString(),
        },
      })
      .select();

    if (insertError) {
      console.error('Error granting premium:', insertError);
      console.error('Insert error code:', insertError.code);
      console.error('Insert error hint:', insertError.hint);
      console.error('Insert error details:', insertError.details);
      return new Response(JSON.stringify({
        error: 'Failed to grant premium access',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Entitlement created successfully:', insertData);

    // Also update teacher_premium_overrides for backwards compatibility (can be removed later)
    await supabase
      .from('teacher_premium_overrides')
      .upsert({
        teacher_id,
        granted_by_admin_id: user.id,
        expires_at: expiryDate ? expiryDate.toISOString() : null,
        is_active: true,
        granted_at: new Date().toISOString(),
        reason: reason || 'Admin granted premium access',
      }, {
        onConflict: 'teacher_id'
      });

    await supabase.from('audit_logs').insert({
      actor_admin_id: user.id,
      actor_email: user.email,
      action_type: 'grant_premium',
      target_entity_type: 'teacher',
      target_entity_id: teacher_id,
      reason: reason || 'Admin granted premium access',
      metadata: {
        teacher_email: teacher.email,
        expires_at: expiryDate ? expiryDate.toISOString() : null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Premium access granted successfully',
        expires_at: expiryDate ? expiryDate.toISOString() : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error granting premium:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
