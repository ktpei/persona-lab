#!/usr/bin/env bash
# EC2 bootstrap script for PersonaLab worker
# Tested on Ubuntu 24.04 (Amazon EC2)
# Usage: curl -sSL <raw-url> | bash
set -euo pipefail

echo "=== PersonaLab EC2 Worker Setup ==="

# ── 1. Docker ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo ">> Installing Docker..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo ">> Docker installed. You may need to log out and back in for group changes."
else
  echo ">> Docker already installed."
fi

# ── 2. Node.js 22 + pnpm ────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  echo ">> Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo ">> Node.js 22 already installed."
fi

if ! command -v pnpm &>/dev/null; then
  echo ">> Installing pnpm..."
  sudo corepack enable
  corepack prepare pnpm@latest --activate
else
  echo ">> pnpm already installed."
fi

# ── 3. Clone repo ───────────────────────────────────────────────────
REPO_DIR="$HOME/persona-lab"
if [ ! -d "$REPO_DIR" ]; then
  echo ">> Cloning repo..."
  echo "   Set REPO_URL first, e.g.: export REPO_URL=git@github.com:you/persona-lab.git"
  git clone "${REPO_URL:?Set REPO_URL before running this script}" "$REPO_DIR"
else
  echo ">> Repo already cloned. Pulling latest..."
  cd "$REPO_DIR" && git pull
fi
cd "$REPO_DIR"

# ── 4. Build Docker images ──────────────────────────────────────────
echo ">> Building persona-browser image..."
docker build -f apps/worker/Dockerfile.browser -t persona-browser .

echo ">> Building worker image..."
docker compose -f docker-compose.prod.yml build worker

# ── 5. Create .env if missing ───────────────────────────────────────
if [ ! -f .env ]; then
  echo ">> Creating .env template — fill in the values!"
  cat > .env <<'ENVEOF'
# Database — point to your local Postgres via Tailscale IP or SSH tunnel
DATABASE_URL=postgresql://user:pass@<tailscale-ip>:5432/persona_lab

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Redis (override only if not using compose networking)
# REDIS_URL=redis://localhost:6379

# Concurrency — tune for your instance size
EPISODE_CONCURRENCY=4
AGENT_CONCURRENCY=6

# Uploads directory inside the worker container
UPLOAD_DIR=/app/uploads
ENVEOF
  echo ">> Edit .env with your actual values before starting."
else
  echo ">> .env already exists."
fi

# ── 6. Start services ───────────────────────────────────────────────
echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your DATABASE_URL, OPENROUTER_API_KEY, etc."
echo "  2. Start the worker:"
echo "     cd $REPO_DIR && docker compose -f docker-compose.prod.yml up -d"
echo "  3. Check logs:"
echo "     docker compose -f docker-compose.prod.yml logs -f worker"
echo ""
