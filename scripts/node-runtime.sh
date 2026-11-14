#!/usr/bin/env bash
# Use an already installed supported Node; no downloads or global changes.
set -euo pipefail
if command -v node >/dev/null && node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)'; then
  exec "$@"
fi
astra_bundled_node="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if [[ -x "$astra_bundled_node/node" ]]; then
  export PATH="$astra_bundled_node:$PATH"
  exec "$@"
fi
printf '%s\n' 'ASTRA requires Node 22.12+ (Node 24 recommended). Install it, then retry.' >&2
exit 1
