#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-linux-installer-test.XXXXXX)"
test_home="${test_root}/home"
fixture_v1="${test_root}/release-v1"
fixture_v2="${test_root}/release-v2"
fake_bin="${test_root}/bin"
install_root="${test_home}/.local/share/logue"
data_root="${install_root}/data"
extension_dir="${test_home}/.local/share/logue/extension"
bin_dir="${test_home}/.local/bin"
systemd_dir="${test_home}/.config/systemd/user"
systemd_unit="${systemd_dir}/logue.service"
pid_file="${install_root}/run/logue.pid"
port="${LOGUE_LINUX_TEST_PORT:-18799}"
python_bin="$(command -v python3.13)"
runtime_python="${fake_bin}/python3.13"

cleanup() {
  if [[ -f "${pid_file}" ]]; then
    test_pid="$(tr -dc '0-9' < "${pid_file}")"
    [[ -n "${test_pid}" ]] && kill "${test_pid}" >/dev/null 2>&1 || true
  fi
  [[ "${test_root}" == /tmp/logue-linux-installer-test.* ]] && rm -rf -- "${test_root}"
}
trap cleanup EXIT
mkdir -p "${test_home}" "${fixture_v1}" "${fixture_v2}" "${fake_bin}"

cat > "${fake_bin}/systemctl" <<'SYSTEMCTL'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == --user ]] || exit 64
shift
case "${1:-}" in
  show-environment|daemon-reload|stop|enable|disable) exit 0 ;;
  is-active|is-enabled) exit 1 ;;
  *) exit 64 ;;
esac
SYSTEMCTL
chmod +x "${fake_bin}/systemctl"
ln -s "${python_bin}" "${runtime_python}"

build_fixture() {
  local version="$1" destination="$2" extract_dir
  bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  cp "${repo_dir}/dist/release/logue-python.zip" "${destination}/"
  cp "${repo_dir}/dist/release/checksums.txt" "${destination}/"
  extract_dir="${test_root}/inspect-${version}"
  mkdir -p "${extract_dir}"
  "${python_bin}" -m zipfile -e "${destination}/logue-python.zip" "${extract_dir}"
  if find "${extract_dir}" -type f -exec file {} + | grep -Eq 'ELF|Mach-O'; then
    printf 'release contains a native executable\n' >&2
    exit 1
  fi
  [[ -f "${extract_dir}/python_server/logue_server.py" && -f "${extract_dir}/web/index.html" && -f "${extract_dir}/extension/manifest.json" ]] || {
    printf 'release does not contain prebuilt Web and Extension assets\n' >&2
    exit 1
  }
}

build_missing_microphone_fixture() {
  local source_dir="$1" destination="$2"
  mkdir -p "${destination}"
  "${python_bin}" - "${source_dir}/logue-python.zip" "${destination}/logue-python.zip" <<'PY'
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

source, destination = map(Path, sys.argv[1:])
with ZipFile(source) as archive, ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
    for member in archive.infolist():
        if member.filename == "extension/microphone.html":
            continue
        output.writestr(member, archive.read(member.filename))
PY
  (cd "${destination}" && sha256sum logue-python.zip > checksums.txt)
}

run_installer() {
  local base_url="$1" autostart="$2" address="$3" fail_at="${4:-}"
  local runtime_path
  runtime_path="${fake_bin}:/usr/bin:/bin"
  HOME="${test_home}" \
  PATH="${runtime_path}" \
  LOGUE_INSTALLER_TESTING=1 \
  LOGUE_INSTALLER_TEST_OS=Linux \
  LOGUE_INSTALL_ROOT="${install_root}" \
  LOGUE_DATA_DIR="${data_root}" \
  LOGUE_BIN_DIR="${bin_dir}" \
  LOGUE_SYSTEMD_USER_DIR="${systemd_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
  LOGUE_AUTO_START="${autostart}" \
  LOGUE_INSTALLER_FAIL_AT="${fail_at}" \
  LOGUE_OPEN_BROWSER=no \
  LOGUE_ADDRESS="${address}" \
  LOGUE_TEST_SYSTEMCTL_STATE="${test_root}" \
  LOGUE_TEST_SYSTEMCTL_LOG="${test_root}/systemctl.log" \
  /bin/bash "${repo_dir}/install.sh"
}

if grep -Eq '(^|[^[:alnum:]_])(node|npm|go)([^[:alnum:]_]|$)' "${repo_dir}/install.sh"; then
  printf 'installer invokes a build-time runtime instead of Python 3.13\n' >&2
  exit 1
fi

status_version() {
  curl -fsS "http://127.0.0.1:${port}/v1/status" | grep -Fq "\"version\":\"$1\""
}

printf 'Building platform-independent Python fixture...\n'
build_fixture v0.1.0 "${fixture_v1}"
run_installer "file://${fixture_v1}" yes "0.0.0.0:${port}" >"${test_root}/install.log"
status_version v0.1.0 || { printf 'Python service did not start\n' >&2; exit 1; }
grep -Fq "ExecStart=\"${runtime_python}\" \"${install_root}/current/python_server/logue_server.py\" --address \"0.0.0.0:${port}\"" "${systemd_unit}" || {
  printf 'systemd unit does not use absolute python3.13 and LAN address\n' >&2
  exit 1
}
service_pid="$(tr -dc '0-9' < "${pid_file}")"
service_command="$(ps -p "${service_pid}" -o command=)"
[[ "${service_command}" == *python_server/logue_server.py* ]] || { printf 'service is not the Python server\n' >&2; exit 1; }

if [[ "$(uname -s)" == Linux ]]; then
  lan_host="$(hostname -I | awk '{print $1}')"
  [[ -n "${lan_host}" ]] || { printf 'runner has no LAN address\n' >&2; exit 1; }
  curl --noproxy '*' -fsS "http://${lan_host}:${port}/v1/status" | grep -Fq '"ok":true' || {
    printf 'service is not reachable through its non-loopback address\n' >&2
    exit 1
  }
fi

mkdir -p "${data_root}/items"
printf '%s\n' 'preserve-linux-data' > "${data_root}/items/installer-sentinel.txt"
sentinel_before="$(sha256sum "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
build_fixture v0.1.1 "${fixture_v2}"
manifest_before="$(sha256sum "${extension_dir}/manifest.json" | awk '{print $1}')"
missing_microphone_fixture="${test_root}/missing-microphone-release"
build_missing_microphone_fixture "${fixture_v2}" "${missing_microphone_fixture}"
if run_installer "file://${missing_microphone_fixture}" no "0.0.0.0:${port}" >"${test_root}/missing-microphone.log" 2>&1; then
  printf 'Linux installer accepted a release without microphone.html\n' >&2
  exit 1
fi
status_version v0.1.0 || { printf 'Missing microphone upgrade changed the active service\n' >&2; exit 1; }
[[ "$(sha256sum "${extension_dir}/manifest.json" | awk '{print $1}')" == "${manifest_before}" ]] || { printf 'Missing microphone upgrade changed the active manifest\n' >&2; exit 1; }
run_installer "file://${fixture_v2}" no "0.0.0.0:${port}" >"${test_root}/upgrade.log"
status_version v0.1.1 || { printf 'Python upgrade did not start\n' >&2; exit 1; }
sentinel_after="$(sha256sum "${data_root}/items/installer-sentinel.txt" | awk '{print $1}')"
[[ "${sentinel_before}" == "${sentinel_after}" ]] || { printf 'upgrade changed persistent data\n' >&2; exit 1; }

printf 'Linux Python-only runtime, LAN access, and data-preservation regression passed.\n'
