import type { RoomStateSnapshot, SessionRecord } from "./types";

export type AppState = {
  roomState: RoomStateSnapshot | null;
  backgrounds: Array<{ id: string; name: string; description: string; gradient: string[]; accents: Array<{ x: number; y: number; radius: number; color: string }> }>;
  templates: Array<{ id: string; name: string; description: string; paperColor: string; panelColor: string; accentColor: string; textColor: string; title: string }>;
  session: SessionRecord | null;
  joinUrl: string | null;
  localReady: boolean;
  error: string | null;
};

export type AppAction =
  | { type: "bootstrap"; payload: Partial<AppState> }
  | { type: "room-state"; payload: RoomStateSnapshot }
  | { type: "set-session"; payload: SessionRecord | null }
  | { type: "set-assets"; payload: Pick<AppState, "backgrounds" | "templates"> }
  | { type: "set-ready"; payload: boolean }
  | { type: "set-error"; payload: string | null };

export const initialAppState: AppState = {
  roomState: null,
  backgrounds: [],
  templates: [],
  session: null,
  joinUrl: null,
  localReady: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "bootstrap":
      return { ...state, ...action.payload };
    case "room-state":
      return { ...state, roomState: action.payload };
    case "set-session":
      return { ...state, session: action.payload };
    case "set-assets":
      return { ...state, backgrounds: action.payload.backgrounds, templates: action.payload.templates };
    case "set-ready":
      return { ...state, localReady: action.payload };
    case "set-error":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

