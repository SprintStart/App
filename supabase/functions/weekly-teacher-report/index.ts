import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TeacherMetrics {
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  total_quiz_plays: number;
  unique_students: number;
  completion_rate: number;
  avg_score: number;
  hardest_questions: Array<{ question_text: string; success_rate: number }>;
  top_performing_quiz: string | null;
  recommendations: string[];
}

async function generateTeacherReport(
  supabase: any,
  teacherId: string
): Promise<TeacherMetrics | null> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", teacherId)
      .single();

    if (!profile) return null;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: questionSets } = await supabase
      .from("question_sets")
      .select("id")
      .eq("created_by", teacherId);

    if (!questionSets || questionSets.length === 0) {
      return {
        teacher_id: teacherId,
        teacher_name: profile.full_name || "Teacher",
        teacher_email: profile.email,
        total_quiz_plays: 0,
        unique_students: 0,
        completion_rate: 0,
        avg_score: 0,
        hardest_questions: [],
        top_performing_quiz: null,
        recommendations: [
          "Create your first quiz to start tracking student performance",
        ],
      };
    }

    const questionSetIds = questionSets.map((qs) => qs.id);

    const { data: runs } = await supabase
      .from("topic_runs")
      .select("id, status, score_total, correct_count, wrong_count, session_id, user_id")
      .in("question_set_id", questionSetIds)
      .gte("started_at", oneWeekAgo.toISOString());

    const totalRuns = runs?.length || 0;
    const completedRuns = runs?.filter((r) => r.status === "completed") || [];
    const uniqueStudents = new Set(
      runs?.map((r) => r.user_id || r.session_id) || []
    ).size;

    const completionRate =
      totalRuns > 0 ? (completedRuns.length / totalRuns) * 100 : 0;

    const avgScore =
      completedRuns.length > 0
        ? completedRuns.reduce((sum, r) => sum + (r.score_total || 0), 0) /
          completedRuns.length
        : 0;

    const runIds = runs?.map((r) => r.id) || [];
    const { data: answers } = await supabase
      .from("topic_run_answers")
      .select("question_id, is_correct")
      .in("run_id", runIds);

    const questionStats = new Map<
      string,
      { correct: number; total: number }
    >();
    answers?.forEach((answer) => {
      const stats = questionStats.get(answer.question_id) || {
        correct: 0,
        total: 0,
      };
      stats.total++;
      if (answer.is_correct) stats.correct++;
      questionStats.set(answer.question_id, stats);
    });

    const hardestQuestionIds = Array.from(questionStats.entries())
      .filter((e) => e[1].total >= 5)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .slice(0, 5)
      .map((e) => e[0]);

    const { data: hardestQuestionsData } = await supabase
      .from("topic_questions")
      .select("question_text")
      .in("id", hardestQuestionIds);

    const hardestQuestions =
      hardestQuestionsData?.map((q, i) => {
        const stats = questionStats.get(hardestQuestionIds[i]);
        return {
          question_text: q.question_text,
          success_rate: stats ? (stats.correct / stats.total) * 100 : 0,
        };
      }) || [];

    const recommendations: string[] = [];
    if (completionRate < 50) {
      recommendations.push(
        "Quiz completion rate is low. Consider reducing quiz length or difficulty."
      );
    }
    if (avgScore < 50) {
      recommendations.push(
        "Average scores are low. Review question difficulty and clarity."
      );
    }
    if (hardestQuestions.length > 0 && hardestQuestions[0].success_rate < 30) {
      recommendations.push(
        "Some questions have very low success rates. Consider revising or adding hints."
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(
        "Great job! Your quizzes are engaging and well-balanced."
      );
    }

    return {
      teacher_id: teacherId,
      teacher_name: profile.full_name || "Teacher",
      teacher_email: profile.email,
      total_quiz_plays: totalRuns,
      unique_students: uniqueStudents,
      completion_rate: Math.round(completionRate),
      avg_score: Math.round(avgScore),
      hardest_questions: hardestQuestions.slice(0, 3),
      top_performing_quiz: questionSets[0]?.id || null,
      recommendations,
    };
  } catch (error) {
    console.error(`Error generating report for teacher ${teacherId}:`, error);
    return null;
  }
}

async function sendEmailReport(
  supabase: any,
  metrics: TeacherMetrics
): Promise<boolean> {
  try {
    const emailBody = `
Hi ${metrics.teacher_name},

Here's your weekly performance report from StartSprint:

📊 Quiz Statistics (Last 7 Days)
- Total quiz plays: ${metrics.total_quiz_plays}
- Unique students: ${metrics.unique_students}
- Completion rate: ${metrics.completion_rate}%
- Average score: ${metrics.avg_score}%

${
  metrics.hardest_questions.length > 0
    ? `
🎯 Hardest Questions for Students
${metrics.hardest_questions
  .map(
    (q, i) =>
      `${i + 1}. "${q.question_text.substring(0, 50)}..." (${Math.round(q.success_rate)}% success rate)`
  )
  .join("\n")}
`
    : ""
}

💡 Recommendations
${metrics.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

🎯 Ready to create your next quiz?
Log in to your dashboard: https://startsprint.app/teacherdashboard

Keep up the great work!

Best regards,
The StartSprint Team
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stat-item { margin: 10px 0; }
    .questions { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .recommendations { background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .cta { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Your Weekly Report</h1>
      <p>Hi ${metrics.teacher_name},</p>
    </div>
    <div class="content">
      <div class="stats">
        <h2>📊 Quiz Statistics (Last 7 Days)</h2>
        <div class="stat-item"><strong>Total quiz plays:</strong> ${metrics.total_quiz_plays}</div>
        <div class="stat-item"><strong>Unique students:</strong> ${metrics.unique_students}</div>
        <div class="stat-item"><strong>Completion rate:</strong> ${metrics.completion_rate}%</div>
        <div class="stat-item"><strong>Average score:</strong> ${metrics.avg_score}%</div>
      </div>

      ${
        metrics.hardest_questions.length > 0
          ? `
      <div class="questions">
        <h2>🎯 Hardest Questions for Students</h2>
        ${metrics.hardest_questions
          .map(
            (q, i) =>
              `<div>${i + 1}. "${q.question_text.substring(0, 80)}..." (${Math.round(q.success_rate)}% success rate)</div>`
          )
          .join("")}
      </div>
      `
          : ""
      }

      <div class="recommendations">
        <h2>💡 Recommendations</h2>
        ${metrics.recommendations
          .map((r, i) => `<div>${i + 1}. ${r}</div>`)
          .join("")}
      </div>

      <center>
        <a href="https://startsprint.app/teacherdashboard" class="cta">Create Your Next Quiz</a>
      </center>

      <p class="footer">
        Keep up the great work!<br>
        The StartSprint Team
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const { error } = await supabase.auth.admin.inviteUserByEmail(
      metrics.teacher_email,
      {
        data: {
          type: "weekly_report",
          subject: `📊 Your Weekly Teaching Report - StartSprint`,
          body: emailBody,
          html: htmlBody,
        },
        redirectTo: "https://startsprint.app/teacherdashboard",
      }
    );

    if (error) {
      console.error(`Failed to send email to ${metrics.teacher_email}:`, error);
      return false;
    }

    console.log(`Email sent successfully to ${metrics.teacher_email}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: teachers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "teacher");

    if (!teachers || teachers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No teachers found",
          reports_sent: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const reports: TeacherMetrics[] = [];
    let emailsSent = 0;

    for (const teacher of teachers) {
      const metrics = await generateTeacherReport(supabase, teacher.id);
      if (metrics) {
        reports.push(metrics);
        const sent = await sendEmailReport(supabase, metrics);
        if (sent) emailsSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reports_generated: reports.length,
        emails_sent: emailsSent,
        summary: reports.map((r) => ({
          teacher_name: r.teacher_name,
          total_quiz_plays: r.total_quiz_plays,
          unique_students: r.unique_students,
          completion_rate: r.completion_rate,
        })),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Weekly report error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
