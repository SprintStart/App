import { supabase } from './supabase';

/**
 * Shared authenticated fetch helper for all Supabase Edge Function and REST API calls
 *
 * This helper ensures ALL API calls include the required headers:
 * - Authorization: Bearer {access_token}
 * - apikey: {anon_key}
 * - Content-Type: application/json
 */

interface AuthenticatedFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

interface AuthenticatedFetchResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Get the current access token from the session
 * Returns null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[Auth] Failed to get session:', error);
    return null;
  }

  if (!session) {
    console.warn('[Auth] No active session found');
    return null;
  }

  return session.access_token;
}

/**
 * Make an authenticated request to a Supabase Edge Function or REST endpoint
 *
 * @param url - Full URL to the endpoint
 * @param options - Request options (method, body)
 * @returns Promise with data or error
 *
 * @example
 * ```typescript
 * const { data, error } = await authenticatedFetch<MetricsData>(
 *   `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-teacher-dashboard-metrics`,
 *   { method: 'GET' }
 * );
 * ```
 */
export async function authenticatedFetch<T = any>(
  url: string,
  options: AuthenticatedFetchOptions = {}
): Promise<AuthenticatedFetchResult<T>> {
  const { method = 'GET', body } = options;

  // Get access token
  const token = await getAccessToken();

  if (!token) {
    console.error('[AuthFetch] No access token available');
    return {
      data: null,
      error: new Error('Authentication required. Please log in again.')
    };
  }

  // Get API key from environment
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!apiKey) {
    console.error('[AuthFetch] Missing VITE_SUPABASE_ANON_KEY');
    return {
      data: null,
      error: new Error('Configuration error: Missing API key')
    };
  }

  // Build headers - BOTH Authorization AND apikey are REQUIRED
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'apikey': apiKey,
    'Content-Type': 'application/json',
  };

  // Debug logging (DO NOT log the token itself)
  console.log(`[AuthFetch] ${method} ${url}`);
  console.log('[AuthFetch] Headers:', {
    'Authorization': 'Bearer ****',
    'apikey': '****',
    'Content-Type': 'application/json'
  });

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`[AuthFetch] Response status: ${response.status}`);

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error('[AuthFetch] Error response:', errorData);
      } catch (parseError) {
        // Response body isn't JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      // Special handling for 401 - authentication failure
      if (response.status === 401) {
        console.error('[AuthFetch] 401 Unauthorized - attempting session refresh');

        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          console.error('[AuthFetch] Session refresh failed:', refreshError);
          return {
            data: null,
            error: new Error('Session expired. Please log in again.')
          };
        }

        console.log('[AuthFetch] Session refreshed successfully, retrying request...');

        // Get new access token and retry ONCE
        const newToken = refreshData.session.access_token;
        const retryHeaders: HeadersInit = {
          'Authorization': `Bearer ${newToken}`,
          'apikey': apiKey,
          'Content-Type': 'application/json',
        };

        try {
          const retryResponse = await fetch(url, {
            method,
            headers: retryHeaders,
            body: body ? JSON.stringify(body) : undefined,
          });

          console.log(`[AuthFetch] Retry response status: ${retryResponse.status}`);

          if (!retryResponse.ok) {
            let retryErrorMessage = `Retry failed with status ${retryResponse.status}`;
            try {
              const retryErrorData = await retryResponse.json();
              retryErrorMessage = retryErrorData.message || retryErrorData.error || retryErrorMessage;
            } catch (parseError) {
              retryErrorMessage = retryResponse.statusText || retryErrorMessage;
            }

            return {
              data: null,
              error: new Error(retryErrorMessage)
            };
          }

          // Retry succeeded!
          const retryData = await retryResponse.json();
          console.log('[AuthFetch] Retry succeeded');
          return {
            data: retryData,
            error: null
          };

        } catch (retryError) {
          console.error('[AuthFetch] Retry network error:', retryError);
          return {
            data: null,
            error: retryError instanceof Error ? retryError : new Error('Retry request failed')
          };
        }
      }

      return {
        data: null,
        error: new Error(errorMessage)
      };
    }

    // Parse successful response
    const data = await response.json();
    console.log('[AuthFetch] Success');

    return {
      data,
      error: null
    };

  } catch (error) {
    console.error('[AuthFetch] Network or parse error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Network request failed')
    };
  }
}

/**
 * Make an authenticated GET request with query parameters
 *
 * @param baseUrl - Base URL without query parameters
 * @param params - Query parameters as key-value pairs
 * @returns Promise with data or error
 *
 * @example
 * ```typescript
 * const { data, error } = await authenticatedGet<MetricsData>(
 *   `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-metrics`,
 *   { start_date: '2024-01-01', end_date: '2024-12-31' }
 * );
 * ```
 */
export async function authenticatedGet<T = any>(
  baseUrl: string,
  params?: Record<string, string>
): Promise<AuthenticatedFetchResult<T>> {
  let url = baseUrl;

  if (params) {
    const queryString = new URLSearchParams(params).toString();
    url = `${baseUrl}?${queryString}`;
  }

  return authenticatedFetch<T>(url, { method: 'GET' });
}

/**
 * Make an authenticated POST request
 */
export async function authenticatedPost<T = any>(
  url: string,
  body: any
): Promise<AuthenticatedFetchResult<T>> {
  return authenticatedFetch<T>(url, { method: 'POST', body });
}
