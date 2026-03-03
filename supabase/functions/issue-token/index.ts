import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IssueTokenRequest {
  quizId?: string;
  runId?: string;
  deviceNonce: string;
}

interface IssueTokenResponse {
  token: string;
  signature: string;
  expiresAt: string;
  rewardType: string;
}

const REWARD_TYPES = [
  'challenge_mode',
  'bonus_quiz',
  'premium_skin',
  'power_up'
] as const;

const TOKEN_SECRET = Deno.env.get('TOKEN_SECRET');
const DEFAULT_EXPIRY_HOURS = 24;
const MAX_DEVICE_NONCE_LENGTH = 128;

if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
  throw new Error('TOKEN_SECRET must be set and at least 32 characters long');
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = 'SS-';
  const randomValues = new Uint8Array(6);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < 6; i++) {
    token += chars.charAt(randomValues[i] % chars.length);
  }
  return token;
}

function selectRandomReward(): string {
  const randomValues = new Uint8Array(1);
  crypto.getRandomValues(randomValues);
  return REWARD_TYPES[randomValues[0] % REWARD_TYPES.length];
}

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
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: IssueTokenRequest = await req.json();

    if (!body.deviceNonce || body.deviceNonce.length < 8 || body.deviceNonce.length > MAX_DEVICE_NONCE_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Invalid device nonce length" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = generateToken();
    const rewardType = selectRandomReward();
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const signatureData = `${token}:${expiresAt}:${rewardType}:${body.deviceNonce}`;
    const signature = await generateSignature(signatureData);

    const response: IssueTokenResponse = {
      token,
      signature,
      expiresAt,
      rewardType,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error issuing token:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
