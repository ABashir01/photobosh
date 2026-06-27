# Fast Deploy: Hetzner + Coolify

This is the quickest viable deployment path for Photobosh.

It assumes:

- one Hetzner Cloud VM
- Coolify installed on that VM
- one app domain for the website
- one TURN hostname pointed at the same VM
- TURN over `3478` only for the first public deploy

## Deployment Model

- `web`: frontend + Nginx, exposed through Coolify on container port `80`
- `api`: private to the Compose network, reached by Nginx at `/api`, `/ws`, and `/generated`
- `turn`: exposed directly on the VM for WebRTC relay

## DNS

Create these DNS records:

- `photobosh.yourdomain.com` -> your Hetzner VM public IPv4
- `turn.photobosh.yourdomain.com` -> the same Hetzner VM public IPv4

The app goes through Coolify. TURN does not.

## Required Ports

Open these on the VM firewall:

- `80/tcp`
- `443/tcp`
- `3478/tcp`
- `3478/udp`
- `49160-49200/udp`

You do not need `5349` for the fast path.

## Coolify Environment Values

Set these in Coolify for the Compose app:

```env
APP_BASE_URL=https://photobosh.yourdomain.com
TURN_PUBLIC_HOST=turn.photobosh.yourdomain.com
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_USERNAME=choose-a-real-username
TURN_PASSWORD=choose-a-long-random-password
TURN_MIN_PORT=49160
TURN_MAX_PORT=49200
ROOM_TTL_HOURS=24
ASSET_RETENTION_HOURS=24
MAX_ROOM_PARTICIPANTS=2
UPLOAD_MAX_MB=12
BACKGROUND_ASSET_DIR=/app/assets/backgrounds
TEMPLATE_ASSET_DIR=/app/assets/templates
GENERATED_ASSET_DIR=/app/generated
VITE_API_BASE_URL=
VITE_SEGMENTER_MODEL_URL=https://storage.googleapis.com/mediapipe-assets/deeplabv3.tflite?generation=1661875711618421
```

`TURN_TLS_PORT` remains present only for future TLS TURN support. The current fast deploy does not expose it.

## Coolify Setup

1. Create a new Docker Compose application in Coolify.
2. Point it at this repository.
3. Set the environment variables above.
4. Assign `photobosh.yourdomain.com` to the `web` service on port `80`.
5. Deploy.

## Verification

After deployment:

1. Open `https://photobosh.yourdomain.com`.
2. Create a room and join from two different devices.
3. Test from two different networks if possible, such as home Wi-Fi and cellular.
4. Confirm:
   - camera permission works
   - both users appear in the staged booth
   - countdown runs
   - final strip can be downloaded

## Known Limits Of The Fast Path

- Some restrictive networks may still behave better once TURN-over-TLS is added later.
- Active rooms are still in memory only.
- Generated assets are stored on the Docker volume for a limited retention window.
