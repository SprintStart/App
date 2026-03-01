import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SetPasswordRequest {
  email: string;
  password: string;
  adminSecret: string;
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

    const { email, password, adminSecret }: SetPasswordRequest = await req.json();

    // Validate admin secret (hardcoded for security)
    const ADMIN_SECRET = "startsprint-admin-setup-2026";

    if (adminSecret !== ADMIN_SECRET) {
      console.error("[Admin Set Password] Invalid admin secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Allowlist for admin emails
    const ADMIN_ALLOWLIST = ['lesliekweku.addae@gmail.com'];

    if (!ADMIN_ALLOWLIST.includes(email.toLowerCase())) {
      console.error(`[Admin Set Password] Email not in allowlist: ${email}`);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Admin Set Password] Setting password for admin: ${email}`);

    // Get user by email
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

    if (checkError) {
      console.error("[Admin Set Password] Error checking users:", checkError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);

    if (!existingUser) {
      console.error(`[Admin Set Password] User not found: ${email}`);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update user password directly
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { password: password }
    );

    if (updateError) {
      console.error("[Admin Set Password] Error updating password:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to update password",
          details: updateError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Admin Set Password] Password updated successfully for: ${email}`);

    // Log to audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      actor_admin_id: existingUser.id,
      action_type: 'admin_password_set_direct',
      target_entity_type: 'auth',
      target_entity_id: existingUser.id,
      metadata: {
        timestamp: new Date().toISOString(),
        method: 'direct_service_role'
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId: existingUser.id,
        email: email,
        message: "Admin password set successfully. You can now log in."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[Admin Set Password] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
