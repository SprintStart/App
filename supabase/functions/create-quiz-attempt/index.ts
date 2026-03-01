import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id",
};

interface CreateAttemptRequest {
  topicId: string;
  questionSetId: string;
  sessionId: string;
  deviceInfo?: Record<string, any>;
  retryMode?: 'new_only' | 'same_new_order';
}

/**
 * Seeded deterministic shuffle using Fisher-Yates algorithm
 * This ensures consistent ordering for a given seed
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const random = (max: number) => {
    hash = (hash * 9301 + 49297) % 233280;
    return (hash / 233280) * max;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Generate unique seed for this attempt
 */
function generateSeed(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Get previously used question IDs for this student + question set
 */
async function getPreviouslyUsedQuestions(
  supabase: any,
  sessionId: string,
  questionSetId: string
): Promise<string[]> {
  const { data: previousAttempts } = await supabase
    .from('quiz_attempts')
    .select('question_ids')
    .eq('session_id', sessionId)
    .eq('question_set_id', questionSetId)
    .in('status', ['completed', 'game_over']);

  if (!previousAttempts || previousAttempts.length === 0) {
    return [];
  }

  const allUsedIds = previousAttempts.flatMap((a: any) => a.question_ids || []);
  return Array.from(new Set(allUsedIds));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Create Attempt] Starting...');

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      topicId,
      questionSetId,
      sessionId,
      deviceInfo,
      retryMode = 'new_only'
    }: CreateAttemptRequest = await req.json();

    if (!topicId || !questionSetId || !sessionId) {
      return new Response(
        JSON.stringify({ error: "topicId, questionSetId, and sessionId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Create Attempt] Validating topic and question set...');

    // 1. Verify topic exists and is published
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("id, name, subject")
      .eq("id", topicId)
      .eq("is_active", true)
      .eq("is_published", true)
      .maybeSingle();

    if (topicError || !topic) {
      console.error('[Create Attempt] Topic error:', topicError);
      return new Response(
        JSON.stringify({ error: "Topic not found or not published" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Verify question set exists and is approved
    const { data: questionSet, error: setError } = await supabase
      .from("question_sets")
      .select("id")
      .eq("id", questionSetId)
      .eq("topic_id", topicId)
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .maybeSingle();

    if (setError || !questionSet) {
      console.error('[Create Attempt] Question set error:', setError);
      return new Response(
        JSON.stringify({ error: "Question set not found or not approved" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Create Attempt] Fetching published questions...');

    // 3. Get all published questions for this set
    const { data: allQuestions, error: questionsError } = await supabase
      .from("topic_questions")
      .select("id, question_text, options, correct_index")
      .eq("question_set_id", questionSetId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (questionsError || !allQuestions || allQuestions.length === 0) {
      console.error('[Create Attempt] Questions error:', questionsError);
      return new Response(
        JSON.stringify({ error: "No published questions available for this quiz" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Create Attempt] Total questions available:', allQuestions.length);

    // 4. Get or create quiz session
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
      console.error('[Create Attempt] Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Check for previous attempts (retry logic)
    console.log('[Create Attempt] Checking for previous attempts...');

    const usedQuestionIds = await getPreviouslyUsedQuestions(
      supabase,
      sessionId,
      questionSetId
    );

    const isRetry = usedQuestionIds.length > 0;
    console.log('[Create Attempt] Is retry:', isRetry);
    console.log('[Create Attempt] Previously used questions:', usedQuestionIds.length);

    // 6. Determine question pool based on retry mode
    let questionPool = [];
    let reuseCount = 0;
    const targetQuestionCount = Math.min(allQuestions.length, 10); // Limit to 10 questions

    if (retryMode === 'new_only' && isRetry) {
      // Filter out previously used questions
      const unusedQuestions = allQuestions.filter(
        q => !usedQuestionIds.includes(q.id)
      );

      console.log('[Create Attempt] Unused questions available:', unusedQuestions.length);

      if (unusedQuestions.length >= targetQuestionCount) {
        // Enough unused questions
        questionPool = unusedQuestions.slice(0, targetQuestionCount);
        reuseCount = 0;
      } else {
        // Not enough unused, need to reuse some
        questionPool = [...unusedQuestions];
        const needed = targetQuestionCount - unusedQuestions.length;
        const reusedQuestions = allQuestions
          .filter(q => usedQuestionIds.includes(q.id))
          .slice(0, needed);
        questionPool.push(...reusedQuestions);
        reuseCount = needed;
        console.log('[Create Attempt] Reusing questions:', reuseCount);
      }
    } else {
      // First attempt or same_new_order mode: use all available
      questionPool = allQuestions.slice(0, targetQuestionCount);
    }

    // 7. Generate unique seed and shuffle questions deterministically
    const seed = generateSeed();
    console.log('[Create Attempt] Generated seed:', seed.substring(0, 20) + '...');

    const shuffledQuestions = seededShuffle(questionPool, seed);
    const questionIds = shuffledQuestions.map(q => q.id);

    // 8. Generate deterministic option order for each question
    const optionOrders: Record<string, number[]> = {};
    shuffledQuestions.forEach((q, idx) => {
      const optionCount = q.options.length;
      const optionIndices = Array.from({ length: optionCount }, (_, i) => i);
      const shuffledOptions = seededShuffle(optionIndices, `${seed}-${idx}`);
      optionOrders[q.id] = shuffledOptions;
    });

    console.log('[Create Attempt] Creating attempt record...');

    // 9. Count previous attempts
    const { count: previousAttemptCount } = await supabase
      .from('quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('question_set_id', questionSetId);

    const attemptNumber = (previousAttemptCount || 0) + 1;

    // 10. Create attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        session_id: sessionId,
        quiz_session_id: quizSession.id,
        topic_id: topicId,
        question_set_id: questionSetId,
        seed: seed,
        question_ids: questionIds,
        option_orders: optionOrders,
        attempt_number: attemptNumber,
        reuse_count: reuseCount,
        status: "in_progress",
        device_info: deviceInfo || null,
      })
      .select()
      .single();

    if (attemptError) {
      console.error('[Create Attempt] Failed to create attempt:', attemptError);
      return new Response(
        JSON.stringify({ error: "Failed to create attempt" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Create Attempt] Attempt created:', attempt.id);
    console.log('[Create Attempt] Question count:', questionIds.length);
    console.log('[Create Attempt] Reuse count:', reuseCount);

    // 11. Prepare questions for client (without correct answers)
    const questionsForClient = shuffledQuestions.map((q) => {
      const originalOptions = q.options;
      const optionOrder = optionOrders[q.id];
      const shuffledOptions = optionOrder.map(idx => originalOptions[idx]);

      return {
        id: q.id,
        question_text: q.question_text,
        options: shuffledOptions,
      };
    });

    // 12. Log to audit_logs
    await supabase.from('audit_logs').insert({
      action_type: 'quiz_attempt_created',
      entity_type: 'quiz_attempt',
      entity_id: attempt.id,
      metadata: {
        session_id: sessionId,
        topic_id: topicId,
        question_set_id: questionSetId,
        seed: seed,
        question_count: questionIds.length,
        attempt_number: attemptNumber,
        reuse_count: reuseCount,
        is_retry: isRetry,
      },
    });

    console.log('[Create Attempt] Success!');

    // 13. Return attempt data
    return new Response(
      JSON.stringify({
        attemptId: attempt.id,
        topicName: topic.name,
        questions: questionsForClient,
        totalQuestions: questionsForClient.length,
        attemptNumber: attemptNumber,
        reuseCount: reuseCount,
        isRetry: isRetry,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Create Attempt] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
