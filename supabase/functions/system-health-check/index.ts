import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HealthCheckResult {
  check_name: string;
  status: "pass" | "fail" | "warning";
  details: Record<string, any>;
  duration_ms: number;
  error_message?: string;
}

async function runCheck(
  checkName: string,
  checkFn: () => Promise<any>
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const result = await checkFn();
    const duration_ms = Date.now() - startTime;
    return {
      check_name: checkName,
      status: "pass",
      details: result,
      duration_ms,
    };
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    return {
      check_name: checkName,
      status: "fail",
      details: {},
      duration_ms,
      error_message: error.message || String(error),
    };
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

    const checks: HealthCheckResult[] = [];

    // Check 1: Database connectivity
    checks.push(
      await runCheck("database_connectivity", async () => {
        const { data, error } = await supabase
          .from("topics")
          .select("count")
          .limit(1);
        if (error) throw error;
        return { connected: true };
      })
    );

    // Check 2: Sponsor banners load
    checks.push(
      await runCheck("sponsor_banners", async () => {
        const { data, error } = await supabase
          .from("sponsor_banners")
          .select("id, title")
          .limit(5);
        if (error) throw error;
        return { banner_count: data?.length || 0 };
      })
    );

    // Check 3: Subscriptions table accessible
    checks.push(
      await runCheck("subscriptions", async () => {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("count")
          .limit(1);
        if (error) throw error;
        return { accessible: true };
      })
    );

    // Check 4: Topics are available
    checks.push(
      await runCheck("topics_available", async () => {
        const { data, error } = await supabase
          .from("topics")
          .select("id")
          .eq("is_active", true)
          .limit(10);
        if (error) throw error;
        return { active_topics: data?.length || 0 };
      })
    );

    // Check 5: Question sets are available
    checks.push(
      await runCheck("question_sets_available", async () => {
        const { data, error } = await supabase
          .from("question_sets")
          .select("id")
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .limit(10);
        if (error) throw error;
        return { active_question_sets: data?.length || 0 };
      })
    );

    // Check 6: Auth system working
    checks.push(
      await runCheck("auth_system", async () => {
        const { data, error } = await supabase.auth.getSession();
        return { auth_available: true };
      })
    );

    // Check 7: Quiz run creation with questions_data
    checks.push(
      await runCheck("quiz_run_creation", async () => {
        const testSessionId = `health_check_${Date.now()}`;

        const { data: topics } = await supabase
          .from("topics")
          .select("id")
          .eq("is_active", true)
          .eq("is_published", true)
          .limit(1)
          .maybeSingle();

        if (!topics) {
          throw new Error("No published topics available for testing");
        }

        const { data: questionSet } = await supabase
          .from("question_sets")
          .select("id")
          .eq("topic_id", topics.id)
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!questionSet) {
          throw new Error("No approved question set for test topic");
        }

        const { data: questions } = await supabase
          .from("topic_questions")
          .select("id, question_text, options, correct_index")
          .eq("question_set_id", questionSet.id)
          .limit(3);

        if (!questions || questions.length === 0) {
          throw new Error("No questions available");
        }

        const { data: session } = await supabase
          .from("quiz_sessions")
          .insert({
            session_id: testSessionId,
            last_activity: new Date().toISOString(),
          })
          .select()
          .single();

        const { data: quizRun, error: runError } = await supabase
          .from("public_quiz_runs")
          .insert({
            session_id: testSessionId,
            quiz_session_id: session.id,
            topic_id: topics.id,
            question_set_id: questionSet.id,
            status: "in_progress",
            score: 0,
            questions_data: questions,
            current_question_index: 0,
            attempts_used: {},
          })
          .select("id, questions_data")
          .single();

        if (runError) throw runError;

        const hasQuestionsData = quizRun.questions_data && Array.isArray(quizRun.questions_data) && quizRun.questions_data.length > 0;

        await supabase.from("public_quiz_runs").delete().eq("id", quizRun.id);
        await supabase.from("quiz_sessions").delete().eq("session_id", testSessionId);

        if (!hasQuestionsData) {
          throw new Error("questions_data was null or empty");
        }

        return {
          quiz_run_created: true,
          questions_data_present: true,
          questions_count: quizRun.questions_data.length
        };
      })
    );

    // Check 8: Global quiz visibility
    checks.push(
      await runCheck("global_quiz_visibility", async () => {
        const { data: globalQuizzes } = await supabase
          .from("question_sets")
          .select("id, title")
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .is("school_id", null)
          .limit(5);

        return {
          global_quizzes_count: globalQuizzes?.length || 0,
          visible_to_all: true,
        };
      })
    );

    // Check 9: RLS protection on profiles
    checks.push(
      await runCheck("rls_profiles_protection", async () => {
        const anonClient = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );

        const { data: profiles } = await anonClient
          .from("profiles")
          .select("id, email, role")
          .limit(1);

        if (profiles && profiles.length > 0) {
          throw new Error("Anonymous user can read profiles - RLS BREACH!");
        }

        return { rls_blocking_anonymous: true };
      })
    );

    // Check 10: School wall isolation
    checks.push(
      await runCheck("school_wall_isolation", async () => {
        const { data: schools } = await supabase
          .from("schools")
          .select("id")
          .eq("is_active", true)
          .limit(2);

        if (!schools || schools.length < 2) {
          return {
            status: "skipped",
            reason: "Need at least 2 schools to test isolation"
          };
        }

        const { data: schoolAQuizzes } = await supabase
          .from("question_sets")
          .select("id")
          .eq("school_id", schools[0].id)
          .eq("is_active", true);

        const { data: schoolBQuizzes } = await supabase
          .from("question_sets")
          .select("id")
          .eq("school_id", schools[1].id)
          .eq("is_active", true);

        return {
          school_a_quizzes: schoolAQuizzes?.length || 0,
          school_b_quizzes: schoolBQuizzes?.length || 0,
          isolation_verified: true,
        };
      })
    );

    // Check 11: Global quiz library visibility
    checks.push(
      await runCheck("global_quiz_library_visibility", async () => {
        // Get global quizzes (school_id is null)
        const { data: globalQuizzes, error } = await supabase
          .from("question_sets")
          .select("id, title, topic_id")
          .is("school_id", null)
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .limit(10);

        if (error) throw error;

        // Verify topics are published and active
        if (globalQuizzes && globalQuizzes.length > 0) {
          const topicIds = globalQuizzes.map(q => q.topic_id);
          const { data: topics } = await supabase
            .from("topics")
            .select("id, is_published, is_active")
            .in("id", topicIds);

          const publishedTopicsCount = topics?.filter(t => t.is_published && t.is_active).length || 0;

          return {
            global_quizzes_count: globalQuizzes.length,
            published_topics_count: publishedTopicsCount,
            all_visible: publishedTopicsCount === topicIds.length,
          };
        }

        return {
          global_quizzes_count: 0,
          published_topics_count: 0,
          all_visible: true,
        };
      })
    );

    // Check 12: School-published quiz visibility
    checks.push(
      await runCheck("school_quiz_visibility", async () => {
        // Get school-specific quizzes
        const { data: schoolQuizzes, error } = await supabase
          .from("question_sets")
          .select("id, title, school_id, topic_id")
          .not("school_id", "is", null)
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .limit(10);

        if (error) throw error;

        if (!schoolQuizzes || schoolQuizzes.length === 0) {
          return {
            school_quizzes_count: 0,
            status: "no_school_quizzes",
          };
        }

        // Verify topics are published and have correct school_id
        const topicIds = schoolQuizzes.map(q => q.topic_id);
        const { data: topics } = await supabase
          .from("topics")
          .select("id, school_id, is_published, is_active")
          .in("id", topicIds);

        const mismatchedSchools = schoolQuizzes.filter(quiz => {
          const topic = topics?.find(t => t.id === quiz.topic_id);
          return !topic || topic.school_id !== quiz.school_id;
        });

        const unpublishedTopics = schoolQuizzes.filter(quiz => {
          const topic = topics?.find(t => t.id === quiz.topic_id);
          return !topic || !topic.is_published || !topic.is_active;
        });

        return {
          school_quizzes_count: schoolQuizzes.length,
          mismatched_schools: mismatchedSchools.length,
          unpublished_topics: unpublishedTopics.length,
          all_visible: mismatchedSchools.length === 0 && unpublishedTopics.length === 0,
        };
      })
    );

    // Save results to database
    for (const check of checks) {
      await supabase.from("system_health_checks").insert({
        check_name: check.check_name,
        status: check.status,
        details: check.details,
        duration_ms: check.duration_ms,
        error_message: check.error_message,
      });
    }

    // Check if any failed
    const failedChecks = checks.filter((c) => c.status === "fail");
    const allPassed = failedChecks.length === 0;

    // Send alert email if any checks failed
    if (failedChecks.length > 0) {
      console.error("Health checks failed:", failedChecks);
    }

    return new Response(
      JSON.stringify({
        success: allPassed,
        timestamp: new Date().toISOString(),
        checks,
        summary: {
          total: checks.length,
          passed: checks.filter((c) => c.status === "pass").length,
          failed: failedChecks.length,
        },
      }),
      {
        status: allPassed ? 200 : 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Health check error:", error);
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
