#!/usr/bin/env bash
# Build redis-server from source into ~/.local/bin (no Homebrew, no Docker).
# Needs Xcode command line tools: xcode-select --install
#
# Redis 8 ships optional modules (search, json, bloom, timeseries) that need extra
# toolchains; NAZAR AI only needs the core server, so module failures are ignored
# as long as src/redis-server was produced.
set -uo pipefail

SRC="${NAZAR_HOME:-$HOME/.nazar}/src"
PREFIX="$HOME/.local"

mkdir -p "$SRC" "$PREFIX/bin"
cd "$SRC"
if [ ! -d redis-stable ]; then
  curl -fsSL -o redis-stable.tar.gz https://download.redis.io/redis-stable.tar.gz
  tar xzf redis-stable.tar.gz
fi
cd redis-stable
make BUILD_WITH_MODULES=no MALLOC=libc -j"$(sysctl -n hw.ncpu)" 2>&1 | tail -3

if [ ! -x src/redis-server ]; then
  echo "redis-server qurilmadi" >&2
  exit 1
fi
install -m 755 src/redis-server src/redis-cli "$PREFIX/bin/"
echo "installed: $("$PREFIX/bin/redis-server" --version)"
