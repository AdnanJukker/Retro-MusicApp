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

## If your host's IP gets bot-blocked ("Sign in to confirm you're not a bot")

Some hosts (Render's free tier in particular) share outbound IPs across many
customers, and YouTube has blocklisted that range fairly comprehensively. If
`/resolve` or `/stream` consistently return that error regardless of which
player client is tried, the fix is to authenticate the resolver's requests
with a real YouTube session's cookies — YouTube generally trusts a valid
session regardless of IP reputation.

**This is a deliberate trade-off, not a default**: it means this service
authenticates as whatever Google account the cookies belong to. Use an
account you're comfortable with this service acting as, understand it
reverses any "no personal account" rule you may have set for the app
itself, and that unattended automated use of a personal account's session
isn't something Google's ToS loves — cookies can also expire/rotate and
need periodic re-export if it stops working.

1. **Export cookies.txt** from a browser where you're logged into YouTube,
   using a well-known extension for exactly this ([Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   for Chrome, or the Firefox equivalent). Export for `youtube.com` in
   Netscape format.
2. **Never commit this file to git or paste its contents anywhere** — it's
   equivalent to a password for that account.
3. **Upload it as a secret file** on your host, not through code:
   - Render: Dashboard → your service → **Environment** → **Secret Files** →
     add one with filename `cookies.txt` and paste the file's contents.
     Render mounts it at `/etc/secrets/cookies.txt` automatically, which is
     exactly where `main.py` looks for it by default.
   - Other hosts: check their docs for "secret files" / "mounted secrets";
     override the path with the `YTDLP_COOKIES_PATH` env var if it differs.
4. Redeploy. Check `GET /health` — it returns `cookiesConfigured: true` once
   the file is detected (this never reveals the file's contents, just
   whether it was found).

## Why yt-dlp and not something built from scratch

`ytmusicapi` (the app's primary metadata reference) explicitly does not
implement stream deciphering — its own FAQ recommends `youtube-dl`/`yt-dlp`
for that. `yt-dlp` is the actively-maintained tool that tracks YouTube's
signature/cipher changes; this service is a thin HTTP adapter around it, not
a reimplementation of any cipher-breaking logic.
