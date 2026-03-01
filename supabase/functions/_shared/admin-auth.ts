/**
 * Shared authentication and authorization logic for admin edge functions
 * This ensures consistent JWT validation across all admin endpoints
 */

export async function validateAdminAuth(
  req: Request,
  createClient: any,
  corsHeaders: Record<string, string>
): Promise<{ user: any; supabaseAdmin: any } | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Check for Bearer token
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[Admin Auth] Missing or invalid auth header');
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('[Admin Auth] Token length:', token.length);

  // 2. Validate JWT with anon key client (user validation)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    console.error('[Admin Auth] Auth error:', authError?.message || 'No user');
    return new Response(JSON.stringify({
      error: 'Invalid JWT',
      details: authError?.message || 'No user found'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[Admin Auth] User validated:', user.id, user.email);

  // 3. Create service role client for DB queries
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 4. Check admin allowlist
  const { data: adminCheck } = await supabaseAdmin
    .from('admin_allowlist')
    .select('role')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle();

  if (!adminCheck) {
    console.error('[Admin Auth] User not in admin allowlist:', user.email);
    return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[Admin Auth] Admin check passed, role:', adminCheck.role);

  return { user, supabaseAdmin };
}

/**
 * Simplified admin verification for endpoints that need boolean admin check
 * Returns true if user is an active admin, false otherwise
 */
export async function verifyAdmin(req: Request): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[verifyAdmin] Missing environment variables');
      return false;
    }

    // Check for Authorization header (case-insensitive)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[verifyAdmin] Missing or invalid Authorization header');
      return false;
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate JWT and get user
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      console.error('[verifyAdmin] Invalid JWT or user not found');
      return false;
    }

    // Check admin allowlist using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await adminClient.from('admin_allowlist').select('email').eq('email', user.email).eq('is_active', true).maybeSingle();

    return !!data;
  } catch (error) {
    console.error('[verifyAdmin] Error:', error);
    return false;
  }
}
