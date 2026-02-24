#!/bin/bash
set -e

# Start socat to proxy 0.0.0.0:9222 → 127.0.0.1:9223 (where Chromium will listen)
socat TCP-LISTEN:9222,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:9223 &

# Launch Chromium with CDP on localhost:9223
exec /ms-playwright/chromium-*/chrome-linux64/chrome \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9223 \
  --remote-allow-origins=* \
  --disable-background-networking \
  --disable-default-apps \
  --disable-extensions \
  --disable-sync \
  --no-first-run
