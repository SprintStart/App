import { FEATURE_LOW_BANDWIDTH_MODE } from './featureFlags';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const TTL = 10 * 60 * 1000;

export function getCached<T>(key: string): T | null {
  if (!FEATURE_LOW_BANDWIDTH_MODE) return null;

  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    if (Date.now() - entry.timestamp > TTL) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  if (!FEATURE_LOW_BANDWIDTH_MODE) return;

  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export function clearCache(key?: string): void {
  if (!FEATURE_LOW_BANDWIDTH_MODE) return;

  try {
    if (key) {
      localStorage.removeItem(`cache_${key}`);
    } else {
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('cache_')) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}
