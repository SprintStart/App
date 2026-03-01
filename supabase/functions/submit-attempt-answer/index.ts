import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
};

interface SubmitAnswerRequest {
  attemptId: string;
  questionId: string;
  selectedOptionIndex: number;
  attemptNumber: 1 | 2;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Submit Answer] Starting...');

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      attemptId,
      questionId,
      selectedOptionIndex,
      attemptNumber
    }: SubmitAnswerRequest = await req.json();

    if (!attemptId || !questionId || selectedOptionIndex === undefined || !attemptNumber) {
      return new Response(
        JSON.stringify({ error: "attemptId, questionId, selectedOptionIndex, and attemptNumber are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Submit Answer] Attempt:', attemptId);
    console.log('[Submit Answer] Question:', questionId);
    console.log('[Submit Answer] Selected option:', selectedOptionIndex);
    console.log('[Submit Answer] Attempt number:', attemptNumber);

    // 1. Get the attempt with stored question order
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .select("id, question_ids, option_orders, status")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      console.error('[Submit Answer] Attempt error:', attemptError);
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

    // 2. Verify question is part of this attempt
    if (!attempt.question_ids.includes(questionId)) {
      console.error('[Submit Answer] Question not in attempt');
      return new Response(
        JSON.stringify({ error: "Question not part of this attempt" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Get the actual question data (with correct answer)
    const { data: question, error: questionError } = await supabase
      .from("topic_questions")
      .select("id, correct_index, options, explanation")
      .eq("id", questionId)
      .maybeSingle();

    if (questionError || !question) {
      console.error('[Submit Answer] Question error:', questionError);
      return new Response(
        JSON.stringify({ error: "Question not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Get the shuffled option order for this question
    const optionOrder = attempt.option_orders[questionId];
    if (!optionOrder) {
      console.error('[Submit Answer] No option order found for question');
      return new Response(
        JSON.stringify({ error: "Invalid attempt data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Map the selected shuffled index back to the original index
    const originalSelectedIndex = optionOrder[selectedOptionIndex];
    const isCorrect = originalSelectedIndex === question.correct_index;

    console.log('[Submit Answer] Original correct index:', question.correct_index);
    console.log('[Submit Answer] Option order:', optionOrder);
    console.log('[Submit Answer] Selected shuffled index:', selectedOptionIndex);
    console.log('[Submit Answer] Original selected index:', originalSelectedIndex);
    console.log('[Submit Answer] Is correct:', isCorrect);

    // 6. Check if answer already exists for this attempt number
    const { data: existingAnswer } = await supabase
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .eq("attempt_number", attemptNumber)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(
        JSON.stringify({ error: "Answer already submitted for this attempt" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Insert the answer
    const { error: answerError } = await supabase
      .from("attempt_answers")
      .insert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_index: selectedOptionIndex,
        is_correct: isCorrect,
        attempt_number: attemptNumber,
      });

    if (answerError) {
      console.error('[Submit Answer] Failed to insert answer:', answerError);
      return new Response(
        JSON.stringify({ error: "Failed to save answer" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 8. Update attempt statistics if this was the final answer for this attempt
    const { count: totalAnswers } = await supabase
      .from("attempt_answers")
      .select("id", { count: 'exact', head: true })
      .eq("attempt_id", attemptId)
      .eq("attempt_number", attemptNumber);

    const { count: correctAnswers } = await supabase
      .from("attempt_answers")
      .select("id", { count: 'exact', head: true })
      .eq("attempt_id", attemptId)
      .eq("is_correct", true);

    // Calculate score (10 points for first correct, 5 for second)
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = attemptNumber === 1 ? 10 : 5;
    }

    // Update attempt with current stats
    await supabase
      .from("quiz_attempts")
      .update({
        score: supabase.rpc('increment', { x: pointsEarned }),
        correct_count: correctAnswers || 0,
        wrong_count: (totalAnswers || 0) - (correctAnswers || 0),
      })
      .eq("id", attemptId);

    console.log('[Submit Answer] Answer saved successfully');
    console.log('[Submit Answer] Points earned:', pointsEarned);

    // 9. Return result with feedback
    return new Response(
      JSON.stringify({
        correct: isCorrect,
        correctIndex: selectedOptionIndex, // Send back the shuffled index
        explanation: isCorrect ? question.explanation : null,
        pointsEarned: pointsEarned,
        totalAnswers: totalAnswers || 0,
        correctAnswers: correctAnswers || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Submit Answer] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
