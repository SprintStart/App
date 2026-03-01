import { supabase } from './supabase';

export interface FunctionError {
  error: string;
  message: string;
}

export interface FunctionResponse<T> {
  data: T | null;
  error: FunctionError | null;
}

/**
 * Makes an authenticated request to a Supabase Edge Function.
 * Handles token refresh automatically on 401.
 *
 * @param functionName - Name of the edge function (e.g., 'get-teacher-dashboard-metrics')
 * @param params - Optional query parameters or request body
 * @param options - Optional fetch options (method, etc.)
 */
export async function callFunction<T>(
  functionName: string,
  params?: Record<string, any>,
  options: { method?: 'GET' | 'POST' } = {}
): Promise<FunctionResponse<T>> {
  const method = options.method || 'GET';

  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    console.error('[functionsFetch] No valid session');
    return {
      data: null,
      error: {
        error: 'NO_SESSION',
        message: 'You must be logged in to access this resource'
      }
    };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  const makeRequest = async (token: string): Promise<Response> => {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let finalUrl = url;
    let body: string | undefined;

    if (method === 'GET' && params) {
      const queryParams = new URLSearchParams(params).toString();
      finalUrl = `${url}?${queryParams}`;
    } else if (method === 'POST' && params) {
      body = JSON.stringify(params);
    }

    console.log(`[functionsFetch] ${method} ${functionName}`, {
      hasToken: !!token,
      tokenPrefix: token.substring(0, 20) + '...'
    });

    return fetch(finalUrl, {
      method,
      headers,
      body,
    });
  };

  try {
    // First attempt with current token
    let response = await makeRequest(session.access_token);

    // If 401, refresh token and retry once
    if (response.status === 401) {
      console.log('[functionsFetch] Got 401, refreshing session...');

      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !newSession?.access_token) {
        console.error('[functionsFetch] Session refresh failed:', refreshError);
        return {
          data: null,
          error: {
            error: 'SESSION_EXPIRED',
            message: 'Your session has expired. Please log in again.'
          }
        };
      }

      console.log('[functionsFetch] Session refreshed, retrying request...');
      response = await makeRequest(newSession.access_token);
    }

    // Parse response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'UNKNOWN_ERROR',
        message: `Request failed with status ${response.status}`
      }));

      console.error(`[functionsFetch] Error response from ${functionName}:`, errorData);

      return {
        data: null,
        error: errorData
      };
    }

    const data = await response.json();
    console.log(`[functionsFetch] Success from ${functionName}`);

    return {
      data,
      error: null
    };

  } catch (error) {
    console.error(`[functionsFetch] Network error calling ${functionName}:`, error);
    return {
      data: null,
      error: {
        error: 'NETWORK_ERROR',
        message: 'Failed to connect to server. Please check your internet connection.'
      }
    };
  }
}
