import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerationRequest {
  subject: string;
  topic: string;
  quiz_title: string;
  quiz_description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  types: string[];
  curriculum?: string;
  language?: string;
}

interface GeneratedQuestion {
  type: 'mcq' | 'true_false';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let teacherUserId: string | null = null;

  try {
    // Log all headers for debugging
    console.log('[AI Generate] Request headers:', {
      hasAuthorization: !!req.headers.get("Authorization"),
      hasApiKey: !!req.headers.get("apikey"),
      contentType: req.headers.get("Content-Type"),
      origin: req.headers.get("Origin")
    });

    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");

    if (!authHeader) {
      console.error('[AI Generate] Missing Authorization header');
      console.error('[AI Generate] Available headers:', Array.from(req.headers.keys()));
      return new Response(
        JSON.stringify({
          error: "missing_auth",
          message: "Missing Authorization bearer token"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[AI Generate] Received request with Authorization header');
    console.log('[AI Generate] Auth header format:', authHeader.substring(0, 20) + '...');
    console.log('[AI Generate] Has apikey header:', !!apikeyHeader);

    // Extract JWT token from "Bearer <token>" format
    const jwt = authHeader.replace('Bearer ', '').trim();
    console.log('[AI Generate] Extracted JWT (first 20 chars):', jwt.substring(0, 20) + '...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authenticated user - pass JWT directly to getUser()
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      console.error('[AI Generate] Auth verification failed:', authError?.message || 'No user');
      console.error('[AI Generate] Auth error details:', authError);
      return new Response(
        JSON.stringify({
          error: "invalid_auth",
          message: authError?.message || "Invalid or expired token"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    teacherUserId = user.id;
    console.log(`[AI Generate] Authenticated user: ${user.id} (${user.email})`);

    // Verify teacher has premium entitlement
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: entitlement, error: entitlementError } = await adminSupabase
      .from('teacher_entitlements')
      .select('*')
      .eq('teacher_user_id', user.id)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();

    if (entitlementError) {
      console.error('[AI Generate] Entitlement check error:', entitlementError);
      // Continue anyway - this is a database query error, not an auth error
    }

    console.log(`[AI Generate] Entitlement check result:`, entitlement ? 'active' : 'none');

    if (!entitlement) {
      return new Response(
        JSON.stringify({
          error: "premium_required",
          message: "Premium subscription required for AI generation"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: GenerationRequest = await req.json();
    const {
      subject,
      topic,
      quiz_title,
      quiz_description,
      difficulty,
      count,
      types,
      curriculum = 'uk',
      language = 'en-GB'
    } = body;

    // Validation
    if (!subject || !topic || !difficulty || !count) {
      throw new Error("Missing required fields: subject, topic, difficulty, count");
    }

    if (count < 5 || count > 50) {
      throw new Error("Question count must be between 5 and 50");
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new Error("Invalid difficulty level");
    }

    // Call OpenAI
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    console.log(`[AI Generate] Generating ${count} ${difficulty} questions for ${subject}/${topic}`);

    const systemPrompt = `You are an expert UK secondary school teacher and GCSE exam question writer.

Your task is to generate high-quality multiple-choice quiz questions suitable for UK secondary school students (ages 11-16) and GCSE level.

STRICT REQUIREMENTS:
1. Use UK English spelling and terminology (e.g., "maths" not "math", "programme" not "program" for non-computing)
2. Questions must be age-appropriate and curriculum-aligned
3. Each question must have exactly 4 options (A, B, C, D)
4. Only ONE option is correct
5. Incorrect options (distractors) must be plausible but clearly wrong
6. Keep questions concise and clear (under 200 characters)
7. Explanations should be 1-2 sentences explaining why the answer is correct
8. Avoid sensitive, controversial, or inappropriate content
9. No duplicate options in any question
10. Correct answer index must be valid (0-3)

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "items": [
    {
      "type": "mcq",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}

Do not include any text before or after the JSON. The JSON must be parseable.`;

    const userPrompt = `Generate ${count} ${difficulty} level multiple-choice questions about "${topic}" in the subject "${subject}".

${quiz_description ? `Context: ${quiz_description}` : ''}

Difficulty guidance:
- easy: Basic recall and understanding
- medium: Application and analysis
- hard: Evaluation and synthesis

Return ${count} questions as valid JSON following the specified format.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[AI Generate] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;

    // Parse and validate response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Generate] JSON parse error:', content);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
      throw new Error("Invalid AI response structure");
    }

    // Validate each question
    const validatedItems: GeneratedQuestion[] = [];
    for (const item of parsedContent.items) {
      // Validate structure
      if (!item.question || !item.options || !Array.isArray(item.options)) {
        console.warn('[AI Generate] Skipping invalid item:', item);
        continue;
      }

      // Validate options
      if (item.options.length !== 4) {
        console.warn('[AI Generate] Skipping item with wrong option count:', item);
        continue;
      }

      // Check for duplicate options
      const uniqueOptions = new Set(item.options);
      if (uniqueOptions.size !== 4) {
        console.warn('[AI Generate] Skipping item with duplicate options:', item);
        continue;
      }

      // Check for empty options
      if (item.options.some((opt: string) => !opt || opt.trim().length === 0)) {
        console.warn('[AI Generate] Skipping item with empty option:', item);
        continue;
      }

      // Validate correctIndex
      if (typeof item.correctIndex !== 'number' || item.correctIndex < 0 || item.correctIndex > 3) {
        console.warn('[AI Generate] Skipping item with invalid correctIndex:', item);
        continue;
      }

      validatedItems.push({
        type: item.type || 'mcq',
        question: item.question.trim(),
        options: item.options.map((opt: string) => opt.trim()),
        correctIndex: item.correctIndex,
        explanation: item.explanation?.trim() || 'Correct answer.'
      });
    }

    // Check if we got enough valid questions
    if (validatedItems.length < Math.floor(count * 0.8)) {
      throw new Error(`AI generated only ${validatedItems.length} valid questions (expected ${count})`);
    }

    // Trim to requested count
    const finalItems = validatedItems.slice(0, count);

    const duration = Date.now() - startTime;

    // Log to audit
    try {
      await adminSupabase.from('audit_logs').insert({
        action_type: 'ai_quiz_generation',
        entity_type: 'quiz_generation',
        metadata: {
          teacher_user_id: teacherUserId,
          subject,
          topic,
          difficulty,
          count: finalItems.length,
          duration_ms: duration,
          success: true
        }
      });
    } catch (auditError) {
      console.error('[AI Generate] Failed to log audit:', auditError);
      // Don't fail the request if audit logging fails
    }

    console.log(`[AI Generate] Success: Generated ${finalItems.length} questions in ${duration}ms`);

    return new Response(
      JSON.stringify({ items: finalItems }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[AI Generate] Error:', errorMessage);

    // Log error to audit if we have a user ID
    if (teacherUserId) {
      try {
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

        await adminSupabase.from('audit_logs').insert({
          action_type: 'ai_quiz_generation',
          entity_type: 'quiz_generation',
          metadata: {
            teacher_user_id: teacherUserId,
            duration_ms: duration,
            success: false,
            error: errorMessage
          }
        });
      } catch (auditError) {
        console.error('[AI Generate] Failed to log error audit:', auditError);
      }
    }

    // Determine appropriate status code based on error
    let statusCode = 500;
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid auth token')) {
      statusCode = 401;
    } else if (errorMessage.includes('Premium access required')) {
      statusCode = 403;
    } else if (errorMessage.includes('Missing required fields') || errorMessage.includes('Invalid')) {
      statusCode = 400;
    }

    return new Response(
      JSON.stringify({
        error: "Failed to generate questions",
        message: errorMessage
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
