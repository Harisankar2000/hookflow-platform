export interface Session {
  apiUrl: string;
  apiKey: string;
}

const STORAGE_KEY = 'hookflow.session';
export const DEFAULT_API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3200';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the session simply lasts until reload.
  }
}
