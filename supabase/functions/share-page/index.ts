import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    // Fetch session data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: quizRun, error } = await supabase
      .from('public_quiz_runs')
      .select(`
        id,
        score,
        correct_count,
        wrong_count,
        percentage,
        duration_seconds,
        status,
        topics (
          name,
          subject
        )
      `)
      .eq('id', sessionId)
      .eq('is_frozen', true)
      .maybeSingle();

    if (error || !quizRun) {
      console.error('Session not found:', sessionId, error);
      return generateErrorHTML(sessionId);
    }

    const totalQuestions = (quizRun.correct_count || 0) + (quizRun.wrong_count || 0);
    const percentage = Math.round(quizRun.percentage || 0);
    const topicName = quizRun.topics?.name || 'Quiz';
    const subject = quizRun.topics?.subject || 'General';
    const mins = Math.floor((quizRun.duration_seconds || 0) / 60);
    const secs = (quizRun.duration_seconds || 0) % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const html = generateShareHTML(
      sessionId,
      percentage,
      quizRun.correct_count,
      totalQuestions,
      timeStr,
      topicName,
      subject
    );

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error generating share page:', error);
    return new Response('Error generating share page', { status: 500 });
  }
});

function generateShareHTML(
  sessionId: string,
  percentage: number,
  correctCount: number,
  totalQuestions: number,
  timeStr: string,
  topicName: string,
  subject: string
): string {
  const shareUrl = `https://startsprint.app/share/session/${sessionId}`;
  const ogImageUrl = `https://startsprint.app/api/og/result?sessionId=${sessionId}`;
  const title = `I scored ${percentage}% on ${topicName} | StartSprint`;
  const description = `${correctCount}/${totalQuestions} correct • Time: ${timeStr} • Can you beat my score?`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Redirect to React app after meta tags are parsed -->
  <meta http-equiv="refresh" content="0;url=${shareUrl}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid white;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 { font-size: 24px; margin: 0 0 10px; }
    p { font-size: 16px; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h1>Loading your quiz result...</h1>
    <p>${escapeHtml(topicName)} • ${percentage}%</p>
  </div>

  <!-- JavaScript redirect as backup -->
  <script>
    window.location.href = "${shareUrl}";
  </script>
</body>
</html>`;
}

function generateErrorHTML(sessionId: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Result Not Found | StartSprint</title>
  <meta name="description" content="Quiz result not found. Try StartSprint - Interactive Quiz Learning Platform">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://startsprint.app/">
  <meta property="og:title" content="StartSprint - Interactive Quiz Learning Platform">
  <meta property="og:description" content="Challenge your mind with interactive quizzes">
  <meta property="og:image" content="https://startsprint.app/og-default.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="StartSprint - Interactive Quiz Learning Platform">
  <meta name="twitter:description" content="Challenge your mind with interactive quizzes">
  <meta name="twitter:image" content="https://startsprint.app/og-default.png">

  <meta http-equiv="refresh" content="0;url=https://startsprint.app/">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    h1 { font-size: 24px; margin: 0 0 10px; }
    p { font-size: 16px; opacity: 0.9; }
  </style>
</head>
<body>
  <div>
    <h1>Result Not Found</h1>
    <p>Redirecting to homepage...</p>
  </div>

  <script>
    window.location.href = "https://startsprint.app/";
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
