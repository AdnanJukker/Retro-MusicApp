# The provider image contains its compiled Node server and a compatible Node 26
# runtime. Keeping provider and Python plugin on the same 2.0.0 release avoids
# the version-mismatch rejection built into bgutil.
FROM brainicism/bgutil-ytdlp-pot-provider:2.0.0 AS bgutil-provider

FROM python:3.12-slim-bookworm

WORKDIR /app

# Node runs both the loopback-only bgutil provider and yt-dlp's EJS challenge
# solver. The provider never listens on Render's public interface.
COPY --from=bgutil-provider /usr/local/bin/node /usr/local/bin/node
COPY --from=bgutil-provider /app /opt/bgutil-provider

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=8000
EXPOSE 8000

# The provider currently prints generated token values to stdout. Suppress its
# own output; FastAPI logs provider readiness and token success without values.
CMD ["sh", "-c", "node /opt/bgutil-provider/build/main.js >/dev/null 2>&1 & exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
