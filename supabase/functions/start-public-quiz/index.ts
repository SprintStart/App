import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
};

interface StartQuizRequest {
  questionSetId?: string; // New way: direct quiz ID
  topicId?: string; // Legacy way: find quiz by topic (deprecated)
  sessionId: string;
  deviceInfo?: Record<string, any>;
  timerSeconds?: number;
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

    const { questionSetId, topicId, sessionId, deviceInfo, timerSeconds }: StartQuizRequest = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!questionSetId && !topicId) {
      return new Response(
        JSON.stringify({ error: "questionSetId or topicId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Get question set - either directly or by topic
    let questionSet: any;
    let topic: any;

    if (questionSetId) {
      // NEW WAY: Direct question set lookup
      const { data: qsData, error: qsError } = await supabase
        .from("question_sets")
        .select("id, topic_id, approval_status, is_active")
        .eq("id", questionSetId)
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .maybeSingle();

      if (qsError || !qsData) {
        return new Response(
          JSON.stringify({ error: "Quiz not found or not available" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      questionSet = qsData;

      // Get topic name for response
      const { data: topicData } = await supabase
        .from("topics")
        .select("id, name, subject")
        .eq("id", qsData.topic_id)
        .maybeSingle();

      topic = topicData || { id: qsData.topic_id, name: "Quiz" };
    } else {
      // LEGACY WAY: Find quiz by topic (deprecated)
      const { data: topicData, error: topicError } = await supabase
        .from("topics")
        .select("id, name, subject")
        .eq("id", topicId)
        .eq("is_active", true)
        .maybeSingle();

      if (topicError || !topicData) {
        return new Response(
          JSON.stringify({ error: "Topic not found or inactive" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      topic = topicData;

      // Find approved question set for this topic
      const { data: qsData, error: setError } = await supabase
        .from("question_sets")
        .select("id, topic_id")
        .eq("topic_id", topicId)
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (setError || !qsData) {
        return new Response(
          JSON.stringify({ error: "No approved questions available for this topic" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      questionSet = qsData;
    }

    // 2. Get or create quiz session
    const { data: quizSession, error: sessionError } = await supabase
      .from("quiz_sessions")
      .upsert(
        {
          session_id: sessionId,
          last_activity: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      )
      .select()
      .single();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting: Check how many quiz runs this session has created in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRuns, error: rateLimitError } = await supabase
      .from("public_quiz_runs")
      .select("id")
      .eq("session_id", sessionId)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    }

    const recentRunCount = recentRuns?.length || 0;
    const MAX_RUNS_PER_HOUR = 50;

    if (recentRunCount >= MAX_RUNS_PER_HOUR) {
      console.warn(`Rate limit exceeded for session ${sessionId}: ${recentRunCount} runs in last hour`);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: "Too many quiz attempts. Please try again later.",
          retry_after_seconds: 3600
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600"
          },
        }
      );
    }

    // 3. Get questions for this set (limit 10)
    const { data: questions, error: questionsError } = await supabase
      .from("topic_questions")
      .select("id, question_text, options, correct_index, image_url")
      .eq("question_set_id", questionSet.id)
      .order("order_index", { ascending: true })
      .limit(10);

    if (questionsError) {
      console.error("Questions error:", questionsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch questions", details: questionsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No questions found for this quiz" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Shuffle questions
    const shuffled = questions.sort(() => Math.random() - 0.5);

    // 5. Prepare questions data (WITHOUT correct answers)
    const questionsForClient = shuffled.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      image_url: q.image_url || null,
    }));

    const questionsData = shuffled.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      correct_index: q.correct_index,
      image_url: q.image_url || null,
    }));

    // 6. Create quiz run
    const { data: quizRun, error: runError } = await supabase
      .from("public_quiz_runs")
      .insert({
        session_id: sessionId,
        quiz_session_id: quizSession.id,
        topic_id: questionSet.topic_id,
        question_set_id: questionSet.id,
        status: "in_progress",
        score: 0,
        questions_data: questionsData,
        current_question_index: 0,
        attempts_used: {},
        device_info: deviceInfo || null,
        timer_seconds: timerSeconds || null,
      })
      .select()
      .single();

    if (runError) {
      console.error("Run error:", runError);
      return new Response(
        JSON.stringify({ error: "Failed to create quiz run" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Return quiz data
    return new Response(
      JSON.stringify({
        runId: quizRun.id,
        topicName: topic.name,
        questions: questionsForClient,
        totalQuestions: questionsForClient.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error starting quiz:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
