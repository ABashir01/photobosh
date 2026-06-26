from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.assets import list_backgrounds, list_templates
from app.config import Settings
from app.models import BackgroundSelectionRequest, JoinRoomRequest, ReadyRequest, TemplateSelectionRequest
from app.room_manager import RoomManager


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or Settings()
    manager = RoomManager(active_settings)
    active_settings.background_asset_dir.mkdir(parents=True, exist_ok=True)
    active_settings.template_asset_dir.mkdir(parents=True, exist_ok=True)
    active_settings.generated_asset_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        cleanup_task = asyncio.create_task(_cleanup_loop(manager, active_settings.cleanup_interval_seconds))
        try:
            yield
        finally:
            cleanup_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await cleanup_task

    app = FastAPI(title="Photobosh API", lifespan=lifespan)
    app.state.settings = active_settings
    app.state.manager = manager
    app.mount("/generated", StaticFiles(directory=str(active_settings.generated_asset_dir)), name="generated")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def healthcheck() -> dict:
        return {"ok": True}

    @app.get("/api/backgrounds")
    async def get_backgrounds() -> dict:
        return {"items": list_backgrounds()}

    @app.get("/api/templates")
    async def get_templates() -> dict:
        return {"items": list_templates()}

    @app.post("/api/rooms")
    async def create_room() -> dict:
        return await manager.create_room()

    @app.get("/api/rooms/{room_id}")
    async def get_room(room_id: str) -> dict:
        snapshot = await manager.get_room_snapshot(room_id)
        return snapshot.model_dump()

    @app.post("/api/rooms/{room_id}/join")
    async def join_room(room_id: str, payload: JoinRoomRequest) -> dict:
        return await manager.join_room(room_id, payload.displayName, payload.hostToken)

    @app.post("/api/rooms/{room_id}/ready")
    async def set_ready(room_id: str, payload: ReadyRequest, x_participant_token: str = Header(...)) -> dict:
        return (await manager.set_ready(room_id, x_participant_token, payload.ready)).model_dump()

    @app.post("/api/rooms/{room_id}/background")
    async def set_background(
        room_id: str,
        payload: BackgroundSelectionRequest,
        x_host_token: str = Header(...),
    ) -> dict:
        return (await manager.update_background(room_id, x_host_token, payload.backgroundId)).model_dump()

    @app.post("/api/rooms/{room_id}/start")
    async def start_room(room_id: str, x_host_token: str = Header(...)) -> dict:
        return (await manager.start_room(room_id, x_host_token)).model_dump()

    @app.post("/api/rooms/{room_id}/shots/{shot_index}")
    async def upload_shot(
        room_id: str,
        shot_index: int,
        file: UploadFile = File(...),
        x_participant_token: str = Header(...),
    ) -> dict:
        return (await manager.save_shot_upload(room_id, shot_index, x_participant_token, file)).model_dump()

    @app.post("/api/rooms/{room_id}/template")
    async def select_template(
        room_id: str,
        payload: TemplateSelectionRequest,
        x_host_token: str = Header(...),
    ) -> dict:
        return (await manager.update_template(room_id, x_host_token, payload.templateId)).model_dump()

    @app.post("/api/rooms/{room_id}/finalize")
    async def finalize_room(room_id: str, x_host_token: str = Header(...)) -> dict:
        return (await manager.finalize_room(room_id, x_host_token)).model_dump()

    @app.get("/api/rooms/{room_id}/final-strip")
    async def final_strip(room_id: str) -> dict:
        snapshot = await manager.get_room_snapshot(room_id)
        if snapshot.finalStripUrl is None:
            raise HTTPException(status_code=404, detail="Final strip not ready.")
        return {"url": snapshot.finalStripUrl}

    @app.websocket("/ws/rooms/{room_id}")
    async def room_socket(websocket: WebSocket, room_id: str, token: str):
        _, participant = await manager.register_socket(room_id, token, websocket)
        try:
            while True:
                message = await websocket.receive_json()
                if message.get("type") == "signal":
                    await manager.send_signal(
                        room_id,
                        participant.id,
                        message["payload"]["targetParticipantId"],
                        message["payload"]["signal"],
                    )
                elif message.get("type") == "peer-state":
                    await manager.update_peer_state(room_id, participant.id, message["payload"]["state"])
        except WebSocketDisconnect:
            await manager.unregister_socket(room_id, participant.id)

    @app.exception_handler(HTTPException)
    async def http_error_handler(_, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return app


async def _cleanup_loop(manager: RoomManager, interval_seconds: int) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await manager.cleanup_expired()


app = create_app()
