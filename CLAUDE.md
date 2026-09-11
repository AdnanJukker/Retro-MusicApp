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

- No login, signup, OAuth, Google auth, subscriptions, or ads, anywhere.
- No authenticated InnerTube mode: no cookies/SAPISID/browser.json/oauth.json,
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
2. Your self-hosted resolver (`server/`, a `yt-dlp`-backed FastAPI service —
   see `server/README.md`) if `EXPO_PUBLIC_STREAM_RESOLVER_URL` is set. This
   is the one fallback proven to work end-to-end (verified live, real
   206-Partial-Content audio response).
3. Public Piped API instances (`EXPO_PUBLIC_PIPED_INSTANCES`, comma-separated
   base URLs) — best-effort, and as of this work every publicly-listed
   instance was down. Kept in case the public network recovers.
4. Otherwise throws a typed `NO_AUDIO_STREAM` `YouTubeMusicError` — never a
   silent failure or a guessed/broken URL.

Do not attempt to add cipher-deciphering logic directly into the app to "fix"
step 1 — extend step 2/3 (more resolver instances, a better self-hosted
resolver) instead.

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

`server/` itself is built and was verified working locally end-to-end
(`uvicorn` on `localhost`, resolved a real track, confirmed a genuine
`206 Partial Content` / `audio/mp4` response from the returned URL) — see
`server/README.md`. It has **not** been deployed anywhere yet, and there is
no `.env.local` in the project, so `EXPO_PUBLIC_STREAM_RESOLVER_URL` is unset
and every `getAudioStream()` call currently falls through straight to the
dead public Piped list (step 3) and fails with `NO_AUDIO_STREAM`. This is
expected given the current state, not a regression.

**To finish enabling playback** (in progress, picked up wherever this left off):
1. Repo has no `git remote` configured yet — needs pushing to GitHub before
   Render (or similar) can deploy `server/` from it.
2. Deploy `server/` as a Render Web Service, root directory `server`, free
   plan — it auto-detects `server/Dockerfile`.
3. Create `.env.local` in the project root with
   `EXPO_PUBLIC_STREAM_RESOLVER_URL=<deployed-url>`, then fully restart Expo
   (env vars only load at startup, not on hot reload).
