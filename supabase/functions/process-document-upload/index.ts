import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DocumentRequest {
  fileName: string;
  fileType: string;
  fileData: string; // base64 encoded
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

interface GeneratedQuestion {
  type: 'mcq' | 'true_false';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

async function extractTextFromAnyFile(base64Data: string, fileType: string): Promise<string> {
  try {
    // Decode base64 to text
    // This works for TXT, and partially works for DOC/DOCX (extracts some text with formatting)
    const decoded = atob(base64Data);

    // For binary formats like DOC/DOCX/PDF, we'll extract whatever text we can
    // This is a simple approach that works surprisingly well for basic documents
    let text = decoded;

    // Clean up common binary artifacts
    // Remove null bytes and control characters except newlines and tabs
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

    // Remove sequences of special characters that are likely binary data
    text = text.replace(/[^\x20-\x7E\n\t\r]{10,}/g, ' ');

    // Collapse multiple spaces
    text = text.replace(/ {3,}/g, ' ');

    // Collapse multiple newlines (keep max 2)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    text = text.trim();

    console.log(`[Document Upload] Extracted ${text.length} characters from ${fileType}`);

    return text;
  } catch (error) {
    console.error('[Document Upload] Text extraction error:', error);
    throw new Error('Failed to extract text from file. Please try copying and pasting the text instead.');
  }
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
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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

    const jwt = authHeader.replace('Bearer ', '').trim();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      console.error('[Document Upload] Auth verification failed:', authError?.message);
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
    console.log(`[Document Upload] Authenticated user: ${user.id} (${user.email})`);

    // Verify teacher has premium entitlement
    const { data: entitlement } = await supabase
      .from('teacher_entitlements')
      .select('*')
      .eq('teacher_user_id', user.id)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();

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
    const body: DocumentRequest = await req.json();
    const {
      fileName,
      fileType,
      fileData,
      subject,
      topic,
      difficulty,
      count
    } = body;

    // Validation
    if (!fileName || !fileType || !fileData) {
      throw new Error("Missing required fields: fileName, fileType, fileData");
    }

    if (!subject || !topic || !difficulty || !count) {
      throw new Error("Missing required fields: subject, topic, difficulty, count");
    }

    if (count < 5 || count > 50) {
      throw new Error("Question count must be between 5 and 50");
    }

    console.log(`[Document Upload] Processing ${fileType} file: ${fileName}`);

    // Extract text from any file type
    let extractedText: string = await extractTextFromAnyFile(fileData, fileType);

    if (!extractedText || extractedText.trim().length < 100) {
      throw new Error('Extracted text is too short (minimum 100 characters required). Please provide a document with more content or paste the text directly.');
    }

    // Limit text length to avoid token limits
    const maxTextLength = 8000;
    if (extractedText.length > maxTextLength) {
      extractedText = extractedText.substring(0, maxTextLength) + '...';
      console.log(`[Document Upload] Text truncated to ${maxTextLength} characters`);
    }

    console.log(`[Document Upload] Extracted ${extractedText.length} characters of text`);

    // Call OpenAI to generate questions
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const systemPrompt = `You are an expert UK secondary school teacher and GCSE exam question writer.

Your task is to generate high-quality multiple-choice quiz questions based on the provided document content.

STRICT REQUIREMENTS:
1. Use UK English spelling and terminology
2. Questions must be age-appropriate and curriculum-aligned
3. Each question must have exactly 4 options (A, B, C, D)
4. Only ONE option is correct
5. Incorrect options (distractors) must be plausible but clearly wrong
6. Keep questions concise and clear (under 200 characters)
7. Explanations should be 1-2 sentences explaining why the answer is correct
8. Questions MUST be based on facts and information in the provided document
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

    const userPrompt = `Based on the following document content, generate ${count} ${difficulty} level multiple-choice questions about "${topic}" in the subject "${subject}".

DOCUMENT CONTENT:
${extractedText}

Difficulty guidance:
- easy: Basic recall and understanding from the document
- medium: Application and analysis of document concepts
- hard: Evaluation and synthesis of document ideas

Return ${count} questions as valid JSON following the specified format. Questions must be based on the document content.`;

    console.log(`[Document Upload] Calling OpenAI to generate ${count} questions`);

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
      console.error('[Document Upload] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;

    // Parse and validate response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('[Document Upload] JSON parse error:', content);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
      throw new Error("Invalid AI response structure");
    }

    // Validate each question
    const validatedItems: GeneratedQuestion[] = [];
    for (const item of parsedContent.items) {
      if (!item.question || !item.options || !Array.isArray(item.options)) {
        continue;
      }

      if (item.options.length !== 4) {
        continue;
      }

      const uniqueOptions = new Set(item.options);
      if (uniqueOptions.size !== 4) {
        continue;
      }

      if (item.options.some((opt: string) => !opt || opt.trim().length === 0)) {
        continue;
      }

      if (typeof item.correctIndex !== 'number' || item.correctIndex < 0 || item.correctIndex > 3) {
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

    if (validatedItems.length < Math.floor(count * 0.8)) {
      throw new Error(`AI generated only ${validatedItems.length} valid questions (expected ${count})`);
    }

    const finalItems = validatedItems.slice(0, count);
    const duration = Date.now() - startTime;

    // Log to audit
    try {
      await supabase.from('audit_logs').insert({
        action_type: 'document_quiz_generation',
        entity_type: 'quiz_generation',
        metadata: {
          teacher_user_id: teacherUserId,
          file_name: fileName,
          file_type: fileType,
          text_length: extractedText.length,
          subject,
          topic,
          difficulty,
          count: finalItems.length,
          duration_ms: duration,
          success: true
        }
      });
    } catch (auditError) {
      console.error('[Document Upload] Failed to log audit:', auditError);
    }

    console.log(`[Document Upload] Success: Generated ${finalItems.length} questions in ${duration}ms`);

    return new Response(
      JSON.stringify({
        items: finalItems,
        extractedTextLength: extractedText.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[Document Upload] Error:', errorMessage);

    // Log error to audit
    if (teacherUserId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        await supabase.from('audit_logs').insert({
          action_type: 'document_quiz_generation',
          entity_type: 'quiz_generation',
          metadata: {
            teacher_user_id: teacherUserId,
            duration_ms: duration,
            success: false,
            error: errorMessage
          }
        });
      } catch (auditError) {
        console.error('[Document Upload] Failed to log error audit:', auditError);
      }
    }

    let statusCode = 500;
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid auth token')) {
      statusCode = 401;
    } else if (errorMessage.includes('Premium') || errorMessage.includes('required')) {
      statusCode = 403;
    } else if (errorMessage.includes('Missing required fields') || errorMessage.includes('Invalid')) {
      statusCode = 400;
    }

    return new Response(
      JSON.stringify({
        error: "Failed to process document",
        message: errorMessage
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
