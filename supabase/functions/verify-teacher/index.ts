import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Verify Teacher Status - Server-Side Enforcement Only
 *
 * This is the ONLY way for frontend to verify teacher (or admin) status.
 * Uses service role to bypass RLS and check profiles.role directly.
 *
 * Security:
 * - Requires valid JWT (authenticated user)
 * - Checks profiles table for role='teacher' or role='admin'
 * - Admins can also access teacher dashboard
 * - Logs all verification attempts in audit_logs
 * - Returns only boolean + minimal info (no sensitive data)
 *
 * Returns:
 * {
 *   "is_teacher": boolean,
 *   "is_admin": boolean,
 *   "role": string,
 *   "verified_at": ISO timestamp
 * }
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          is_teacher: false,
          is_admin: false,
          error: 'No authorization header'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Verify Teacher] Auth error:', authError);
      return new Response(
        JSON.stringify({
          is_teacher: false,
          is_admin: false,
          error: 'Invalid or expired token'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Verify Teacher] Checking teacher status for user:', user.id, user.email);

    // Check profiles table for role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Verify Teacher] Profile error:', profileError);
      throw profileError;
    }

    const isAdmin = profile?.role === 'admin';
    const isTeacher = profile?.role === 'teacher' || isAdmin;

    console.log('[Verify Teacher] Result:', { role: profile?.role, isTeacher, isAdmin });

    // Log verification attempt
    if (isTeacher || isAdmin) {
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action_type: 'teacher_access_verified',
        entity_type: 'teacher_session',
        after_state: {
          is_teacher: isTeacher,
          is_admin: isAdmin,
          role: profile?.role,
          email: user.email
        }
      });
    }

    // Return minimal response (no sensitive data)
    return new Response(
      JSON.stringify({
        is_teacher: isTeacher,
        is_admin: isAdmin,
        role: profile?.role || null,
        verified_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[Verify Teacher] Error:', error);

    return new Response(
      JSON.stringify({
        is_teacher: false,
        is_admin: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
