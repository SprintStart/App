import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BannerAnalytics {
  banner_id: string;
  banner_title: string;
  impressions: number;
  clicks: number;
  ctr: number;
  top_referrers: Array<{ referrer: string; count: number }>;
  placement: string;
  period: string;
}

async function generateBannerAnalytics(
  supabase: any,
  bannerId: string,
  daysBack: number = 7
): Promise<BannerAnalytics | null> {
  try {
    const { data: banner } = await supabase
      .from("sponsored_ads")
      .select("title, placement")
      .eq("id", bannerId)
      .single();

    if (!banner) return null;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: views } = await supabase
      .from("sponsor_banner_events")
      .select("id")
      .eq("banner_id", bannerId)
      .eq("event_type", "view")
      .gte("created_at", startDate.toISOString());

    const { data: clicks } = await supabase
      .from("sponsor_banner_events")
      .select("id")
      .eq("banner_id", bannerId)
      .eq("event_type", "click")
      .gte("created_at", startDate.toISOString());

    const impressions = views?.length || 0;
    const clickCount = clicks?.length || 0;
    const ctr = impressions > 0 ? (clickCount / impressions) * 100 : 0;

    const { data: referrerData } = await supabase
      .from("sponsor_banner_events")
      .select("referrer")
      .eq("banner_id", bannerId)
      .eq("event_type", "click")
      .gte("created_at", startDate.toISOString())
      .not("referrer", "is", null);

    const referrerCounts = new Map<string, number>();
    referrerData?.forEach((r) => {
      const count = referrerCounts.get(r.referrer) || 0;
      referrerCounts.set(r.referrer, count + 1);
    });

    const topReferrers = Array.from(referrerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([referrer, count]) => ({ referrer, count }));

    return {
      banner_id: bannerId,
      banner_title: banner.title,
      impressions,
      clicks: clickCount,
      ctr: Math.round(ctr * 100) / 100,
      top_referrers: topReferrers,
      placement: banner.placement,
      period: `Last ${daysBack} days`,
    };
  } catch (error) {
    console.error(`Error generating analytics for banner ${bannerId}:`, error);
    return null;
  }
}

async function trackBannerEvent(
  supabase: any,
  bannerId: string,
  eventType: "view" | "click",
  sessionId: string | null,
  userAgent: string | null,
  ipAddress: string | null,
  referrer: string | null
): Promise<boolean> {
  try {
    const ipHash = ipAddress
      ? await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(ipAddress))
          .then((hash) =>
            Array.from(new Uint8Array(hash))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          )
      : null;

    const { error } = await supabase.from("sponsor_banner_events").insert({
      banner_id: bannerId,
      event_type: eventType,
      session_id: sessionId,
      user_agent: userAgent,
      ip_hash: ipHash,
      referrer: referrer,
    });

    if (error) {
      console.error("Error tracking event:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error tracking banner event:", error);
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "track") {
      const { banner_id, event_type, session_id, referrer } = await req.json();

      if (!banner_id || !event_type) {
        return new Response(
          JSON.stringify({ error: "Missing banner_id or event_type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!["view", "click"].includes(event_type)) {
        return new Response(
          JSON.stringify({ error: "Invalid event_type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const userAgent = req.headers.get("user-agent");
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || null;

      const success = await trackBannerEvent(
        supabase,
        banner_id,
        event_type,
        session_id || null,
        userAgent,
        ipAddress,
        referrer || null
      );

      return new Response(
        JSON.stringify({ success }),
        {
          status: success ? 200 : 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (action === "report") {
      const daysBack = parseInt(url.searchParams.get("days") || "7");
      const bannerId = url.searchParams.get("banner_id");

      if (bannerId) {
        const analytics = await generateBannerAnalytics(
          supabase,
          bannerId,
          daysBack
        );

        if (!analytics) {
          return new Response(
            JSON.stringify({ error: "Banner not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(JSON.stringify(analytics), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      const { data: banners } = await supabase
        .from("sponsored_ads")
        .select("id, title")
        .eq("is_active", true);

      if (!banners || banners.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "No active banners found",
            analytics: [],
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

      const allAnalytics: BannerAnalytics[] = [];
      for (const banner of banners) {
        const analytics = await generateBannerAnalytics(
          supabase,
          banner.id,
          daysBack
        );
        if (analytics) allAnalytics.push(analytics);
      }

      return new Response(
        JSON.stringify({
          success: true,
          period: `Last ${daysBack} days`,
          analytics: allAnalytics,
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

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use ?action=track or ?action=report",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Sponsor analytics error:", error);
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
