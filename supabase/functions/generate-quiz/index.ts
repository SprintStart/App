import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QuizRequest {
  topic: string;
  subject: string;
  difficulty: string;
  question_count: number;
  teacher_id: string;
}

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { topic, subject, difficulty, question_count, teacher_id }: QuizRequest = await req.json();

    if (!topic || !subject || !difficulty || !question_count || !teacher_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const questions = await generateQuestions(topic, subject, difficulty, question_count);

    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const { data: existingTopic } = await supabase
      .from("topics")
      .select("id")
      .eq("slug", slug)
      .eq("created_by", teacher_id)
      .maybeSingle();

    let topicId: string;

    if (existingTopic) {
      topicId = existingTopic.id;
    } else {
      const { data: newTopic, error: topicError } = await supabase
        .from("topics")
        .insert({
          name: topic,
          slug,
          description: `AI-generated quiz on ${topic}`,
          subject,
          created_by: teacher_id,
        })
        .select("id")
        .single();

      if (topicError) throw topicError;
      topicId = newTopic.id;
    }

    const { data: questionSet, error: qsError } = await supabase
      .from("question_sets")
      .insert({
        topic_id: topicId,
        title: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} - ${topic}`,
        difficulty,
        question_count: questions.length,
        created_by: teacher_id,
        approval_status: "draft",
      })
      .select("id")
      .single();

    if (qsError) throw qsError;

    const questionInserts = questions.map((q, idx) => ({
      question_set_id: questionSet.id,
      question_text: q.question_text,
      options: q.options,
      correct_index: q.correct_index,
      order_index: idx,
      created_by: teacher_id,
    }));

    const { error: questionsError } = await supabase
      .from("topic_questions")
      .insert(questionInserts);

    if (questionsError) throw questionsError;

    return new Response(
      JSON.stringify({
        success: true,
        question_set_id: questionSet.id,
        topic_id: topicId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating quiz:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate quiz" }),
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
  difficulty: string,
  count: number
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];

  const difficultyDescriptions = {
    easy: "basic understanding level for beginners",
    medium: "intermediate level requiring solid understanding",
    hard: "advanced level requiring deep knowledge",
    expert: "expert level with complex scenarios",
  };

  const prompt = `You are an expert educational content creator. Generate ${count} high-quality, exam-standard multiple-choice questions about "${topic}" in the subject of ${subject} at ${difficulty} difficulty (${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions] || "medium level"}).

CRITICAL QUALITY STANDARDS:

1. Question Text Requirements:
   - Write clear, specific, complete questions that make sense on their own
   - Use proper educational terminology and grammar
   - Target secondary school level (ages 11-18)
   - Be factually accurate and verifiable
   - NO placeholders like "When did this occur?" without context
   - NO meta-text or labels

2. Answer Options Requirements:
   - Provide exactly 4 distinct, plausible options
   - All options must be realistic and similar in structure/length
   - Options should be challenging but have one clearly correct answer
   - Use proper terminology, numbers, dates, or technical terms
   - NO generic text like "Option A/B/C/D"
   - NEVER include hints like "(Correct)" or "(Wrong)" in any option
   - NEVER expose which answer is correct in the option text

3. Educational Standards:
   - Questions should test understanding, not just recall
   - Incorrect options should be plausible misconceptions or common errors
   - Difficulty should match the specified level

Format as JSON array:
[
  {
    "question": "In which year did the Battle of Hastings take place?",
    "options": ["1066", "1215", "1415", "1666"],
    "correct": 0
  }
]

The "correct" field should be the index (0-3) of the correct answer. NEVER include correctness indicators in the question text or options themselves.`;

  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.content[0].text;

    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const parsedQuestions = JSON.parse(jsonMatch[0]);

    for (const q of parsedQuestions) {
      if (q.question && q.options && q.options.length === 4 && typeof q.correct === "number") {
        questions.push({
          question_text: q.question,
          options: q.options,
          correct_index: q.correct,
        });
      }
    }

    if (questions.length === 0) {
      throw new Error("No valid questions generated");
    }

    return questions.slice(0, count);
  } catch (error) {
    console.error("AI generation failed, using fallback questions");
    return generateFallbackQuestions(topic, subject, count);
  }
}

function generateFallbackQuestions(
  topic: string,
  subject: string,
  count: number
): GeneratedQuestion[] {
  const fallbacks: GeneratedQuestion[] = [];

  // Generate basic but educational questions based on subject
  const fallbackTemplates = {
    mathematics: [
      { q: "What is 15 + 27?", opts: ["42", "52", "32", "62"], c: 0 },
      { q: "What is 144 ÷ 12?", opts: ["11", "12", "13", "14"], c: 1 },
      { q: "What is 8 × 7?", opts: ["54", "56", "64", "72"], c: 1 },
      { q: "What is the square root of 64?", opts: ["6", "8", "10", "12"], c: 1 },
    ],
    science: [
      { q: "What is H2O commonly known as?", opts: ["Oxygen", "Water", "Hydrogen", "Carbon dioxide"], c: 1 },
      { q: "What is the chemical symbol for gold?", opts: ["Go", "Au", "Gd", "Ag"], c: 1 },
      { q: "How many planets are in our solar system?", opts: ["7", "8", "9", "10"], c: 1 },
      { q: "What gas do plants absorb from the atmosphere?", opts: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], c: 2 },
    ],
    english: [
      { q: "What is a verb?", opts: ["A describing word", "An action word", "A naming word", "A connecting word"], c: 1 },
      { q: "What is the plural of 'child'?", opts: ["Childs", "Children", "Childrens", "Childes"], c: 1 },
      { q: "Which is a synonym for 'happy'?", opts: ["Sad", "Angry", "Joyful", "Tired"], c: 2 },
      { q: "What is an adjective?", opts: ["A doing word", "A place", "A describing word", "A person"], c: 2 },
    ],
  };

  const templates = fallbackTemplates[subject as keyof typeof fallbackTemplates] || [
    { q: `What is a key concept in ${topic}?`, opts: ["Concept A", "Concept B", "Concept C", "Concept D"], c: 0 },
    { q: `Which statement about ${topic} is true?`, opts: ["Statement 1", "Statement 2", "Statement 3", "Statement 4"], c: 0 },
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    fallbacks.push({
      question_text: template.q,
      options: template.opts,
      correct_index: template.c,
    });
  }

  return fallbacks;
}
