import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get query params
    const url = new URL(req.url);
    const questionSetId = url.searchParams.get("question_set_id");

    if (!questionSetId) {
      return new Response(
        JSON.stringify({ error: "question_set_id parameter required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call database function
    const { data, error } = await supabase.rpc("get_quiz_deep_analytics", {
      p_question_set_id: questionSetId,
      p_teacher_id: user.id,
    });

    if (error) {
      console.error("Error fetching quiz analytics:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Also fetch question details with options for context
    const { data: questions, error: questionsError } = await supabase
      .from("topic_questions")
      .select("id, question_text, options, correct_index, explanation")
      .eq("question_set_id", questionSetId)
      .order("order_index", { ascending: true });

    if (questionsError) {
      console.error("Error fetching questions:", questionsError);
    }

    // Merge question options into the response
    const questionBreakdown = data?.question_breakdown || [];
    const enrichedQuestions = questionBreakdown.map((q: any) => {
      const fullQuestion = questions?.find((fq: any) => fq.id === q.question_id);
      return {
        ...q,
        options: fullQuestion?.options || [],
        correct_index: fullQuestion?.correct_index,
        explanation: fullQuestion?.explanation,
        most_common_wrong_answer: fullQuestion?.options?.[q.most_common_wrong_index] || null,
      };
    });

    const enrichedData = {
      ...data,
      question_breakdown: enrichedQuestions,
    };

    return new Response(
      JSON.stringify(enrichedData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
