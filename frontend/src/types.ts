export type RoomPhase =
  | "lobby"
  | "waiting_room"
  | "countdown"
  | "uploading"
  | "template_selection"
  | "final_ready"
  | "expired";

export type ParticipantSnapshot = {
  id: string;
  displayName: string;
  isHost: boolean;
  ready: boolean;
  peerState: string;
  connectionState: string;
  joinedAt: number;
};

export type BackgroundDefinition = {
  id: string;
  name: string;
  description: string;
  gradient: string[];
  accents: Array<{ x: number; y: number; radius: number; color: string }>;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  paperColor: string;
  panelColor: string;
  accentColor: string;
  textColor: string;
  title: string;
};

export type RoomStateSnapshot = {
  roomId: string;
  phase: RoomPhase;
  participants: ParticipantSnapshot[];
  selectedBackgroundId: string;
  selectedTemplateId: string | null;
  previewStripUrl: string | null;
  shotSchedule: number[];
  uploadsReceived: Record<string, boolean[]>;
  finalStripUrl: string | null;
  expiresAt: number;
};

export type CreateRoomResponse = {
  roomId: string;
  joinUrl: string;
  hostToken: string;
  expiresAt: number;
};

export type JoinRoomResponse = {
  participantId: string;
  participantToken: string;
  rtcConfig: RTCConfiguration;
  roomState: RoomStateSnapshot;
};

export type SessionRecord = {
  roomId: string;
  participantId: string;
  participantToken: string;
  displayName: string;
  hostToken?: string;
  rtcConfig?: RTCConfiguration;
};
