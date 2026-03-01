import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubmitAnswerRequest {
  run_id: string;
  question_id: string;
  selected_index: number;
  session_id: string;
}

const POINTS_PER_CORRECT = 10;

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

    const { run_id, question_id, selected_index, session_id }: SubmitAnswerRequest = await req.json();

    if (!run_id || !question_id || selected_index === undefined || !session_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-400",
          step: "submitTopicAnswer",
          message: "run_id, question_id, selected_index, and session_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: run, error: runError } = await supabase
      .from("topic_runs")
      .select("id, session_id, status")
      .eq("id", run_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (runError || !run) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "submitTopicAnswer",
          message: "Run not found or access denied",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (run.status !== "in_progress") {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "submitTopicAnswer",
          message: "Run is not in progress",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: previousAnswers, error: answersError } = await supabase
      .from("topic_run_answers")
      .select("attempt_number")
      .eq("run_id", run_id)
      .eq("question_id", question_id)
      .order("attempt_number", { ascending: false });

    if (answersError) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-500",
          step: "submitTopicAnswer",
          message: "Failed to check previous attempts",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const attemptNumber = previousAnswers && previousAnswers.length > 0
      ? previousAnswers[0].attempt_number + 1
      : 1;

    if (attemptNumber > 2) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "submitTopicAnswer",
          message: "Attempt limit exceeded",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: question, error: questionError } = await supabaseAdmin
      .from("topic_questions")
      .select("id, correct_index")
      .eq("id", question_id)
      .maybeSingle();

    if (questionError || !question) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-404",
          step: "submitTopicAnswer",
          message: "Question not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isCorrect = selected_index === question.correct_index;
    const scoreDelta = isCorrect ? POINTS_PER_CORRECT : 0;

    const { error: insertError } = await supabaseAdmin
      .from("topic_run_answers")
      .insert({
        run_id: run_id,
        question_id: question_id,
        attempt_number: attemptNumber,
        selected_index: selected_index,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Failed to insert answer:", insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-500",
          step: "submitTopicAnswer",
          message: `Failed to record answer: ${insertError.message}`,
          details: insertError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let newStatus = "in_progress";
    if (!isCorrect && attemptNumber === 2) {
      newStatus = "game_over";
    }

    const { data: currentRun, error: fetchError } = await supabase
      .from("topic_runs")
      .select("score_total, correct_count, wrong_count, question_set_id, total_questions, started_at")
      .eq("id", run_id)
      .maybeSingle();

    if (fetchError || !currentRun) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-500",
          step: "submitTopicAnswer",
          message: "Failed to fetch run data",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: totalQuestions } = await supabaseAdmin
      .from("topic_questions")
      .select("id", { count: "exact" })
      .eq("question_set_id", currentRun.question_set_id);

    const totalCount = totalQuestions?.length || 0;

    const updateData: {
      score_total: number;
      correct_count?: number;
      wrong_count?: number;
      status: string;
      completed_at?: string;
      total_questions: number;
      is_frozen?: boolean;
      duration_seconds?: number;
      percentage?: number;
    } = {
      score_total: currentRun.score_total + scoreDelta,
      status: newStatus,
      total_questions: totalCount,
    };

    if (isCorrect) {
      updateData.correct_count = currentRun.correct_count + 1;
      const newCorrectCount = currentRun.correct_count + 1;

      if (newCorrectCount >= totalCount && totalCount > 0) {
        updateData.status = "completed";
        const completedTime = new Date().toISOString();
        updateData.completed_at = completedTime;
        updateData.is_frozen = true;
        newStatus = "completed";

        if (currentRun.started_at) {
          const startTime = new Date(currentRun.started_at).getTime();
          const endTime = new Date(completedTime).getTime();
          updateData.duration_seconds = Math.floor((endTime - startTime) / 1000);
        }

        updateData.percentage = (newCorrectCount / totalCount) * 100;

        const { data: currentSet } = await supabaseAdmin
          .from("question_sets")
          .select("completion_count")
          .eq("id", currentRun.question_set_id)
          .maybeSingle();

        if (currentSet) {
          await supabaseAdmin
            .from("question_sets")
            .update({
              completion_count: (currentSet.completion_count || 0) + 1,
            })
            .eq("id", currentRun.question_set_id);
        }
      }
    } else if (attemptNumber === 2) {
      updateData.wrong_count = currentRun.wrong_count + 1;
    }

    if (newStatus === "game_over") {
      const completedTime = new Date().toISOString();
      updateData.completed_at = completedTime;
      updateData.is_frozen = true;

      if (currentRun.started_at) {
        const startTime = new Date(currentRun.started_at).getTime();
        const endTime = new Date(completedTime).getTime();
        updateData.duration_seconds = Math.floor((endTime - startTime) / 1000);
      }

      const finalCorrectCount = isCorrect
        ? (updateData.correct_count || currentRun.correct_count)
        : currentRun.correct_count;
      if (totalCount > 0) {
        updateData.percentage = (finalCorrectCount / totalCount) * 100;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("topic_runs")
      .update(updateData)
      .eq("id", run_id);

    if (updateError) {
      console.error("Failed to update run:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-500",
          step: "submitTopicAnswer",
          message: `Failed to update run: ${updateError.message}`,
          details: updateError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let responseStatus = "correct";
    if (newStatus === "completed") {
      responseStatus = "quiz_completed";
    } else if (newStatus === "game_over") {
      responseStatus = "game_over";
    } else if (!isCorrect && attemptNumber < 2) {
      responseStatus = "try_again";
    } else if (isCorrect) {
      responseStatus = "correct";
    }

    return new Response(
      JSON.stringify({
        success: true,
        is_correct: isCorrect,
        attemptNumber: attemptNumber,
        score_delta: scoreDelta,
        status: responseStatus,
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
        step: "submitTopicAnswer",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
