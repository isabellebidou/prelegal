#!/usr/bin/env bash
# Build the Prelegal image and run it at http://localhost:8000.
# Set PRELEGAL_PORT to use another port, e.g. PRELEGAL_PORT=8080 scripts/start-linux.sh
set -euo pipefail
cd "$(dirname "$0")/.."

port="${PRELEGAL_PORT:-8000}"

docker build -t prelegal .
docker rm -f prelegal >/dev/null 2>&1 || true

env_args=()
[ -f .env ] && env_args=(--env-file .env)
docker run -d --name prelegal -p "$port:8000" ${env_args[@]+"${env_args[@]}"} prelegal >/dev/null

echo "Prelegal is running at http://localhost:$port"
