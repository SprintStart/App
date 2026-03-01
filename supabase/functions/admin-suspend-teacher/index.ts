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
      console.error('[Admin Suspend Teacher] Missing or invalid auth header');
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Admin Suspend Teacher] Token length:', token.length);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error('[Admin Suspend Teacher] Auth error:', authError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Invalid JWT', details: authError?.message || 'No user found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Suspend Teacher] User validated:', user.id, user.email);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminCheck } = await supabaseAdmin
      .from('admin_allowlist')
      .select('role')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      console.error('[Admin Suspend Teacher] User not in admin allowlist:', user.email);
      return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Admin Suspend Teacher] Admin check passed');

    const { teacher_id, reason } = await req.json();

    if (!teacher_id) {
      return new Response(JSON.stringify({ error: 'teacher_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    const { data: topics } = await supabaseAdmin
      .from('topics')
      .select('id, is_active')
      .eq('created_by', teacher_id);

    if (topics && topics.length > 0) {
      const activeTopics = topics.filter(t => t.is_active);

      for (const topic of activeTopics) {
        await supabaseAdmin
          .from('topics')
          .update({
            is_active: false,
            suspended_due_to_subscription: true,
            published_before_suspension: true,
            suspended_at: now,
          })
          .eq('id', topic.id);
      }
    }

    const { data: questionSets } = await supabaseAdmin
      .from('question_sets')
      .select('id, is_active')
      .eq('created_by', teacher_id);

    if (questionSets && questionSets.length > 0) {
      const activeSets = questionSets.filter(qs => qs.is_active);

      for (const qs of activeSets) {
        await supabaseAdmin
          .from('question_sets')
          .update({
            is_active: false,
            suspended_due_to_subscription: true,
            published_before_suspension: true,
            suspended_at: now,
          })
          .eq('id', qs.id);
      }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_admin_id: user.id,
      actor_email: user.email,
      action_type: 'suspend_teacher',
      target_entity_type: 'teacher',
      target_entity_id: teacher_id,
      reason: reason || 'No reason provided',
      metadata: {
        topics_suspended: topics?.filter(t => t.is_active).length || 0,
        question_sets_suspended: questionSets?.filter(qs => qs.is_active).length || 0,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teacher suspended and content unpublished',
        topics_suspended: topics?.filter(t => t.is_active).length || 0,
        question_sets_suspended: questionSets?.filter(qs => qs.is_active).length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error suspending teacher:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
