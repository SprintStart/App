import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StartRunRequest {
  topic_id: string;
  question_set_id: string;
  session_id: string;
  device_info?: Record<string, any>;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { topic_id, question_set_id, session_id, device_info }: StartRunRequest = await req.json();

    if (!topic_id || !question_set_id || !session_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-400",
          step: "startTopicRun",
          message: "topic_id, question_set_id, and session_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("id, is_active")
      .eq("id", topic_id)
      .maybeSingle();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-404",
          step: "startTopicRun",
          message: "Topic not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!topic.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "startTopicRun",
          message: "Topic is not active",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: questionSet, error: qsError } = await supabase
      .from("question_sets")
      .select("id, is_active, shuffle_questions, topic_id, approval_status")
      .eq("id", question_set_id)
      .eq("topic_id", topic_id)
      .maybeSingle();

    if (qsError || !questionSet) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-404",
          step: "startTopicRun",
          message: "Quiz not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!questionSet.is_active || questionSet.approval_status !== 'approved') {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-403",
          step: "startTopicRun",
          message: "Quiz is not available",
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

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("topic_questions")
      .select("id, question_text, options, order_index, image_url")
      .eq("question_set_id", question_set_id)
      .order("order_index", { ascending: true });

    if (questionsError || !questions || questions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-404",
          step: "startTopicRun",
          message: "No questions found for this quiz",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if this is a retry by counting previous completed/game_over runs
    const { data: previousRuns } = await supabase
      .from("topic_runs")
      .select("id, status")
      .eq("session_id", session_id)
      .eq("question_set_id", question_set_id)
      .in("status", ["completed", "game_over"])
      .order("created_at", { ascending: false })
      .limit(1);

    const isRetry = previousRuns && previousRuns.length > 0;

    let selectedQuestions = [...questions];

    // Apply question ordering logic
    if (questionSet.shuffle_questions) {
      selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5);
    } else if (isRetry) {
      // Reverse order for retry attempts
      selectedQuestions = selectedQuestions.reverse();
    }

    const { data: newRun, error: runError } = await supabaseAdmin
      .from("topic_runs")
      .insert({
        session_id: session_id,
        topic_id: topic_id,
        question_set_id: question_set_id,
        status: "in_progress",
        started_at: new Date().toISOString(),
        device_info: device_info || null,
      })
      .select("id")
      .single();

    if (runError || !newRun) {
      console.error("Failed to create run:", runError);
      return new Response(
        JSON.stringify({
          success: false,
          error_id: "IMM-500",
          step: "createTopicRun",
          message: `Failed to create quiz run: ${runError?.message || 'Unknown error'}`,
          details: runError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: currentSet } = await supabaseAdmin
      .from("question_sets")
      .select("play_count")
      .eq("id", question_set_id)
      .maybeSingle();

    if (currentSet) {
      await supabaseAdmin
        .from("question_sets")
        .update({
          play_count: (currentSet.play_count || 0) + 1,
          last_played_at: new Date().toISOString(),
        })
        .eq("id", question_set_id);
    }

    const questionsResponse = selectedQuestions.map((q) => ({
      question_id: q.id,
      text: q.question_text,
      options: q.options,
      image_url: q.image_url || null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        run_id: newRun.id,
        questions: questionsResponse,
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
        step: "startTopicRun",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
