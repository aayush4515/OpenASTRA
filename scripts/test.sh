#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python -m pytest backend/tests -q
./scripts/node-runtime.sh npm --prefix frontend test
./scripts/node-runtime.sh npm --prefix frontend run build
