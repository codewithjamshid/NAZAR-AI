#!/usr/bin/env bash
# Local dev services for NAZAR AI without Docker: PostgreSQL + Redis.
#
#   scripts/services.sh start|stop|status
#
# Data lives in ~/.nazar (outside the repo). MedGemma is NOT started here:
# it runs on a separate GPU machine and is reached through MEDGEMMA_URL.
set -euo pipefail

NAZAR_HOME="${NAZAR_HOME:-$HOME/.nazar}"
PGDATA="$NAZAR_HOME/pg"
PGPORT="${PGPORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DIR="$NAZAR_HOME/redis"
REDIS_PID="$REDIS_DIR/redis.pid"

find_pg_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then
    dirname "$(command -v pg_ctl)"
    return
  fi
  for dir in /Applications/Postgres.app/Contents/Versions/*/bin; do
    [ -x "$dir/pg_ctl" ] && { echo "$dir"; return; }
  done
  echo "pg_ctl topilmadi: Postgres.app o'rnating yoki PATH ga qo'shing" >&2
  exit 1
}

PG_BIN="$(find_pg_bin)"

redis_bin() {
  command -v redis-server 2>/dev/null || echo "$HOME/.local/bin/redis-server"
}

start_postgres() {
  if "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "postgres: already running"
    return
  fi
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "postgres: initialising cluster at $PGDATA"
    "$PG_BIN/initdb" -D "$PGDATA" -U "$USER" -E UTF8 --locale=C >/dev/null
  fi
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$NAZAR_HOME/pg.log" \
    -o "-p $PGPORT -k $NAZAR_HOME" start >/dev/null
  sleep 1
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -qtAc \
    "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nazar')
     THEN CREATE ROLE nazar LOGIN PASSWORD 'nazar'; END IF; END \$\$;" >/dev/null
  "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -qtAc \
    "SELECT 1 FROM pg_database WHERE datname='nazar'" | grep -q 1 \
    || "$PG_BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$USER" -O nazar nazar
  echo "postgres: started on port $PGPORT"
}

start_redis() {
  local bin; bin="$(redis_bin)"
  if [ ! -x "$bin" ]; then
    echo "redis-server topilmadi ($bin). scripts/install-redis.sh ni ishga tushiring." >&2
    exit 1
  fi
  if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
    echo "redis: already running"
    return
  fi
  mkdir -p "$REDIS_DIR"
  "$bin" --port "$REDIS_PORT" --daemonize yes --dir "$REDIS_DIR" \
    --pidfile "$REDIS_PID" --logfile "$REDIS_DIR/redis.log" --save ''
  sleep 1
  echo "redis: started on port $REDIS_PORT"
}

case "${1:-status}" in
  start)
    start_postgres
    start_redis
    ;;
  stop)
    "$PG_BIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 && echo "postgres: stopped" || echo "postgres: not running"
    if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
      kill "$(cat "$REDIS_PID")" && echo "redis: stopped"
    else
      echo "redis: not running"
    fi
    ;;
  status)
    "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 \
      && echo "postgres: running (port $PGPORT)" || echo "postgres: stopped"
    if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
      echo "redis: running (port $REDIS_PORT)"
    else
      echo "redis: stopped"
    fi
    ;;
  *)
    echo "usage: $0 start|stop|status" >&2
    exit 1
    ;;
esac
