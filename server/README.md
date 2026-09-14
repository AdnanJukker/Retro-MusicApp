# Music backend and stream resolver

A small FastAPI service with a JioSaavn catalog for new searches and the
existing yt-dlp resolver for saved YouTube tracks. New playback uses
`/music/search` -> `/music/resolve/{song_id}` -> `/music/stream/{song_id}` ->
Expo Audio. The server resolves fresh upstream URLs and relays byte ranges;
no audio is stored or transcoded. No account, cookies, or API key is required.

## Current catalog

- `GET /music/search?q=...` returns `{tracks: Track[], provider: "jiosaavn"}`.
  Track IDs are namespaced, such as `saavn:Yv-9NmYK`; source is `jiosaavn`.
- `GET /music/resolve/Yv-9NmYK` returns the existing playback metadata shape:
  `{mimeType, bitrate, durationSeconds}`. Bitrate is null when not measured.
- `GET /music/stream/Yv-9NmYK` returns actual media, supporting Range and HEAD.
- `GET /music/lyrics/Yv-9NmYK` returns `{lyrics: string | null}`.

The frontend strips the `saavn:` namespace for these endpoints. Upstream URLs
never leave the backend or enter persistent storage. Its bounded, two-minute
cache is refreshed once on a rejected media URL. `/resolve?refresh=true`
forces renewal after a player error. Malformed IDs return 400; absent songs
return 404; upstream failures and HTML/error responses return 502.

This is an unofficial adapter to JioSaavn's public web API, not a public proxy
instance dependency. Search/details operations follow the upstream conventions
documented in [saavn-labs/sdk](https://github.com/saavn-labs/sdk). The source's
`song.generateAuthToken` operation resolves media; the adapter does not decode
DRM or embed cryptographic keys. Only HTTPS `*.saavncdn.com` media URLs and
redirects are accepted. The source requires its playback Origin/Referer;
the backend supplies them and exposes CORS for this app's browser player.
New catalog playback does not use yt-dlp, Node, bgutil, or a YouTube proxy.

The app labels its catalog as JioSaavn. Existing favorites/history retain
their original YouTube IDs; search a song again to choose its JioSaavn version.
Failed YouTube extraction no longer starts an unverified iframe as though it
were resolved audio. Catalog availability can differ from YouTube.

## Existing YouTube endpoints

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

Deploy this backend **before** distributing the updated app. Docker now copies
`music.py` alongside `main.py` and `start.py`; no new Python or Node dependency
is needed. `/health` should include `musicProvider: "jiosaavn"` and
`musicApiVersion: 1`, along with the unchanged bgutil health fields. Its 503
status still indicates bgutil is absent; local `/music` endpoints can work
without that provider when running Uvicorn directly. Docker startup continues
to require the existing provider.

Run offline tests from the repository root:

```sh
npm run typecheck
npm test
npm run lint
python -m unittest discover -s server -v
```

Run a real search-to-audio check after starting the backend (or against Render
after deploying). This exercises the actual frontend service and fetches only
128 KiB plus a 4 KiB seek range per song, without saving or logging media URLs:

```sh
npm run test:playback -- http://127.0.0.1:8000
npm run test:playback -- https://retro-musicapp.onrender.com
```

Expected logs for a new catalog selection:

```text
GET /music/search?q=Besharam%20Rang HTTP/1.1 200 OK
music resolved provider=jiosaavn song_id=Yv-9NmYK mime=audio/mp4 probe=ok
GET /music/resolve/Yv-9NmYK HTTP/1.1 200 OK
GET /music/stream/Yv-9NmYK HTTP/1.1 206 Partial Content
```

A media request without a Range header can return 200. Provider-ready logs
alone do not prove YouTube playback works. See [the playback investigation](../PLAYBACK_FIX.md)
for measured results and remaining verification limits.
