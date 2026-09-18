#!/usr/bin/env bash
# Redeploy NAZAR AI to the production server behind nazarai.nodi.uz.
#
#   NAZAR_HOST=ubuntu@<server-ip> NAZAR_KEY=~/key.pem scripts/deploy.sh
#
# Builds both front-ends for one domain (nurse app at /, panel at /panel/,
# API at /api/), syncs code, installs dependencies (CPU-only torch: the box has
# no GPU and very little disk), restarts the two services and checks /health.
# Secrets stay in ~/nazar-ai/.env on the server; nothing secret is sent from here.
set -euo pipefail

HOST="${NAZAR_HOST:?set NAZAR_HOST=user@host}"
KEY="${NAZAR_KEY:?set NAZAR_KEY=/path/to/key.pem}"
DOMAIN="${NAZAR_DOMAIN:-nazarai.nodi.uz}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RSH="ssh -i $KEY -o BatchMode=yes"

echo "== tests"
(cd "$ROOT/backend" && .venv/bin/python -m pytest -q -p no:warnings | tail -1)

echo "== front-ends"
(cd "$ROOT/nurse-app" && VITE_API_URL=/api/v1 npm run build >/dev/null)
(cd "$ROOT/specialist-panel" && VITE_API_URL=/api/v1 VITE_BASE_PATH=/panel/ npm run build >/dev/null)

echo "== sync"
rsync -az --delete -e "$RSH" \
  --exclude '.venv' --exclude '__pycache__' --exclude '.pytest_cache' --exclude '*.pyc' \
  "$ROOT/backend/" "$HOST:~/nazar-ai/backend/"
rsync -az -e "$RSH" "$ROOT/rules" "$ROOT/demo-data" "$HOST:~/nazar-ai/"
rsync -az -e "$RSH" "$ROOT/scripts/smoke.py" "$HOST:~/nazar-ai/scripts/"
rsync -az --delete -e "$RSH" "$ROOT/nurse-app/dist/" "$HOST:/var/www/nazarai/nurse/"
rsync -az --delete -e "$RSH" "$ROOT/specialist-panel/dist/" "$HOST:/var/www/nazarai/panel/"

echo "== dependencies and restart"
$RSH "$HOST" 'bash -s' <<'REMOTE'
set -e
cd ~/nazar-ai
export UV_CACHE_DIR=~/nazar-ai/.uv-cache
UV=~/nazar-ai/.bootstrap/bin/uv
# CPU wheels first, so the requirements cannot pull the multi-GB CUDA build.
$UV pip install -q --python backend/.venv/bin/python \
  --index-url https://download.pytorch.org/whl/cpu torch torchvision
$UV pip install -q --python backend/.venv/bin/python -r backend/requirements.txt
$UV cache clean -q && rm -rf "$UV_CACHE_DIR"
sudo systemctl restart nazar-api nazar-worker
sleep 6
systemctl is-active nazar-api nazar-worker
df -h / | awk 'NR==2 {print "disk free: " $4}'
REMOTE

echo "== health"
curl -fsS "https://$DOMAIN/health"
echo
echo "Full check (creates two test cases): ssh in and run"
echo "  cd ~/nazar-ai && backend/.venv/bin/python scripts/smoke.py --base https://$DOMAIN"
