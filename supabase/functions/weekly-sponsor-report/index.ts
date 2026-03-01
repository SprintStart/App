import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SponsorMetrics {
  sponsor_name: string;
  ad_title: string;
  ad_id: string;
  total_impressions: number;
  total_clicks: number;
  ctr: number;
  top_placements: Array<{ placement: string; impressions: number; clicks: number }>;
  daily_breakdown: Array<{ date: string; impressions: number; clicks: number }>;
  contact_email: string;
}

async function generateSponsorReport(
  supabase: any,
  adId: string
): Promise<SponsorMetrics | null> {
  try {
    const { data: ad } = await supabase
      .from("sponsored_ads")
      .select("*")
      .eq("id", adId)
      .single();

    if (!ad) return null;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: impressions } = await supabase
      .from("sponsor_banner_events")
      .select("*")
      .eq("banner_id", adId)
      .eq("event_type", "impression")
      .gte("created_at", oneWeekAgo.toISOString());

    const { data: clicks } = await supabase
      .from("sponsor_banner_events")
      .select("*")
      .eq("banner_id", adId)
      .eq("event_type", "click")
      .gte("created_at", oneWeekAgo.toISOString());

    const totalImpressions = impressions?.length || 0;
    const totalClicks = clicks?.length || 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const placementStats = new Map<string, { impressions: number; clicks: number }>();

    impressions?.forEach((imp) => {
      const placement = imp.page || "unknown";
      const stats = placementStats.get(placement) || { impressions: 0, clicks: 0 };
      stats.impressions++;
      placementStats.set(placement, stats);
    });

    clicks?.forEach((click) => {
      const placement = click.page || "unknown";
      const stats = placementStats.get(placement) || { impressions: 0, clicks: 0 };
      stats.clicks++;
      placementStats.set(placement, stats);
    });

    const topPlacements = Array.from(placementStats.entries())
      .map(([placement, stats]) => ({
        placement,
        impressions: stats.impressions,
        clicks: stats.clicks,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    const dailyStats = new Map<string, { impressions: number; clicks: number }>();

    impressions?.forEach((imp) => {
      const date = new Date(imp.created_at).toISOString().split("T")[0];
      const stats = dailyStats.get(date) || { impressions: 0, clicks: 0 };
      stats.impressions++;
      dailyStats.set(date, stats);
    });

    clicks?.forEach((click) => {
      const date = new Date(click.created_at).toISOString().split("T")[0];
      const stats = dailyStats.get(date) || { impressions: 0, clicks: 0 };
      stats.clicks++;
      dailyStats.set(date, stats);
    });

    const dailyBreakdown = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        impressions: stats.impressions,
        clicks: stats.clicks,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      sponsor_name: ad.advertiser_name || "Sponsor",
      ad_title: ad.title,
      ad_id: adId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      ctr: Math.round(ctr * 100) / 100,
      top_placements: topPlacements,
      daily_breakdown: dailyBreakdown,
      contact_email: ad.contact_email || "",
    };
  } catch (error) {
    console.error(`Error generating report for ad ${adId}:`, error);
    return null;
  }
}

async function sendSponsorEmailReport(
  supabase: any,
  metrics: SponsorMetrics
): Promise<boolean> {
  try {
    if (!metrics.contact_email) {
      console.log(`No contact email for ad ${metrics.ad_id}, skipping email`);
      return false;
    }

    const emailBody = `
Hi ${metrics.sponsor_name},

Here's your weekly advertising performance report for "${metrics.ad_title}":

📊 Performance Overview (Last 7 Days)
- Total impressions: ${metrics.total_impressions.toLocaleString()}
- Total clicks: ${metrics.total_clicks.toLocaleString()}
- Click-through rate (CTR): ${metrics.ctr}%

${
  metrics.top_placements.length > 0
    ? `
📍 Top Performing Placements
${metrics.top_placements
  .map(
    (p, i) =>
      `${i + 1}. ${p.placement}: ${p.impressions.toLocaleString()} impressions, ${p.clicks.toLocaleString()} clicks`
  )
  .join("\n")}
`
    : ""
}

${
  metrics.daily_breakdown.length > 0
    ? `
📅 Daily Performance
${metrics.daily_breakdown
  .map(
    (d) =>
      `${d.date}: ${d.impressions.toLocaleString()} impressions, ${d.clicks.toLocaleString()} clicks`
  )
  .join("\n")}
`
    : ""
}

Thank you for advertising with StartSprint!

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
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stat-item { margin: 10px 0; font-size: 18px; }
    .stat-value { font-weight: bold; color: #f5576c; font-size: 24px; }
    .placements { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .placement-item { margin: 8px 0; padding: 10px; background: white; border-radius: 5px; }
    .daily { background: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .daily-item { display: flex; justify-content: space-between; margin: 5px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Your Weekly Ad Report</h1>
      <p>Hi ${metrics.sponsor_name},</p>
    </div>
    <div class="content">
      <h2>Ad: "${metrics.ad_title}"</h2>

      <div class="stats">
        <h2>📊 Performance Overview (Last 7 Days)</h2>
        <div class="stat-item">
          Total Impressions: <span class="stat-value">${metrics.total_impressions.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          Total Clicks: <span class="stat-value">${metrics.total_clicks.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          Click-through Rate: <span class="stat-value">${metrics.ctr}%</span>
        </div>
      </div>

      ${
        metrics.top_placements.length > 0
          ? `
      <div class="placements">
        <h2>📍 Top Performing Placements</h2>
        ${metrics.top_placements
          .map(
            (p, i) =>
              `<div class="placement-item">
                <strong>${i + 1}. ${p.placement}</strong><br>
                ${p.impressions.toLocaleString()} impressions, ${p.clicks.toLocaleString()} clicks
              </div>`
          )
          .join("")}
      </div>
      `
          : ""
      }

      ${
        metrics.daily_breakdown.length > 0
          ? `
      <div class="daily">
        <h2>📅 Daily Performance</h2>
        ${metrics.daily_breakdown
          .map(
            (d) =>
              `<div class="daily-item">
                <span>${d.date}</span>
                <span>${d.impressions.toLocaleString()} impressions, ${d.clicks.toLocaleString()} clicks</span>
              </div>`
          )
          .join("")}
      </div>
      `
          : ""
      }

      <p class="footer">
        Thank you for advertising with StartSprint!<br>
        The StartSprint Team
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const { error } = await supabase.auth.admin.inviteUserByEmail(
      metrics.contact_email,
      {
        data: {
          type: "sponsor_report",
          subject: `📊 Your Weekly Ad Performance - StartSprint`,
          body: emailBody,
          html: htmlBody,
        },
        redirectTo: "https://startsprint.app",
      }
    );

    if (error) {
      console.error(`Failed to send email to ${metrics.contact_email}:`, error);
      return false;
    }

    console.log(`Email sent successfully to ${metrics.contact_email}`);
    return true;
  } catch (error) {
    console.error("Error sending sponsor email:", error);
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

    const { data: ads } = await supabase
      .from("sponsored_ads")
      .select("id")
      .eq("is_active", true);

    if (!ads || ads.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active ads found",
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

    const reports: SponsorMetrics[] = [];
    let emailsSent = 0;

    for (const ad of ads) {
      const metrics = await generateSponsorReport(supabase, ad.id);
      if (metrics) {
        reports.push(metrics);
        const sent = await sendSponsorEmailReport(supabase, metrics);
        if (sent) emailsSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reports_generated: reports.length,
        emails_sent: emailsSent,
        summary: reports.map((r) => ({
          ad_title: r.ad_title,
          total_impressions: r.total_impressions,
          total_clicks: r.total_clicks,
          ctr: r.ctr,
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
    console.error("Weekly sponsor report error:", error);
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
