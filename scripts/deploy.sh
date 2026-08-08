#!/usr/bin/env bash
#
# Build everything, put exactly one copy on this machine, and leave the Host
# running on it.
#
# The machine should never accumulate versions: Chrome keeps the extension
# folder loaded, so the folder is stable and only its contents are replaced,
# atomically. Every earlier release is removed once the new one is live.

set -Eeuo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_root="${LOGUE_INSTALL_ROOT:-$HOME/.local/share/logue}"
extension_dir="${install_root}/extension"
data_dir="${LOGUE_DATA_DIR:-${repo}/.logue-data}"
address="${LOGUE_ADDRESS:-127.0.0.1:8787}"
port="${address##*:}"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nDeploy failed: %s\n' "$*" >&2; exit 1; }

command -v python3.13 >/dev/null || fail "python3.13 is required."

# The workspace must never sit inside anything this script replaces.
real_data="$(cd "$(dirname "${data_dir}")" && pwd)/$(basename "${data_dir}")"
case "${real_data}/" in
  "${extension_dir}"/*) fail "The data directory is inside the extension folder." ;;
esac

step "1/4  Build"
(cd "${repo}" && npm run build >/dev/null) || fail "build failed"
say "web, extension, and host compiled"

step "2/4  Install the one extension"
mkdir -p "${extension_dir}"
staging="${extension_dir}/.next.$$"
rm -rf "${staging}"
mkdir -p "${staging}"
cp -R "${repo}/extension/dist/." "${staging}/"
[[ -f "${staging}/manifest.json" && -f "${staging}/content.js" && -f "${staging}/background.js" \
   && -f "${staging}/sidepanel.html" && -f "${staging}/offscreen.html" ]] \
  || fail "the build is missing files"

# Swap the contents in place: the folder path Chrome has loaded never changes.
previous="${extension_dir}/.previous.$$"
mkdir -p "${previous}"
shopt -s nullglob dotglob
for item in "${extension_dir}"/*; do
  case "${item}" in "${staging}"|"${previous}") continue ;; esac
  mv "${item}" "${previous}/"
done
for item in "${staging}"/*; do mv "${item}" "${extension_dir}/"; done
shopt -u nullglob dotglob
rmdir "${staging}"
rm -rf "${previous}"

version="$(python3.13 -c "import json;print(json.load(open('${extension_dir}/manifest.json'))['version'])")"
say "extension ${version} at ${extension_dir}"
say "exactly one copy — no releases/ directory to grow"

step "3/4  Restart the Host on this build"
# Only ever stop a Host serving this workspace; another one is not ours to kill.
existing="$(pgrep -f "logue_host .*--address ${address}" || true)"
if [[ -n "${existing}" ]]; then
  kill ${existing} 2>/dev/null || true
  for _ in $(seq 1 20); do pgrep -f "logue_host .*--address ${address}" >/dev/null || break; sleep 0.5; done
fi

cd "${repo}/server"
LOGUE_DATA_DIR="${data_dir}" nohup python3.13 -m logue_host --address "${address}" \
  >"${install_root}/host.log" 2>&1 &
cd "${repo}"

for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:${port}/v1/status" >/dev/null && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:${port}/v1/status" >/dev/null || fail "the Host did not come up; see ${install_root}/host.log"
say "Host on http://${address} using ${data_dir}"

step "4/4  Keep it running"
plist="${HOME}/Library/LaunchAgents/com.logue.host.plist"
if [[ "$(uname)" == "Darwin" ]]; then
  mkdir -p "$(dirname "${plist}")"
  cat > "${plist}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.logue.host</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v python3.13)</string>
    <string>-m</string><string>logue_host</string>
    <string>--address</string><string>${address}</string>
  </array>
  <key>WorkingDirectory</key><string>${repo}/server</string>
  <key>EnvironmentVariables</key>
  <dict><key>LOGUE_DATA_DIR</key><string>${data_dir}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${install_root}/host.log</string>
  <key>StandardErrorPath</key><string>${install_root}/host.log</string>
</dict>
</plist>
PLIST
  say "login item written to ${plist}"
  say "enable with: launchctl bootstrap gui/\$UID ${plist}"
fi

printf '\n✓ Logue %s is live\n' "${version}"
say "Web:       cd ${repo} && npm run dev:web"
say "Extension: chrome://extensions → Reload on the Logue card"
say "First time: Load unpacked → ${extension_dir}"
