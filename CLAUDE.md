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

- No login, signup, OAuth, Google auth, subscriptions, or ads, anywhere in the
  **app itself** (`src/**`). **Exception, explicitly approved 2026-09**: the
  optional `server/` resolver may use real YouTube session cookies (see
  "Cookie auth" below) — this is a deliberate, narrowly-scoped reversal for
  that one component only, not a general green light to add auth elsewhere.
- No authenticated InnerTube mode inside the app's own InnerTube client
  (`src/services/youtubeMusic/**`): no cookies/SAPISID/browser.json/oauth.json,
  no private library/subscriptions/account history. (This is separate from
  `server/`'s cookies, which authenticate yt-dlp's YouTube *website* requests,
  not this app's InnerTube API calls.)
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
2. Your self-hosted resolver (`server/`, a `yt-dlp`-backed FastAPI service —
   see `server/README.md`) if `EXPO_PUBLIC_STREAM_RESOLVER_URL` is set. The
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

### Cloud hosts get bot-blocked; cookie auth is the sanctioned way around it

Render's free tier (and likely other shared-IP free hosts) is comprehensively
blocked by YouTube's bot detection — confirmed via ~10 consecutive failed
attempts across every yt-dlp player-client fallback over several minutes, not
an intermittent fluke. Trying more clients in code does not fix this; it's an
IP-reputation block, not a request-shape problem.

**Approved fix (explicit user decision, 2026-09, using their main Google
account, accepting the account-risk trade-off — see `server/README.md`)**:
`server/main.py` optionally loads a real YouTube session's cookies from
`YTDLP_COOKIES_PATH` (default `/etc/secrets/cookies.txt`, matching Render's
Secret Files mount point) and passes them to yt-dlp via `cookiefile`. A valid
session is generally trusted by YouTube regardless of IP reputation. This
file must never be committed to git or pasted into chat/code — upload it
directly through the host's secret-file UI. `GET /health` reports
`cookiesConfigured: true/false` (presence only, never contents) so you can
confirm it mounted correctly without exposing anything.

If cookie auth isn't set up yet or you'd rather not use it: the other
mitigation being tried is moving off Render's blocked IP pool entirely —
Google Cloud Run was chosen as the next host (genuinely-free usage-based
tier, different IP pool, unverified against YouTube's block). Self-hosting
on a residential connection is the most reliable non-cookie option, since
residential IPs essentially never hit this block.

## Env vars (see `.env.example` for the full annotated list)

- `EXPO_PUBLIC_STREAM_RESOLVER_URL` — your self-hosted `server/` deployment.
- `EXPO_PUBLIC_PIPED_INSTANCES` — override the public Piped fallback list.
- `EXPO_PUBLIC_MUSIC_API_BASE_URL` — legacy provider only, currently unused.

## Current status

Search, artwork, lyrics, and the local library all work against real
unauthenticated YouTube Music data (parsers verified against live responses,
not just fixtures). Audio playback works end-to-end **only when a working
resolver is configured** per the fallback chain above — with nothing
configured, the app is honestly search/browse-only and surfaces
`NO_AUDIO_STREAM` rather than pretending to play.

`server/` is built, proxies bytes correctly (verified locally end-to-end —
real `206 Partial Content` / `audio/mp4` audio through `/stream`), pushed to
`github.com/AdnanJukker/Retro-MusicApp`, and deployed to Render at
`https://retro-musicapp.onrender.com`. There is still **no `.env.local`** in
the project, so the app isn't actually pointed at it yet.

**Blocker**: Render's IP is bot-blocked by YouTube (see above) — `/resolve`
and `/stream` both fail there consistently. Cookie-auth support was just
added to `server/main.py` to work around this (pending the user uploading
their exported `cookies.txt` as a Render Secret File — not yet confirmed
done). In parallel, Google Cloud Run was chosen as an alternative host to
try, not yet deployed.

**Remaining steps, whichever path lands first:**
1. Either: user uploads `cookies.txt` to Render's Secret Files (see
   `server/README.md`) and redeploys, then confirm `GET /health` shows
   `cookiesConfigured: true` and `/resolve`/`/stream` succeed — OR: deploy
   `server/` to Cloud Run (build context `/server`, unauthenticated
   invocations) and test the same way.
2. Once *any* deployment reliably resolves+streams, create `.env.local` in
   the project root with `EXPO_PUBLIC_STREAM_RESOLVER_URL=<that-url>`, then
   fully restart Expo (env vars only load at startup, not on hot reload).
3. Verify the real acceptance test: search a track in the app, tap it,
   confirm audible playback on device — not just a successful curl.
