#!/usr/bin/env bash
# Start (or stop) the whole NAZAR AI stack locally, without Docker.
#
#   scripts/dev.sh start|stop|status|logs
#
# MedGemma is not started here: it runs on the GPU machine and is reached over
# MEDGEMMA_URL (see medgemma-service/README.md).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="$ROOT/.logs"
PIDS="$LOGS/pids"
VENV="$ROOT/backend/.venv/bin"

mkdir -p "$LOGS"

start_one() {
  local name="$1" dir="$2"; shift 2
  if [ -f "$PIDS/$name" ] && kill -0 "$(cat "$PIDS/$name")" 2>/dev/null; then
    echo "$name: already running"
    return
  fi
  mkdir -p "$PIDS"
  # Redirect the subshell's own descriptors before starting the service, so no
  # child keeps our caller's stdout open (otherwise `dev.sh start | tail` hangs).
  ( cd "$dir" && exec 0</dev/null 1>>"$LOGS/$name.log" 2>&1; "$@" & echo $! > "$PIDS/$name" )
  sleep 1
  echo "$name: started (log: .logs/$name.log)"
}

stop_one() {
  local name="$1"
  if [ -f "$PIDS/$name" ] && kill -0 "$(cat "$PIDS/$name")" 2>/dev/null; then
    pkill -P "$(cat "$PIDS/$name")" 2>/dev/null
    kill "$(cat "$PIDS/$name")" 2>/dev/null
    echo "$name: stopped"
  else
    echo "$name: not running"
  fi
  rm -f "$PIDS/$name"
}

case "${1:-status}" in
  start)
    "$ROOT/scripts/services.sh" start
    [ -x "$VENV/uvicorn" ] || { echo "backend/.venv topilmadi — README ga qarang" >&2; exit 1; }
    start_one api "$ROOT/backend" "$VENV/uvicorn" app.main:app --port 8000 --reload
    start_one worker "$ROOT/backend" "$VENV/celery" -A app.workers.tasks worker -l info
    [ -d "$ROOT/nurse-app/node_modules" ] && start_one nurse "$ROOT/nurse-app" npm run dev
    [ -d "$ROOT/specialist-panel/node_modules" ] && start_one panel "$ROOT/specialist-panel" npm run dev
    echo
    echo "  API    http://localhost:8000/docs"
    echo "  Nurse  http://localhost:5173"
    echo "  Panel  http://localhost:5174"
    ;;
  stop)
    for name in panel nurse worker api; do stop_one "$name"; done
    "$ROOT/scripts/services.sh" stop
    ;;
  status)
    "$ROOT/scripts/services.sh" status
    for name in api worker nurse panel; do
      if [ -f "$PIDS/$name" ] && kill -0 "$(cat "$PIDS/$name")" 2>/dev/null; then
        echo "$name: running (pid $(cat "$PIDS/$name"))"
      else
        echo "$name: stopped"
      fi
    done
    ;;
  logs)
    tail -n 40 -f "$LOGS"/*.log
    ;;
  *)
    echo "usage: $0 start|stop|status|logs" >&2
    exit 1
    ;;
esac
