"""
Tiny self-hosted stream resolver for the MusicApp mobile client.

Why this exists: YouTube Music's unauthenticated InnerTube `player` endpoint
currently returns only `signatureCipher`-protected audio formats (no direct
URL), and public Piped/Invidious proxy instances are largely down. yt-dlp is
the one actively-maintained tool that still keeps up with YouTube's cipher/
signature changes, so this wraps it behind two tiny HTTP endpoints the app
already knows how to call (`EXPO_PUBLIC_STREAM_RESOLVER_URL`).

This does not re-implement any deciphering itself — it's a thin adapter
around yt-dlp's own extraction, which yt-dlp maintains for exactly this
purpose (and which ytmusicapi's own FAQ recommends for downloading/streaming).

Why /stream proxies bytes instead of just returning a URL: the googlevideo.com
URLs yt-dlp resolves are IP-locked to whichever machine requested them
(verified: fetching one from a different IP than the resolver gets a plain
403). Handing that URL straight to a phone would never work, since the
phone's IP never matches this server's. So the phone always talks to this
server for the actual audio bytes too — /stream fetches from googlevideo.com
using *this* server's IP (the one the URL is valid for) and relays the
response through, including Range support so seeking still works.

Endpoints:
    GET /resolve/{video_id} -> 200 {"mimeType", "bitrate", "durationSeconds"}
                               (metadata + playability check only — the raw
                               upstream URL is intentionally not returned,
                               it's not fetchable from any other IP)
                             -> 404 {"error"} if unplayable/not found
    GET /stream/{video_id}  -> 200/206, proxies the actual audio bytes,
                               forwarding a client Range header if present
                             -> 404 if unplayable/not found
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from functools import partial

import httpx
import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
    try:
        yield
    finally:
        await http_client.aclose()


app = FastAPI(title="musicapp-stream-resolver", lifespan=lifespan)

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

# video_id -> (resolved format dict, duration seconds, resolved_at). Short
# TTL: googlevideo URLs are typically valid for hours, but re-resolving
# occasionally is cheap insurance against edge-case early expiry and keeps
# this process from accumulating stale entries forever.
_CACHE_TTL_SECONDS = 600
_resolved_cache: dict[str, tuple[dict, float | None, float]] = {}


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


def _resolve_sync(video_id: str) -> tuple[dict | None, float | None, Exception | None]:
    last_error: Exception | None = None
    duration: float | None = None
    for client in PLAYER_CLIENTS:
        try:
            info = _extract(video_id, client)
        except Exception as e:  # noqa: BLE001 - keep trying the next client
            last_error = e
            continue

        duration = info.get("duration")
        best = _pick_best_audio(info)
        if best:
            return best, duration, None

    return None, duration, last_error


async def _get_resolved(video_id: str, force_refresh: bool = False) -> tuple[dict | None, float | None, Exception | None]:
    cached = _resolved_cache.get(video_id)
    if cached and not force_refresh and (time.time() - cached[2]) < _CACHE_TTL_SECONDS:
        return cached[0], cached[1], None

    loop = asyncio.get_event_loop()
    best, duration, error = await loop.run_in_executor(None, partial(_resolve_sync, video_id))
    if best:
        _resolved_cache[video_id] = (best, duration, time.time())
    return best, duration, error


@app.get("/resolve/{video_id}")
async def resolve(video_id: str):
    if not video_id or len(video_id) > 32:
        raise HTTPException(status_code=400, detail="invalid video id")

    best, duration, error = await _get_resolved(video_id)
    if not best:
        detail = f"unplayable: {error}" if error else "no audio-only format available"
        return JSONResponse(status_code=404, content={"error": detail})

    return {
        "mimeType": f"audio/{best.get('ext', 'mp4')}",
        "bitrate": int((best.get("abr") or 0) * 1000) or None,
        "durationSeconds": duration,
    }


@app.get("/stream/{video_id}")
async def stream(video_id: str, request: Request):
    if not video_id or len(video_id) > 32:
        raise HTTPException(status_code=400, detail="invalid video id")

    best, _, error = await _get_resolved(video_id)
    if not best:
        # One retry with a forced re-resolve — the cached URL may have
        # expired, or the first attempt raced a transient upstream error.
        best, _, error = await _get_resolved(video_id, force_refresh=True)
    if not best:
        detail = f"unplayable: {error}" if error else "no audio-only format available"
        raise HTTPException(status_code=404, detail=detail)

    assert http_client is not None
    range_header = request.headers.get("range")
    upstream_headers = {"Range": range_header} if range_header else {}

    upstream_req = http_client.build_request("GET", best["url"], headers=upstream_headers)
    try:
        upstream_resp = await http_client.send(upstream_req, stream=True)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"upstream fetch failed: {e}") from e

    if upstream_resp.status_code == 403:
        # The cached URL is almost certainly stale/expired — invalidate and
        # let the *next* request re-resolve, rather than looping here.
        _resolved_cache.pop(video_id, None)
        await upstream_resp.aclose()
        raise HTTPException(status_code=502, detail="upstream rejected the resolved URL (expired?)")

    response_headers = {
        k: v
        for k, v in upstream_resp.headers.items()
        if k.lower() in ("content-type", "content-length", "content-range", "accept-ranges")
    }

    async def body():
        try:
            async for chunk in upstream_resp.aiter_bytes():
                yield chunk
        finally:
            await upstream_resp.aclose()

    return StreamingResponse(body(), status_code=upstream_resp.status_code, headers=response_headers)


@app.get("/health")
async def health():
    return {"status": "ok"}
