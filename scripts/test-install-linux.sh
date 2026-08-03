#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-linux-installer-test.XXXXXX)"
test_home="${test_root}/home"
fixture_v1="${test_root}/release-v1"
fixture_v2="${test_root}/release-v2"
fake_bin="${test_root}/bin"
systemctl_state="${test_root}/systemctl-state"
systemctl_log="${test_root}/systemctl.log"
install_root="${test_home}/.local/share/logue"
data_root="${install_root}/data"
bin_dir="${test_home}/.local/bin"
systemd_dir="${test_home}/.config/systemd/user"
systemd_unit="${systemd_dir}/logue.service"
pid_file="${install_root}/run/logue.pid"
port="${LOGUE_LINUX_TEST_PORT:-18799}"

cleanup() {
  if [[ -f "${pid_file}" ]]; then
    test_pid="$(tr -dc '0-9' < "${pid_file}")"
    if [[ -n "${test_pid}" ]] && kill -0 "${test_pid}" >/dev/null 2>&1; then
      kill "${test_pid}" >/dev/null 2>&1 || true
    fi
  fi
  if [[ "${test_root}" == /tmp/logue-linux-installer-test.* && -d "${test_root}" ]]; then
    rm -rf -- "${test_root}"
  fi
}
trap cleanup EXIT

mkdir -p "${test_home}" "${fixture_v1}" "${fixture_v2}" "${fake_bin}" "${systemctl_state}"
: > "${systemctl_log}"

cat > "${fake_bin}/systemctl" <<'SYSTEMCTL'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == "--user" ]] || exit 64
shift
command_name="${1:-}"
shift || true
printf '%s %s\n' "${command_name}" "$*" >> "${LOGUE_TEST_SYSTEMCTL_LOG:?}"
case "${command_name}" in
  show-environment|daemon-reload) exit 0 ;;
  stop) [[ ! -f "${LOGUE_TEST_SYSTEMCTL_STATE:?}/fail-stop" ]] ;;
  is-active) [[ -f "${LOGUE_TEST_SYSTEMCTL_STATE:?}/active-after-stop" ]] ;;
  is-enabled) [[ -f "${LOGUE_TEST_SYSTEMCTL_STATE:?}/enabled" ]] ;;
  enable) : > "${LOGUE_TEST_SYSTEMCTL_STATE:?}/enabled" ;;
  disable) rm -f -- "${LOGUE_TEST_SYSTEMCTL_STATE:?}/enabled" ;;
  *) exit 64 ;;
esac
SYSTEMCTL
chmod +x "${fake_bin}/systemctl"

case "$(uname -m)" in
  arm64|aarch64) host_arch="arm64" ;;
  x86_64|amd64) host_arch="amd64" ;;
  *) printf 'Unsupported test host architecture: %s\n' "$(uname -m)" >&2; exit 69 ;;
esac

if [[ "$(uname -s)" == "Darwin" ]]; then
  runtime_platform="darwin"
else
  runtime_platform="linux"
fi

build_fixture() {
  local version="$1" destination="$2" runtime_asset target_asset
  bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  runtime_asset="${repo_dir}/dist/release/logue-${runtime_platform}-${host_arch}.tar.gz"
  target_asset="${destination}/logue-linux-amd64.tar.gz"
  cp "${runtime_asset}" "${target_asset}"
  (
    cd "${destination}"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum logue-linux-amd64.tar.gz > checksums.txt
    else
      shasum -a 256 logue-linux-amd64.tar.gz > checksums.txt
    fi
  )
}

run_installer() {
  local base_url="$1" autostart="$2" address="$3" fail_at="${4:-}"
  HOME="${test_home}" \
  PATH="${fake_bin}:${PATH}" \
  LOGUE_INSTALLER_TESTING=1 \
  LOGUE_INSTALLER_TEST_OS=Linux \
  LOGUE_INSTALLER_TEST_ARCH=x86_64 \
  LOGUE_INSTALL_ROOT="${install_root}" \
  LOGUE_BIN_DIR="${bin_dir}" \
  LOGUE_SYSTEMD_USER_DIR="${systemd_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
  LOGUE_AUTO_START="${autostart}" \
  LOGUE_INSTALLER_FAIL_AT="${fail_at}" \
  LOGUE_OPEN_BROWSER=no \
  LOGUE_PORT="${port}" \
  LOGUE_ADDRESS="${address}" \
  LOGUE_TEST_SYSTEMCTL_STATE="${systemctl_state}" \
  LOGUE_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
  bash "${repo_dir}/install.sh"
}

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

printf 'Building Linux installer v0.1.0 fixture...\n'
build_fixture v0.1.0 "${fixture_v1}"

noninteractive_log="${test_root}/noninteractive.log"
systemctl_log_before="$(wc -l < "${systemctl_log}" 2>/dev/null || printf '0')"
if HOME="${test_home}" \
  PATH="${fake_bin}:${PATH}" \
  LOGUE_INSTALLER_TESTING=1 \
  LOGUE_INSTALLER_TEST_OS=Linux \
  LOGUE_INSTALLER_TEST_ARCH=x86_64 \
  LOGUE_INSTALL_ROOT="${test_root}/noninteractive-install" \
  LOGUE_SYSTEMD_USER_DIR="${test_root}/noninteractive-systemd" \
  LOGUE_ASSET_BASE_URL="file://${test_root}/missing-release" \
  LOGUE_AUTO_START='' \
  LOGUE_OPEN_BROWSER=no \
  LOGUE_TEST_SYSTEMCTL_STATE="${systemctl_state}" \
  LOGUE_TEST_SYSTEMCTL_LOG="${systemctl_log}" \
  bash "${repo_dir}/install.sh" </dev/null >"${noninteractive_log}" 2>&1; then
  printf 'Installer unexpectedly succeeded with a missing noninteractive fixture\n' >&2
  exit 1
fi
grep -Fq 'No interactive terminal; automatic startup stays off.' "${noninteractive_log}" || {
  printf 'Noninteractive installation did not default automatic startup to off\n' >&2
  exit 1
}
grep -Fq 'No interactive terminal; using 0.0.0.0:' "${noninteractive_log}" || {
  printf 'Noninteractive installation did not default to network access\n' >&2
  exit 1
}
systemctl_log_after="$(wc -l < "${systemctl_log}" 2>/dev/null || printf '0')"
[[ "${systemctl_log_before}" == "${systemctl_log_after}" ]] || { printf 'Noninteractive installation unexpectedly contacted systemd\n' >&2; exit 1; }

linux_install_log="${test_root}/linux-install.log"
run_installer "file://${fixture_v1}" yes "" >"${linux_install_log}"
grep -Fq 'Next on your Mac:' "${linux_install_log}" || { printf 'Linux install omitted the standalone Mac Extension command\n' >&2; exit 1; }
grep -Fq 'install-extension.sh | bash' "${linux_install_log}" || { printf 'Linux install printed an incomplete standalone Mac Extension command\n' >&2; exit 1; }
if grep -Fq 'Load unpacked' "${linux_install_log}" || grep -Fq 'chrome://extensions' "${linux_install_log}"; then
  printf 'Linux service install incorrectly printed local Chrome setup steps\n' >&2
  exit 1
fi

status_v1="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
[[ "${status_v1}" == *'"version":"v0.1.0"'* ]] || { printf 'Linux fixture v0.1.0 did not start\n' >&2; exit 1; }
[[ -f "${systemd_unit}" ]] || { printf 'systemd user service was not created\n' >&2; exit 1; }
[[ -f "${systemctl_state}/enabled" ]] || { printf 'systemd user service was not enabled\n' >&2; exit 1; }
grep -Fq "ExecStart=\"${install_root}/current/bin/logue\" -address \"0.0.0.0:${port}\"" "${systemd_unit}" || {
  printf 'systemd user service has the wrong command or listen address\n' >&2
  exit 1
}
if [[ "$(uname -s)" == "Linux" ]] && command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze --user verify "${systemd_unit}" >/dev/null || { printf 'systemd rejected the generated user service\n' >&2; exit 1; }
fi
grep -Fq 'enable logue.service' "${systemctl_log}" || { printf 'systemd enable was not requested\n' >&2; exit 1; }

mkdir -p "${data_root}/items"
printf '%s\n' 'preserve-linux-data' > "${data_root}/items/installer-sentinel.txt"
sentinel_before="$(file_sha256 "${data_root}/items/installer-sentinel.txt")"
baseline_current="$(readlink "${install_root}/current")"

printf 'Building Linux installer v0.1.1 fixture...\n'
build_fixture v0.1.1 "${fixture_v2}"

pid_before_stop_failure="$(tr -dc '0-9' < "${pid_file}")"
: > "${systemctl_state}/fail-stop"
stop_failure_log="${test_root}/stop-failure.log"
if run_installer "file://${fixture_v2}" yes "127.0.0.1:${port}" >"${stop_failure_log}" 2>&1; then
  printf 'Installer unexpectedly ignored a systemd stop failure\n' >&2
  exit 1
fi
rm -f -- "${systemctl_state}/fail-stop"
[[ "$(readlink "${install_root}/current")" == "${baseline_current}" ]] || { printf 'systemd stop failure switched current\n' >&2; exit 1; }
[[ "$(tr -dc '0-9' < "${pid_file}")" == "${pid_before_stop_failure}" ]] || { printf 'systemd stop failure replaced the running service\n' >&2; exit 1; }
kill -0 "${pid_before_stop_failure}" >/dev/null 2>&1 || { printf 'systemd stop failure did not leave the prior service running\n' >&2; exit 1; }
grep -Fq 'Could not stop the existing service safely' "${stop_failure_log}" || { printf 'systemd stop failure was not reported clearly\n' >&2; exit 1; }

pid_before_active_failure="$(tr -dc '0-9' < "${pid_file}")"
: > "${systemctl_state}/active-after-stop"
active_failure_log="${test_root}/active-after-stop.log"
if run_installer "file://${fixture_v2}" yes "127.0.0.1:${port}" >"${active_failure_log}" 2>&1; then
  printf 'Installer unexpectedly switched while systemd still reported the service active\n' >&2
  exit 1
fi
rm -f -- "${systemctl_state}/active-after-stop"
[[ "$(readlink "${install_root}/current")" == "${baseline_current}" ]] || { printf 'active systemd service failure switched current\n' >&2; exit 1; }
[[ "$(tr -dc '0-9' < "${pid_file}")" == "${pid_before_active_failure}" ]] || { printf 'active systemd service failure replaced the running service\n' >&2; exit 1; }
kill -0 "${pid_before_active_failure}" >/dev/null 2>&1 || { printf 'active systemd service failure did not leave the prior service running\n' >&2; exit 1; }
[[ "$(file_sha256 "${data_root}/items/installer-sentinel.txt")" == "${sentinel_before}" ]] || { printf 'active systemd service failure changed persistent data\n' >&2; exit 1; }
grep -Fq 'Could not stop the existing service safely' "${active_failure_log}" || { printf 'active systemd service failure was not reported clearly\n' >&2; exit 1; }

failure_log="${test_root}/rollback.log"
if run_installer "file://${fixture_v2}" no "0.0.0.0:${port}" autostart >"${failure_log}" 2>&1; then
  printf 'Injected Linux autostart failure unexpectedly succeeded\n' >&2
  exit 1
fi
[[ "$(readlink "${install_root}/current")" == "${baseline_current}" ]] || { printf 'Linux rollback did not restore current\n' >&2; exit 1; }
[[ -f "${systemd_unit}" && -f "${systemctl_state}/enabled" ]] || { printf 'Linux rollback did not restore enabled systemd service\n' >&2; exit 1; }
restored_status="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
[[ "${restored_status}" == *'"version":"v0.1.0"'* ]] || { printf 'Linux rollback did not restore the prior service\n' >&2; exit 1; }
[[ "$(file_sha256 "${data_root}/items/installer-sentinel.txt")" == "${sentinel_before}" ]] || { printf 'Linux rollback changed persistent data\n' >&2; exit 1; }

upgrade_log="${test_root}/upgrade.log"
run_installer "file://${fixture_v2}" no "0.0.0.0:${port}" >"${upgrade_log}"
status_v2="$(curl -fsS "http://127.0.0.1:${port}/v1/status")"
[[ "${status_v2}" == *'"version":"v0.1.1"'* ]] || { printf 'Linux fixture v0.1.1 did not start on the explicit LAN address\n' >&2; exit 1; }
if [[ "$(uname -s)" == "Linux" ]]; then
  lan_host="$(hostname -I | awk '{print $1}')"
  [[ -n "${lan_host}" ]] || { printf 'Linux runner has no non-loopback address\n' >&2; exit 1; }
  lan_status="$(curl --noproxy '*' -fsS --max-time 5 "http://${lan_host}:${port}/v1/status")"
  [[ "${lan_status}" == *'"version":"v0.1.1"'* ]] || { printf 'Linux fixture is not reachable through its non-loopback address\n' >&2; exit 1; }
fi
grep -Fq "Listen address: 0.0.0.0:${port}" "${upgrade_log}" || { printf 'Installer did not report the explicit listen address\n' >&2; exit 1; }
[[ ! -e "${systemd_unit}" && ! -e "${systemctl_state}/enabled" ]] || { printf 'systemd user service was not disabled and removed\n' >&2; exit 1; }
grep -Fq 'disable logue.service' "${systemctl_log}" || { printf 'systemd disable was not requested\n' >&2; exit 1; }
[[ "$(file_sha256 "${data_root}/items/installer-sentinel.txt")" == "${sentinel_before}" ]] || { printf 'Linux upgrade changed persistent data\n' >&2; exit 1; }

printf 'Linux installer startup, LAN listen, rollback, and data-preservation regression passed.\n'
