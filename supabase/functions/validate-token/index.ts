import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ValidateTokenRequest {
  token: string;
  signature: string;
  expiresAt: string;
  rewardType: string;
  deviceNonce: string;
}

interface ValidateTokenResponse {
  ok: boolean;
  rewardType?: string;
  error?: string;
}

const TOKEN_SECRET = Deno.env.get('TOKEN_SECRET');
const MAX_DEVICE_NONCE_LENGTH = 128;

const REWARD_TYPES_ALLOWLIST = [
  'challenge_mode',
  'bonus_quiz',
  'premium_skin',
  'power_up'
];

if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
  throw new Error('TOKEN_SECRET must be set and at least 32 characters long');
}

const usedTokens = new Map<string, number>();

async function generateSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(TOKEN_SECRET);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const messageData = encoder.encode(data);
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }

  return result === 0;
}

async function hashTokenForReplay(token: string, signature: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${token}:${signature}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function cleanupUsedTokens(): void {
  const now = Date.now();
  const twentyFiveHours = 25 * 60 * 60 * 1000;

  for (const [hash, timestamp] of usedTokens.entries()) {
    if (now - timestamp > twentyFiveHours) {
      usedTokens.delete(hash);
    }
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
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: ValidateTokenRequest = await req.json();

    if (!body.token || !body.signature || !body.expiresAt || !body.rewardType || !body.deviceNonce) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!REWARD_TYPES_ALLOWLIST.includes(body.rewardType)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid reward type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.deviceNonce.length < 8 || body.deviceNonce.length > MAX_DEVICE_NONCE_LENGTH) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid device nonce length" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.token.startsWith('SS-') || body.token.length < 8) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const expiryTime = new Date(body.expiresAt).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const signatureData = `${body.token}:${body.expiresAt}:${body.rewardType}:${body.deviceNonce}`;
    const expectedSignature = await generateSignature(signatureData);

    const isSignatureValid = await timingSafeEqual(body.signature, expectedSignature);
    if (!isSignatureValid) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid signature" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenHash = await hashTokenForReplay(body.token, body.signature);
    cleanupUsedTokens();

    if (usedTokens.has(tokenHash)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token already used" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    usedTokens.set(tokenHash, Date.now());

    const response: ValidateTokenResponse = {
      ok: true,
      rewardType: body.rewardType,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error validating token:', error);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
