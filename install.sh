#!/usr/bin/env bash

set -Eeuo pipefail

logue_system="$(uname -s)"
logue_machine="$(uname -m)"
if [[ "${LOGUE_INSTALLER_TESTING:-}" == "1" ]]; then
  logue_system="${LOGUE_INSTALLER_TEST_OS:-${logue_system}}"
  logue_machine="${LOGUE_INSTALLER_TEST_ARCH:-${logue_machine}}"
fi

case "${logue_system}" in
  Darwin) logue_platform="darwin" ;;
  Linux) logue_platform="linux" ;;
  *) printf 'Unsupported operating system: %s\n' "${logue_system}" >&2; exit 69 ;;
esac

case "${logue_machine}" in
  arm64|aarch64) logue_arch="arm64" ;;
  x86_64|amd64) logue_arch="amd64" ;;
  *) printf 'Unsupported %s architecture: %s\n' "${logue_system}" "${logue_machine}" >&2; exit 69 ;;
esac

has_interactive_terminal() {
  [[ -t 0 || -t 1 || -t 2 ]] && [[ -r /dev/tty && -w /dev/tty ]]
}

logue_home="${HOME:?HOME is required}"
install_root="${LOGUE_INSTALL_ROOT:-${logue_home}/.local/share/logue}"
if [[ "${logue_platform}" == "darwin" ]]; then
  default_data_root="${logue_home}/Library/Application Support/Logue"
else
  default_data_root="${XDG_DATA_HOME:-${logue_home}/.local/share}/logue/data"
fi
data_root="${LOGUE_DATA_DIR:-${default_data_root}}"
bin_dir="${LOGUE_BIN_DIR:-${logue_home}/.local/bin}"
launch_agents_dir="${LOGUE_LAUNCH_AGENTS_DIR:-${logue_home}/Library/LaunchAgents}"
launch_label="${LOGUE_LAUNCH_LABEL:-com.ralphite.logue}"
launch_plist="${launch_agents_dir}/${launch_label}.plist"
systemd_user_dir="${LOGUE_SYSTEMD_USER_DIR:-${XDG_CONFIG_HOME:-${logue_home}/.config}/systemd/user}"
systemd_unit_name="${LOGUE_SYSTEMD_UNIT_NAME:-logue.service}"
if [[ ! "${systemd_unit_name}" =~ ^[A-Za-z0-9_.@-]+\.service$ ]]; then
  printf 'LOGUE_SYSTEMD_UNIT_NAME must be a systemd service unit name without a path.\n' >&2
  exit 64
fi
systemd_unit="${systemd_user_dir}/${systemd_unit_name}"
logue_port="${LOGUE_PORT:-8787}"
choose_address() {
  local configured="${LOGUE_ADDRESS:-}" answer
  if [[ -n "${configured}" ]]; then
    printf '%s' "${configured}"
    return
  fi
  if has_interactive_terminal; then
    printf '\nWhere should Logue listen?\n' > /dev/tty
    printf '  1) Network — 0.0.0.0:%s (recommended)\n' "${logue_port}" > /dev/tty
    printf '  2) This computer only — 127.0.0.1:%s\n' "${logue_port}" > /dev/tty
    printf 'Choose 1 or 2 [1]: ' > /dev/tty
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in
      2|local|LOCAL|Local) printf '127.0.0.1:%s' "${logue_port}" ;;
      *) printf '0.0.0.0:%s' "${logue_port}" ;;
    esac
    return
  fi
  printf 'No interactive terminal; using 0.0.0.0:%s so Logue is reachable on the network. Restrict access with a firewall or VPN.\n' "${logue_port}" >&2
  printf '0.0.0.0:%s' "${logue_port}"
}
logue_address="$(choose_address)"
if [[ ! "${logue_address}" =~ ^(\[[^]]+\]|[^:]+):([0-9]+)$ ]]; then
  printf 'LOGUE_ADDRESS must be a host and port, for example 127.0.0.1:8787 or 0.0.0.0:8787.\n' >&2
  exit 64
fi
address_host="${BASH_REMATCH[1]}"
address_port="${BASH_REMATCH[2]}"
if (( address_port < 1 || address_port > 65535 )); then
  printf 'LOGUE_ADDRESS uses an invalid port: %s.\n' "${address_port}" >&2
  exit 64
fi
case "${address_host}" in
  0.0.0.0|'*'|'[::]') health_host="127.0.0.1" ;;
  *) health_host="${address_host}" ;;
esac
health_url="${LOGUE_HEALTH_URL:-http://${health_host}:${address_port}/v1/status}"
open_url="${LOGUE_OPEN_URL:-${health_url%/v1/status}}"
asset_base_url="${LOGUE_ASSET_BASE_URL:-https://github.com/ralphite/logue/releases/latest/download}"
asset_name="logue-${logue_platform}-${logue_arch}.tar.gz"
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
systemd_unit_next=""
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
  [[ -n "${systemd_unit_next}" ]] && rm -f -- "${systemd_unit_next}"
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
  if has_interactive_terminal; then
    if [[ "${logue_platform}" == "darwin" ]]; then
      printf '\nStart Logue when you sign in to this Mac? [Y/n] ' > /dev/tty
    else
      printf '\nCreate a systemd user service to start Logue when you sign in? [Y/n] ' > /dev/tty
    fi
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in n|N|no|NO|No) printf 'no' ;; *) printf 'yes' ;; esac
  else
    say "No interactive terminal; automatic startup stays off. Re-run with LOGUE_AUTO_START=yes to enable it." >&2
    printf 'no'
  fi
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

systemd_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/%/%%/g'
}

replace_path() {
  local source="$1" destination="$2"
  if [[ "$(uname -s)" == "Linux" ]]; then
    /bin/mv -fT -- "${source}" "${destination}"
  else
    /bin/mv -f -h "${source}" "${destination}"
  fi
}

verify_checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${install_tmp}" && sha256sum -c selected-checksum.txt >/dev/null)
  else
    (cd "${install_tmp}" && shasum -a 256 -c selected-checksum.txt >/dev/null)
  fi
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

for required_command in curl tar; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "Missing required system command: ${required_command}."
done
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  fail "Missing required system command: sha256sum or shasum."
fi
if [[ "${logue_platform}" == "darwin" ]]; then
  command -v plutil >/dev/null 2>&1 || fail "Missing required system command: plutil."
elif [[ "${autostart}" == "yes" || -f "${systemd_unit}" ]]; then
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required to manage the existing or requested systemd user service."
fi

printf '\nLogue install and upgrade\n'
say "App: ${install_root}"
say "Data: ${data_root} (never overwritten)"

mkdir -p "${install_root}/releases" "${data_root}" "${bin_dir}" "${run_dir}"
if [[ "${logue_platform}" == "darwin" ]]; then
  mkdir -p "${launch_agents_dir}"
else
  mkdir -p "${systemd_user_dir}"
fi
install_tmp="$(mktemp -d "${install_root}/.install.XXXXXX")"

step "1/4  Download and verify the release"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/${asset_name}" -o "${install_tmp}/${asset_name}"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/checksums.txt" -o "${install_tmp}/checksums.txt"
checksum_line="$(awk -v wanted="${asset_name}" '$2 == wanted || $2 == "./" wanted { print; exit }' "${install_tmp}/checksums.txt")"
[[ -n "${checksum_line}" ]] || fail "checksums.txt does not contain ${asset_name}."
printf '%s\n' "${checksum_line}" > "${install_tmp}/selected-checksum.txt"
verify_checksum || fail "Release verification failed; the existing installation was not changed."
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
systemd_unit_backup="${systemd_user_dir}/.${systemd_unit_name}.previous.$$"
had_extension_manifest="no"
had_cli="no"
had_launch_plist="no"
had_systemd_unit="no"
systemd_was_enabled="no"

validate_managed_service() {
  local old_command systemd_pid
  managed_pid=""
  if [[ "${logue_platform}" == "linux" && -f "${systemd_unit}" ]] && command -v systemctl >/dev/null 2>&1; then
    systemd_pid="$(systemctl --user show --property MainPID --value "${systemd_unit_name}" 2>/dev/null || true)"
    if [[ "${systemd_pid}" =~ ^[1-9][0-9]*$ ]] && kill -0 "${systemd_pid}" >/dev/null 2>&1; then
      old_command="$(ps -p "${systemd_pid}" -o command= 2>/dev/null || true)"
      [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || fail "The systemd user service does not belong to this Logue installation; stopped to avoid terminating another process."
      managed_pid="${systemd_pid}"
      return
    fi
  fi
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
  if [[ "${logue_platform}" == "darwin" ]]; then
    launchctl bootout "gui/$(id -u)" "${launch_plist}" >/dev/null 2>&1 || launchctl unload "${launch_plist}" >/dev/null 2>&1 || true
  elif [[ -f "${systemd_unit}" ]]; then
    systemctl --user stop "${systemd_unit_name}" >/dev/null 2>&1 || return 1
    if systemctl --user is-active --quiet "${systemd_unit_name}" >/dev/null 2>&1; then
      return 1
    fi
  fi
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

create_systemd_unit() {
  local escaped_binary escaped_address escaped_data escaped_web
  escaped_binary="$(systemd_escape "${current_link}/bin/logue")"
  escaped_address="$(systemd_escape "${logue_address}")"
  escaped_data="$(systemd_escape "${data_root}")"
  escaped_web="$(systemd_escape "${current_link}/web")"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Logue service'
    printf '%s\n' 'After=network-online.target'
    printf '%s\n' 'Wants=network-online.target'
    printf '%s\n' ''
    printf '%s\n' '[Service]'
    printf 'Environment="LOGUE_DATA_DIR=%s"\n' "${escaped_data}"
    printf 'Environment="LOGUE_WEB_DIST=%s"\n' "${escaped_web}"
    printf 'ExecStart="%s" -address "%s"\n' "${escaped_binary}" "${escaped_address}"
    printf '%s\n' 'Restart=on-failure'
    printf '%s\n' 'RestartSec=2'
    printf '%s\n' ''
    printf '%s\n' '[Install]'
    printf '%s\n' 'WantedBy=default.target'
  } > "${systemd_unit_next}" || return 1
  chmod 600 "${systemd_unit_next}" || return 1
  grep -Fq "ExecStart=\"${escaped_binary}\" -address \"${escaped_address}\"" "${systemd_unit_next}" || return 1
}

validate_extension_html_assets() {
  local html_file="$1" html_dir asset_ref asset_count=0
  html_dir="$(dirname "${html_file}")"
  while IFS= read -r asset_ref; do
    asset_count=$((asset_count + 1))
    case "${asset_ref}" in
      ./*) ;;
      *) return 1 ;;
    esac
    asset_ref="${asset_ref%%\#*}"
    asset_ref="${asset_ref%%\?*}"
    [[ -f "${html_dir}/${asset_ref}" ]] || return 1
  done < <(grep -Eo '(src|href)="[^"]+"' "${html_file}" | sed -e 's/^[^=]*="//' -e 's/"$//')
  (( asset_count > 0 ))
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
  -e "s|\"default_path\": \"sidepanel.html\"|\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"|" \
  "${release_dir}/extension/manifest.json" > "${extension_manifest_next}"
grep -Fq "\"service_worker\": \"releases/${extension_asset_id}/background.js\"" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned worker; the existing installation was not changed."
grep -Fq "\"js\": [\"releases/${extension_asset_id}/content.js\"]" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned content script; the existing installation was not changed."
grep -Fq "\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned Side Panel; the existing installation was not changed."
[[ -f "${staged_extension_assets}/background.js" && -f "${staged_extension_assets}/content.js" && -f "${staged_extension_assets}/sidepanel.html" ]] || fail "Extension assets are incomplete; the existing installation was not changed."
validate_extension_html_assets "${staged_extension_assets}/sidepanel.html" || fail "Extension Side Panel references missing or non-versioned assets; the existing installation was not changed."

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

if [[ "${logue_platform}" == "darwin" ]]; then
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
else
  if [[ -d "${systemd_unit}" && ! -L "${systemd_unit}" ]]; then
    fail "systemd unit path is a directory; stopped to avoid overwriting unknown content."
  fi
  if [[ -e "${systemd_unit}" || -L "${systemd_unit}" ]]; then
    grep -Fq "${current_link}/bin/logue" "${systemd_unit}" || fail "The existing ${systemd_unit_name} does not belong to this Logue installation; stopped to avoid overwriting it."
    /bin/cp -pP "${systemd_unit}" "${systemd_unit_backup}"
    had_systemd_unit="yes"
    if systemctl --user is-enabled "${systemd_unit_name}" >/dev/null 2>&1; then
      systemd_was_enabled="yes"
    fi
  fi
  if [[ "${autostart}" == "yes" || "${had_systemd_unit}" == "yes" ]]; then
    systemctl --user show-environment >/dev/null 2>&1 || fail "The systemd user manager is unavailable. Re-run with LOGUE_AUTO_START=no or enable the user manager first."
  fi
  if [[ "${autostart}" == "yes" ]]; then
    systemd_unit_next="${systemd_user_dir}/.${systemd_unit_name}.next.$$"
    create_systemd_unit || fail "Could not create a valid systemd user service; the existing installation was not changed."
  fi
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
  replace_path "${next_link}" "${current_link}" || return 1
  current_switched="yes"
  say "App switched to ${logue_version}"

  start_service "${logue_version}" || return 1
  say "Service started: ${health_url}"

  /bin/mv -f "${extension_manifest_next}" "${extension_dir}/manifest.json" || return 1
  say "Extension switched atomically to ${logue_version}"
  inject_failure extension || return 1

  replace_path "${cli_next}" "${bin_dir}/logue" || return 1
  inject_failure cli || return 1

  if [[ "${logue_platform}" == "darwin" ]]; then
    if [[ "${autostart}" == "yes" ]]; then
      replace_path "${launch_plist_next}" "${launch_plist}" || return 1
    else
      rm -f -- "${launch_plist}" || return 1
    fi
  else
    if [[ "${autostart}" == "yes" ]]; then
      replace_path "${systemd_unit_next}" "${systemd_unit}" || return 1
      systemctl --user daemon-reload >/dev/null || return 1
      systemctl --user enable "${systemd_unit_name}" >/dev/null || return 1
    elif [[ "${had_systemd_unit}" == "yes" ]]; then
      systemctl --user disable "${systemd_unit_name}" >/dev/null || return 1
      rm -f -- "${systemd_unit}" || return 1
      systemctl --user daemon-reload >/dev/null || return 1
    fi
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
    replace_path "${cli_backup}" "${bin_dir}/logue" || rollback_failed="yes"
  else
    rm -f -- "${bin_dir}/logue" || rollback_failed="yes"
  fi
  if [[ "${logue_platform}" == "darwin" ]]; then
    if [[ "${had_launch_plist}" == "yes" ]]; then
      replace_path "${launch_plist_backup}" "${launch_plist}" || rollback_failed="yes"
    else
      rm -f -- "${launch_plist}" || rollback_failed="yes"
    fi
  else
    if [[ "${had_systemd_unit}" == "yes" ]]; then
      replace_path "${systemd_unit_backup}" "${systemd_unit}" || rollback_failed="yes"
    else
      rm -f -- "${systemd_unit}" || rollback_failed="yes"
    fi
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --user daemon-reload >/dev/null || rollback_failed="yes"
      if [[ "${systemd_was_enabled}" == "yes" ]]; then
        systemctl --user enable "${systemd_unit_name}" >/dev/null || rollback_failed="yes"
      else
        systemctl --user disable "${systemd_unit_name}" >/dev/null 2>&1 || true
      fi
    fi
  fi

  if [[ -n "${previous_current}" ]]; then
    rollback_link="${install_root}/.current.rollback.$$"
    ln -s "${previous_current}" "${rollback_link}" || rollback_failed="yes"
    replace_path "${rollback_link}" "${current_link}" || rollback_failed="yes"
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

rm -f -- "${extension_manifest_backup}" "${cli_backup}" "${launch_plist_backup}" "${systemd_unit_backup}"
if [[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]]; then rm -rf -- "${previous_current_backup}"; fi
staged_release_dir=""
staged_extension_assets=""

printf '\n✓ Logue %s is installed and running\n' "${logue_version}"
say "Open: ${open_url}"
say "Listen address: ${logue_address}"
case "${address_host}" in
  0.0.0.0|'*'|'[::]') say "Security: Logue has no public-internet authentication. Limit access with a firewall, VPN, or controlled reverse proxy." ;;
esac
if [[ "${logue_platform}" == "linux" ]]; then
  say "Next on your Mac: curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install-extension.sh | bash"
else
  say "Extension folder: ${extension_dir}"
  say "Chrome will not install or update an unpacked Extension silently"
fi
if [[ "${logue_platform}" == "darwin" && "${had_extension_manifest}" == "no" ]]; then
  printf '\nFirst-time Chrome setup:\n'
  printf '%s\n' '  1. Open chrome://extensions.'
  printf '%s\n' '  2. Turn on Developer mode.'
  printf '%s\n' '  3. Click Load unpacked.'
  printf '  4. Select: %s\n' "${extension_dir}"
elif [[ "${logue_platform}" == "darwin" ]]; then
  say "Extension upgrade: open chrome://extensions and click Reload on the Logue card"
  say "Do not use Load unpacked again"
fi
say "Command: ${bin_dir}/logue"
say "Data remains at: ${data_root}"

open_browser="${LOGUE_OPEN_BROWSER:-}"
if [[ -z "${open_browser}" ]]; then
  has_interactive_terminal && open_browser="yes" || open_browser="no"
fi
case "${open_browser}" in
  1|true|TRUE|True|yes|YES|Yes|y|Y)
    if [[ "${logue_platform}" == "darwin" ]]; then
      open "${open_url}" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "${open_url}" >/dev/null 2>&1 || true
    fi
    ;;
esac
