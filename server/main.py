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
#
# yt-dlp's own default client auto-selection (no extractor_args at all) is
# usually the best choice — its maintainers actively rotate it to whatever
# currently dodges YouTube's SABR/PO-token restrictions, which changes often
# (see https://github.com/yt-dlp/yt-dlp/issues/12482). `None` here means "no
# override, use the default". The explicit clients after it are extra
# fallback attempts only, for when a specific IP (cloud/datacenter IPs get
# scored more suspiciously than residential ones) gets blocked on default.
PLAYER_CLIENTS: list[str | None] = [None, "android", "ios", "web"]

BASE_YDL_OPTS = {
    "noplaylist": True,
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": False,
    "socket_timeout": 15,
}


def _has_audio(f: dict) -> bool:
    return bool(f.get("url")) and f.get("acodec") not in (None, "none")


def _pick_best_audio(info: dict) -> dict | None:
    formats = [f for f in (info.get("formats") or []) if _has_audio(f)]
    if not formats:
        return None

    # Prefer real audio-only formats; only fall back to a muxed (audio+video)
    # one — still genuinely playable, just wastes some bandwidth on a video
    # track we don't use — when that's all a given client offers (e.g. the
    # android client, which currently only exposes itag 18, muxed).
    audio_only = [f for f in formats if f.get("vcodec") in (None, "none")]
    candidates = audio_only or formats

    target_bitrate = 160
    def score(f: dict) -> tuple[int, int, float]:
        ext = f.get("ext") or ""
        container_score = 0 if ext in ("m4a", "mp4") else 1 if ext == "webm" else 2
        muxed_penalty = 0 if f.get("vcodec") in (None, "none") else 1
        abr = f.get("abr") or 0
        return (muxed_penalty, container_score, abs(abr - target_bitrate))

    return min(candidates, key=score)


def _extract(video_id: str, player_client: str | None) -> dict:
    url = f"https://music.youtube.com/watch?v={video_id}"
    opts = dict(BASE_YDL_OPTS)
    if player_client:
        opts["extractor_args"] = {"youtube": {"player_client": [player_client]}}
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


@app.get("/resolve/{video_id}")
async def resolve(video_id: str):
    if not video_id or len(video_id) > 32:
        raise HTTPException(status_code=400, detail="invalid video id")

    loop = asyncio.get_event_loop()
    last_error: Exception | None = None
    info: dict | None = None
    best: dict | None = None
    for client in PLAYER_CLIENTS:
        try:
            candidate_info = await loop.run_in_executor(None, partial(_extract, video_id, client))
        except Exception as e:  # noqa: BLE001 - keep trying the next client
            last_error = e
            continue

        candidate_best = _pick_best_audio(candidate_info)
        if candidate_best:
            info, best = candidate_info, candidate_best
            break
        info = info or candidate_info  # keep something around for duration/etc. even if unusable

    if best is None:
        detail = f"unplayable: {last_error}" if last_error else "no audio-only format available"
        return JSONResponse(status_code=404, content={"error": detail})

    return {
        "url": best["url"],
        "mimeType": f"audio/{best.get('ext', 'mp4')}",
        "bitrate": int((best.get("abr") or 0) * 1000) or None,
        "durationSeconds": info.get("duration"),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
