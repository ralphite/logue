#!/usr/bin/env bash
#
# A test browser holding the extension the way a person actually has it.
#
# The real Chrome the user runs, a throwaway profile, and three things that
# have to match a real install or the self-update path cannot be tested
# honestly:
#
#  * Unpacked, not --load-extension. A command-line extension is disabled by
#    Chrome the moment it calls chrome.runtime.reload(). CDP's
#    Extensions.loadUnpacked registers a profile-managed unpacked install.
#  * Developer mode on, set through chrome://extensions' own API — it lives in
#    Secure Preferences, which Chrome signs, so it cannot be written by hand.
#    With it off, a reload disables the extension instead of reloading it.
#    (That state cannot happen for real: with developer mode off, Chrome would
#    already have disabled the unpacked extension.)
#  * Developer mode BEFORE the install, so the extension is never registered
#    under the wrong regime.
set -Eeuo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chrome="${LOGUE_TEST_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
port="${1:-9888}"
page="${2:-http://127.0.0.1:8899/editor.html}"
# Beside the repo, never inside it: a Chrome profile is hundreds of megabytes
# of someone's throwaway browsing and has no business near a commit.
profile="${LOGUE_QA_PROFILE:-${TMPDIR:-/tmp}logue-qa-profile-${port}}"

pkill -f "user-data-dir=${profile}" 2>/dev/null || true
sleep 1
rm -rf "${profile}"

# The port must be nobody's. Another Chrome on this port — the person's own
# browser was, once — silently receives every action meant for the test
# instance: their tabs navigated, their extension reloaded, their microphone
# clicked. IPv4 goes to whichever process bound it first, not to ours.
if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port ${port} is already in use by another browser — refusing to share it" >&2
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >&2
  exit 1
fi

nohup "${chrome}" \
  --user-data-dir="${profile}" \
  --remote-debugging-port="${port}" \
  --no-first-run --no-default-browser-check \
  --enable-unsafe-extension-debugging --remote-debugging-targets \
  --use-fake-ui-for-media-stream \
  ${LOGUE_TEST_REAL_MIC:---use-fake-device-for-media-stream} \
  ${LOGUE_TEST_AUDIO:+--use-file-for-fake-audio-capture="${LOGUE_TEST_AUDIO}"} \
  ${LOGUE_TEST_AUDIO:+--disable-features=AudioServiceSandbox} \
  --window-size=1400,900 "${page}" >"${here}/test-browser-${port}.log" 2>&1 &

for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:${port}/json/version" >/dev/null && break
  sleep 0.5
done

node "${here}/developer-mode.mjs" "${port}"
# The installed folder by default, because that is what a person has. A build
# under test that has not been deployed yet can be named instead — without it,
# checking a change means deploying it over the machine's own Logue first.
node "${here}/load-unpacked.mjs" "${port}" "${LOGUE_TEST_EXTENSION:-${HOME}/.local/share/logue/extension}"
node "${here}/grant-mic.mjs" "${port}"

# Leave the browser on the page the caller asked for, not chrome://extensions.
# `--input-type=module`: stdin is a CommonJS script otherwise, and the top-level
# await below fails to parse — which left every launch on chrome://extensions.
node --input-type=module - "${port}" "${page}" <<'NODE'
const [port, page] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.send(JSON.stringify({ id: 1, method: "Page.navigate", params: { url: page } }));
await new Promise((r) => setTimeout(r, 2000));
ws.close();
NODE
