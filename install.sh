#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Logue installer currently supports macOS only.\n' >&2
  exit 69
fi

case "$(uname -m)" in
  arm64) logue_arch="arm64" ;;
  x86_64) logue_arch="amd64" ;;
  *) printf 'Unsupported Mac architecture: %s\n' "$(uname -m)" >&2; exit 69 ;;
esac

logue_home="${HOME:?HOME is required}"
install_root="${LOGUE_INSTALL_ROOT:-${logue_home}/.local/share/logue}"
data_root="${LOGUE_DATA_DIR:-${logue_home}/Library/Application Support/Logue}"
bin_dir="${LOGUE_BIN_DIR:-${logue_home}/.local/bin}"
launch_agents_dir="${LOGUE_LAUNCH_AGENTS_DIR:-${logue_home}/Library/LaunchAgents}"
launch_label="${LOGUE_LAUNCH_LABEL:-com.ralphite.logue}"
launch_plist="${launch_agents_dir}/${launch_label}.plist"
logue_port="${LOGUE_PORT:-8787}"
logue_address="${LOGUE_ADDRESS:-127.0.0.1:${logue_port}}"
health_url="${LOGUE_HEALTH_URL:-http://127.0.0.1:${logue_port}/v1/status}"
asset_base_url="${LOGUE_ASSET_BASE_URL:-https://github.com/ralphite/logue/releases/latest/download}"
asset_name="logue-darwin-${logue_arch}.tar.gz"
current_link="${install_root}/current"
extension_dir="${install_root}/extension"
run_dir="${install_root}/run"
pid_file="${run_dir}/logue.pid"
log_file="${run_dir}/logue.log"
install_tmp=""
staged_release_dir=""
staged_extension_assets=""
extension_manifest_next=""
cli_next=""
launch_plist_next=""
current_switched="no"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nInstallation did not complete: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ "${current_switched}" == "no" && -n "${staged_release_dir}" && -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}"
  fi
  if [[ -n "${staged_extension_assets}" && -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}"
  fi
  [[ -n "${extension_manifest_next}" ]] && rm -f -- "${extension_manifest_next}"
  [[ -n "${cli_next}" ]] && rm -f -- "${cli_next}"
  [[ -n "${launch_plist_next}" ]] && rm -f -- "${launch_plist_next}"
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
}
trap cleanup EXIT

choose_autostart() {
  local configured="${LOGUE_AUTO_START:-}" answer
  case "${configured}" in
    1|true|TRUE|True|yes|YES|Yes|y|Y) printf 'yes' ; return ;;
    0|false|FALSE|False|no|NO|No|n|N) printf 'no' ; return ;;
    "") ;;
    *) fail "LOGUE_AUTO_START accepts only yes or no." ;;
  esac
  if [[ -r /dev/tty && -w /dev/tty ]]; then
    printf '\nStart Logue when you sign in to this Mac? [Y/n] ' > /dev/tty
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in n|N|no|NO|No) printf 'no' ;; *) printf 'yes' ;; esac
  else
    say "No interactive terminal; sign-in launch stays off. Re-run with LOGUE_AUTO_START=yes to enable it." >&2
    printf 'no'
  fi
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

inject_failure() {
  if [[ "${LOGUE_INSTALLER_FAIL_AT:-}" == "$1" ]]; then
    printf '  [test] injected failure after %s switch\n' "$1" >&2
    return 1
  fi
  return 0
}

case "${LOGUE_INSTALLER_FAIL_AT:-}" in
  ""|extension|cli|autostart) ;;
  *) fail "LOGUE_INSTALLER_FAIL_AT accepts only extension, cli, or autostart." ;;
esac

autostart="$(choose_autostart)"

for required_command in curl tar shasum plutil; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "Missing required system command: ${required_command}."
done

printf '\nLogue install and upgrade\n'
say "App: ${install_root}"
say "Data: ${data_root} (never overwritten)"

mkdir -p "${install_root}/releases" "${data_root}" "${bin_dir}" "${launch_agents_dir}" "${run_dir}"
install_tmp="$(mktemp -d "${install_root}/.install.XXXXXX")"

step "1/4  Download and verify the release"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/${asset_name}" -o "${install_tmp}/${asset_name}"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/checksums.txt" -o "${install_tmp}/checksums.txt"
checksum_line="$(awk -v wanted="${asset_name}" '$2 == wanted || $2 == "./" wanted { print; exit }' "${install_tmp}/checksums.txt")"
[[ -n "${checksum_line}" ]] || fail "checksums.txt does not contain ${asset_name}."
printf '%s\n' "${checksum_line}" > "${install_tmp}/selected-checksum.txt"
(cd "${install_tmp}" && shasum -a 256 -c selected-checksum.txt >/dev/null) || fail "Release verification failed; the existing installation was not changed."
say "Verified"

package_dir="${install_tmp}/package"
mkdir -p "${package_dir}"
tar -xzf "${install_tmp}/${asset_name}" -C "${package_dir}"
[[ -x "${package_dir}/bin/logue" ]] || fail "Release is missing executable bin/logue."
[[ -f "${package_dir}/web/index.html" ]] || fail "Release is missing the Web App."
[[ -f "${package_dir}/extension/manifest.json" ]] || fail "Release is missing the Chrome Extension."
[[ -f "${package_dir}/VERSION" ]] || fail "Release is missing VERSION."
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
[[ "${logue_version}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || fail "Invalid release version: ${logue_version}."
say "Preparing ${logue_version}"

managed_pid=""
previous_current=""
previous_current_version=""
previous_current_backup=""
extension_manifest_backup="${extension_dir}/.manifest.previous.$$"
cli_backup="${bin_dir}/.logue.previous.$$"
launch_plist_backup="${launch_agents_dir}/.${launch_label}.previous.$$"
had_extension_manifest="no"
had_cli="no"
had_launch_plist="no"

validate_managed_service() {
  local old_command
  managed_pid=""
  if [[ -f "${pid_file}" ]]; then
    managed_pid="$(tr -dc '0-9' < "${pid_file}")"
    if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
      old_command="$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)"
      [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || fail "The PID file does not belong to this Logue installation; stopped to avoid terminating another process."
    else
      managed_pid=""
    fi
  fi
}

stop_managed_service() {
  local old_command wait_count
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    old_command="$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)"
    [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || return 1
  fi
  launchctl bootout "gui/$(id -u)" "${launch_plist}" >/dev/null 2>&1 || launchctl unload "${launch_plist}" >/dev/null 2>&1 || true
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    say "Stopping existing service (PID ${managed_pid})"
    kill "${managed_pid}" >/dev/null 2>&1 || true
    for ((wait_count = 0; wait_count < 30; wait_count++)); do
      kill -0 "${managed_pid}" >/dev/null 2>&1 || break
      sleep 0.1
    done
    if kill -0 "${managed_pid}" >/dev/null 2>&1; then
      kill -KILL "${managed_pid}" >/dev/null 2>&1 || true
      for ((wait_count = 0; wait_count < 20; wait_count++)); do
        kill -0 "${managed_pid}" >/dev/null 2>&1 || break
        sleep 0.1
      done
    fi
    kill -0 "${managed_pid}" >/dev/null 2>&1 && return 1
  fi
  rm -f -- "${pid_file}"
  managed_pid=""
  return 0
}

start_service() {
  local expected_version="$1" service_pid status_body wait_count
  : >> "${log_file}" || return 1
  nohup env \
    LOGUE_DATA_DIR="${data_root}" \
    LOGUE_WEB_DIST="${current_link}/web" \
    "${current_link}/bin/logue" -address "${logue_address}" \
    >> "${log_file}" 2>&1 </dev/null &
  service_pid=$!
  printf '%s\n' "${service_pid}" > "${pid_file}" || return 1
  managed_pid="${service_pid}"
  for ((wait_count = 0; wait_count < 40; wait_count++)); do
    if ! kill -0 "${service_pid}" >/dev/null 2>&1; then
      return 1
    fi
    status_body="$(curl -fsS --max-time 1 "${health_url}" 2>/dev/null || true)"
    if [[ "${status_body}" == *'"ok":true'* && "${status_body}" == *"\"version\":\"${expected_version}\""* ]]; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

create_launch_plist() {
  local escaped_label escaped_binary escaped_address escaped_data escaped_web escaped_log
  escaped_label="$(xml_escape "${launch_label}")"
  escaped_binary="$(xml_escape "${current_link}/bin/logue")"
  escaped_address="$(xml_escape "${logue_address}")"
  escaped_data="$(xml_escape "${data_root}")"
  escaped_web="$(xml_escape "${current_link}/web")"
  escaped_log="$(xml_escape "${log_file}")"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0"><dict>'
    printf '  <key>Label</key><string>%s</string>\n' "${escaped_label}"
    printf '%s\n' '  <key>ProgramArguments</key><array>'
    printf '%s\n' "    <string>/bin/zsh</string><string>-lc</string><string>exec \"\$1\" -address \"\$2\"</string><string>logue-autostart</string>"
    printf '    <string>%s</string><string>%s</string>\n' "${escaped_binary}" "${escaped_address}"
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>EnvironmentVariables</key><dict>'
    printf '    <key>LOGUE_DATA_DIR</key><string>%s</string>\n' "${escaped_data}"
    printf '    <key>LOGUE_WEB_DIST</key><string>%s</string>\n' "${escaped_web}"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    printf '  <key>StandardOutPath</key><string>%s</string>\n' "${escaped_log}"
    printf '  <key>StandardErrorPath</key><string>%s</string>\n' "${escaped_log}"
    printf '%s\n' '</dict></plist>'
  } > "${launch_plist_next}" || return 1
  chmod 600 "${launch_plist_next}" || return 1
  plutil -lint "${launch_plist_next}" >/dev/null || return 1
}

step "2/4  Stage and verify the full upgrade"
release_dir="$(mktemp -d "${install_root}/releases/${logue_version}.XXXXXX")"
rmdir -- "${release_dir}"
mv "${package_dir}" "${release_dir}"
staged_release_dir="${release_dir}"

if [[ -L "${current_link}" ]]; then
  previous_current="$(readlink "${current_link}")"
elif [[ -e "${current_link}" && ! -d "${current_link}" ]]; then
  fail "Existing current is neither a symlink nor a directory; stopped to avoid overwriting an unknown file."
fi
if [[ -x "${current_link}/bin/logue" ]]; then
  previous_current_version="$("${current_link}/bin/logue" -version 2>/dev/null || true)"
fi

extension_asset_id="${logue_version}-$$"
extension_releases_dir="${extension_dir}/releases"
extension_stage="${extension_releases_dir}/.${extension_asset_id}.next"
staged_extension_assets="${extension_releases_dir}/${extension_asset_id}"
extension_manifest_next="${extension_dir}/.manifest.next.$$"
mkdir -p "${extension_stage}"
cp -R "${release_dir}/extension/." "${extension_stage}/"
rm -f -- "${extension_stage}/manifest.json"
mv "${extension_stage}" "${staged_extension_assets}"
sed \
  -e "s|\"service_worker\": \"background.js\"|\"service_worker\": \"releases/${extension_asset_id}/background.js\"|" \
  -e "s|\"js\": \[\"content.js\"\]|\"js\": [\"releases/${extension_asset_id}/content.js\"]|" \
  "${release_dir}/extension/manifest.json" > "${extension_manifest_next}"
grep -Fq "\"service_worker\": \"releases/${extension_asset_id}/background.js\"" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned worker; the existing installation was not changed."
grep -Fq "\"js\": [\"releases/${extension_asset_id}/content.js\"]" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned content script; the existing installation was not changed."
[[ -f "${staged_extension_assets}/background.js" && -f "${staged_extension_assets}/content.js" ]] || fail "Extension assets are incomplete; the existing installation was not changed."

if [[ -d "${extension_dir}/manifest.json" && ! -L "${extension_dir}/manifest.json" ]]; then
  fail "Extension manifest path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${extension_dir}/manifest.json" || -L "${extension_dir}/manifest.json" ]]; then
  cp -p "${extension_dir}/manifest.json" "${extension_manifest_backup}"
  had_extension_manifest="yes"
fi

if [[ -d "${bin_dir}/logue" && ! -L "${bin_dir}/logue" ]]; then
  fail "CLI path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${bin_dir}/logue" || -L "${bin_dir}/logue" ]]; then
  /bin/cp -pP "${bin_dir}/logue" "${cli_backup}"
  had_cli="yes"
fi
cli_next="${bin_dir}/.logue.next.$$"
ln -s "${current_link}/bin/logue" "${cli_next}"

if [[ -d "${launch_plist}" && ! -L "${launch_plist}" ]]; then
  fail "LaunchAgent path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${launch_plist}" || -L "${launch_plist}" ]]; then
  /bin/cp -pP "${launch_plist}" "${launch_plist_backup}"
  had_launch_plist="yes"
fi
if [[ "${autostart}" == "yes" ]]; then
  launch_plist_next="${launch_agents_dir}/.${launch_label}.next.$$"
  create_launch_plist || fail "Could not create a valid LaunchAgent; the existing installation was not changed."
fi

validate_managed_service
say "App, Extension, CLI, and startup settings are ready"

commit_install() {
  local next_link
  if [[ -e "${current_link}" && ! -L "${current_link}" ]]; then
    previous_current_backup="${install_root}/.current.previous.$$"
    mv "${current_link}" "${previous_current_backup}" || return 1
  fi
  next_link="${install_root}/.current.next.$$"
  ln -s "${release_dir}" "${next_link}" || return 1
  /bin/mv -f -h "${next_link}" "${current_link}" || return 1
  current_switched="yes"
  say "App switched to ${logue_version}"

  start_service "${logue_version}" || return 1
  say "Service started: ${health_url}"

  /bin/mv -f "${extension_manifest_next}" "${extension_dir}/manifest.json" || return 1
  say "Extension switched atomically to ${logue_version}"
  inject_failure extension || return 1

  /bin/mv -f -h "${cli_next}" "${bin_dir}/logue" || return 1
  inject_failure cli || return 1

  if [[ "${autostart}" == "yes" ]]; then
    /bin/mv -f -h "${launch_plist_next}" "${launch_plist}" || return 1
  else
    rm -f -- "${launch_plist}" || return 1
  fi
  inject_failure autostart || return 1
  return 0
}

rollback_install() {
  local rollback_failed="no" rollback_link restored_version
  validate_managed_service
  stop_managed_service || rollback_failed="yes"

  if [[ "${had_extension_manifest}" == "yes" ]]; then
    /bin/mv -f "${extension_manifest_backup}" "${extension_dir}/manifest.json" || rollback_failed="yes"
  else
    rm -f -- "${extension_dir}/manifest.json" || rollback_failed="yes"
  fi
  if [[ "${had_cli}" == "yes" ]]; then
    /bin/mv -f -h "${cli_backup}" "${bin_dir}/logue" || rollback_failed="yes"
  else
    rm -f -- "${bin_dir}/logue" || rollback_failed="yes"
  fi
  if [[ "${had_launch_plist}" == "yes" ]]; then
    /bin/mv -f -h "${launch_plist_backup}" "${launch_plist}" || rollback_failed="yes"
  else
    rm -f -- "${launch_plist}" || rollback_failed="yes"
  fi

  if [[ -n "${previous_current}" ]]; then
    rollback_link="${install_root}/.current.rollback.$$"
    ln -s "${previous_current}" "${rollback_link}" || rollback_failed="yes"
    /bin/mv -f -h "${rollback_link}" "${current_link}" || rollback_failed="yes"
  elif [[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]]; then
    rm -f -- "${current_link}" || rollback_failed="yes"
    mv "${previous_current_backup}" "${current_link}" || rollback_failed="yes"
  else
    rm -f -- "${current_link}" || rollback_failed="yes"
  fi
  current_switched="no"

  if [[ -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}" || rollback_failed="yes"
  fi
  staged_extension_assets=""
  if [[ -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}" || rollback_failed="yes"
  fi
  staged_release_dir=""

  if [[ -x "${current_link}/bin/logue" ]]; then
    restored_version="${previous_current_version}"
    [[ -n "${restored_version}" ]] || restored_version="$("${current_link}/bin/logue" -version 2>/dev/null || true)"
    start_service "${restored_version}" || rollback_failed="yes"
  fi
  [[ "${rollback_failed}" == "no" ]]
}

step "3/4  Commit atomically and check the service"
if ! stop_managed_service; then
  fail "Could not stop the existing service safely; the existing installation was not switched."
fi
if ! commit_install; then
  printf '\nUpgrade commit failed; restoring the complete previous version…\n' >&2
  if rollback_install; then
    fail "Upgrade did not complete; the app, Extension, CLI, startup settings, and previous service were restored. Data was not changed."
  fi
  printf '\nLatest service log:\n' >&2
  tail -n 12 "${log_file}" >&2 || true
  fail "Upgrade did not complete and automatic recovery was incomplete. Data was not changed; keep the log above."
fi

step "4/4  Finish startup settings"
if [[ "${autostart}" == "yes" ]]; then
  say "Logue will start when you sign in (the current service was started by this install)"
else
  say "Logue will not start automatically when you sign in"
fi

rm -f -- "${extension_manifest_backup}" "${cli_backup}" "${launch_plist_backup}"
if [[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]]; then rm -rf -- "${previous_current_backup}"; fi
staged_release_dir=""
staged_extension_assets=""

printf '\n✓ Logue %s is installed and running\n' "${logue_version}"
say "Open: http://127.0.0.1:${logue_port}"
say "Extension: ${extension_dir} (load it in chrome://extensions)"
say "Command: ${bin_dir}/logue"
say "Data remains at: ${data_root}"

open_browser="${LOGUE_OPEN_BROWSER:-}"
if [[ -z "${open_browser}" ]]; then
  [[ -r /dev/tty && -w /dev/tty ]] && open_browser="yes" || open_browser="no"
fi
case "${open_browser}" in
  1|true|TRUE|True|yes|YES|Yes|y|Y) open "http://127.0.0.1:${logue_port}" >/dev/null 2>&1 || true ;;
esac
