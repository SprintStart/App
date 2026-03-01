import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  sessionId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessionId }: RequestBody = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Session ID is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: quizRun, error: quizError } = await supabase
      .from('public_quiz_runs')
      .select(`
        id,
        status,
        score,
        correct_count,
        wrong_count,
        percentage,
        duration_seconds,
        completed_at,
        topic_id,
        topics (
          id,
          name,
          subject
        )
      `)
      .eq('id', sessionId)
      .eq('is_frozen', true)
      .single();

    if (quizError || !quizRun) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Session not found or not completed',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const result = {
      id: quizRun.id,
      score: quizRun.score || 0,
      correct_count: quizRun.correct_count || 0,
      wrong_count: quizRun.wrong_count || 0,
      percentage: Math.round(quizRun.percentage || 0),
      duration_seconds: quizRun.duration_seconds || 0,
      topic_name: quizRun.topics?.name || 'Unknown Topic',
      topic_id: quizRun.topic_id,
      subject: quizRun.topics?.subject || 'General',
      status: quizRun.status,
      completed_at: quizRun.completed_at,
    };

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching shared session:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
