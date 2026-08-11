#!/usr/bin/env bash
#
# The two Hosts n5 needs besides the real one.
#
# A failure has to be caused, not waited for — and caused somewhere that is not
# the person's own workspace. `n5` needs a Host that answers and refuses, so
# this starts one on a throwaway data directory with a key no provider will
# accept. The "no Host" half needs nothing at all: 8799 is simply left empty,
# and the check asserts that before it starts.

set -Eeuo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "${here}/../.." && pwd)"
port="${LOGUE_REFUSING_PORT:-8798}"
empty_port="${LOGUE_NOWHERE_PORT:-8799}"
data="${TMPDIR:-/tmp}logue-n5-data"

case "${1:-start}" in
  start)
    if lsof -nP -iTCP:"${empty_port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "port ${empty_port} must answer nothing — something is listening on it" >&2
      exit 1
    fi
    pkill -f "logue_host --address 127.0.0.1:${port}" 2>/dev/null || true
    rm -rf "${data}"
    mkdir -p "${data}"
    (cd "${repo}/server" && LOGUE_DATA_DIR="${data}" nohup python3.13 -m logue_host --address "127.0.0.1:${port}" \
      >"${here}/n5-host-${port}.log" 2>&1 &)
    for _ in $(seq 1 40); do
      curl -sf "http://127.0.0.1:${port}/v1/status" >/dev/null && break
      sleep 0.25
    done
    # Configured, and certain to be refused. "Not configured" is a different
    # failure that never reaches the model, and the model is what is under test.
    curl -sf -X PATCH "http://127.0.0.1:${port}/v1/model" \
      -H 'content-type: application/json' \
      -d '{"api_key":"not-a-real-key","provider":"gemini","model":"gemini-3.6-flash"}' >/dev/null
    echo "refusing Host on 127.0.0.1:${port} (data ${data}); nothing on ${empty_port}"
    ;;
  stop)
    pkill -f "logue_host --address 127.0.0.1:${port}" 2>/dev/null || true
    rm -rf "${data}"
    echo "stopped"
    ;;
  *)
    echo "usage: n5-hosts.sh [start|stop]" >&2
    exit 64
    ;;
esac
