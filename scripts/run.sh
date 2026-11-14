#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f frontend/dist/index.html ]]; then
  printf '%s\n' 'Build the frontend first: ./scripts/node-runtime.sh npm --prefix frontend run build' >&2
  exit 1
fi
exec .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port "${ASTRA_PORT:-8010}"
