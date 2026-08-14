#!/usr/bin/env bash
#
# A Host whose model is busy, on a throwaway workspace.
#
# The same shape as `n5-hosts.sh`: a failure has to be caused, and caused
# somewhere that is not the person's own data. This one pairs a Host on 8796
# with the stand-in model on 8795, which answers 503 the way Google does.
#
#   ./scripts/qa/busy-host.sh start        # busy forever
#   ./scripts/qa/busy-host.sh start 2      # busy for two calls, then answers
#   ./scripts/qa/busy-host.sh stop

set -Eeuo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "${here}/../.." && pwd)"
port="${LOGUE_BUSY_HOST_PORT:-8796}"
model_port="${LOGUE_BUSY_MODEL_PORT:-8795}"
data="${TMPDIR:-/tmp}logue-busy-data"

case "${1:-start}" in
  start)
    pkill -f "busy-model.mjs ${model_port}" 2>/dev/null || true
    pkill -f "logue_host --address 127.0.0.1:${port}" 2>/dev/null || true
    rm -rf "${data}"
    mkdir -p "${data}"

    until="${2:-}"
    if [ -n "${until}" ]; then
      nohup node "${here}/busy-model.mjs" "${model_port}" --until "${until}" >"${here}/busy-model.log" 2>&1 &
    else
      nohup node "${here}/busy-model.mjs" "${model_port}" >"${here}/busy-model.log" 2>&1 &
    fi

    (cd "${repo}/server" && LOGUE_DATA_DIR="${data}" nohup python3.13 -m logue_host --address "127.0.0.1:${port}" \
      >"${here}/busy-host-${port}.log" 2>&1 &)
    for _ in $(seq 1 40); do
      curl -sf "http://127.0.0.1:${port}/v1/status" >/dev/null && break
      sleep 0.25
    done

    # Pointed at the stand-in. Its health probes are answered, so the Host
    # considers the capability ready and real calls actually reach the model —
    # "not configured" is a different failure and would prove nothing.
    curl -sf -X PATCH "http://127.0.0.1:${port}/v1/model" \
      -H 'content-type: application/json' \
      -d "{\"provider\":\"gemini\",\"api_key\":\"busy-stand-in\",\"base_url\":\"http://127.0.0.1:${model_port}\"}" \
      >/dev/null
    echo "busy Host on 127.0.0.1:${port} → model on 127.0.0.1:${model_port} (data ${data})"
    ;;
  stop)
    pkill -f "logue_host --address 127.0.0.1:${port}" 2>/dev/null || true
    pkill -f "busy-model.mjs ${model_port}" 2>/dev/null || true
    rm -rf "${data}"
    echo "stopped"
    ;;
  *)
    echo "usage: busy-host.sh [start [busy-calls]|stop]" >&2
    exit 64
    ;;
esac
