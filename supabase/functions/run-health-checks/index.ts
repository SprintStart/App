import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://startsprint.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, authorization, Content-Type, content-type, X-CRON-SECRET, x-cron-secret",
};

interface HealthCheckResult {
  name: string;
  target: string;
  status: "success" | "failure" | "warning";
  http_status?: number;
  response_time_ms?: number;
  error_message?: string;
  marker_found?: boolean;
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
    const productionDomain = "https://startsprint.app";

    // Helper: Check if status code is successful (2xx or 3xx)
    const isSuccessStatus = (status: number) => status >= 200 && status < 400;

    // Helper: Perform URL health check with content verification
    async function checkUrl(
      name: string,
      url: string,
      expectedMarkers: string[]
    ): Promise<HealthCheckResult> {
      const startTime = Date.now();
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "StartSprint-Health-Monitor/1.0",
          },
          redirect: "follow",
        });

        const responseTime = Date.now() - startTime;
        const httpStatus = response.status;

        // Status 200-399 = success
        if (!isSuccessStatus(httpStatus)) {
          return {
            name,
            target: url,
            status: "failure",
            http_status: httpStatus,
            response_time_ms: responseTime,
            error_message: `HTTP ${httpStatus}`,
            marker_found: false,
            timestamp: new Date().toISOString(),
          };
        }

        // Check for expected content markers
        const text = await response.text();
        let markerFound = false;

        for (const marker of expectedMarkers) {
          if (text.includes(marker)) {
            markerFound = true;
            break;
          }
        }

        return {
          name,
          target: url,
          status: "success",
          http_status: httpStatus,
          response_time_ms: responseTime,
          marker_found: markerFound,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
          name,
          target: url,
          status: "failure",
          response_time_ms: responseTime,
          error_message: error instanceof Error ? error.message : "Unknown error",
          marker_found: false,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // P0 Critical Routes - Money Routes

    // 1. Check Homepage /explore
    results.push(
      await checkUrl(
        "explore_page",
        `${productionDomain}/explore`,
        ["StartSprint", "Interactive Quiz"]
      )
    );

    // 2. Check Global Library /explore/global
    results.push(
      await checkUrl(
        "global_library_page",
        `${productionDomain}/explore/global`,
        ["Global Quiz Library", "StartSprint"]
      )
    );

    // 3. Check School Wall /northampton-college
    results.push(
      await checkUrl(
        "northampton_college_wall",
        `${productionDomain}/northampton-college`,
        ["Northampton College", "Interactive Quiz Wall", "Interactive Quiz"]
      )
    );

    // 4. Check Subject Page /subjects/business
    results.push(
      await checkUrl(
        "business_subject_page",
        `${productionDomain}/subjects/business`,
        ["Business", "StartSprint"]
      )
    );

    // 5. Check Subject Page /subjects/mathematics
    results.push(
      await checkUrl(
        "mathematics_subject_page",
        `${productionDomain}/subjects/mathematics`,
        ["Mathematics", "StartSprint"]
      )
    );

    // 6. Check Country/Exam Listing Page
    results.push(
      await checkUrl(
        "gcse_mathematics_exam_page",
        `${productionDomain}/exams/gcse/mathematics`,
        ["GCSE", "Mathematics", "StartSprint"]
      )
    );

    // Log results to health_checks table with performance categorization
    try {
      const performanceBaseline = parseInt(Deno.env.get("HEALTH_PERFORMANCE_THRESHOLD_MS") || "2000");

      const healthCheckLogs = results.map(result => {
        const isSlowPerformance = result.response_time_ms && result.response_time_ms > performanceBaseline;

        return {
          name: result.name,
          target: result.target,
          status: isSlowPerformance && result.status === 'success' ? 'warning' : result.status,
          http_status: result.http_status || null,
          error_message: result.error_message ||
            (isSlowPerformance ? `Slow response: ${result.response_time_ms}ms (baseline: ${performanceBaseline}ms)` : null),
          response_time_ms: result.response_time_ms || null,
          marker_found: result.marker_found || false,
          check_category: result.target.includes('/functions/v1/') ? 'function' : 'route',
          is_critical: true, // All P0 routes are critical
          performance_baseline_ms: performanceBaseline,
        };
      });

      await fetch(`${supabaseUrl}/rest/v1/health_checks`, {
        method: "POST",
        headers: {
          "apikey": supabaseServiceKey!,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(healthCheckLogs),
      });

      console.log("[Health Checks] Logged results to database");
    } catch (error) {
      console.error("[Health Checks] Failed to log results:", error);
    }

    // Check for consecutive failures and trigger alerts
    try {
      for (const result of results) {
        if (result.status === 'failure') {
          // Check if this check has 2+ consecutive failures
          const checkFailuresResponse = await fetch(
            `${supabaseUrl}/rest/v1/rpc/check_consecutive_failures`,
            {
              method: "POST",
              headers: {
                "apikey": supabaseServiceKey!,
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                p_check_name: result.name,
                p_threshold: 2,
              }),
            }
          );

          if (checkFailuresResponse.ok) {
            const hasConsecutiveFailures = await checkFailuresResponse.json();

            if (hasConsecutiveFailures) {
              // Check if alert is in cooldown
              const cooldownResponse = await fetch(
                `${supabaseUrl}/rest/v1/rpc/is_alert_in_cooldown`,
                {
                  method: "POST",
                  headers: {
                    "apikey": supabaseServiceKey!,
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    p_check_name: result.name,
                    p_cooldown_hours: 6,
                  }),
                }
              );

              const inCooldown = cooldownResponse.ok ? await cooldownResponse.json() : false;

              if (!inCooldown) {
                console.log(`[Health Checks] Triggering alert for ${result.name} (2+ consecutive failures)`);

                // Record alert in database
                await fetch(`${supabaseUrl}/rest/v1/rpc/record_health_alert`, {
                  method: "POST",
                  headers: {
                    "apikey": supabaseServiceKey!,
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    p_check_name: result.name,
                    p_alert_type: 'consecutive_failure',
                    p_failure_count: 2,
                    p_error_details: {
                      target: result.target,
                      error_message: result.error_message,
                      http_status: result.http_status,
                      timestamp: result.timestamp,
                    },
                    p_recipients: ['support@startsprint.app', 'leslie.addae@startsprint.app'],
                    p_severity: 'critical',
                    p_cooldown_hours: 6,
                  }),
                });

                // Trigger alert email via send-health-alert function
                const alertResponse = await fetch(
                  `${supabaseUrl}/functions/v1/send-health-alert`,
                  {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${supabaseServiceKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      check_name: result.name,
                      target: result.target,
                      error_message: result.error_message || `HTTP ${result.http_status}`,
                      failure_count: 2,
                    }),
                  }
                );

                if (alertResponse.ok) {
                  console.log(`[Health Checks] Alert sent successfully for ${result.name}`);
                } else {
                  console.error(`[Health Checks] Failed to send alert for ${result.name}`);
                }
              } else {
                console.log(`[Health Checks] Alert for ${result.name} is in cooldown, skipping`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[Health Checks] Failed to check/trigger alerts:", error);
    }

    // Auto-resolve old alerts (>24 hours)
    try {
      const autoResolveResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/auto_resolve_old_health_alerts`, {
        method: "POST",
        headers: {
          "apikey": supabaseServiceKey!,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });

      if (autoResolveResponse.ok) {
        const resolvedCount = await autoResolveResponse.json();
        if (resolvedCount > 0) {
          console.log(`[Health Checks] Auto-resolved ${resolvedCount} old alerts`);
        }
      }
    } catch (error) {
      console.error("[Health Checks] Failed to auto-resolve old alerts:", error);
    }

    const allPassing = results.every(r => r.status === "success");
    const summary = {
      overall: allPassing ? "healthy" : "degraded",
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
