# Keep the official provider image as the runtime base so its Node runtime,
# native modules, and shared libraries remain together. The provider and the
# Python yt-dlp plugin are pinned to the same release in requirements.txt.
FROM brainicism/bgutil-ytdlp-pot-provider:2.0.0

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/musicapp

COPY requirements.txt .
RUN python3 -m venv /opt/musicapp-venv \
    && /opt/musicapp-venv/bin/pip install --no-cache-dir -r requirements.txt

COPY main.py music.py start.py ./
RUN chown -R node:node /srv/musicapp

USER node

ENV PATH="/opt/musicapp-venv/bin:${PATH}" \
    PORT=8000

EXPOSE 8000

# Clear the provider image's entrypoint. start.py launches that same provider
# on loopback, verifies /ping, then replaces itself with Uvicorn.
ENTRYPOINT []
CMD ["python", "start.py"]
