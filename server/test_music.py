"""Offline contract and streaming regressions: python -m unittest discover -s server."""
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI

import music

SONG = {
    "id": "Yv-9NmYK", "title": "A &amp; B", "type": "song", "image": "https://c.saavncdn.com/art.jpg",
    "more_info": {"encrypted_media_url": "opaque-test-reference", "duration": "258",
                  "artistMap": {"primary_artists": [{"name": "Singer"}]}},
}
MEDIA_URL = "https://web.saavncdn.com/test.mp4?token=do-not-log"


class MusicTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        music._cache.clear()
        self.calls = []
        self.media_status = 206
        self.media_type = "audio/mp4"
        self.auth_calls = 0
        self.details = {"songs": [SONG]}
        self.api_status = 200
        self.auth_url = MEDIA_URL
        self.api_error = None
        self.redirect = None
        self.upstream = httpx.AsyncClient(transport=httpx.MockTransport(self.handle))
        self.app = FastAPI()
        self.app.state.music_client = self.upstream
        self.app.include_router(music.router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://app.test")

    def handle(self, request):
        self.calls.append(request)
        if request.url.host == "www.jiosaavn.com":
            if self.api_error:
                raise self.api_error
            call = request.url.params["__call"]
            if call == "search.getResults":
                data = {"results": [SONG, SONG, {"id": "bad"}]}
            elif call == "song.getDetails":
                data = self.details
            elif call == "song.generateAuthToken":
                self.auth_calls += 1
                data = {"auth_url": self.auth_url}
            else:
                data = {"lyrics": "First<br>Second &amp; third"}
            return httpx.Response(self.api_status, json=data)
        self.assertEqual(request.url.host, "web.saavncdn.com")
        self.assertEqual(request.headers["origin"], "https://www.jiosaavn.com")
        self.assertEqual(request.headers["referer"], "https://www.jiosaavn.com/")
        if self.redirect:
            return httpx.Response(302, headers={"Location": self.redirect})
        start, end = (request.headers.get("range") or "bytes=0-3")[6:].split("-")
        content = b"abcd"[int(start):int(end) + 1]
        return httpx.Response(self.media_status, headers={
            "Content-Type": self.media_type, "Content-Range": f"bytes {start}-{end}/4",
            "Content-Length": str(len(content)), "Accept-Ranges": "bytes",
        }, stream=httpx.ByteStream(content))

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.upstream.aclose()
        music._cache.clear()

    async def test_search_resolve_stream_and_seek_contract(self):
        search = await self.client.get("/music/search", params={"q": "A & B"})
        self.assertEqual(search.status_code, 200)
        self.assertEqual(len(search.json()["tracks"]), 1)
        track = search.json()["tracks"][0]
        self.assertEqual((track["id"], track["source"], track["title"]), ("saavn:Yv-9NmYK", "jiosaavn", "A & B"))
        resolved = await self.client.get("/music/resolve/Yv-9NmYK")
        self.assertEqual(resolved.status_code, 200)
        self.assertEqual(resolved.json(), {"mimeType": "audio/mp4", "bitrate": None, "durationSeconds": 258})
        self.assertEqual(resolved.headers["cache-control"], "no-store")
        media = await self.client.get("/music/stream/Yv-9NmYK", headers={"Range": "bytes=2-3"})
        self.assertEqual((media.status_code, media.content), (206, b"cd"))
        self.assertEqual(media.headers["content-range"], "bytes 2-3/4")
        self.assertEqual(self.auth_calls, 1)

    async def test_invalid_and_missing_song_are_not_upstream_errors(self):
        self.assertEqual((await self.client.get("/music/resolve/invalid")).status_code, 400)
        self.assertEqual(self.calls, [])
        self.details = {"modules": {}}
        self.assertEqual((await self.client.get("/music/resolve/ZZZZZZZZ")).status_code, 404)

    async def test_upstream_failure_or_html_media_returns_502(self):
        self.api_status = 500
        self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)
        self.api_status = 200
        self.media_status = 403
        self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)
        self.media_status, self.media_type = 200, "text/html"
        self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)

    async def test_unknown_response_shape_is_502_not_404(self):
        self.details = {}
        self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)

    async def test_refresh_and_expiration_generate_new_urls(self):
        await self.client.get("/music/resolve/Yv-9NmYK")
        await self.client.get("/music/resolve/Yv-9NmYK?refresh=true")
        self.assertEqual(self.auth_calls, 2)
        timestamp, value = music._cache["Yv-9NmYK"]
        music._cache["Yv-9NmYK"] = (timestamp - music._TTL - 1, value)
        await self.client.get("/music/resolve/Yv-9NmYK")
        self.assertEqual(self.auth_calls, 3)

    async def test_only_catalog_cdn_urls_and_redirects_are_allowed(self):
        for url in ["https://127.0.0.1/private", "https://web.saavncdn.com.evil.test/x", "http://web.saavncdn.com/x"]:
            self.auth_url = url
            self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)
        self.auth_url = MEDIA_URL
        self.redirect = "http://169.254.169.254/credentials"
        self.assertEqual((await self.client.get("/music/resolve/Yv-9NmYK")).status_code, 502)

    async def test_logs_do_not_include_tokens_from_http_errors(self):
        self.api_error = httpx.ConnectError("secret signed URL " + MEDIA_URL)
        with self.assertLogs("uvicorn.error", level="WARNING") as logs:
            response = await self.client.get("/music/resolve/Yv-9NmYK")
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("do-not-log", " ".join(logs.output) + response.text)

    async def test_stream_retries_expired_url_once(self):
        await self.client.get("/music/resolve/Yv-9NmYK")
        original = music._open_media
        attempted = 0

        async def expire_once(*args):
            nonlocal attempted
            attempted += 1
            if attempted == 1:
                return httpx.Response(403)
            return await original(*args)

        with patch.object(music, "_open_media", expire_once):
            response = await self.client.get("/music/stream/Yv-9NmYK", headers={"Range": "bytes=2-3"})
        self.assertEqual(response.status_code, 206)
        self.assertEqual(self.auth_calls, 2)
        self.assertEqual(attempted, 3)  # rejected URL, new probe, retried media

    async def test_lyrics_and_invalid_range(self):
        response = await self.client.get("/music/lyrics/Yv-9NmYK")
        self.assertEqual(response.json(), {"lyrics": "First\nSecond & third"})
        response = await self.client.get("/music/stream/Yv-9NmYK", headers={"Range": "bytes=0-1,2-3"})
        self.assertEqual(response.status_code, 416)


if __name__ == "__main__":
    unittest.main()
