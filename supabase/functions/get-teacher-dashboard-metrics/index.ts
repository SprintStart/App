import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { validateAuth, createErrorResponse, type AuthError } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Validate authentication using shared helper
    const { user, supabase } = await validateAuth(req);

    console.log("[Dashboard Metrics] User authenticated:", user.id);

    // Call database function (date range is handled in the function - last 30 days)
    const { data, error } = await supabase.rpc("get_teacher_dashboard_metrics", {
      p_teacher_id: user.id,
    });

    if (error) {
      console.error("[Dashboard Metrics] Database error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // Handle auth errors
    if (err && typeof err === 'object' && 'code' in err && 'status' in err) {
      console.error("[Dashboard Metrics] Auth error:", err);
      return createErrorResponse(err as AuthError, corsHeaders);
    }

    // Handle unexpected errors
    console.error("[Dashboard Metrics] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
