# Photobosh

Photobosh is a two-person remote photobooth MVP built with FastAPI, React, TypeScript, and WebRTC. Two participants join a room, appear composited onto the same virtual background, capture four synchronized shots, then choose and finalize a photostrip theme.

## Stack

- `backend/`: FastAPI room orchestration, signaling, uploads, and strip rendering
- `frontend/`: Vite React TypeScript client with WebRTC, canvas compositing, and MediaPipe segmentation
- `docker-compose.yml`: single-host deployment stack with `web`, `api`, and `turn`

## Local development

1. Copy `.env.example` to `.env` and adjust values for your machine.
2. Backend:
   - `python -m venv .venv`
   - `.venv\Scripts\activate`
   - `pip install -r backend/requirements.txt`
   - `uvicorn app.main:app --reload --app-dir backend`
3. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

The frontend uses `VITE_API_BASE_URL` when set. Leave it empty in local development to use the Vite proxy and a same-origin style API path.

## Tests

- Backend: `pytest backend/tests`
- Frontend: `cd frontend && npm test`

## Deployment

The repo includes a Docker Compose stack intended for a single Hetzner VM managed by Coolify:

- `web`: static frontend served by Nginx
- `api`: FastAPI app
- `turn`: coturn relay

Open these ports on the host:

- `80/tcp`
- `443/tcp`
- `3478/tcp`
- `3478/udp`
- `5349/tcp`
- `5349/udp`
- `49160-49200/udp`

