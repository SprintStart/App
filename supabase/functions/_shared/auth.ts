import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export interface AuthResult {
  user: {
    id: string;
    email?: string;
    [key: string]: any;
  };
  supabase: ReturnType<typeof createClient>;
}

export interface AuthError {
  code: string;
  message: string;
  status: number;
}

/**
 * Validates JWT token from Authorization header and returns authenticated user.
 * This is the ONLY way edge functions should validate auth.
 *
 * @param req - The incoming request
 * @returns AuthResult with user and supabase client, or throws AuthError
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    throw {
      code: "NO_AUTH_HEADER",
      message: "Missing Authorization header",
      status: 401,
    } as AuthError;
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw {
      code: "INVALID_AUTH_FORMAT",
      message: "Authorization header must be 'Bearer <token>'",
      status: 401,
    } as AuthError;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token || token.length < 20) {
    throw {
      code: "INVALID_TOKEN",
      message: "Token is empty or too short",
      status: 401,
    } as AuthError;
  }

  // Create Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  // Verify token and get user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    console.error("[Auth] Token validation failed:", error);
    throw {
      code: "INVALID_JWT",
      message: error.message || "Invalid JWT token",
      status: 401,
    } as AuthError;
  }

  if (!user) {
    throw {
      code: "NO_USER",
      message: "No user found for token",
      status: 401,
    } as AuthError;
  }

  return { user, supabase };
}

/**
 * Helper to create error response
 */
export function createErrorResponse(
  error: AuthError,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: error.code,
      message: error.message,
    }),
    {
      status: error.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
