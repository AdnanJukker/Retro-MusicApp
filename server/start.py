"""Start the private bgutil provider before exposing the FastAPI service."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request


PROVIDER_SCRIPT = os.environ.get("BGUTIL_PROVIDER_SCRIPT", "/app/build/main.js")
PROVIDER_URL = os.environ.get("BGUTIL_PROVIDER_URL", "http://127.0.0.1:4416").rstrip("/")
STARTUP_TIMEOUT_SECONDS = 15


def _provider_version() -> str | None:
    try:
        with urllib.request.urlopen(f"{PROVIDER_URL}/ping", timeout=1) as response:
            payload = json.load(response)
        return str(payload.get("version") or "unknown")
    except (OSError, ValueError, urllib.error.URLError):
        return None


def main() -> None:
    # The provider writes generated token values to stdout, so discard stdout.
    # Keep stderr visible so startup failures appear in Render logs.
    provider = subprocess.Popen(
        ["node", PROVIDER_SCRIPT],
        stdout=subprocess.DEVNULL,
    )

    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    version = None
    while time.monotonic() < deadline:
        return_code = provider.poll()
        if return_code is not None:
            raise SystemExit(f"bgutil provider exited during startup (status {return_code})")
        version = _provider_version()
        if version:
            break
        time.sleep(0.25)

    if not version:
        provider.terminate()
        raise SystemExit("bgutil provider did not become ready within 15 seconds")

    print(f"bgutil provider ready version={version}", file=sys.stderr, flush=True)
    port = os.environ.get("PORT", "8000")
    os.execvp(
        "uvicorn",
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", port],
    )


if __name__ == "__main__":
    main()
