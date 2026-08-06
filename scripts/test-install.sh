#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-installer-test.XXXXXX)"
test_home="${test_root}/home"
fixture_v1="${test_root}/release-v1"
fixture_v2="${test_root}/release-v2"
workspace_version="$(node -p "require('${repo_dir}/package.json').version")"
release_v1="v${workspace_version}-fixture.1"
release_v2="v${workspace_version}-fixture.2"
install_root="${test_home}/.local/share/logue"
data_root="${test_home}/Library/Application Support/Logue"
bin_dir="${test_home}/.local/bin"
launch_dir="${test_home}/Library/LaunchAgents"
launch_plist="${launch_dir}/com.ralphite.logue.plist"
pid_file="${install_root}/run/logue.pid"
port="${LOGUE_TEST_PORT:-18798}"

cleanup() {
  if [[ -f "${pid_file}" ]]; then
    test_pid="$(tr -dc '0-9' < "${pid_file}")"
    [[ -n "${test_pid}" ]] && kill "${test_pid}" >/dev/null 2>&1 || true
  fi
  [[ "${test_root}" == /tmp/logue-installer-test.* ]] && rm -rf -- "${test_root}"
}
trap cleanup EXIT
mkdir -p "${test_home}" "${fixture_v1}" "${fixture_v2}"

build_fixture() {
  local version="$1" destination="$2"
  bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  cp "${repo_dir}/dist/release/logue-python.zip" "${destination}/"
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

status_version() {
  curl -fsS "http://127.0.0.1:${port}/v1/status" | grep -Fq "\"version\":\"$1\""
}

assert_python_process() {
  local pid command_line
  pid="$(tr -dc '0-9' < "${pid_file}")"
  command_line="$(ps -p "${pid}" -o command=)"
  [[ "${command_line}" == *python_server/logue_server.py* ]] || {
    printf 'service is not running the Python server: %s\n' "${command_line}" >&2
    exit 1
  }
}

printf 'Building Python %s fixture...\n' "${release_v1}"
build_fixture "${release_v1}" "${fixture_v1}"
first_log="${test_root}/first.log"
run_installer "file://${fixture_v1}" yes >"${first_log}"
status_version "${release_v1}" || { printf '%s did not start\n' "${release_v1}" >&2; exit 1; }
assert_python_process
[[ -f "${launch_plist}" ]] || { printf 'LaunchAgent was not created\n' >&2; exit 1; }
plutil -lint "${launch_plist}" >/dev/null
grep -Fq "$(command -v python3.13)" "${launch_plist}" || { printf 'LaunchAgent does not use absolute python3.13\n' >&2; exit 1; }
grep -Fq 'python_server/logue_server.py' "${launch_plist}" || { printf 'LaunchAgent does not start the Python server\n' >&2; exit 1; }
[[ -x "${bin_dir}/logue" && ! -L "${bin_dir}/logue" ]] || { printf 'CLI is not a text wrapper\n' >&2; exit 1; }
grep -Fq "$(command -v python3.13)" "${bin_dir}/logue" || { printf 'CLI does not use absolute python3.13\n' >&2; exit 1; }

mkdir -p "${data_root}/items"
printf '%s\n' 'preserve-me' > "${data_root}/items/installer-sentinel.txt"
sentinel_before="$(shasum -a 256 "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"

printf 'Building Python %s fixture...\n' "${release_v2}"
build_fixture "${release_v2}" "${fixture_v2}"
rollback_log="${test_root}/rollback.log"
if run_installer "file://${fixture_v2}" no extension >"${rollback_log}" 2>&1; then
  printf 'injected upgrade failure unexpectedly succeeded\n' >&2
  exit 1
fi
status_version "${release_v1}" || { printf 'rollback did not restore %s\n' "${release_v1}" >&2; exit 1; }
assert_python_process

run_installer "file://${fixture_v2}" no >"${test_root}/upgrade.log"
status_version "${release_v2}" || { printf '%s did not start\n' "${release_v2}" >&2; exit 1; }
assert_python_process
sentinel_after="$(shasum -a 256 "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
[[ "${sentinel_before}" == "${sentinel_after}" ]] || { printf 'upgrade changed persistent data\n' >&2; exit 1; }
[[ ! -e "${launch_plist}" ]] || { printf 'autostart was not removed after opt-out\n' >&2; exit 1; }
[[ "$("${bin_dir}/logue" --version)" == "${release_v2}" ]] || { printf 'CLI version mismatch\n' >&2; exit 1; }

printf 'Python installer startup, rollback, and data-preservation regression passed.\n'

LOGUE_EXTENSION_TEST_FIXTURE_V1="${fixture_v1}" \
LOGUE_EXTENSION_TEST_FIXTURE_V2="${fixture_v2}" \
  bash "${repo_dir}/scripts/test-install-extension.sh"
