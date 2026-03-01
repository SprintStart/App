import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import satori from "npm:satori@0.10.14";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

let resvgReady = false;
let fontDataCache: ArrayBuffer | null = null;
let logoDataUri: string | null = null;

async function ensureResvg(): Promise<void> {
  if (resvgReady) return;
  await initWasm(
    fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm")
  );
  resvgReady = true;
}

async function loadFont(): Promise<ArrayBuffer> {
  if (fontDataCache) return fontDataCache;
  const css = await (
    await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@700", {
      headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 8.0)" },
    })
  ).text();
  const match = css.match(/url\(([^)]+)\)/);
  if (!match) throw new Error("Font URL not found");
  fontDataCache = await (await fetch(match[1])).arrayBuffer();
  return fontDataCache;
}

async function loadLogo(): Promise<string> {
  if (logoDataUri) return logoDataUri;
  try {
    const resp = await fetch("https://startsprint.app/startsprint_logo.png");
    if (!resp.ok) throw new Error(`Logo ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    logoDataUri = `data:image/png;base64,${btoa(bin)}`;
    return logoDataUri;
  } catch {
    logoDataUri = "";
    return "";
  }
}

function h(type: string, style: Record<string, unknown>, ...children: unknown[]) {
  const filtered = children.flat().filter((c) => c != null && c !== false);
  return {
    type,
    props: {
      style: { display: "flex", ...style },
      children: filtered.length === 1 ? filtered[0] : filtered.length === 0 ? undefined : filtered,
    },
  };
}

function imgEl(src: string, w: number, ht: number, style?: Record<string, unknown>) {
  return { type: "img", props: { src, width: w, height: ht, style: style || {} } };
}

function buildResultImage(
  percentage: number,
  correctCount: number,
  totalQuestions: number,
  timeStr: string,
  topicName: string,
  subject: string,
  logo: string
) {
  const statCard = (bg: string, value: string, label: string, color: string, labelColor: string) =>
    h("div", {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      backgroundColor: bg,
      borderRadius: "16px",
      padding: "16px",
    },
      h("div", { fontSize: "52px", fontWeight: 700, color }, value),
      h("div", { fontSize: "18px", fontWeight: 700, color: labelColor, marginTop: "4px" }, label)
    );

  return h("div", {
    width: "100%",
    height: "100%",
    backgroundImage: "linear-gradient(135deg, #1E40AF, #059669)",
    padding: "32px",
    fontFamily: "Inter",
  },
    h("div", {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: "white",
      borderRadius: "24px",
      padding: "36px 40px",
    },
      h("div", { alignItems: "center", marginBottom: "16px" },
        logo ? imgEl(logo, 56, 56, { borderRadius: "10px", marginRight: "14px" }) : null,
        h("span", { fontSize: "32px", fontWeight: 700, color: "#1E40AF" }, "StartSprint"),
        h("span", { fontSize: "32px", fontWeight: 700, color: "#F59E0B" }, ".app")
      ),

      h("div", { fontSize: "44px", fontWeight: 700, color: "#111827", marginBottom: "6px" },
        `I scored ${percentage}% on StartSprint!`
      ),

      h("div", { fontSize: "22px", color: "#6B7280", marginBottom: "24px" },
        `${topicName}  •  ${subject}`
      ),

      h("div", { flex: 1, gap: "16px" },
        statCard("#FEF3C7", `${percentage}%`, "SCORE", "#B45309", "#92400E"),
        statCard("#D1FAE5", `${correctCount}/${totalQuestions}`, "CORRECT", "#047857", "#065F46"),
        statCard("#DBEAFE", timeStr, "TIME", "#1D4ED8", "#1E40AF")
      ),

      h("div", {
        justifyContent: "center",
        fontSize: "22px",
        fontWeight: 700,
        color: "#374151",
        marginTop: "12px",
      }, "Can you beat my score?  startsprint.app")
    )
  );
}

function buildFallbackImage(logo: string) {
  return h("div", {
    width: "100%",
    height: "100%",
    backgroundImage: "linear-gradient(135deg, #1E40AF, #059669)",
    padding: "32px",
    fontFamily: "Inter",
  },
    h("div", {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      backgroundColor: "white",
      borderRadius: "24px",
      padding: "40px",
    },
      logo ? imgEl(logo, 120, 120, { borderRadius: "20px", marginBottom: "24px" }) : null,
      h("div", { fontSize: "56px", fontWeight: 700, marginBottom: "8px" },
        h("span", { color: "#1E40AF" }, "Start"),
        h("span", { color: "#1E40AF" }, "Sprint"),
        h("span", { color: "#F59E0B" }, ".app")
      ),
      h("div", {
        fontSize: "32px",
        color: "#374151",
        fontWeight: 700,
        marginTop: "12px",
      }, "Interactive Quiz Learning Platform"),
      h("div", {
        fontSize: "22px",
        color: "#6B7280",
        marginTop: "12px",
      }, "Challenge your mind  •  Track your progress  •  Share your scores"),
      h("div", {
        marginTop: "28px",
        backgroundColor: "#1E40AF",
        borderRadius: "40px",
        padding: "14px 48px",
        color: "white",
        fontSize: "24px",
        fontWeight: 700,
      }, "Start Playing")
    )
  );
}

async function renderPng(element: unknown): Promise<Uint8Array> {
  const [font] = await Promise.all([loadFont(), ensureResvg()]);
  const svg = await satori(element as any, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" as const }],
  });
  const resvg = new Resvg(svg);
  const rendered = resvg.render();
  return rendered.asPng();
}

function pngResponse(data: Uint8Array, cache: string): Response {
  return new Response(data, {
    headers: { ...corsHeaders, "Content-Type": "image/png", "Cache-Control": cache },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const logo = await loadLogo();

    if (!sessionId) {
      const png = await renderPng(buildFallbackImage(logo));
      return pngResponse(png, "public, max-age=86400");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: run, error } = await supabase
      .from("public_quiz_runs")
      .select("id, correct_count, wrong_count, percentage, duration_seconds, topics(name, subject)")
      .eq("id", sessionId)
      .eq("is_frozen", true)
      .maybeSingle();

    if (error || !run) {
      const png = await renderPng(buildFallbackImage(logo));
      return pngResponse(png, "public, max-age=3600");
    }

    const total = (run.correct_count || 0) + (run.wrong_count || 0);
    const pct = Math.round(run.percentage || 0);
    const topic = run.topics?.name || "Quiz";
    const subj = run.topics?.subject || "General";
    const m = Math.floor((run.duration_seconds || 0) / 60);
    const s = (run.duration_seconds || 0) % 60;
    const time = `${m}:${s.toString().padStart(2, "0")}`;

    const element = buildResultImage(pct, run.correct_count || 0, total, time, topic, subj, logo);
    const png = await renderPng(element);
    return pngResponse(png, "public, max-age=31536000, immutable");
  } catch (err) {
    console.error("OG image generation error:", err);
    try {
      const logo = await loadLogo();
      const png = await renderPng(buildFallbackImage(logo));
      return pngResponse(png, "public, max-age=3600");
    } catch (fallbackErr) {
      console.error("Fallback PNG also failed:", fallbackErr);
      return new Response("Image generation failed", {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
});
