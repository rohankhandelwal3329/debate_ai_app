const SESSION_KEY = 'debate_user_session';
const DEBATE_SESSION_KEY = 'debate_session_id';

export type UserData = { name: string; pantherId: string; email: string };

export function saveUserSession(user: UserData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function loadUserSession(): UserData | null {
  const d = sessionStorage.getItem(SESSION_KEY);
  return d ? JSON.parse(d) : null;
}

export function clearUserSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DEBATE_SESSION_KEY);
}

export function saveDebateSessionId(id: string) {
  sessionStorage.setItem(DEBATE_SESSION_KEY, id);
}

export function getDebateSessionId(): string | null {
  return sessionStorage.getItem(DEBATE_SESSION_KEY);
}

export function clearDebateSessionId() {
  sessionStorage.removeItem(DEBATE_SESSION_KEY);
}
