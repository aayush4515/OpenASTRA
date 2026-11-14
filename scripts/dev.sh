#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010 --reload &
astra_api_pid=$!
trap 'kill "$astra_api_pid" 2>/dev/null || true' EXIT INT TERM
./scripts/node-runtime.sh npm --prefix frontend run dev -- --port 5173 --strictPort
