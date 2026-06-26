from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RoomPhase = Literal[
    "lobby",
    "waiting_room",
    "countdown",
    "uploading",
    "template_selection",
    "final_ready",
    "expired",
]


class ParticipantSnapshot(BaseModel):
    id: str
    displayName: str
    isHost: bool
    ready: bool
    peerState: str
    connectionState: str
    joinedAt: int


class RoomStateSnapshot(BaseModel):
    roomId: str
    phase: RoomPhase
    participants: list[ParticipantSnapshot]
    selectedBackgroundId: str
    selectedTemplateId: str | None
    previewStripUrl: str | None = None
    shotSchedule: list[int] = Field(default_factory=list)
    uploadsReceived: dict[str, list[bool]] = Field(default_factory=dict)
    finalStripUrl: str | None = None
    expiresAt: int


class CreateRoomResponse(BaseModel):
    roomId: str
    joinUrl: str
    hostToken: str
    expiresAt: int


class JoinRoomRequest(BaseModel):
    displayName: str = Field(min_length=1, max_length=40)
    hostToken: str | None = None


class JoinRoomResponse(BaseModel):
    participantId: str
    participantToken: str
    rtcConfig: dict
    roomState: RoomStateSnapshot


class ReadyRequest(BaseModel):
    ready: bool


class BackgroundSelectionRequest(BaseModel):
    backgroundId: str


class TemplateSelectionRequest(BaseModel):
    templateId: str


class WebSocketEnvelope(BaseModel):
    type: str
    roomId: str
    participantId: str | None = None
    payload: dict = Field(default_factory=dict)
    serverTs: int

