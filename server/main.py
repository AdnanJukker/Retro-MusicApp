"""Small yt-dlp-backed stream resolver for the MusicApp mobile client.

The frontend deals only with video ids and this service's two playback
endpoints. YouTube extraction, PO-token acquisition, and expiring signed media
URLs stay inside this service.

Endpoints:
    GET /resolve/{video_id} -> 200 {"mimeType", "bitrate", "durationSeconds"}
    GET /stream/{video_id}  -> 200/206 proxied media bytes with Range support
    GET /health             -> service and local PO-token-provider readiness

The raw googlevideo URL is intentionally never returned. It is short-lived
and may be tied to the resolver's egress IP, so /stream fetches and relays it.
"""

from __future__ import annotations

import asyncio
import importlib.metadata
import logging
import os
import re
import subprocess
import time
from contextlib import asynccontextmanager
from functools import partial

import httpx
import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

service_logger = logging.getLogger("uvicorn.error")
service_logger.setLevel(logging.INFO)

BGUTIL_PROVIDER_URL = os.environ.get("BGUTIL_PROVIDER_URL", "http://127.0.0.1:4416").rstrip("/")
PLAYER_CLIENTS = ["mweb", "web_embedded"]
_VIDEO_ID_RE = re.compile(r"^[0-9A-Za-z_-]{11}$")
_SIGNED_URL_RE = re.compile(r"https?://[^\s\"']*googlevideo\.com[^\s\"']*", re.IGNORECASE)
_provider_available = False
_provider_version: str | None = None
http_client: httpx.AsyncClient | None = None


def _package_version(name: str) -> str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return "not installed"


def _node_version() -> str:
    try:
        result = subprocess.run(
            ["node", "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unavailable"


def _safe_log_message(message: object) -> str:
    """Prevent expiring signed playback URLs from ever entering server logs."""
    return _SIGNED_URL_RE.sub("<signed media URL redacted>", str(message))


async def _check_provider(retries: int = 1) -> bool:
    global _provider_available, _provider_version
    assert http_client is not None

    for attempt in range(retries):
        try:
            response = await http_client.get(f"{BGUTIL_PROVIDER_URL}/ping", timeout=2.0)
            response.raise_for_status()
            payload = response.json()
            _provider_version = str(payload.get("version") or "unknown")
            _provider_available = True
            return True
        except (httpx.HTTPError, ValueError):
            if attempt + 1 < retries:
                await asyncio.sleep(0.25)

    _provider_available = False
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
    try:
        provider_ready = await _check_provider(retries=12)
        service_logger.info(
            "resolver runtime yt-dlp=%s yt-dlp-ejs=%s bgutil-plugin=%s node=%s "
            "provider_url=%s provider_ready=%s provider_version=%s clients=%s",
            yt_dlp.version.__version__,
            _package_version("yt-dlp-ejs"),
            _package_version("bgutil-ytdlp-pot-provider"),
            _node_version(),
            BGUTIL_PROVIDER_URL,
            provider_ready,
            _provider_version,
            PLAYER_CLIENTS,
        )
        if not provider_ready:
            service_logger.error("bgutil PO-token provider is not reachable")
        yield
    finally:
        await http_client.aclose()


app = FastAPI(title="musicapp-stream-resolver", lifespan=lifespan)


class _CapturingLogger:
    """Send useful yt-dlp diagnostics to server logs without exposing URLs."""

    _SAFE_DEBUG_MARKERS = (
        "PO Token Providers:",
        "JS Challenge Providers:",
        "Generating a gvs PO Token",
        "Retrieved a gvs PO Token",
        "player response playability status",
        "player API JSON",
        "SABR",
    )

    def __init__(self, client: str) -> None:
        self.client = client
        self.messages: list[str] = []

    def debug(self, msg: str) -> None:
        safe = _safe_log_message(msg)
        if any(marker in safe for marker in self._SAFE_DEBUG_MARKERS):
            service_logger.info("yt-dlp client=%s %s", self.client, safe)
        if "Retrieved a gvs PO Token" in safe or "player response playability status" in safe:
            self.messages.append(safe)

    def info(self, msg: str) -> None:
        safe = _safe_log_message(msg)
        if "Generating a gvs PO Token" in safe:
            service_logger.info("yt-dlp client=%s %s", self.client, safe)

    def warning(self, msg: str) -> None:
        safe = _safe_log_message(msg)
        self.messages.append(safe)
        service_logger.warning("yt-dlp client=%s %s", self.client, safe)

    def error(self, msg: str) -> None:
        safe = _safe_log_message(msg)
        self.messages.append(safe)
        service_logger.error("yt-dlp client=%s %s", self.client, safe)


BASE_YDL_OPTS = {
    "noplaylist": True,
    "quiet": True,
    "verbose": True,
    "skip_download": True,
    "extract_flat": False,
    "socket_timeout": 15,
    "retries": 3,
    "extractor_retries": 3,
    # Node 26 is copied from the provider image and serves both bgutil and
    # yt-dlp-ejs. Node is opt-in in yt-dlp, unlike Deno.
    "js_runtimes": {"node": {}},
    # Avoid yt-dlp's default best-video/best-audio selector hiding an otherwise
    # useful formats list behind "Requested format is not available". The
    # service applies its own audio-aware selection below.
    "format": "all",
}

# video_id -> (resolved format dict, duration seconds, resolved_at)
_CACHE_TTL_SECONDS = 600
_resolved_cache: dict[str, tuple[dict, float | None, float]] = {}


def _has_audio(format_info: dict) -> bool:
    url = format_info.get("url")
    protocol = (format_info.get("protocol") or "").lower()
    return (
        isinstance(url, str)
        and url.startswith(("https://", "http://"))
        and protocol in ("http", "https")
        and format_info.get("acodec") not in (None, "none")
    )


def _pick_best_audio(info: dict) -> dict | None:
    formats = [format_info for format_info in (info.get("formats") or []) if _has_audio(format_info)]
    if not formats:
        return None

    audio_only = [format_info for format_info in formats if format_info.get("vcodec") in (None, "none")]
    candidates = audio_only or formats
    target_bitrate = 160

    def score(format_info: dict) -> tuple[int, int, float]:
        ext = format_info.get("ext") or ""
        container_score = 0 if ext in ("m4a", "mp4") else 1 if ext == "webm" else 2
        muxed_penalty = 0 if format_info.get("vcodec") in (None, "none") else 1
        abr = format_info.get("abr") or 0
        return (muxed_penalty, container_score, abs(abr - target_bitrate))

    return min(candidates, key=score)


def _log_formats(client: str, info: dict) -> None:
    formats = info.get("formats") or []
    format_ids = [str(format_info.get("format_id") or "?") for format_info in formats]
    audio_formats = [
        {
            "id": format_info.get("format_id"),
            "ext": format_info.get("ext"),
            "acodec": format_info.get("acodec"),
            "vcodec": format_info.get("vcodec"),
            "protocol": format_info.get("protocol"),
            "abr": format_info.get("abr"),
            "has_url": bool(format_info.get("url")),
        }
        for format_info in formats
        if format_info.get("acodec") not in (None, "none")
    ]
    service_logger.info(
        "yt-dlp client=%s returned format_ids=%s audio_formats=%s",
        client,
        format_ids,
        audio_formats,
    )


def _extract(video_id: str, player_client: str, logger: _CapturingLogger) -> dict:
    url = f"https://music.youtube.com/watch?v={video_id}"
    opts = dict(BASE_YDL_OPTS, logger=logger)
    opts["extractor_args"] = {
        "youtube": {"player_client": [player_client]},
        "youtubepot-bgutilhttp": {"base_url": [BGUTIL_PROVIDER_URL]},
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _log_selected(video_id: str, client: str, best: dict) -> None:
    service_logger.info(
        "selected stream video_id=%s client=%s format_id=%s ext=%s acodec=%s "
        "vcodec=%s protocol=%s abr=%s",
        video_id,
        client,
        best.get("format_id"),
        best.get("ext"),
        best.get("acodec"),
        best.get("vcodec"),
        best.get("protocol"),
        best.get("abr"),
    )


def _resolve_sync(video_id: str) -> tuple[dict | None, float | None, Exception | None, list[str]]:
    last_error: Exception | None = None
    duration: float | None = None
    diagnostics: list[str] = []
    muxed_fallback: tuple[dict, float | None, str] | None = None

    for client in PLAYER_CLIENTS:
        logger = _CapturingLogger(client)
        try:
            info = _extract(video_id, client, logger)
        except Exception as error:  # noqa: BLE001 - try the intentional fallback
            last_error = error
            diagnostics.extend(f"[{client}] {message}" for message in logger.messages)
            continue

        diagnostics.extend(f"[{client}] {message}" for message in logger.messages)
        duration = info.get("duration")
        _log_formats(client, info)
        best = _pick_best_audio(info)
        if best:
            if best.get("vcodec") in (None, "none"):
                _log_selected(video_id, client, best)
                return best, duration, None, diagnostics
            if muxed_fallback is None:
                muxed_fallback = (best, duration, client)
                service_logger.info(
                    "holding muxed fallback video_id=%s client=%s format_id=%s",
                    video_id,
                    client,
                    best.get("format_id"),
                )
            continue

        service_logger.warning("yt-dlp client=%s returned no usable direct HTTP audio format", client)

    if muxed_fallback:
        best, duration, client = muxed_fallback
        _log_selected(video_id, client, best)
        return best, duration, None, diagnostics

    return None, duration, last_error, diagnostics


async def _get_resolved(
    video_id: str, force_refresh: bool = False
) -> tuple[dict | None, float | None, Exception | None, list[str]]:
    cached = _resolved_cache.get(video_id)
    if cached and not force_refresh and (time.time() - cached[2]) < _CACHE_TTL_SECONDS:
        return cached[0], cached[1], None, []

    loop = asyncio.get_running_loop()
    best, duration, error, diagnostics = await loop.run_in_executor(None, partial(_resolve_sync, video_id))
    if best:
        _resolved_cache[video_id] = (best, duration, time.time())
    return best, duration, error, diagnostics


_NOT_FOUND_MARKERS = (
    "video unavailable",
    "this video is unavailable",
    "this video has been removed",
    "private video",
    "video does not exist",
    "copyright grounds",
    "members-only content",
)


def _failure_status(error: Exception | None, diagnostics: list[str]) -> tuple[int, str]:
    combined = " ".join([str(error or ""), *diagnostics]).lower()
    if any(marker in combined for marker in _NOT_FOUND_MARKERS):
        return 404, "video unavailable"
    return 502, "upstream extraction failed"


def _validate_video_id(video_id: str) -> None:
    if not _VIDEO_ID_RE.fullmatch(video_id):
        raise HTTPException(status_code=400, detail="invalid video id")


def _mime_type(format_info: dict) -> str:
    ext = (format_info.get("ext") or "").lower()
    if ext in ("m4a", "mp4"):
        return "audio/mp4"
    if ext == "webm":
        return "audio/webm"
    return "application/octet-stream"


@app.get("/resolve/{video_id}")
async def resolve(video_id: str):
    _validate_video_id(video_id)
    best, duration, error, diagnostics = await _get_resolved(video_id)
    if not best:
        status_code, public_error = _failure_status(error, diagnostics)
        service_logger.error(
            "resolve failed video_id=%s status=%s error=%s diagnostics=%s",
            video_id,
            status_code,
            _safe_log_message(error),
            [_safe_log_message(message) for message in diagnostics],
        )
        return JSONResponse(status_code=status_code, content={"error": public_error})

    return {
        "mimeType": _mime_type(best),
        "bitrate": int((best.get("abr") or 0) * 1000) or None,
        "durationSeconds": duration,
    }


async def _fetch_upstream(video_id: str, range_header: str | None, force_refresh: bool):
    best, _, error, diagnostics = await _get_resolved(video_id, force_refresh=force_refresh)
    if not best:
        status_code, public_error = _failure_status(error, diagnostics)
        raise HTTPException(status_code=status_code, detail=public_error)

    assert http_client is not None
    upstream_headers = {
        str(key): str(value)
        for key, value in (best.get("http_headers") or {}).items()
        if key.lower() not in ("cookie", "host", "content-length")
    }
    if range_header:
        upstream_headers["Range"] = range_header

    upstream_request = http_client.build_request("GET", best["url"], headers=upstream_headers)
    try:
        return await http_client.send(upstream_request, stream=True)
    except httpx.HTTPError as error:
        service_logger.error("upstream fetch failed video_id=%s error=%s", video_id, _safe_log_message(error))
        raise HTTPException(status_code=502, detail="upstream media fetch failed") from error


@app.get("/stream/{video_id}")
async def stream(video_id: str, request: Request):
    _validate_video_id(video_id)
    range_header = request.headers.get("range")
    upstream_response = await _fetch_upstream(video_id, range_header, force_refresh=False)

    if upstream_response.status_code == 403:
        _resolved_cache.pop(video_id, None)
        await upstream_response.aclose()
        upstream_response = await _fetch_upstream(video_id, range_header, force_refresh=True)

    if upstream_response.status_code not in (200, 206, 416):
        status_code = upstream_response.status_code
        _resolved_cache.pop(video_id, None)
        await upstream_response.aclose()
        service_logger.error("upstream media rejected video_id=%s status=%s", video_id, status_code)
        raise HTTPException(status_code=502, detail="upstream media fetch failed")

    response_headers = {
        key: value
        for key, value in upstream_response.headers.items()
        if key.lower() in ("content-type", "content-length", "content-range", "accept-ranges")
    }

    async def body():
        try:
            async for chunk in upstream_response.aiter_bytes():
                yield chunk
        finally:
            await upstream_response.aclose()

    return StreamingResponse(body(), status_code=upstream_response.status_code, headers=response_headers)


@app.get("/health")
async def health():
    provider_ready = await _check_provider()
    payload = {
        "status": "ok" if provider_ready else "degraded",
        "poTokenProvider": "bgutil",
        "providerAvailable": _provider_available,
        "providerVersion": _provider_version,
    }
    if not provider_ready:
        return JSONResponse(status_code=503, content=payload)
    return payload
