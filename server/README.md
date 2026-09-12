# Stream resolver

A small FastAPI service that keeps YouTube extraction details out of the
mobile app. The app sends a YouTube video id to `/resolve`, then plays from
`/stream`; the server uses yt-dlp to resolve and proxy the expiring media URL.
No audio is stored or transcoded.

## Endpoints

- `GET /health` returns service and PO-token-provider readiness. It returns 503
  when the provider is unavailable, so a broken deployment cannot pass its
  health check.
- `GET /resolve/{video_id}` checks playability and returns `mimeType`,
  `bitrate`, and `durationSeconds`. It never exposes the signed upstream URL.
- `GET /stream/{video_id}` proxies the selected media bytes and forwards Range
  requests so mobile seeking works.

Malformed ids return 400. A genuinely unavailable/removed/private video
returns 404. yt-dlp, YouTube, PO-token, or network failures return 502 with a
short public message; detailed diagnostics stay in server logs.

## YouTube extraction strategy

The image pins compatible versions of:

- yt-dlp 2026.08.19
- yt-dlp-ejs 0.8.0
- bgutil-ytdlp-pot-provider 2.0.0
- the bgutil 2.0.0 Node provider server (Node 26)

The provider listens only on `127.0.0.1:4416` inside the container. `mweb` is
the primary yt-dlp client because it can receive a generated GVS PO token and
return direct HTTPS audio formats. `visionos`, yt-dlp's default anonymous
client, is the preferred general fallback and can return direct HTTPS audio
when the anonymous web session is rejected for a particular video.
`tv_simply` supplies a direct muxed MP4/AAC stream when the audio-only clients
are rejected. `web_embedded` remains last for videos that explicitly permit
embedded playback.

yt-dlp's exact-format selection is disabled with `format: all`. The service
then selects from `info["formats"]`, requiring a direct HTTP(S) URL and a real
audio codec. It prefers audio-only M4A/MP4 near 160 kbps, then WebM, and uses a
muxed format only when no audio-only format is available. No exact itag such
as 140 is assumed. Before accepting a candidate, the backend requests one byte
from the signed URL on its own egress. A 403 candidate is skipped so the next
client can be tried during `/resolve`, rather than failing later in `/stream`.

Node is also enabled for yt-dlp-ejs signature/n challenge solving. The server
passes yt-dlp's per-format request headers when fetching the selected URL, but
never forwards cookies.

## Run locally

The FastAPI process can be run directly when a compatible bgutil provider is
already listening on `http://127.0.0.1:4416`:

```sh
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The production-equivalent path is Docker, which keeps the official provider's
Node runtime and native dependencies together, then adds Python for FastAPI.
`start.py` starts the loopback provider, requires its `/ping` check to pass,
and only then starts FastAPI:

```sh
docker build -t retro-musicapp-resolver ./server
docker run --rm -p 8000:8000 retro-musicapp-resolver
```

Verify it without printing a signed upstream URL:

```sh
curl http://localhost:8000/health
curl http://localhost:8000/resolve/Uo_OSlQZlgY
curl -H "Range: bytes=0-65535" -o sample.bin -D - \
  http://localhost:8000/stream/Uo_OSlQZlgY
```

At startup and extraction time, FastAPI logs report yt-dlp, EJS, bgutil, Node,
provider readiness, player client, returned format ids/codecs/protocols, token
success, and the selected format. The provider's own stdout is suppressed
because it prints token values, while provider startup errors remain visible.
Full signed playback URLs are also redacted.

## Configuration

- `PORT`: public FastAPI port, supplied automatically by Render (defaults to
  8000 in the Docker image).
- `BGUTIL_PROVIDER_URL`: optional provider override; defaults to the bundled
  loopback server at `http://127.0.0.1:4416`.
- `YOUTUBE_PROXY_URL`: optional HTTP(S) proxy used for yt-dlp extraction,
  PO-token generation, stream validation, and media transfer. On hosts whose
  datacenter IP is blocked by YouTube, configure a reputable residential/ISP
  proxy with a sticky session so every request for a signed URL uses the same
  exit IP. Store it as a Render secret; its value is never logged or returned.

No cookies or account credentials are read. `YOUTUBE_PROXY_URL` is unnecessary
when the deployment's normal outbound IP is accepted by YouTube.

## Render deployment

Create a Docker web service with the repository root directory set to
`server`. The image binds FastAPI to `0.0.0.0:$PORT`; only FastAPI is exposed.
Remove any old `cookies.txt` secret file because this implementation does not
read browser cookies.

If Render logs show `LOGIN_REQUIRED` for every configured player client while
the provider is healthy, Render's shared outbound IP has been rejected before
format selection. Set `YOUTUBE_PROXY_URL` to a sticky HTTP(S) proxy endpoint;
changing formats or adding more clients cannot repair that upstream response.

The app uses `https://retro-musicapp.onrender.com` by default. Set
`EXPO_PUBLIC_STREAM_RESOLVER_URL` only to override that URL for local or staging
builds.
