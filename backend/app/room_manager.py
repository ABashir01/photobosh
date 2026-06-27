from __future__ import annotations

import asyncio
import secrets
import shutil
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, UploadFile, WebSocket

from app.assets import get_background, get_template, list_backgrounds, list_templates
from app.config import Settings
from app.models import ParticipantSnapshot, RoomStateSnapshot, WebSocketEnvelope
from app.rendering import render_strip


def now_ms() -> int:
    return int(datetime.now(tz=UTC).timestamp() * 1000)


@dataclass
class Participant:
    id: str
    token: str
    display_name: str
    is_host: bool
    ready: bool = False
    peer_state: str = "idle"
    connection_state: str = "disconnected"
    joined_at: int = field(default_factory=now_ms)


@dataclass
class Room:
    id: str
    host_token: str
    phase: str
    participants: dict[str, Participant]
    selected_background_id: str
    selected_template_id: str | None
    preview_strip_url: str | None
    shot_schedule: list[int]
    uploads_received: dict[str, list[bool]]
    final_strip_url: str | None
    expires_at: int


class RoomManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.rooms: dict[str, Room] = {}
        self.sockets: dict[str, dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()

    def get_rtc_config(self) -> dict:
        return {
            "iceServers": [
                {"urls": [f"stun:{self.settings.turn_public_host}:{self.settings.turn_port}"]},
                {
                    "urls": [
                        f"turn:{self.settings.turn_public_host}:{self.settings.turn_port}?transport=udp",
                        f"turns:{self.settings.turn_public_host}:{self.settings.turn_tls_port}?transport=tcp",
                    ],
                    "username": self.settings.turn_username,
                    "credential": self.settings.turn_password,
                },
            ]
        }

    def _expires_at(self) -> int:
        return int((datetime.now(tz=UTC) + timedelta(hours=self.settings.room_ttl_hours)).timestamp() * 1000)

    def _room_dir(self, room_id: str) -> Path:
        return self.settings.generated_asset_dir / room_id

    def _participant_by_token(self, room: Room, token: str) -> Participant:
        for participant in room.participants.values():
            if participant.token == token:
                return participant
        raise HTTPException(status_code=401, detail="Invalid participant token.")

    def _require_room(self, room_id: str) -> Room:
        room = self.rooms.get(room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found.")
        if room.expires_at < now_ms():
            room.phase = "expired"
            raise HTTPException(status_code=410, detail="Room expired.")
        return room

    def _to_snapshot(self, room: Room) -> RoomStateSnapshot:
        participants = sorted(room.participants.values(), key=lambda participant: participant.joined_at)
        return RoomStateSnapshot(
            roomId=room.id,
            phase=room.phase,  # type: ignore[arg-type]
            participants=[
                ParticipantSnapshot(
                    id=participant.id,
                    displayName=participant.display_name,
                    isHost=participant.is_host,
                    ready=participant.ready,
                    peerState=participant.peer_state,
                    connectionState=participant.connection_state,
                    joinedAt=participant.joined_at,
                )
                for participant in participants
            ],
            selectedBackgroundId=room.selected_background_id,
            selectedTemplateId=room.selected_template_id,
            previewStripUrl=room.preview_strip_url,
            shotSchedule=room.shot_schedule,
            uploadsReceived=room.uploads_received,
            finalStripUrl=room.final_strip_url,
            expiresAt=room.expires_at,
        )

    async def create_room(self) -> dict:
        async with self._lock:
            room_id = secrets.token_urlsafe(6)
            host_token = secrets.token_urlsafe(18)
            room = Room(
                id=room_id,
                host_token=host_token,
                phase="lobby",
                participants={},
                selected_background_id=list_backgrounds()[0]["id"],
                selected_template_id=list_templates()[0]["id"],
                preview_strip_url=None,
                shot_schedule=[],
                uploads_received={},
                final_strip_url=None,
                expires_at=self._expires_at(),
            )
            self.rooms[room_id] = room
            self.sockets[room_id] = {}
        return {
            "roomId": room.id,
            "joinUrl": f"{self.settings.app_base_url}?room={room.id}",
            "hostToken": room.host_token,
            "expiresAt": room.expires_at,
        }

    async def join_room(self, room_id: str, display_name: str, host_token: str | None = None) -> dict:
        async with self._lock:
            room = self._require_room(room_id)
            if len(room.participants) >= self.settings.max_room_participants:
                raise HTTPException(status_code=409, detail="Room is full.")
            participant_id = secrets.token_urlsafe(8)
            participant = Participant(
                id=participant_id,
                token=secrets.token_urlsafe(18),
                display_name=display_name.strip(),
                is_host=host_token == room.host_token and not any(
                    existing.is_host for existing in room.participants.values()
                ),
            )
            room.participants[participant_id] = participant
            room.uploads_received[participant_id] = [False, False, False, False]
            room.phase = "waiting_room"
            room.expires_at = self._expires_at()
            snapshot = self._to_snapshot(room)

        await self.broadcast_room_state(room_id)
        return {
            "participantId": participant.id,
            "participantToken": participant.token,
            "rtcConfig": self.get_rtc_config(),
            "roomState": snapshot.model_dump(),
        }

    async def get_room_snapshot(self, room_id: str) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            return self._to_snapshot(room)

    async def set_ready(self, room_id: str, participant_token: str, ready: bool) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            participant = self._participant_by_token(room, participant_token)
            participant.ready = ready
            room.expires_at = self._expires_at()
            snapshot = self._to_snapshot(room)
        await self.broadcast_room_state(room_id)
        return snapshot

    async def update_peer_state(self, room_id: str, participant_id: str, state: str) -> None:
        async with self._lock:
            room = self._require_room(room_id)
            participant = room.participants.get(participant_id)
            if participant is None:
                return
            participant.peer_state = state
        await self.broadcast_room_state(room_id)

    async def update_background(self, room_id: str, host_token: str, background_id: str) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            if host_token != room.host_token:
                raise HTTPException(status_code=403, detail="Host token required.")
            get_background(background_id)
            room.selected_background_id = background_id
            snapshot = self._to_snapshot(room)
        await self.broadcast_room_state(room_id)
        return snapshot

    async def start_room(self, room_id: str, host_token: str) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            if host_token != room.host_token:
                raise HTTPException(status_code=403, detail="Host token required.")
            ready_participants = [participant for participant in room.participants.values() if participant.ready]
            if len(ready_participants) != 2:
                raise HTTPException(status_code=409, detail="Both participants must be ready.")
            start_at = now_ms() + (self.settings.room_countdown_seconds * 1000)
            room.shot_schedule = [
                start_at + index * self.settings.shot_interval_seconds * 1000 for index in range(4)
            ]
            room.phase = "countdown"
            room.preview_strip_url = None
            room.final_strip_url = None
            room.expires_at = self._expires_at()
            for participant_id in room.uploads_received:
                room.uploads_received[participant_id] = [False, False, False, False]
            snapshot = self._to_snapshot(room)
        await self.broadcast_room_state(room_id)
        return snapshot

    async def save_shot_upload(
        self,
        room_id: str,
        shot_index: int,
        participant_token: str,
        upload: UploadFile,
    ) -> RoomStateSnapshot:
        if shot_index < 0 or shot_index > 3:
            raise HTTPException(status_code=400, detail="Invalid shot index.")
        content = await upload.read()
        if len(content) > self.settings.upload_max_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Upload too large.")

        render_template_id: str | None = None
        async with self._lock:
            room = self._require_room(room_id)
            participant = self._participant_by_token(room, participant_token)
            room_dir = self._room_dir(room_id) / "shots"
            room_dir.mkdir(parents=True, exist_ok=True)
            file_path = room_dir / f"{participant.id}_shot_{shot_index}.png"
            file_path.write_bytes(content)
            room.uploads_received[participant.id][shot_index] = True
            if all(all(shot_flags) for shot_flags in room.uploads_received.values()):
                room.phase = "template_selection"
                render_template_id = room.selected_template_id or list_templates()[0]["id"]
            room.expires_at = self._expires_at()

        if render_template_id is not None:
            await self._render_template_outputs(room_id, render_template_id)
        await self.broadcast_room_state(room_id)
        return await self.get_room_snapshot(room_id)

    async def save_composite_shot(
        self,
        room_id: str,
        shot_index: int,
        host_token: str,
        upload: UploadFile,
    ) -> None:
        if shot_index < 0 or shot_index > 3:
            raise HTTPException(status_code=400, detail="Invalid shot index.")
        content = await upload.read()
        if len(content) > self.settings.upload_max_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Upload too large.")
        async with self._lock:
            room = self._require_room(room_id)
            if host_token != room.host_token:
                raise HTTPException(status_code=403, detail="Host token required.")
            room_dir = self._room_dir(room_id) / "composite_shots"
            room_dir.mkdir(parents=True, exist_ok=True)
            file_path = room_dir / f"composite_shot_{shot_index}.png"
            file_path.write_bytes(content)
            room.expires_at = self._expires_at()

    async def update_template(self, room_id: str, host_token: str, template_id: str) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            if host_token != room.host_token:
                raise HTTPException(status_code=403, detail="Host token required.")
            get_template(template_id)
            room.selected_template_id = template_id
        await self._render_template_outputs(room_id, template_id)
        await self.broadcast_room_state(room_id)
        return await self.get_room_snapshot(room_id)

    async def finalize_room(self, room_id: str, host_token: str) -> RoomStateSnapshot:
        async with self._lock:
            room = self._require_room(room_id)
            if host_token != room.host_token:
                raise HTTPException(status_code=403, detail="Host token required.")
            template_id = room.selected_template_id or list_templates()[0]["id"]
        _, final_url = await self._render_template_outputs(room_id, template_id)
        async with self._lock:
            room = self._require_room(room_id)
            room.final_strip_url = final_url
            room.phase = "final_ready"
        await self.broadcast_room_state(room_id)
        return await self.get_room_snapshot(room_id)

    async def _render_preview(self, room_id: str, template_id: str) -> str:
        preview_url = await self._render_strip(room_id, template_id, "preview")
        async with self._lock:
            room = self._require_room(room_id)
            room.preview_strip_url = preview_url
        return preview_url

    async def _render_template_outputs(self, room_id: str, template_id: str) -> tuple[str, str]:
        preview_url = await self._render_strip(room_id, template_id, "preview")
        final_url = await self._render_strip(room_id, template_id, "final")
        async with self._lock:
            room = self._require_room(room_id)
            room.preview_strip_url = preview_url
            room.final_strip_url = final_url
        return preview_url, final_url

    async def _render_strip(self, room_id: str, template_id: str, variant: str) -> str:
        async with self._lock:
            room = self._require_room(room_id)
            background = get_background(room.selected_background_id)
            template = get_template(template_id)
            participants = sorted(room.participants.values(), key=lambda participant: participant.joined_at)
            shot_paths = {
                (participant.id, shot_index): self._room_dir(room_id) / "shots" / f"{participant.id}_shot_{shot_index}.png"
                for participant in participants
                for shot_index in range(4)
            }
            composite_paths = {
                shot_index: self._room_dir(room_id) / "composite_shots" / f"composite_shot_{shot_index}.png"
                for shot_index in range(4)
            }
            output_path = self._room_dir(room_id) / f"{variant}_{template_id}.png"
        render_strip(
            output_path,
            background,
            template,
            [participant.id for participant in participants],
            shot_paths,
            composite_paths,
        )
        return f"/generated/{room_id}/{output_path.name}"

    async def register_socket(self, room_id: str, participant_token: str, websocket: WebSocket) -> tuple[Room, Participant]:
        await websocket.accept()
        async with self._lock:
            room = self._require_room(room_id)
            participant = self._participant_by_token(room, participant_token)
            participant.connection_state = "connected"
            self.sockets.setdefault(room_id, {})[participant.id] = websocket
        await self.broadcast_room_state(room_id)
        return room, participant

    async def unregister_socket(self, room_id: str, participant_id: str) -> None:
        async with self._lock:
            room = self.rooms.get(room_id)
            if room is None:
                return
            participant = room.participants.get(participant_id)
            if participant is not None:
                participant.connection_state = "disconnected"
                participant.ready = False
                participant.peer_state = "idle"
            self.sockets.get(room_id, {}).pop(participant_id, None)
        await self.broadcast_room_state(room_id)

    async def send_signal(self, room_id: str, sender_id: str, target_id: str, signal: dict) -> None:
        socket = self.sockets.get(room_id, {}).get(target_id)
        if socket is None:
            return
        envelope = WebSocketEnvelope(
            type="room.signal",
            roomId=room_id,
            participantId=sender_id,
            payload={"signal": signal},
            serverTs=now_ms(),
        )
        await socket.send_json(envelope.model_dump())

    async def broadcast_room_state(self, room_id: str) -> None:
        room = self.rooms.get(room_id)
        if room is None:
            return
        envelope = WebSocketEnvelope(
            type="room.state",
            roomId=room_id,
            payload={"roomState": self._to_snapshot(room).model_dump()},
            serverTs=now_ms(),
        )
        dead_participants: list[str] = []
        for participant_id, socket in list(self.sockets.get(room_id, {}).items()):
            try:
                await socket.send_json(envelope.model_dump())
            except Exception:
                dead_participants.append(participant_id)
        for participant_id in dead_participants:
            self.sockets.get(room_id, {}).pop(participant_id, None)

    async def cleanup_expired(self) -> None:
        expired_ids: list[str] = []
        current_time = now_ms()
        async with self._lock:
            for room_id, room in list(self.rooms.items()):
                if room.expires_at < current_time:
                    expired_ids.append(room_id)
            for room_id in expired_ids:
                self.rooms.pop(room_id, None)
                self.sockets.pop(room_id, None)

        for room_id in expired_ids:
            room_dir = self._room_dir(room_id)
            if room_dir.exists():
                shutil.rmtree(room_dir, ignore_errors=True)
