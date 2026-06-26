import type { SessionRecord } from "../types";

const storageKey = (roomId: string) => `photobosh:${roomId}`;

export function loadSession(roomId: string): SessionRecord | null {
  const raw = sessionStorage.getItem(storageKey(roomId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionRecord): void {
  sessionStorage.setItem(storageKey(session.roomId), JSON.stringify(session));
}

export function clearSession(roomId: string): void {
  sessionStorage.removeItem(storageKey(roomId));
}

