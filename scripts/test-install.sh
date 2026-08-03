#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-installer-test.XXXXXX)"
test_home="${test_root}/home"
fixture_v1="${test_root}/release-v1"
fixture_v2="${test_root}/release-v2"
install_root="${test_home}/.local/share/logue"
data_root="${test_home}/Library/Application Support/Logue"
bin_dir="${test_home}/.local/bin"
launch_dir="${test_home}/Library/LaunchAgents"
launch_plist="${launch_dir}/com.ralphite.logue.plist"
port="${LOGUE_TEST_PORT:-18798}"
pid_file="${install_root}/run/logue.pid"
probe_done="${test_root}/reinstall-done"
probe_pid=""

cleanup() {
  if [[ -n "${probe_pid}" ]] && kill -0 "${probe_pid}" >/dev/null 2>&1; then
    : > "${probe_done}"
    kill "${probe_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -f "${pid_file}" ]]; then
    test_pid="$(tr -dc '0-9' < "${pid_file}")"
    if [[ -n "${test_pid}" ]] && kill -0 "${test_pid}" >/dev/null 2>&1; then
      kill "${test_pid}" >/dev/null 2>&1 || true
    fi
  fi
  if [[ "${test_root}" == /tmp/logue-installer-test.* && -d "${test_root}" ]]; then
    rm -rf -- "${test_root}"
  fi
}
trap cleanup EXIT

mkdir -p "${test_home}" "${fixture_v1}" "${fixture_v2}"

build_fixture() {
  local version="$1" destination="$2"
  bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  cp "${repo_dir}/dist/release/logue-darwin-arm64.tar.gz" "${destination}/"
  cp "${repo_dir}/dist/release/logue-darwin-amd64.tar.gz" "${destination}/"
  cp "${repo_dir}/dist/release/checksums.txt" "${destination}/"
}

run_installer() {
  local base_url="$1" autostart="$2" fail_at="${3:-}"
  HOME="${test_home}" \
  LOGUE_INSTALL_ROOT="${install_root}" \
  LOGUE_DATA_DIR="${data_root}" \
  LOGUE_BIN_DIR="${bin_dir}" \
  LOGUE_LAUNCH_AGENTS_DIR="${launch_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
  LOGUE_AUTO_START="${autostart}" \
  LOGUE_INSTALLER_FAIL_AT="${fail_at}" \
  LOGUE_OPEN_BROWSER=no \
  LOGUE_PORT="${port}" \
  LOGUE_HEALTH_URL="http://127.0.0.1:${port}/v1/status" \
  bash "${repo_dir}/install.sh"
}

assert_loopback_listener() {
  local service_pid="$1" listeners
  listeners="$(lsof -Pan -p "${service_pid}" -iTCP -sTCP:LISTEN 2>/dev/null || true)"
  [[ "${listeners}" == *"127.0.0.1:${port} (LISTEN)"* ]] || {
    printf 'installer must listen on loopback by default\n%s\n' "${listeners}" >&2
    exit 1
  }
}

file_sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

assert_failure_order() {
  local failure_point="$1" log_file="$2" switch_line healthy_line injection_line rollback_line
  switch_line="$(grep -nF 'App switched to v0.1.1' "${log_file}" | head -1 | cut -d: -f1)"
  healthy_line="$(grep -nF 'Service started:' "${log_file}" | head -1 | cut -d: -f1)"
  injection_line="$(grep -nF "[test] injected failure after ${failure_point} switch" "${log_file}" | head -1 | cut -d: -f1)"
  rollback_line="$(grep -nF 'previous service were restored. Data was not changed.' "${log_file}" | head -1 | cut -d: -f1)"
  if [[ -z "${switch_line}" || -z "${healthy_line}" || -z "${injection_line}" || -z "${rollback_line}" ]] ||
     (( switch_line >= healthy_line || healthy_line >= injection_line || injection_line >= rollback_line )); then
    printf '%s failure log does not prove candidate health before injection and rollback\n' "${failure_point}" >&2
    sed -n '1,220p' "${log_file}" >&2
    exit 1
  fi
  printf 'AUDIT %s: candidate v0.1.1 switched(line %s), healthy(line %s), injected after switch(line %s), full rollback(line %s)\n' \
    "${failure_point}" "${switch_line}" "${healthy_line}" "${injection_line}" "${rollback_line}"
}

assert_failed_upgrade_restored() {
  local failure_name="$1" pid_expectation="${2:-restarted}" restored_pid restored_status

  [[ "$(readlink "${install_root}/current")" == "${baseline_current}" ]] || {
    printf '%s failure did not restore current\n' "${failure_name}" >&2
    exit 1
  }
  [[ "$(file_sha256 "${extension_manifest}")" == "${baseline_extension_manifest_sha}" ]] || {
    printf '%s failure changed the Extension manifest\n' "${failure_name}" >&2
    exit 1
  }
  [[ -f "${install_root}/extension/${extension_worker_v1}" ]] || {
    printf '%s failure removed the active Extension worker\n' "${failure_name}" >&2
    exit 1
  }
  [[ -f "${install_root}/extension/${extension_content_v1}" ]] || {
    printf '%s failure removed the active Extension content script\n' "${failure_name}" >&2
    exit 1
  }
  [[ -L "${bin_dir}/logue" && "$(readlink "${bin_dir}/logue")" == "${baseline_cli_target}" ]] || {
    printf '%s failure did not restore the CLI link\n' "${failure_name}" >&2
    exit 1
  }
  [[ "$("${bin_dir}/logue" -version)" == "v0.1.0" ]] || {
    printf '%s failure left the CLI on the candidate version\n' "${failure_name}" >&2
    exit 1
  }
  [[ -f "${launch_plist}" && "$(file_sha256 "${launch_plist}")" == "${baseline_launch_plist_sha}" ]] || {
    printf '%s failure did not restore the LaunchAgent\n' "${failure_name}" >&2
    exit 1
  }
  plutil -lint "${launch_plist}" >/dev/null || {
    printf '%s failure restored an invalid LaunchAgent\n' "${failure_name}" >&2
    exit 1
  }
  [[ "$(file_sha256 "${data_root}/items/installer-sentinel.txt")" == "${sentinel_before}" ]] || {
    printf '%s failure changed persistent data\n' "${failure_name}" >&2
    exit 1
  }

  restored_pid="$(tr -dc '0-9' < "${pid_file}")"
  if [[ -z "${restored_pid}" ]] || ! kill -0 "${restored_pid}" >/dev/null 2>&1; then
    printf '%s failure did not leave the old version running\n' "${failure_name}" >&2
    exit 1
  fi
  case "${pid_expectation}" in
    unchanged)
      [[ "${restored_pid}" == "${baseline_pid}" ]] || {
        printf '%s validation stopped the old service before failing\n' "${failure_name}" >&2
        exit 1
      }
      ;;
    restarted)
      [[ "${restored_pid}" != "${baseline_pid}" ]] || {
        printf '%s failure was injected before exercising service rollback\n' "${failure_name}" >&2
        exit 1
      }
      ;;
  esac
  restored_status="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
  [[ "${restored_status}" == *'"version":"v0.1.0"'* ]] || {
    printf '%s failure did not restore the running old version\n' "${failure_name}" >&2
    exit 1
  }
  assert_loopback_listener "${restored_pid}"
}

printf 'Building v0.1.0 fixture...\n'
build_fixture v0.1.0 "${fixture_v1}"
run_installer "file://${fixture_v1}" yes

status_v1="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
[[ "${status_v1}" == *'"version":"v0.1.0"'* ]] || { printf 'v0.1.0 did not start\n' >&2; exit 1; }
[[ -f "${launch_plist}" ]] || { printf 'autostart plist was not created\n' >&2; exit 1; }
plutil -lint "${launch_plist}" >/dev/null || { printf 'autostart plist is invalid\n' >&2; exit 1; }
if grep -q 'GEMINI\|GOOGLE_GENERATIVE_AI' "${launch_plist}"; then
  printf 'autostart plist must not persist API keys\n' >&2
  exit 1
fi
[[ -d "${install_root}/extension" ]] || { printf 'stable extension directory was not created\n' >&2; exit 1; }
[[ ! -L "${install_root}/extension" ]] || { printf 'extension path must remain stable across upgrades\n' >&2; exit 1; }
extension_manifest="${install_root}/extension/manifest.json"
extension_worker_v1="$(sed -n 's/.*"service_worker": "\([^"]*\)".*/\1/p' "${extension_manifest}")"
extension_content_v1="$(sed -n 's/.*"js": \["\([^"]*\)"\].*/\1/p' "${extension_manifest}")"
[[ "${extension_worker_v1}" == releases/v0.1.0-*/background.js ]] || { printf 'v0.1.0 extension worker is not versioned\n' >&2; exit 1; }
[[ "${extension_content_v1}" == releases/v0.1.0-*/content.js ]] || { printf 'v0.1.0 extension content script is not versioned\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_worker_v1}" ]] || { printf 'v0.1.0 extension worker is missing\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_content_v1}" ]] || { printf 'v0.1.0 extension content script is missing\n' >&2; exit 1; }

mkdir -p "${data_root}/items"
printf '%s\n' 'preserve-me' > "${data_root}/items/installer-sentinel.txt"
sentinel_before="$(shasum -a 256 "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
pid_before="$(cat "${pid_file}")"
assert_loopback_listener "${pid_before}"

printf 'Building v0.1.1 fixture...\n'
build_fixture v0.1.1 "${fixture_v2}"

baseline_current="$(readlink "${install_root}/current")"
baseline_extension_manifest_sha="$(file_sha256 "${extension_manifest}")"
baseline_cli_target="$(readlink "${bin_dir}/logue")"
baseline_launch_plist_sha="$(file_sha256 "${launch_plist}")"
baseline_pid="${pid_before}"

printf 'Checking invalid autostart is rejected before stopping the old service...\n'
invalid_autostart_log="${test_root}/invalid-autostart.log"
if run_installer "file://${fixture_v2}" invalid >"${invalid_autostart_log}" 2>&1; then
  printf 'invalid LOGUE_AUTO_START unexpectedly succeeded\n' >&2
  exit 1
fi
assert_failed_upgrade_restored invalid-autostart unchanged

for failure_point in extension cli autostart; do
  printf 'Checking rollback after injected %s failure...\n' "${failure_point}"
  failure_log="${test_root}/failure-${failure_point}.log"
  baseline_pid="$(cat "${pid_file}")"
  if run_installer "file://${fixture_v2}" no "${failure_point}" >"${failure_log}" 2>&1; then
    printf 'injected %s failure unexpectedly succeeded\n' "${failure_point}" >&2
    exit 1
  fi
  assert_failure_order "${failure_point}" "${failure_log}"
  assert_failed_upgrade_restored "${failure_point}"
done

pid_before="$(cat "${pid_file}")"
assert_loopback_listener "${pid_before}"
run_installer "file://${fixture_v2}" no

status_v2="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
[[ "${status_v2}" == *'"version":"v0.1.1"'* ]] || { printf 'v0.1.1 did not start\n' >&2; exit 1; }
pid_after="$(cat "${pid_file}")"
assert_loopback_listener "${pid_after}"
[[ "${pid_before}" != "${pid_after}" ]] || { printf 'old service was not replaced\n' >&2; exit 1; }
kill -0 "${pid_after}" >/dev/null 2>&1 || { printf 'new service is not running\n' >&2; exit 1; }
if kill -0 "${pid_before}" >/dev/null 2>&1; then
  printf 'old service is still running\n' >&2
  exit 1
fi
sentinel_after="$(shasum -a 256 "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
[[ "${sentinel_before}" == "${sentinel_after}" ]] || { printf 'persistent data changed during upgrade\n' >&2; exit 1; }
[[ ! -e "${launch_plist}" ]] || { printf 'autostart plist was not removed after opt-out\n' >&2; exit 1; }
[[ "$("${install_root}/current/bin/logue" -version)" == "v0.1.1" ]] || { printf 'current binary version mismatch\n' >&2; exit 1; }
extension_worker_v2="$(sed -n 's/.*"service_worker": "\([^"]*\)".*/\1/p' "${extension_manifest}")"
extension_content_v2="$(sed -n 's/.*"js": \["\([^"]*\)"\].*/\1/p' "${extension_manifest}")"
[[ "${extension_worker_v2}" == releases/v0.1.1-*/background.js ]] || { printf 'v0.1.1 extension worker is not versioned\n' >&2; exit 1; }
[[ "${extension_content_v2}" == releases/v0.1.1-*/content.js ]] || { printf 'v0.1.1 extension content script is not versioned\n' >&2; exit 1; }
[[ "${extension_worker_v1}" != "${extension_worker_v2}" ]] || { printf 'extension manifest did not switch assets\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_worker_v1}" ]] || { printf 'previous extension worker disappeared during upgrade\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_content_v1}" ]] || { printf 'previous extension content script disappeared during upgrade\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_worker_v2}" ]] || { printf 'v0.1.1 extension worker is missing\n' >&2; exit 1; }
[[ -f "${install_root}/extension/${extension_content_v2}" ]] || { printf 'v0.1.1 extension content script is missing\n' >&2; exit 1; }

current_before_reinstall="$(readlink "${install_root}/current")"
pid_before_reinstall="${pid_after}"
probe_failed="${test_root}/current-link-gap"
(
  while [[ ! -e "${probe_done}" ]]; do
    if [[ ! -x "${install_root}/current/bin/logue" ]]; then
      : > "${probe_failed}"
      exit 0
    fi
    sleep 0.01
  done
) &
probe_pid=$!
run_installer "file://${fixture_v2}" no
: > "${probe_done}"
wait "${probe_pid}"
[[ ! -e "${probe_failed}" ]] || { printf 'current link became unavailable during same-version reinstall\n' >&2; exit 1; }
current_after_reinstall="$(readlink "${install_root}/current")"
[[ "${current_before_reinstall}" != "${current_after_reinstall}" ]] || { printf 'same-version reinstall reused the live release directory\n' >&2; exit 1; }
pid_after_reinstall="$(cat "${pid_file}")"
[[ "${pid_before_reinstall}" != "${pid_after_reinstall}" ]] || { printf 'same-version reinstall did not replace the service\n' >&2; exit 1; }
if kill -0 "${pid_before_reinstall}" >/dev/null 2>&1; then
  printf 'same-version reinstall left the old service running\n' >&2
  exit 1
fi
sentinel_after_reinstall="$(shasum -a 256 "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
[[ "${sentinel_before}" == "${sentinel_after_reinstall}" ]] || { printf 'same-version reinstall changed persistent data\n' >&2; exit 1; }

printf 'Installer new-install and overwrite-upgrade regression passed.\n'
