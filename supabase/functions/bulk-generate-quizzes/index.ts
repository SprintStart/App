import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface BulkGenerateRequest {
  topic_id: string;
  quiz_count: number;
  questions_per_quiz: number;
  difficulty: string;
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AI service not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      topic_id,
      quiz_count = 10,
      questions_per_quiz = 10,
      difficulty = "medium",
    }: BulkGenerateRequest = await req.json();

    if (!topic_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "topic_id is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("id, name, subject")
      .eq("id", topic_id)
      .maybeSingle();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Topic not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = {
      success: true,
      topic_name: topic.name,
      quizzes_generated: 0,
      questions_generated: 0,
      failed_quizzes: [] as string[],
    };

    for (let quizNum = 1; quizNum <= quiz_count; quizNum++) {
      try {
        const questions = await generateQuestions(
          topic.name,
          topic.subject,
          questions_per_quiz,
          difficulty,
          anthropicKey
        );

        if (questions.length !== questions_per_quiz) {
          results.failed_quizzes.push(`Quiz ${quizNum}: Incorrect question count`);
          continue;
        }

        const { data: questionSet, error: qsError} = await supabase
          .from("question_sets")
          .insert({
            topic_id: topic_id,
            title: `${topic.name} Quiz ${quizNum}`,
            difficulty: difficulty,
            is_active: true,
            approval_status: "approved",
            question_count: questions_per_quiz,
          })
          .select("id")
          .single();

        if (qsError || !questionSet) {
          results.failed_quizzes.push(`Quiz ${quizNum}: Failed to create question set`);
          continue;
        }

        const questionRecords = questions.map((q, idx) => ({
          question_set_id: questionSet.id,
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation || null,
          order_index: idx + 1,
        }));

        const { error: questionsError } = await supabase
          .from("topic_questions")
          .insert(questionRecords);

        if (questionsError) {
          await supabase.from("question_sets").delete().eq("id", questionSet.id);
          results.failed_quizzes.push(`Quiz ${quizNum}: Failed to insert questions`);
          continue;
        }

        results.quizzes_generated++;
        results.questions_generated += questions.length;

      } catch (error) {
        results.failed_quizzes.push(
          `Quiz ${quizNum}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateQuestions(
  topic: string,
  subject: string,
  count: number,
  difficulty: string,
  apiKey: string
): Promise<Array<{ question_text: string; options: string[]; correct_index: number; explanation?: string }>> {
  const difficultyDescriptions = {
    easy: "introductory level for beginners",
    medium: "intermediate level requiring solid understanding",
    hard: "advanced level requiring deep knowledge",
    expert: "expert level with complex scenarios",
  };

  const prompt = `You are an expert educational content creator for UK secondary schools (ages 11-18). Generate ${count} high-quality, exam-standard multiple-choice questions about "${topic}" in the subject of ${subject} at ${difficulty} difficulty (${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions] || "medium level"}).

CRITICAL QUALITY STANDARDS (NON-NEGOTIABLE):

1. Question Text Requirements:
   - Write clear, specific, complete questions that stand alone
   - Use proper educational terminology and grammar
   - Be factually accurate and verifiable
   - Test understanding, not just recall
   - NO placeholders like "When did this occur?" without context
   - NO generic text like "Select the correct option"
   - NO meta-text or labels like "Q1" or "Question 1"

2. Answer Options Requirements:
   - Provide exactly 4 distinct, plausible options
   - All options must be realistic and similar in structure/length
   - Options should be challenging but have ONE clearly correct answer
   - Use proper terminology, numbers, dates, or technical terms
   - NO generic text like "Option A/B/C/D" or "Choice 1/2/3/4"
   - NEVER include hints like "(Correct)" or "(Wrong)" or "(Answer)"
   - NEVER expose which answer is correct in the option text itself

3. Educational Standards:
   - Questions must be exam-quality and curriculum-aligned
   - Incorrect options should be plausible misconceptions or common errors
   - Difficulty must match the specified level
   - Each question should be unique and non-repetitive
   - Questions should cover different aspects of the topic

4. Format Requirements:
   - Return ONLY valid JSON, no markdown or extra text
   - Include an optional brief explanation for analytics (not shown to students)

EXAMPLE OF GOOD QUALITY:
{
  "question": "In which year did the Battle of Hastings take place?",
  "options": ["1066", "1215", "1415", "1666"],
  "correct": 0,
  "explanation": "The Battle of Hastings occurred in 1066 when William the Conqueror defeated King Harold II"
}

EXAMPLE OF BAD QUALITY (NEVER DO THIS):
{
  "question": "Question 1: Select the answer",
  "options": ["Option A (Correct)", "Option B", "Option C", "Option D"],
  "correct": 0
}

Format as JSON array of exactly ${count} questions:
[
  {
    "question": "Question text here?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correct": 0,
    "explanation": "Brief explanation"
  }
]

The "correct" field should be the index (0-3) of the correct answer. NEVER include correctness indicators in the question text or options themselves.`;

  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in AI response");
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length !== count) {
      throw new Error(`Expected ${count} questions, got ${parsed.length}`);
    }

    const validated = parsed.map((q: GeneratedQuestion, idx: number) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correct !== "number") {
        throw new Error(`Invalid question structure at index ${idx}`);
      }

      const questionLower = q.question.toLowerCase();
      const optionsText = q.options.join(" ").toLowerCase();

      if (
        questionLower.includes("select the") ||
        questionLower.includes("choose the") ||
        questionLower.includes("identify the answer") ||
        optionsText.includes("correct") ||
        optionsText.includes("incorrect") ||
        optionsText.includes("wrong") ||
        optionsText.includes("option a") ||
        optionsText.includes("option b") ||
        optionsText.includes("choice 1")
      ) {
        throw new Error(`Question ${idx + 1} contains prohibited placeholder text or answer exposure`);
      }

      return {
        question_text: q.question.trim(),
        options: q.options.map((opt) => opt.trim()),
        correct_index: q.correct,
        explanation: q.explanation?.trim() || null,
      };
    });

    return validated;
  } catch (error) {
    throw new Error(`Question generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
