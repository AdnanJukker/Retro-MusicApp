"""JioSaavn catalog adapter. Media stays upstream; only bounded buffers are relayed."""

from __future__ import annotations

import html
import logging
import re
import time
from collections import OrderedDict
from urllib.parse import urljoin, urlsplit

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/music")
logger = logging.getLogger("uvicorn.error")
API_URL = "https://www.jiosaavn.com/api.php"
MEDIA_HEADERS = {"Referer": "https://www.jiosaavn.com/", "Origin": "https://www.jiosaavn.com", "Accept-Encoding": "identity"}
_ID = re.compile(r"^[A-Za-z0-9_-]{8}$")
_RANGE = re.compile(r"^bytes=(?:\d+-\d*|-\d+)$")
_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_TTL = 120
_MAX_CACHE = 128


def _validate_id(song_id: str) -> None:
    if not _ID.fullmatch(song_id):
        raise HTTPException(400, "invalid song id")


def _text(value: object) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip() if isinstance(value, str) else ""


def _number(value: object) -> int | None:
    try:
        return max(0, int(value))
    except (TypeError, ValueError, OverflowError):
        return None


def _track(song: dict) -> dict | None:
    info = song.get("more_info") or {}
    song_id, title = song.get("id", ""), _text(song.get("title"))
    if not isinstance(song_id, str) or not _ID.fullmatch(song_id) or not title:
        return None
    if song.get("type") != "song" or not info.get("encrypted_media_url"):
        return None
    artists = (info.get("artistMap") or {}).get("primary_artists") or []
    return {
        "id": f"saavn:{song_id}", "source": "jiosaavn", "title": title,
        "artist": ", ".join(filter(None, (_text(a.get("name")) for a in artists))),
        "album": _text(info.get("album")), "duration": _number(info.get("duration")),
        "artwork": song.get("image"), "year": _number(song.get("year")),
    }


async def _api(client: httpx.AsyncClient, call: str, **params) -> dict:
    try:
        response = await client.get(API_URL, params={
            "__call": call, "_format": "json", "_marker": "0",
            "api_version": "4", "ctx": "web6dot0", **params,
        }, headers=MEDIA_HEADERS, timeout=15.0)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or data.get("error"):
            raise ValueError("invalid catalog response")
        return data
    except (httpx.HTTPError, ValueError) as error:
        # Never stringify the exception: its request can contain a media token.
        logger.warning("music upstream failed operation=%s error_type=%s", call, type(error).__name__)
        raise HTTPException(502, "music service unavailable") from None


def _media_url(url: object) -> str:
    if isinstance(url, str):
        try:
            parts = urlsplit(url)
            host = parts.hostname or ""
            if (parts.scheme == "https" and host.endswith(".saavncdn.com")
                    and not parts.username and not parts.password and parts.port in (None, 443)):
                return url
        except ValueError:
            pass
    raise HTTPException(502, "invalid upstream media response")


async def _open_media(client: httpx.AsyncClient, url: str, byte_range: str | None) -> httpx.Response:
    headers = {**MEDIA_HEADERS, **({"Range": byte_range} if byte_range else {})}
    try:
        # Check every redirect before sending anything; this is not an arbitrary URL proxy.
        for _ in range(4):
            request = client.build_request("GET", _media_url(url), headers=headers, timeout=20.0)
            response = await client.send(request, stream=True, follow_redirects=False)
            if not response.is_redirect:
                return response
            location = response.headers.get("location", "")
            await response.aclose()
            url = urljoin(url, location)
        raise HTTPException(502, "too many upstream redirects")
    except httpx.HTTPError as error:
        logger.warning("music media failed error_type=%s", type(error).__name__)
        raise HTTPException(502, "music stream unavailable") from None


def _is_audio(response: httpx.Response) -> bool:
    mime = response.headers.get("content-type", "").split(";")[0]
    return response.status_code in (200, 206) and mime in ("audio/mp4", "audio/mpeg", "audio/aac", "video/mp4")


async def _resolve(client: httpx.AsyncClient, song_id: str, refresh: bool = False) -> dict:
    _validate_id(song_id)
    cached = _cache.get(song_id)
    if cached and not refresh and time.monotonic() - cached[0] < _TTL:
        _cache.move_to_end(song_id)
        return cached[1]
    _cache.pop(song_id, None)
    data = await _api(client, "song.getDetails", pids=song_id)
    songs = data.get("songs")
    # A missing song is returned as a modules-only envelope by this upstream.
    if songs is None and "modules" in data:
        raise HTTPException(404, "song unavailable")
    if not isinstance(songs, list):
        raise HTTPException(502, "invalid music service response")
    song = next((song for song in songs if isinstance(song, dict) and song.get("id") == song_id), None)
    if song is None:
        raise HTTPException(404, "song unavailable")
    info = song.get("more_info") or {}
    encrypted_url = info.get("encrypted_media_url")
    if not encrypted_url:
        raise HTTPException(404, "song unavailable")
    # Let the source generate a fresh playback URL. No embedded keys, DRM decoding,
    # personal cookies, guessed CDN paths, or third-party resolver installations.
    auth = await _api(client, "song.generateAuthToken", url=encrypted_url, bitrate="128", type="OAEP")
    url = _media_url(auth.get("auth_url"))
    probe = await _open_media(client, url, "bytes=0-0")
    try:
        if not _is_audio(probe):
            logger.warning("music probe rejected song_id=%s status=%s", song_id, probe.status_code)
            raise HTTPException(502, "music stream unavailable")
        # Confirm bytes arrive, not just a successful response header.
        if not await anext(probe.aiter_raw(chunk_size=1), b""):
            raise HTTPException(502, "empty music stream")
        mime = probe.headers["content-type"].split(";")[0]
    except httpx.HTTPError:
        raise HTTPException(502, "music stream unavailable") from None
    finally:
        await probe.aclose()
    # The source can return a different bitrate than requested. Do not report
    # the requested quality as measured codec metadata.
    result = {"url": url, "mimeType": mime, "bitrate": None, "durationSeconds": _number(info.get("duration"))}
    _cache[song_id] = (time.monotonic(), result)
    while len(_cache) > _MAX_CACHE:
        _cache.popitem(last=False)
    logger.info("music resolved provider=jiosaavn song_id=%s mime=%s probe=ok", song_id, mime)
    return result


@router.get("/search")
async def search(request: Request, q: str = Query(min_length=1, max_length=200)):
    data = await _api(request.app.state.music_client, "search.getResults", q=q.strip(), n="25", p="1")
    if not isinstance(data.get("results"), list):
        raise HTTPException(502, "invalid music search response")
    tracks = [track for song in data["results"] if isinstance(song, dict) and (track := _track(song))]
    return {"tracks": list({track["id"]: track for track in tracks}.values()), "provider": "jiosaavn"}


@router.get("/resolve/{song_id}")
async def resolve(song_id: str, request: Request, response: Response, refresh: bool = False):
    result = await _resolve(request.app.state.music_client, song_id, refresh)
    response.headers["Cache-Control"] = "no-store"
    return {key: value for key, value in result.items() if key != "url"}


@router.api_route("/stream/{song_id}", methods=["GET", "HEAD"])
async def stream(song_id: str, request: Request):
    _validate_id(song_id)
    byte_range = request.headers.get("range")
    if byte_range and not _RANGE.fullmatch(byte_range):
        raise HTTPException(416, "invalid byte range")
    client = request.app.state.music_client
    result = await _resolve(client, song_id)
    upstream = await _open_media(client, result["url"], byte_range)
    if upstream.status_code in (401, 403, 404):
        await upstream.aclose()
        result = await _resolve(client, song_id, refresh=True)
        upstream = await _open_media(client, result["url"], byte_range)
    if upstream.status_code != 416 and not _is_audio(upstream):
        logger.warning("music stream rejected song_id=%s status=%s", song_id, upstream.status_code)
        _cache.pop(song_id, None)
        await upstream.aclose()
        raise HTTPException(502, "music stream unavailable")
    headers = {key: value for key, value in upstream.headers.items()
               if key in ("content-type", "content-length", "content-range", "accept-ranges")}
    headers["cache-control"] = "no-store"
    if request.method == "HEAD" or upstream.status_code == 416:
        await upstream.aclose()
        if upstream.status_code == 416:
            headers.pop("content-length", None)
        return Response(status_code=upstream.status_code, headers=headers)

    async def body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            logger.warning("music stream interrupted song_id=%s", song_id)
        finally:
            await upstream.aclose()

    return StreamingResponse(body(), status_code=upstream.status_code, headers=headers)


@router.get("/lyrics/{song_id}")
async def lyrics(song_id: str, request: Request):
    _validate_id(song_id)
    data = await _api(request.app.state.music_client, "lyrics.getLyrics", lyrics_id=song_id)
    value = data.get("lyrics")
    if not isinstance(value, str):
        return {"lyrics": None}
    return {"lyrics": _text(re.sub(r"<br\s*/?>", "\n", value, flags=re.I)) or None}
