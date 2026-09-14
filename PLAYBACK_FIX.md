# Playback investigation and fix

## Root cause

The deployed YouTube path still fails before it can provide usable audio.
The supplied logs show `LOGIN_REQUIRED` even with bgutil available. A live
Render check during this investigation returned `/health` 200 with provider
2.0.0 available, but `/resolve/Uo_OSlQZlgY` returned 502. Provider readiness
does not mean YouTube accepts that server's anonymous session. The code already
uses `format: all`; forcing format 140 is not the current cause.

The previous client fallback also treated an internal iframe marker as
successful resolution. Its web implementation did not connect the app's
play/pause/seek controls to YouTube. That was not evidence of working audio.

## Existing changes reviewed

Kept the compatible bgutil Python/Node installation, Node runtime, format
inspection, byte probing, same-egress YouTube streaming, 502 errors, and existing
Docker startup. Those address real extraction and playback requirements.

Removed the assumption that `/health.youtubeProxyConfigured=false` means a
resolver cannot work. It now attempts the actual endpoint. An InnerTube network
failure also reaches the resolver, and signed client cache entries expire after
two minutes. Failed extraction now returns a clear error rather than an
unverified iframe success. No working queue/library/native-audio feature was
replaced.

## Alternative source and flow

New searches use JioSaavn through the existing FastAPI deployment:

```text
Search / Home -> musicService -> FastAPI /music/search
Select saavn:{id} -> /music/resolve/{id}
JioSaavn song details -> source-generated playback URL -> byte probe
Expo Audio <- FastAPI /music/stream/{id} <- upstream AAC media
```

Direct media requests with an unrelated browser Origin returned 403. Requests
using the source's playback Origin/Referer returned real AAC. The backend owns
those headers, provides CORS, forwards byte ranges, and refreshes rejected URLs
once. It stores no songs, transcodes nothing, exposes no signed URLs, and adds
no runtime dependencies or account requirements. Upstream URL caching is
bounded to 128 entries with a two-minute TTL.

This is an unofficial JioSaavn web API adapter. Its catalog differs from
YouTube. Search is labeled accordingly. Saved YouTube favorites/history retain
their IDs; search the title again to choose a JioSaavn version. The app never
silently replaces a saved song with a different recording.

## Test results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 23 tests pass |
| `npm run lint` | Pass |
| `server/.venv/Scripts/python.exe -m unittest discover -s server -v` | 9 tests pass |
| `npm run test:playback` against local Uvicorn on port 8765 | Pass; actual frontend service calls backend |
| `npx expo export --platform android --platform web --output-dir .playback-build` | Pass; Android bundle and 13 web routes |
| Render `/health` | 200; bgutil 2.0.0 available, no proxy configured |
| Render `/resolve/Uo_OSlQZlgY` | Still 502 on the existing deployment |

Live local media checks:

| Song | Namespaced ID | Resolve | Media / seek | Decoded audio |
| --- | --- | --- | --- | --- |
| Besharam Rang | `saavn:Yv-9NmYK` | 200 | 206 / 206 | AAC, 44.1 kHz, stereo; 258.47 s container |
| Tum Hi Ho | `saavn:aRZbUYD7` | 200 | 206 / 206 | AAC, 44.1 kHz, stereo; 261.97 s container |
| Kesariya | `saavn:rjkrTnma` | 200 | 206 / 206 | AAC, 44.1 kHz, stereo; 268.17 s container |

The smoke test reads 128 KiB from the start plus a later 4 KiB range per song.
A temporary PyAV decoder decoded ten audio frames from each 128 KiB sample;
audio was held in memory only. No full songs were downloaded. Invalid ID
`invalid` returned 400; nonexistent song `ZZZZZZZZ` returned 404. Offline tests
also verify upstream failures become 502, rejected redirects cannot target
arbitrary hosts, tokens are omitted from error logs, and expired URLs refresh.

Local `/health` returned 503 because the bgutil Node server is not running in
the local Python-only setup; the new catalog endpoints worked independently.
Docker is unavailable here, so an image build was not executed. No connected
phone/emulator was available: native audio lifecycle was regression-tested and
real media was decoded, but physical-device playback remains to be checked.

## Deploy

1. Push these changes and deploy the Render Docker service rooted at `server/`.
   The Dockerfile now includes `music.py`. Keep the existing PORT/bgutil setup.
2. Confirm `/health` reports `musicApiVersion: 1`, then run
   `npm run test:playback -- https://retro-musicapp.onrender.com`.
3. Restart Metro with `npx expo start --clear`, or rebuild/reinstall the app if
   using an installed APK. Search again to get new catalog tracks. No new
   environment variable, API key, proxy, or login is required for this source.

Expected new playback logs:

```text
GET /music/search?q=Besharam%20Rang HTTP/1.1 200 OK
music resolved provider=jiosaavn song_id=Yv-9NmYK mime=audio/mp4 probe=ok
GET /music/resolve/Yv-9NmYK HTTP/1.1 200 OK
GET /music/stream/Yv-9NmYK HTTP/1.1 206 Partial Content
```

These changes are local, not deployed. The new endpoints have not yet been
verified from Render's own egress.

## Files changed

- `server/music.py` — new catalog, resolution, lyrics, and streaming adapter.
- `server/main.py` — router, shared client, CORS, capability health fields.
- `server/Dockerfile` — include the new module.
- `server/test_music.py` — backend contract and failure regression tests.
- `server/README.md` — endpoints, source, deployment, and verification.
- `src/services/musicService.ts` — provider-independent frontend entry point.
- `src/services/youtubeMusic/YouTubeMusicProvider.ts` — honest failure handling, network fallback, cache expiry.
- `src/services/youtubeMusic/streamResolver.ts` — remove proxy prerequisite; respect cancellation.
- `src/store/playerStore.ts` — route playback and permit the new source.
- `src/types/music.ts` — add the JioSaavn source.
- `src/components/TrackRow.tsx` — enable playback/favorites for new tracks.
- `src/hooks/useMusicSearch.ts` — new search service.
- `src/hooks/useLyrics.ts` — route lyrics by source ID.
- `src/app/(tabs)/index.tsx` — use the new catalog for Home discovery.
- `src/app/(tabs)/search.tsx` — label the source.
- `scripts/review.test.cjs` — playback/routing/cancellation regressions.
- `scripts/playback-smoke.cjs` — repeatable live playback verification.
- `package.json` — `test:playback` command; dependencies unchanged.
- `.env.example` — document the existing backend URL for the new endpoints.
- `PLAYBACK_FIX.md` — this report.
