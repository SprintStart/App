import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
};

interface CompleteAttemptRequest {
  attemptId: string;
  status: 'completed' | 'game_over' | 'abandoned';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Complete Attempt] Starting...');

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { attemptId, status }: CompleteAttemptRequest = await req.json();

    if (!attemptId || !status) {
      return new Response(
        JSON.stringify({ error: "attemptId and status are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Complete Attempt] Attempt:', attemptId);
    console.log('[Complete Attempt] Status:', status);

    // 1. Get the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .select("id, status, started_at, question_ids, correct_count, wrong_count, score")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      console.error('[Complete Attempt] Attempt error:', attemptError);
      return new Response(
        JSON.stringify({ error: "Attempt not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (attempt.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: "Attempt is not in progress" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Calculate final statistics
    const completedAt = new Date();
    const startedAt = new Date(attempt.started_at);
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

    const totalQuestions = attempt.question_ids.length;
    const correctCount = attempt.correct_count || 0;
    const wrongCount = attempt.wrong_count || 0;
    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    console.log('[Complete Attempt] Duration:', durationSeconds, 'seconds');
    console.log('[Complete Attempt] Correct:', correctCount, '/', totalQuestions);
    console.log('[Complete Attempt] Percentage:', percentage.toFixed(2), '%');

    // 3. Update attempt with final data
    const { data: updatedAttempt, error: updateError } = await supabase
      .from("quiz_attempts")
      .update({
        status: status,
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
        percentage: percentage.toFixed(2),
        correct_count: correctCount,
        wrong_count: wrongCount,
        updated_at: completedAt.toISOString(),
      })
      .eq("id", attemptId)
      .select()
      .single();

    if (updateError) {
      console.error('[Complete Attempt] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: "Failed to complete attempt" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Log completion to audit
    await supabase.from('audit_logs').insert({
      action_type: 'quiz_attempt_completed',
      entity_type: 'quiz_attempt',
      entity_id: attemptId,
      metadata: {
        status: status,
        score: attempt.score,
        correct_count: correctCount,
        wrong_count: wrongCount,
        percentage: percentage.toFixed(2),
        duration_seconds: durationSeconds,
      },
    });

    console.log('[Complete Attempt] Success!');

    // 5. Return completion summary
    return new Response(
      JSON.stringify({
        success: true,
        attempt: {
          id: updatedAttempt.id,
          status: updatedAttempt.status,
          score: updatedAttempt.score,
          correctCount: correctCount,
          wrongCount: wrongCount,
          totalQuestions: totalQuestions,
          percentage: percentage.toFixed(2),
          durationSeconds: durationSeconds,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Complete Attempt] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
