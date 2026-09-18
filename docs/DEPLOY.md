# Production: nazarai.nodi.uz

One domain, three parts, on a shared Ubuntu server (AWS, 2 vCPU, 2 GB RAM):

| URL | What | Served by |
|---|---|---|
| `https://nazarai.nodi.uz/` | Nurse PWA | nginx, `/var/www/nazarai/nurse` |
| `https://nazarai.nodi.uz/panel/` | Specialist panel | nginx, `/var/www/nazarai/panel` |
| `https://nazarai.nodi.uz/api/` | API + WebSocket | nginx → uvicorn on `127.0.0.1:8010` |
| `https://nazarai.nodi.uz/health` | Health check | same API |

TLS is Let's Encrypt via certbot, renewed by the server's existing certbot timer.

## Layout on the server

| Path | What |
|---|---|
| `~/nazar-ai/backend` | code, Python 3.11 venv in `backend/.venv` (CPU-only torch) |
| `~/nazar-ai/.env` | production settings and secrets, mode 600, not in git |
| `~/nazar-ai/rules`, `~/nazar-ai/demo-data` | triage rules, demo data |
| `~/nazar-ai/storage` | uploaded studies, heatmaps, CT slices |
| `/etc/nginx/sites-available/nazarai.nodi.uz` | nginx site (certbot added the 443 block) |
| `/etc/systemd/system/nazar-api.service` | API, `MemoryMax=500M` |
| `/etc/systemd/system/nazar-worker.service` | Celery worker, `--concurrency 1`, `MemoryMax=1200M` |

Shared services, kept separate from the other apps on the box:

- PostgreSQL: its own role and database, both named `nazar`.
- Redis: database 5 (the other apps use 0).

## Everyday commands (on the server)

```bash
systemctl status nazar-api nazar-worker
journalctl -u nazar-worker -n 100 --no-pager
sudo systemctl restart nazar-api nazar-worker
curl -s https://nazarai.nodi.uz/health
```

## Redeploy from a laptop

```bash
NAZAR_HOST=ubuntu@<server-ip> NAZAR_KEY=~/<key>.pem scripts/deploy.sh
```

It runs the tests, builds both front-ends for the one-domain layout, syncs the
code, installs dependencies with CPU-only torch, restarts both services and
checks `/health`.

## Accounts

Production does **not** use the public demo password. The accounts are the
same phones as in `demo-data/users.json`, with a separate password that is not
stored in this repository. Re-running `app.seed` never resets an existing
password.

## Known limits of this box

- Disk: about 0.9 GB free after deployment (94% used). A 300 MB head CT upload
  is allowed, so a few large uploads can fill the disk for every app on the
  server. Grow the EBS volume before real use.
- Memory: the worker holds the chest X-ray model (~740 MB), so the server runs
  on swap. The systemd caps keep NAZAR from taking memory from the other apps;
  if the worker hits its cap it restarts on its own.
- MedGemma still runs in stub mode (`MEDGEMMA_STUB=true` in `~/nazar-ai/.env`);
  the GPU box is reached over an ngrok URL that changes on every restart.
