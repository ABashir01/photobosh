import { API_BASE_URL } from "./config";
import type {
  BackgroundDefinition,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomStateSnapshot,
  TemplateDefinition,
} from "./types";

const baseHeaders = {
  "Content-Type": "application/json",
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ detail: "Request failed." }))) as {
      detail?: string;
    };
    throw new Error(payload.detail ?? "Request failed.");
  }
  return (await response.json()) as T;
}

export async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rooms`, { method: "POST" });
  return parseJson<CreateRoomResponse>(response);
}

export async function joinRoom(
  roomId: string,
  displayName: string,
  hostToken?: string,
): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ displayName, hostToken }),
  });
  return parseJson<JoinRoomResponse>(response);
}

export async function getRoom(roomId: string): Promise<RoomStateSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`);
  return parseJson<RoomStateSnapshot>(response);
}

export async function listBackgrounds(): Promise<BackgroundDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/api/backgrounds`);
  return parseJson<{ items: BackgroundDefinition[] }>(response).then((payload) => payload.items);
}

export async function listTemplates(): Promise<TemplateDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/api/templates`);
  return parseJson<{ items: TemplateDefinition[] }>(response).then((payload) => payload.items);
}

export async function setReady(roomId: string, participantToken: string, ready: boolean): Promise<RoomStateSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/ready`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "X-Participant-Token": participantToken,
    },
    body: JSON.stringify({ ready }),
  });
  return parseJson<RoomStateSnapshot>(response);
}

export async function setBackground(
  roomId: string,
  hostToken: string,
  backgroundId: string,
): Promise<RoomStateSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/background`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "X-Host-Token": hostToken,
    },
    body: JSON.stringify({ backgroundId }),
  });
  return parseJson<RoomStateSnapshot>(response);
}

export async function startRoom(roomId: string, hostToken: string): Promise<RoomStateSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/start`, {
    method: "POST",
    headers: {
      "X-Host-Token": hostToken,
    },
  });
  return parseJson<RoomStateSnapshot>(response);
}

export async function uploadShot(
  roomId: string,
  participantToken: string,
  shotIndex: number,
  file: Blob,
): Promise<RoomStateSnapshot> {
  const formData = new FormData();
  formData.append("file", file, `shot-${shotIndex}.png`);
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/shots/${shotIndex}`, {
    method: "POST",
    headers: {
      "X-Participant-Token": participantToken,
    },
    body: formData,
  });
  return parseJson<RoomStateSnapshot>(response);
}

export async function uploadCompositeShot(
  roomId: string,
  hostToken: string,
  shotIndex: number,
  file: Blob,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file, `composite-shot-${shotIndex}.png`);
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/composite-shots/${shotIndex}`, {
    method: "POST",
    headers: {
      "X-Host-Token": hostToken,
    },
    body: formData,
  });
  await parseJson<{ ok: boolean }>(response);
}

export async function setTemplate(
  roomId: string,
  hostToken: string,
  templateId: string,
): Promise<RoomStateSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/template`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "X-Host-Token": hostToken,
    },
    body: JSON.stringify({ templateId }),
  });
  return parseJson<RoomStateSnapshot>(response);
}
