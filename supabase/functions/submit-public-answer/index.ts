import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
};

interface SubmitAnswerRequest {
  runId: string;
  questionId: string;
  selectedOption: number;
  sessionId: string;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { runId, questionId, selectedOption, sessionId }: SubmitAnswerRequest = await req.json();

    if (!runId || !questionId || selectedOption === undefined || !sessionId) {
      return new Response(
        JSON.stringify({ error: "runId, questionId, selectedOption, and sessionId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Get the quiz run and verify ownership
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

    if (quizRun.status !== "in_progress") {
      return new Response(
        JSON.stringify({ error: "Quiz already completed or failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Find the question in questions_data
    const questionsData = quizRun.questions_data as any[];
    const question = questionsData.find((q) => q.id === questionId);

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Question not found in this quiz" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Check attempts for this question
    const attemptsUsed = (quizRun.attempts_used as any) || {};
    const currentAttempts = attemptsUsed[questionId] || 0;

    if (currentAttempts >= 2) {
      return new Response(
        JSON.stringify({ error: "Maximum attempts reached for this question" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const attemptNumber = currentAttempts + 1;
    const isCorrect = selectedOption === question.correct_index;

    // 4. Record the answer
    await supabase.from("public_quiz_answers").insert({
      run_id: runId,
      question_id: questionId,
      selected_option: selectedOption,
      is_correct: isCorrect,
      attempt_number: attemptNumber,
    });

    // 5. Update attempts
    const newAttemptsUsed = { ...attemptsUsed, [questionId]: attemptNumber };

    let newScore = quizRun.score;
    let newStatus = quizRun.status;
    let newQuestionIndex = quizRun.current_question_index;
    let responseStatus = "incorrect";
    let nextQuestionId = null;
    let correctCount = quizRun.correct_count || 0;
    let wrongCount = quizRun.wrong_count || 0;

    if (isCorrect) {
      // Correct answer: add points and advance
      newScore += 10;
      newQuestionIndex += 1;
      correctCount += 1;
      responseStatus = "correct";

      // Check if this was the last question
      if (newQuestionIndex >= questionsData.length) {
        newStatus = "completed";
        responseStatus = "quiz_completed";
      } else {
        nextQuestionId = questionsData[newQuestionIndex].id;
      }
    } else if (attemptNumber >= 2) {
      // Wrong on second attempt: game over
      wrongCount += 1;
      newStatus = "failed";
      responseStatus = "game_over";
    } else {
      // Wrong on first attempt: try again
      responseStatus = "try_again";
    }

    // 6. Update the quiz run
    const updateData: any = {
      attempts_used: newAttemptsUsed,
      score: newScore,
      current_question_index: newQuestionIndex,
      status: newStatus,
      correct_count: correctCount,
      wrong_count: wrongCount,
    };

    if (newStatus === "completed" || newStatus === "failed") {
      const completedTime = new Date().toISOString();
      updateData.completed_at = completedTime;
      updateData.is_frozen = true;

      // Calculate duration
      if (quizRun.started_at) {
        const startTime = new Date(quizRun.started_at).getTime();
        const endTime = new Date(completedTime).getTime();
        updateData.duration_seconds = Math.floor((endTime - startTime) / 1000);
      }

      // Calculate percentage
      const totalQuestions = questionsData.length;
      if (totalQuestions > 0) {
        updateData.percentage = (correctCount / totalQuestions) * 100;
      }
    }

    await supabase
      .from("public_quiz_runs")
      .update(updateData)
      .eq("id", runId);

    // 7. Return response
    return new Response(
      JSON.stringify({
        status: responseStatus,
        isCorrect,
        attemptNumber,
        score: newScore,
        nextQuestionId,
        correctOption: !isCorrect && attemptNumber >= 2 ? question.correct_option : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error submitting answer:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
