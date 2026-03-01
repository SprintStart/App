import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CheckEmailRequest {
  email: string;
}

interface CheckEmailResponse {
  available: boolean;
  message?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse request body
    const { email }: CheckEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({
          available: false,
          message: 'Email is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({
          available: false,
          message: 'Invalid email format',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email exists in profiles table (more efficient than listing all auth users)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error('Error checking profile:', profileError);
      return new Response(
        JSON.stringify({
          available: false,
          message: 'Error checking email availability',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (profile) {
      return new Response(
        JSON.stringify({
          available: false,
          message: profile.role === 'teacher'
            ? 'This email is already registered. Please sign in or reset your password.'
            : 'This email is already in use.',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Email is available
    return new Response(
      JSON.stringify({
        available: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in check-teacher-email function:', error);
    return new Response(
      JSON.stringify({
        available: false,
        message: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
