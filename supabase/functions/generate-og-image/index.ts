import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const isDefault = url.searchParams.get('default') === 'true';

    if (isDefault) {
      const defaultSvg = generateDefaultOGImage();
      return new Response(defaultSvg, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (!sessionId) {
      return new Response('Session ID is required', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: quizRun, error: quizError } = await supabase
      .from('public_quiz_runs')
      .select(`
        id,
        correct_count,
        wrong_count,
        percentage,
        duration_seconds,
        topics (
          name,
          subject
        )
      `)
      .eq('id', sessionId)
      .eq('is_frozen', true)
      .single();

    if (quizError || !quizRun) {
      return new Response('Session not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const totalQuestions = (quizRun.correct_count || 0) + (quizRun.wrong_count || 0);
    const percentage = Math.round(quizRun.percentage || 0);
    const topicName = quizRun.topics?.name || 'Quiz';
    const subject = quizRun.topics?.subject || 'General';
    const mins = Math.floor((quizRun.duration_seconds || 0) / 60);
    const secs = (quizRun.duration_seconds || 0) % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const svg = generateSessionOGImage(percentage, quizRun.correct_count, totalQuestions, timeStr, subject, topicName);

    return new Response(svg, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);

    const errorSvg = generateDefaultOGImage();

    return new Response(errorSvg, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
      },
    });
  }
});

function generateDefaultOGImage(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E0F2FE;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#DBEAFE;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>

  <!-- Main content card -->
  <rect x="80" y="100" width="1040" height="430" rx="20" fill="white" opacity="0.95"/>

  <!-- Logo area top-left -->
  <g transform="translate(120, 140)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#0EA5E9">
      Start
    </text>
    <text x="140" y="0" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#0EA5E9">
      Sprint
    </text>
    <text x="290" y="0" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#F59E0B">
      .App
    </text>
  </g>

  <!-- Rocket emoji/icon -->
  <text x="120" y="250" font-family="Arial, sans-serif" font-size="80">🚀</text>

  <!-- Main headline -->
  <text x="120" y="320" font-family="Arial, sans-serif" font-size="52" font-weight="900" fill="#1F2937">
    Challenge Your Mind
  </text>

  <!-- Description -->
  <text x="120" y="370" font-family="Arial, sans-serif" font-size="28" fill="#4B5563">
    Fast, fun quizzes for students
  </text>
  <text x="120" y="410" font-family="Arial, sans-serif" font-size="28" fill="#4B5563">
    Play solo or in Immersive Mode
  </text>

  <!-- CTA -->
  <rect x="120" y="450" width="320" height="60" rx="30" fill="#0EA5E9"/>
  <text x="280" y="490" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="white" text-anchor="middle">
    Start Playing
  </text>
</svg>`;
}

function generateSessionOGImage(
  percentage: number,
  correctCount: number,
  totalQuestions: number,
  timeStr: string,
  subject: string,
  topicName: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E0F2FE;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#DBEAFE;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>

  <!-- Main content card -->
  <rect x="60" y="60" width="1080" height="510" rx="24" fill="white" opacity="0.98"/>

  <!-- Logo top-left -->
  <g transform="translate(100, 110)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#0EA5E9">
      Start
    </text>
    <text x="105" y="0" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#0EA5E9">
      Sprint
    </text>
    <text x="218" y="0" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#F59E0B">
      .App
    </text>
  </g>

  <!-- Score emoji -->
  <text x="100" y="200" font-family="Arial, sans-serif" font-size="48">💨</text>

  <!-- Main score text -->
  <text x="100" y="260" font-family="Arial, sans-serif" font-size="44" font-weight="900" fill="#1F2937">
    I scored ${percentage}% on StartSprint!
  </text>

  <!-- Topic and subject -->
  <text x="100" y="310" font-family="Arial, sans-serif" font-size="28" fill="#6B7280">
    ${escapeXml(topicName)} • ${escapeXml(subject)}
  </text>

  <!-- Stats boxes -->
  <g transform="translate(100, 350)">
    <!-- Score Card -->
    <rect x="0" y="0" width="300" height="140" rx="16" fill="#FEF3C7"/>
    <text x="150" y="60" font-family="Arial, sans-serif" font-size="56" font-weight="900" fill="#D97706" text-anchor="middle">
      ${percentage}%
    </text>
    <text x="150" y="95" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#92400E" text-anchor="middle">
      SCORE
    </text>

    <!-- Correct Card -->
    <rect x="330" y="0" width="300" height="140" rx="16" fill="#D1FAE5"/>
    <text x="480" y="60" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#059669" text-anchor="middle">
      ${correctCount}/${totalQuestions}
    </text>
    <text x="480" y="95" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#065F46" text-anchor="middle">
      CORRECT
    </text>

    <!-- Time Card -->
    <rect x="660" y="0" width="300" height="140" rx="16" fill="#DBEAFE"/>
    <text x="810" y="60" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#2563EB" text-anchor="middle">
      ${timeStr}
    </text>
    <text x="810" y="95" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#1E40AF" text-anchor="middle">
      TIME
    </text>
  </g>

  <!-- CTA -->
  <text x="600" y="545" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#1F2937" text-anchor="middle">
    Can you beat my score? startsprint.app
  </text>
</svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
