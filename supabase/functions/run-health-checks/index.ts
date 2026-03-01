import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://startsprint.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, authorization, Content-Type, content-type, X-CRON-SECRET, x-cron-secret",
};

interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "down";
  responseTime?: number;
  error?: string;
  timestamp: string;
}

/**
 * Run Health Checks Edge Function
 *
 * Performs health checks on critical services and logs results.
 * Authentication methods:
 *   1. CRON: X-CRON-SECRET header matching CRON_SECRET env var (cron-job.org)
 *   2. Admin: Authorization Bearer JWT (startsprint.app admin manual trigger)
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Two authentication methods supported:
    // 1. CRON job with X-CRON-SECRET header
    // 2. Admin user with JWT Authorization header

    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("X-CRON-SECRET") || req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

    let isAuthorized = false;
    let authMethod = "none";

    // Check CRON secret first
    if (providedSecret && cronSecret && providedSecret === cronSecret) {
      console.log("[Health Checks] ✓ Authenticated via CRON secret");
      isAuthorized = true;
      authMethod = "cron";
    }
    // Check admin JWT authentication
    else if (authHeader?.startsWith('Bearer ')) {
      console.log("[Health Checks] Validating admin JWT...");
      isAuthorized = await verifyAdmin(req);
      if (isAuthorized) {
        console.log("[Health Checks] ✓ Authenticated via admin JWT");
        authMethod = "admin";
      } else {
        console.warn("[Health Checks] ✗ Invalid admin JWT");
      }
    }

    if (!isAuthorized) {
      console.warn("[Health Checks] ✗ Unauthorized access attempt");
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Valid X-CRON-SECRET or admin JWT required"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Health Checks] Starting health check run (auth: ${authMethod})`);

    const results: HealthCheckResult[] = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const productionDomain = "https://startsprint.app";

    // 1. Check Homepage/Explore
    try {
      const homeStart = Date.now();
      const homeResponse = await fetch(`${productionDomain}/explore`, {
        method: "GET",
        headers: {
          "User-Agent": "StartSprint-Health-Monitor/1.0",
        },
      });
      const homeTime = Date.now() - homeStart;

      results.push({
        service: "homepage",
        status: homeResponse.ok ? "healthy" : "degraded",
        responseTime: homeTime,
        error: homeResponse.ok ? undefined : `HTTP ${homeResponse.status}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        service: "homepage",
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Check School Wall
    try {
      const schoolStart = Date.now();
      const schoolResponse = await fetch(`${productionDomain}/northampton-college`, {
        method: "GET",
        headers: {
          "User-Agent": "StartSprint-Health-Monitor/1.0",
        },
      });
      const schoolTime = Date.now() - schoolStart;

      results.push({
        service: "school_wall",
        status: schoolResponse.ok ? "healthy" : "degraded",
        responseTime: schoolTime,
        error: schoolResponse.ok ? undefined : `HTTP ${schoolResponse.status}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        service: "school_wall",
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Check Subject Page
    try {
      const subjectStart = Date.now();
      const subjectResponse = await fetch(`${productionDomain}/subjects/business`, {
        method: "GET",
        headers: {
          "User-Agent": "StartSprint-Health-Monitor/1.0",
        },
      });
      const subjectTime = Date.now() - subjectStart;

      results.push({
        service: "subject_page",
        status: subjectResponse.ok ? "healthy" : "degraded",
        responseTime: subjectTime,
        error: subjectResponse.ok ? undefined : `HTTP ${subjectResponse.status}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        service: "subject_page",
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Check Database (start_quiz_run RPC) - mirrors frontend quiz start flow
    try {
      const dbStart = Date.now();

      // First get an active quiz ID from the database
      const quizResponse = await fetch(`${supabaseUrl}/rest/v1/question_sets?is_active=eq.true&approval_status=eq.approved&limit=1&select=id`, {
        headers: {
          "apikey": supabaseAnonKey!,
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
      });

      let dbStatus = "down";
      let dbError = undefined;

      if (quizResponse.ok) {
        const quizData = await quizResponse.json();
        if (quizData && quizData.length > 0) {
          // Test the start_quiz_run RPC with a test session ID
          const testSessionId = `health-check-${Date.now()}`;
          const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/start_quiz_run`, {
            method: "POST",
            headers: {
              "apikey": supabaseAnonKey!,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_question_set_id: quizData[0].id,
              p_session_id: testSessionId,
            }),
          });

          if (rpcResponse.ok) {
            dbStatus = "healthy";
          } else {
            dbStatus = "degraded";
            dbError = `RPC error: HTTP ${rpcResponse.status}`;
          }
        } else {
          dbStatus = "degraded";
          dbError = "No active quizzes found";
        }
      } else {
        dbStatus = "degraded";
        dbError = `HTTP ${quizResponse.status}`;
      }

      const dbTime = Date.now() - dbStart;
      results.push({
        service: "database",
        status: dbStatus,
        responseTime: dbTime,
        error: dbError,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        service: "database",
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }

    // Log results to database for monitoring
    try {
      const healthCheckLog = results.map(result => ({
        service_name: result.service,
        status: result.status,
        response_time_ms: result.responseTime || null,
        error_message: result.error || null,
        checked_at: result.timestamp,
      }));

      await fetch(`${supabaseUrl}/rest/v1/system_health_checks`, {
        method: "POST",
        headers: {
          "apikey": supabaseServiceKey!,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(healthCheckLog),
      });
    } catch (error) {
      console.error("[Health Checks] Failed to log results:", error);
    }

    const overallHealthy = results.every(r => r.status === "healthy");
    const summary = {
      overall: overallHealthy ? "healthy" : "degraded",
      checks: results,
      timestamp: new Date().toISOString(),
    };

    console.log("[Health Checks] Completed:", JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify(summary),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[Health Checks] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
