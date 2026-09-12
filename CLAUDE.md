@AGENTS.md

# Music backend: YouTube Music (InnerTube)

The active music provider is `src/services/youtubeMusic/` — an unauthenticated
YouTube Music InnerTube client, ported from `sigma67/ytmusicapi` (Python,
primary reference) with `vfsfitvnm/ViMusic` (Kotlin, archived/unmaintained
since 2023) as a secondary architecture reference only. The legacy
`src/services/musicApi.ts` (`musicapi.x007.workers.dev`) is kept but **inactive**
— nothing imports it. Do not delete it without checking first; do not wire it
back in without a reason.

Reference copies live in `assets/api_folder/ytmusicapi` (vendored, current as
of ~2026-07) and `assets/ViMusic-master`. Prefer live-verifying against real
YouTube Music responses over trusting either snapshot blindly — both rot.

## Hard constraints (do not relax without the user explicitly asking)

- No login, signup, OAuth, Google auth, subscriptions, ads, browser cookies, or
  account credentials in either the app or resolver.
- No authenticated InnerTube mode inside the app's own InnerTube client
  (`src/services/youtubeMusic/**`): no cookies/SAPISID/browser.json/oauth.json,
  no private library/subscriptions/account history.
- No YouTube signature-cipher deciphering implemented in this app's own code
  (`src/services/youtubeMusic/**`) — this was an explicit platform-level
  restriction during development, not just a style preference. If a format
  only has `signatureCipher`/`cipher` and no direct `url`, that format is
  unusable to this app directly; see the fallback chain below instead.
- No YouTube playback via WebView/browser/iframe.
- Stream URLs are never persisted (no AsyncStorage) — runtime `Map` cache only.

## Why playback can still fail: the signatureCipher problem

As of this work (2026-09), YouTube Music's unauthenticated `WEB_REMIX`
`player` endpoint returns `streamingData.adaptiveFormats` where every entry
is `signatureCipher`-protected with no direct `url`. This is real, current,
and verified live — not a bug in the parsing. Confirmed independently via:
`ytmusicapi`'s own FAQ ("Can I download songs? Use youtube-dl for this") and
its total absence of any deciphering code even in the current snapshot; and
ViMusic's real `PlayerService.kt`, which depends on the exact same kind of
external proxy fallback and would itself fail today since its hardcoded
instance is dead.

`getAudioStream()` in `YouTubeMusicProvider.ts` therefore resolves in order,
via `streamResolver.ts`:
1. Direct `url` from InnerTube's own response, if ever present (rare today).
2. The resolver (`server/`, a `yt-dlp`-backed FastAPI service — see
   `server/README.md`), defaulting to the production Render URL. The
   app calls `{baseUrl}/stream/{videoId}` directly as the playable URL —
   **not** a raw googlevideo URL returned by `/resolve` (see IP-locking below).
3. Public Piped API instances (`EXPO_PUBLIC_PIPED_INSTANCES`, comma-separated
   base URLs) — best-effort, and as of this work every publicly-listed
   instance was down. Kept in case the public network recovers.
4. Otherwise throws a typed `NO_AUDIO_STREAM` `YouTubeMusicError` — never a
   silent failure or a guessed/broken URL.

Do not attempt to add cipher-deciphering logic directly into the app to "fix"
step 1 — extend step 2/3 (more resolver instances, a better self-hosted
resolver) instead.

### googlevideo.com URLs are IP-locked — `server/` must proxy bytes, not URLs

Verified directly: a googlevideo.com URL yt-dlp resolves only works from the
IP that requested it — fetching it from a different IP returns a plain 403.
So `server/main.py` has `/stream/{video_id}`, which fetches from
googlevideo.com using the resolver's own IP and relays the response through
(with Range-header forwarding, so seeking works) — the app never touches the
raw upstream URL. `/resolve/{video_id}` is metadata/playability-check only.

### Cloud hosts get bot-blocked; use the bundled PO-token provider

Render's shared outbound IP can trigger YouTube bot checks. The Docker image
therefore bundles matching 2.0.0 releases of the bgutil Python plugin and its
loopback-only Node provider. yt-dlp uses `mweb` with a generated GVS PO token,
then `web_embedded` as one controlled muxed-format fallback. Node also runs the
yt-dlp-ejs challenge solver. No cookies or account credentials are read.

## Env vars (see `.env.example` for the full annotated list)

- `EXPO_PUBLIC_STREAM_RESOLVER_URL` — your self-hosted `server/` deployment.
- `EXPO_PUBLIC_PIPED_INSTANCES` — override the public Piped fallback list.
- `EXPO_PUBLIC_MUSIC_API_BASE_URL` — legacy provider only, currently unused.

## Current status

Search, artwork, lyrics, and the local library use unauthenticated YouTube
Music. The app defaults to `https://retro-musicapp.onrender.com` for stream
resolution and can override it with `EXPO_PUBLIC_STREAM_RESOLVER_URL`.

The bgutil-backed server change is verified locally with three public videos:
`/resolve` returns 200 metadata and `/stream` returns real 206 `audio/mp4`
bytes. Malformed ids return 400, unavailable videos return 404, and upstream
extractor failures return 502. Push and redeploy `server/`, remove the obsolete
Render cookies secret, then repeat the endpoint and device-audio checks against
the production URL.
