import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id");
    const sessionId = url.searchParams.get("session_id");

    if (!runId || !sessionId) {
      return new Response(
        JSON.stringify({ error: "run_id and session_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: quizRun, error: runError } = await supabase
      .from("public_quiz_runs")
      .select("*")
      .eq("id", runId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (runError || !quizRun) {
      return new Response(
        JSON.stringify({ error: "Quiz run not found or unauthorized" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: answers } = await supabase
      .from("public_quiz_answers")
      .select("*")
      .eq("run_id", runId)
      .order("answered_at", { ascending: true });

    const correctCount = quizRun.correct_count ?? (answers?.filter((a) => a.is_correct).length || 0);
    const wrongCount = quizRun.wrong_count ?? (answers?.filter((a) => !a.is_correct && a.attempt_number === 2).length || 0);

    const durationSeconds = quizRun.duration_seconds ?? (quizRun.completed_at
      ? Math.floor(
          (new Date(quizRun.completed_at).getTime() -
            new Date(quizRun.started_at).getTime()) /
            1000
        )
      : null);

    const questionsData = (quizRun.questions_data as any[]) || [];
    const totalQuestions = questionsData.length;

    const percentage = quizRun.percentage ?? (totalQuestions > 0
      ? (correctCount / totalQuestions) * 100
      : 0);

    const questionBreakdown = questionsData.map((question, index) => {
      const questionAnswers = answers?.filter(a => a.question_id === question.id) || [];
      const isCorrect = questionAnswers.some(a => a.is_correct);
      const attempts = questionAnswers.length;

      return {
        question_text: question.question_text,
        is_correct: isCorrect,
        attempts: attempts,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          run_id: quizRun.id,
          score_total: quizRun.score,
          correct_count: correctCount,
          wrong_count: wrongCount,
          total_questions: totalQuestions,
          percentage: Math.round(percentage * 100) / 100,
          duration_seconds: durationSeconds,
          status: quizRun.status,
          is_frozen: quizRun.is_frozen || false,
          question_breakdown: questionBreakdown,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting quiz summary:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
