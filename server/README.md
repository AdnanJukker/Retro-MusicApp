# Stream resolver (optional, self-hosted)

A tiny FastAPI service that wraps [`yt-dlp`](https://github.com/yt-dlp/yt-dlp)
to resolve a playable audio URL for a YouTube video id. The app only calls
this when YouTube Music's own unauthenticated response has no direct URL
(every `adaptiveFormats` entry is `signatureCipher`-only) — see
`src/services/youtubeMusic/YouTubeMusicProvider.ts`.

This is entirely optional. Without it, the app still works for search,
browsing, artwork, and lyrics — playback just fails with a clean
`NO_AUDIO_STREAM` error until this is deployed.

## Run locally

```sh
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test it:

```sh
curl http://localhost:8000/resolve/dQw4w9WgXcQ
```

## Deploy for free (Render)

1. Push this repo to GitHub (or just the `server/` folder as its own repo).
2. On [render.com](https://render.com), **New > Web Service**, connect the repo, set
   **Root Directory** to `server`. Render auto-detects the `Dockerfile`.
3. Free plan is fine — it sleeps after ~15 min of inactivity and wakes on
   the next request (adds a few seconds of latency on the first play after
   a while, harmless afterwards).
4. Once deployed, copy the service URL (e.g. `https://your-service.onrender.com`).

Fly.io and Railway both also have free/low-cost tiers and support the same
`Dockerfile` as-is if you'd rather use one of those.

## Point the app at it

In the MusicApp project root, set in `.env.local`:

```
EXPO_PUBLIC_STREAM_RESOLVER_URL=https://your-service.onrender.com
```

Restart Expo. Playback will now try your resolver whenever YouTube's direct
response has no URL, before falling back to public Piped instances (which
are frequently down) and finally to `NO_AUDIO_STREAM`.

## Why yt-dlp and not something built from scratch

`ytmusicapi` (the app's primary metadata reference) explicitly does not
implement stream deciphering — its own FAQ recommends `youtube-dl`/`yt-dlp`
for that. `yt-dlp` is the actively-maintained tool that tracks YouTube's
signature/cipher changes; this service is a thin HTTP adapter around it, not
a reimplementation of any cipher-breaking logic.
