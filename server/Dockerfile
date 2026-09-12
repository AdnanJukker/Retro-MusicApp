FROM python:3.12-slim

WORKDIR /app

# Deno: yt-dlp's embedded JS runtime for solving YouTube's signature/n-param
# challenges (https://github.com/yt-dlp/yt-dlp/wiki/EJS). Without it, every
# adaptive-format URL fails to decipher regardless of player client/cookies
# (verified: "Signature solving failed... supported JavaScript runtime").
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && apt-get purge -y curl unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
