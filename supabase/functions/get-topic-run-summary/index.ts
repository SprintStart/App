import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const url = new URL(req.url);
    const run_id = url.searchParams.get("run_id");
    const session_id = url.searchParams.get("session_id");

    if (!run_id || !session_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-400",
          step: "getTopicRunSummary",
          message: "run_id and session_id parameters are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: run, error: runError } = await supabase
      .from("topic_runs")
      .select("id, session_id, status, score_total, correct_count, wrong_count, started_at, completed_at, total_questions, percentage, is_frozen")
      .eq("id", run_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (runError || !run) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "getTopicRunSummary",
          message: "Run not found or access denied",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let durationSeconds = run.duration_seconds || null;
    if (!durationSeconds && run.completed_at && run.started_at) {
      const startTime = new Date(run.started_at).getTime();
      const endTime = new Date(run.completed_at).getTime();
      durationSeconds = Math.floor((endTime - startTime) / 1000);
    }

    const totalQuestions = run.total_questions || (run.correct_count + run.wrong_count);
    const percentage = run.percentage || (totalQuestions > 0 ? (run.correct_count / totalQuestions) * 100 : 0);

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: answers } = await supabaseService
      .from("topic_run_answers")
      .select(`
        question_id,
        is_correct,
        attempt_number,
        topic_questions (
          question_text,
          options
        )
      `)
      .eq("run_id", run_id)
      .order("answered_at", { ascending: true });

    const questionBreakdown = answers?.map((answer: any) => ({
      question_text: answer.topic_questions?.question_text || 'Question text unavailable',
      is_correct: answer.is_correct,
      attempts: answer.attempt_number,
    })) || [];

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          run_id: run.id,
          score_total: run.score_total,
          correct_count: run.correct_count,
          wrong_count: run.wrong_count,
          total_questions: totalQuestions,
          percentage: Math.round(percentage * 100) / 100,
          duration_seconds: durationSeconds,
          status: run.status,
          is_frozen: run.is_frozen || false,
          question_breakdown: questionBreakdown,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error_id: "IMM-500",
        step: "getTopicRunSummary",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
