import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateAdminRequest {
  email: string;
  sendPasswordResetEmail?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, sendPasswordResetEmail = true }: CreateAdminRequest = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check admin_allowlist table for authorized emails
    const { data: allowlistEntry, error: allowlistError } = await supabaseAdmin
      .from('admin_allowlist')
      .select('email, is_active, role')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (allowlistError) {
      console.error(`[Create Admin] Error checking allowlist:`, allowlistError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin access" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!allowlistEntry) {
      console.error(`[Create Admin] Email not in allowlist or inactive: ${email}`);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Create Admin] Email authorized in allowlist: ${email} (role: ${allowlistEntry.role})`);

    console.log(`[Create Admin] Creating admin user for: ${email}`);

    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

    if (checkError) {
      console.error("[Create Admin] Error checking users:", checkError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);

    if (existingUser) {
      console.log(`[Create Admin] User already exists: ${existingUser.id}`);

      // Ensure profile has admin role
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: existingUser.id,
          email: email,
          role: 'admin',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (profileError) {
        console.error("[Create Admin] Error updating profile:", profileError);
      }

      // Send password reset email if requested
      let resetData: any = null;
      if (sendPasswordResetEmail) {
        const redirectUrl = 'https://startsprint.app/admin/reset-password';

        const { data, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: redirectUrl,
          }
        });

        if (resetError) {
          console.error("[Create Admin] Error generating reset link:", resetError);
          return new Response(
            JSON.stringify({
              success: true,
              userId: existingUser.id,
              message: "Admin user exists but password reset email failed",
              error: resetError.message
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        resetData = data;
        console.log(`[Create Admin] Password reset email sent to: ${email}`);
        console.log(`[Create Admin] Reset link generated:`, resetData?.properties?.action_link);
      }

      return new Response(
        JSON.stringify({
          success: true,
          userId: existingUser.id,
          message: sendPasswordResetEmail
            ? "Password reset email sent"
            : "Admin user already exists",
          emailSent: sendPasswordResetEmail,
          setupLink: resetData?.properties?.action_link
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create new admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      app_metadata: {
        role: 'admin',
      },
    });

    if (createError || !newUser.user) {
      console.error("[Create Admin] Error creating user:", createError);
      return new Response(
        JSON.stringify({
          error: "Failed to create admin user",
          details: createError?.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Create Admin] User created: ${newUser.user.id}`);

    // Create profile with admin role
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        email: email,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("[Create Admin] Error creating profile:", profileError);
      // Continue anyway, profile might be created by trigger
    }

    // Send password setup email
    if (sendPasswordResetEmail) {
      const redirectUrl = `${new URL(req.url).origin}/admin/reset-password`;

      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: redirectUrl,
        }
      });

      if (resetError) {
        console.error("[Create Admin] Error generating reset link:", resetError);
        return new Response(
          JSON.stringify({
            success: true,
            userId: newUser.user.id,
            message: "Admin user created but password setup email failed",
            setupLink: resetData?.properties?.action_link,
            error: resetError.message
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`[Create Admin] Password setup email sent to: ${email}`);
      console.log(`[Create Admin] Setup link generated:`, resetData?.properties?.action_link);

      return new Response(
        JSON.stringify({
          success: true,
          userId: newUser.user.id,
          message: "Admin user created and password setup email sent",
          emailSent: true,
          setupLink: resetData?.properties?.action_link
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUser.user.id,
        message: "Admin user created successfully",
        emailSent: false
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[Create Admin] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
