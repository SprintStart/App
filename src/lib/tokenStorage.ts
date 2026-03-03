interface TokenData {
  token: string;
  signature: string;
  expiresAt: string;
  rewardType: string;
  issuedAt: number;
}

interface TokenUnlock {
  token: string;
  usedAt: number;
  rewardType: string;
}

const STORAGE_KEYS = {
  TOKENS: 'ss_tokens',
  UNLOCKS: 'ss_token_unlocks',
  DAILY_COUNT: 'ss_token_daily_count',
  DAILY_RESET: 'ss_token_daily_reset'
} as const;

const DEFAULT_MAX_DAILY_TOKENS = 3;

export function getStoredTokens(): TokenData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TOKENS);
    if (!stored) return [];
    const tokens = JSON.parse(stored) as TokenData[];
    const now = Date.now();
    const valid = tokens.filter(t => new Date(t.expiresAt).getTime() > now);
    if (valid.length !== tokens.length) {
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function storeToken(tokenData: TokenData): void {
  try {
    const tokens = getStoredTokens();
    tokens.push(tokenData);
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  } catch (error) {
    console.error('Failed to store token:', error);
  }
}

export function removeToken(token: string): void {
  try {
    const tokens = getStoredTokens().filter(t => t.token !== token);
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
}

export function getDailyTokenCount(): number {
  try {
    const resetTime = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    if (!resetTime || parseInt(resetTime) < todayStart) {
      localStorage.setItem(STORAGE_KEYS.DAILY_COUNT, '0');
      localStorage.setItem(STORAGE_KEYS.DAILY_RESET, todayStart.toString());
      return 0;
    }

    const count = localStorage.getItem(STORAGE_KEYS.DAILY_COUNT);
    return count ? parseInt(count) : 0;
  } catch {
    return 0;
  }
}

export function incrementDailyTokenCount(): void {
  try {
    const current = getDailyTokenCount();
    localStorage.setItem(STORAGE_KEYS.DAILY_COUNT, (current + 1).toString());
  } catch (error) {
    console.error('Failed to increment daily count:', error);
  }
}

export function canIssueTokenToday(maxDaily: number = DEFAULT_MAX_DAILY_TOKENS): boolean {
  return getDailyTokenCount() < maxDaily;
}

export function storeTokenUnlock(unlock: TokenUnlock): void {
  try {
    const unlocks = getTokenUnlocks();
    unlocks.push(unlock);
    localStorage.setItem(STORAGE_KEYS.UNLOCKS, JSON.stringify(unlocks));
  } catch (error) {
    console.error('Failed to store unlock:', error);
  }
}

export function getTokenUnlocks(): TokenUnlock[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.UNLOCKS);
    if (!stored) return [];
    return JSON.parse(stored) as TokenUnlock[];
  } catch {
    return [];
  }
}

export function hasActiveUnlock(rewardType: string): boolean {
  const unlocks = getTokenUnlocks();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  return unlocks.some(u =>
    u.rewardType === rewardType &&
    (now - u.usedAt) < twentyFourHours
  );
}

export function cleanupExpiredData(): void {
  getStoredTokens();
}
