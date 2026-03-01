import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Verify Admin Status - Server-Side Enforcement Only
 *
 * This is the ONLY way for frontend to verify admin status.
 * Uses service role to bypass RLS and check admin_allowlist directly.
 *
 * Security:
 * - Requires valid JWT (authenticated user)
 * - Checks admin_allowlist table (single source of truth)
 * - Logs all verification attempts in audit_logs
 * - Returns only boolean + minimal info (no sensitive data)
 *
 * Returns:
 * {
 *   "is_admin": boolean,
 *   "role": string | null,  // 'super_admin', 'admin', 'support', or null
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
          is_admin: false,
          error: 'No authorization header'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role (for both JWT validation and admin check)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate JWT by passing it explicitly to getUser()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Verify Admin] Auth error:', authError);
      return new Response(
        JSON.stringify({
          is_admin: false,
          error: 'Invalid or expired token'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Verify Admin] JWT validated. Checking admin status for user:', user.id, user.email);

    // Call the secure verify_admin_status function (bypasses RLS)
    const { data: verificationResult, error: verifyError } = await supabase
      .rpc('verify_admin_status', { check_user_id: user.id });

    console.log('[Verify Admin] RPC Response - Data:', verificationResult, 'Error:', verifyError);

    if (verifyError) {
      console.error('[Verify Admin] Verification error:', verifyError);
      return new Response(
        JSON.stringify({
          is_admin: false,
          error: 'Verification failed'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!verificationResult) {
      console.error('[Verify Admin] No verification result returned');
      return new Response(
        JSON.stringify({
          is_admin: false,
          error: 'No verification result'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Verify Admin] Result is_admin:', verificationResult.is_admin, 'Type:', typeof verificationResult.is_admin);

    // Return minimal response (no sensitive data)
    return new Response(
      JSON.stringify({
        is_admin: verificationResult.is_admin === true,
        role: verificationResult.role || null,
        verified_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[Verify Admin] Error:', error);

    return new Response(
      JSON.stringify({
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
