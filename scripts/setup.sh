#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
./scripts/node-runtime.sh npm --prefix frontend ci
./scripts/node-runtime.sh npm --prefix frontend run models
./scripts/node-runtime.sh npm --prefix frontend run build
printf '%s\n' 'ASTRA is ready. Run ./scripts/run.sh and open http://127.0.0.1:8010'
