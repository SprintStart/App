import { FEATURE_LOW_BANDWIDTH_MODE } from './featureFlags';

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  if (!FEATURE_LOW_BANDWIDTH_MODE) {
    return fetch(url, options);
  }

  try {
    const response = await fetch(url, options);

    if (
      response.status === 429 ||
      (response.status >= 500 && response.status < 600)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const retryResponse = await fetch(url, options);

      if (
        !retryResponse.ok &&
        (retryResponse.status === 429 || retryResponse.status >= 500)
      ) {
        throw new RetryableError('Connection unstable — tap retry');
      }

      return retryResponse;
    }

    return response;
  } catch (error) {
    if (error instanceof RetryableError) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      return await fetch(url, options);
    } catch (retryError) {
      throw new RetryableError('Connection unstable — tap retry');
    }
  }
}
