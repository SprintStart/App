const SESSION_KEY = 'immersiq_session_id';

export function getOrCreateSession(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
