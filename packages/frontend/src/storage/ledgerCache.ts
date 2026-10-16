const HISTORY_PREFIX = 'ledgerlens.history.';
const SESSION_KEY = 'ledgerlens.session';

export type WorkspaceSession = {
  appMode: 'conveyor' | 'workspace';
  currentTab: string;
  removedCoins: string[];
};

export function readHistory<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeHistory(key: string, value: unknown): void {
  try {
    localStorage.setItem(HISTORY_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota / private mode — live API data still persists in SQLite.
  }
}

export function clearHistory(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(HISTORY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

export function readSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSession;
  } catch {
    return null;
  }
}

export function writeSession(session: WorkspaceSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}
