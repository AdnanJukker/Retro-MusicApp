"""
Tiny self-hosted stream resolver for the MusicApp mobile client.

Why this exists: YouTube Music's unauthenticated InnerTube `player` endpoint
currently returns only `signatureCipher`-protected audio formats (no direct
URL), and public Piped/Invidious proxy instances are largely down. yt-dlp is
the one actively-maintained tool that still keeps up with YouTube's cipher/
signature changes, so this wraps it behind one tiny HTTP endpoint the app
already knows how to call (`EXPO_PUBLIC_STREAM_RESOLVER_URL`).

This does not re-implement any deciphering itself — it's a thin adapter
around yt-dlp's own extraction, which yt-dlp maintains for exactly this
purpose (and which ytmusicapi's own FAQ recommends for downloading/streaming).

Endpoint:
    GET /resolve/{video_id} -> 200 {"url", "mimeType", "bitrate", "durationSeconds"}
                             -> 404 {"error"} if unplayable/not found
                             -> 502 {"error"} if extraction failed
"""

from __future__ import annotations

import asyncio
from functools import partial

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import yt_dlp

app = FastAPI(title="musicapp-stream-resolver")

# Reused across requests — yt-dlp instantiation is cheap but this avoids
# re-parsing options on every call. extract_flat=False because we need the
# real format list, not just metadata.
YDL_OPTS = {
    "format": "bestaudio/best",
    "noplaylist": True,
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": False,
    "socket_timeout": 15,
}


def _pick_best_audio(info: dict) -> dict | None:
    formats = info.get("formats") or []
    audio_only = [
        f
        for f in formats
        if f.get("url")
        and f.get("acodec") not in (None, "none")
        and f.get("vcodec") in (None, "none")
    ]
    if not audio_only:
        return None

    target_bitrate = 160
    def score(f: dict) -> tuple[int, float]:
        ext = f.get("ext") or ""
        container_score = 0 if ext in ("m4a", "mp4") else 1 if ext == "webm" else 2
        abr = f.get("abr") or 0
        return (container_score, abs(abr - target_bitrate))

    return min(audio_only, key=score)


def _extract(video_id: str) -> dict:
    url = f"https://music.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
        return ydl.extract_info(url, download=False)


@app.get("/resolve/{video_id}")
async def resolve(video_id: str):
    if not video_id or len(video_id) > 32:
        raise HTTPException(status_code=400, detail="invalid video id")

    loop = asyncio.get_event_loop()
    try:
        info = await loop.run_in_executor(None, partial(_extract, video_id))
    except yt_dlp.utils.DownloadError as e:
        return JSONResponse(status_code=404, content={"error": f"unplayable: {e}"})
    except Exception as e:  # noqa: BLE001 - surface as a clean 502, never crash the process
        return JSONResponse(status_code=502, content={"error": f"extraction failed: {e}"})

    best = _pick_best_audio(info)
    if not best:
        return JSONResponse(status_code=404, content={"error": "no audio-only format available"})

    return {
        "url": best["url"],
        "mimeType": f"audio/{best.get('ext', 'mp4')}",
        "bitrate": int((best.get("abr") or 0) * 1000) or None,
        "durationSeconds": info.get("duration"),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
