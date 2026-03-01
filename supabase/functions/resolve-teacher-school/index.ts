import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = user.email;
    if (!email) {
      return new Response(
        JSON.stringify({ status: "no_email", assigned: false, message: "No email on account" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return new Response(
        JSON.stringify({ status: "invalid_email", assigned: false, message: "Invalid email format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.school_id) {
      const { data: existingSchool } = await supabase
        .from("schools")
        .select("id, school_name, slug, is_active")
        .eq("id", profile.school_id)
        .eq("is_active", true)
        .maybeSingle();

      if (existingSchool) {
        await ensureEntitlement(supabase, user.id, existingSchool.id);
        return new Response(
          JSON.stringify({
            status: "already_assigned",
            assigned: true,
            school: { id: existingSchool.id, name: existingSchool.school_name, slug: existingSchool.slug },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: matchingSchools } = await supabase
      .from("schools")
      .select("id, school_name, slug, email_domains")
      .eq("is_active", true);

    const matches = (matchingSchools || []).filter((s: any) =>
      (s.email_domains || []).some((d: string) => d.toLowerCase() === domain)
    );

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({
          status: "no_school",
          assigned: false,
          message: "Your email domain is not registered with any school. Contact your admin.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (matches.length > 1) {
      return new Response(
        JSON.stringify({
          status: "multiple_schools",
          assigned: false,
          message: "Multiple schools match your email domain. Contact admin for assignment.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const school = matches[0];

    await supabase
      .from("profiles")
      .update({ school_id: school.id, school_name: school.school_name })
      .eq("id", user.id);

    const { data: existingMembership } = await supabase
      .from("teacher_school_membership")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("school_id", school.id)
      .maybeSingle();

    if (!existingMembership) {
      await supabase.from("teacher_school_membership").insert({
        teacher_id: user.id,
        school_id: school.id,
        joined_via: "email_domain",
        premium_granted: true,
        premium_granted_at: new Date().toISOString(),
        is_active: true,
      });
    }

    await ensureEntitlement(supabase, user.id, school.id);

    return new Response(
      JSON.stringify({
        status: "assigned",
        assigned: true,
        school: { id: school.id, name: school.school_name, slug: school.slug },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("resolve-teacher-school error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function ensureEntitlement(supabase: any, userId: string, schoolId: string) {
  const { data: existing } = await supabase
    .from("teacher_entitlements")
    .select("id, status")
    .eq("teacher_user_id", userId)
    .eq("source", "school_domain")
    .maybeSingle();

  if (existing && existing.status === "active") return;

  if (existing) {
    await supabase
      .from("teacher_entitlements")
      .update({ status: "active", metadata: { school_id: schoolId } })
      .eq("id", existing.id);
  } else {
    await supabase.from("teacher_entitlements").insert({
      teacher_user_id: userId,
      source: "school_domain",
      status: "active",
      metadata: { school_id: schoolId },
    });
  }
}
