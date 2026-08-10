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
data_root="${test_home}/.local/share/logue-data"
bin_dir="${test_home}/.local/bin"
pid_file="${install_root}/run/logue.pid"
port="${LOGUE_TEST_PORT:-18798}"
python_bin="$(command -v python3.13)"

cleanup() {
  if [[ -f "${pid_file}" ]]; then
    test_pid="$(tr -dc '0-9' < "${pid_file}")"
    [[ -n "${test_pid}" ]] && kill "${test_pid}" >/dev/null 2>&1 || true
  fi
  [[ "${test_root}" == /tmp/logue-installer-test.* ]] && rm -rf -- "${test_root}"
}
trap cleanup EXIT
mkdir -p "${test_home}" "${fixture_v1}" "${fixture_v2}"

die() { printf '%s\n' "$*" >&2; exit 1; }
file_sha256() { "${python_bin}" -c 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$1"; }

# The Extension is rebuilt in a parallel workstream. When its real dist is not
# on disk yet, stand in a minimal MV3 build so the installer path under test is
# still the real one: real zip, real checksum, real manifest rewrite.
extension_dist="${repo_dir}/extension/dist"
if [[ ! -f "${extension_dist}/manifest.json" ]]; then
  extension_dist="${test_root}/extension-dist"
  printf 'extension/dist is missing; using a minimal stand-in Extension build.\n'
  "${python_bin}" - "${extension_dist}" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
(root / "assets").mkdir(parents=True)
(root / "manifest.json").write_text(json.dumps({
    "manifest_version": 3, "name": "Logue", "version": "0.0.0", "version_name": "v0.0.0",
    "background": {"service_worker": "background.js", "type": "module"},
    "side_panel": {"default_path": "sidepanel.html"},
    "content_scripts": [{"matches": ["<all_urls>"], "js": ["content.js"], "css": ["content.css"]}],
    "permissions": ["sidePanel", "offscreen", "storage"],
}, indent=2) + "\n")
(root / "background.js").write_text("// stand-in service worker\n")
(root / "content.js").write_text("// stand-in content script\n")
(root / "content.css").write_text("/* stand-in */\n")
(root / "sidepanel.html").write_text('<div id="root"></div><link href="./assets/sidepanel.css" rel="stylesheet"><script src="./assets/sidepanel.js"></script>\n')
(root / "offscreen.html").write_text('<script src="./assets/offscreen.js"></script>\n')
(root / "assets" / "sidepanel.js").write_text("// stand-in\n")
(root / "assets" / "sidepanel.css").write_text("/* stand-in */\n")
(root / "assets" / "offscreen.js").write_text("// stand-in\n")
PY
fi

build_fixture() {
  local version="$1" destination="$2"
  LOGUE_RELEASE_SKIP_NPM_CI=1 LOGUE_EXTENSION_DIST="${extension_dist}" \
    bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  cp "${repo_dir}/dist/release/logue.zip" "${repo_dir}/dist/release/checksums.txt" "${destination}/"
}

run_installer() {
  local base_url="$1" output_file="$2" fail_at="${3:-}" data_dir="${4:-${data_root}}"
  HOME="${test_home}" \
  LOGUE_INSTALL_ROOT="${install_root}" \
  LOGUE_DATA_DIR="${data_dir}" \
  LOGUE_BIN_DIR="${bin_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
  LOGUE_ADDRESS="127.0.0.1:${port}" \
  LOGUE_INSTALLER_FAIL_AT="${fail_at}" \
    bash "${repo_dir}/install.sh" >"${output_file}" 2>&1
}

status_data_dir() {
  curl -fsS "http://127.0.0.1:${port}/v1/status" |
    "${python_bin}" -c 'import json,sys;s=json.load(sys.stdin);print(s["data_dir"] if s.get("ok") else "")'
}

# A Host that answers the API but not `/` is an install whose only documented
# URL returns JSON, which every earlier check here would still call a success.
serves_app() {
  curl -fsS "http://127.0.0.1:${port}/" | grep -q '<div id="root"'
}

# "Download one zip, run it with system Python" — an installer that reaches for
# a build toolchain has quietly broken the product promise.
if grep -qE '(^|[^[:alnum:]_])(node|npm|go|pip)([^[:alnum:]_]|$)' "${repo_dir}/install.sh"; then
  die 'installer invokes a build-time runtime instead of Python 3.13'
fi

printf 'Building %s fixture...\n' "${release_v1}"
build_fixture "${release_v1}" "${fixture_v1}"

# Fail-closed before anything is downloaded or created: a data root inside the
# install root would be destroyed by a program rollback.
if run_installer "file://${fixture_v1}" "${test_root}/overlap.log" "" "${install_root}/data"; then
  die 'installer accepted a data root inside the install root'
fi
grep -Fq 'overlaps installer-managed paths' "${test_root}/overlap.log" || die 'overlap rejection did not name the reason'
[[ ! -e "${install_root}" ]] || die 'overlap rejection still created the install root'

run_installer "file://${fixture_v1}" "${test_root}/first.log"
[[ -L "${install_root}/current" ]] || die 'current is not a symlink'
current_v1="$(readlink "${install_root}/current")"
[[ "${current_v1}" == "${install_root}/releases/${release_v1}."* ]] || die "current does not point at a versioned release: ${current_v1}"
[[ -f "${install_root}/current/server/logue_host/__main__.py" ]] || die 'Host is missing from the installed release'
[[ -f "${install_root}/current/web/index.html" ]] || die 'Web App is missing from the installed release'
[[ -x "${bin_dir}/logue" && ! -L "${bin_dir}/logue" ]] || die 'CLI is not a text wrapper'
grep -Fq "${python_bin}" "${bin_dir}/logue" || die 'CLI does not use absolute python3.13'
[[ "$("${bin_dir}/logue" --version)" == "${release_v1}" ]] || die 'CLI reports the wrong version'
[[ "$(status_data_dir)" == "$("${python_bin}" -c 'import pathlib,sys;print(pathlib.Path(sys.argv[1]).resolve())' "${data_root}")" ]] || die 'Host is not serving the installed data root'
[[ "$(readlink "${install_root}/web")" == "${install_root}/current/web" ]] || die 'app link does not point through current'
serves_app || die 'Host is serving the API only, not the Web App'
printf 'First install: staged release, atomic current symlink, CLI, app, and running Host verified.\n'

mkdir -p "${data_root}/items"
printf '%s\n' 'preserve-me' > "${data_root}/items/installer-sentinel.txt"
sentinel_before="$(file_sha256 "${data_root}/items/installer-sentinel.txt")"

bad_fixture="${test_root}/bad-release"
mkdir -p "${bad_fixture}"
cp "${fixture_v1}/logue.zip" "${fixture_v1}/checksums.txt" "${bad_fixture}/"
printf '%s\n' 'corrupt' >> "${bad_fixture}/logue.zip"
if run_installer "file://${bad_fixture}" "${test_root}/bad.log"; then
  die 'installer accepted a bad checksum'
fi
[[ "$(readlink "${install_root}/current")" == "${current_v1}" ]] || die 'bad checksum changed the active release'
[[ "$(status_data_dir)" != "" ]] || die 'bad checksum stopped the running Host'

printf 'Building %s fixture...\n' "${release_v2}"
build_fixture "${release_v2}" "${fixture_v2}"
if run_installer "file://${fixture_v2}" "${test_root}/rollback.log" cli; then
  die 'injected upgrade failure unexpectedly succeeded'
fi
[[ "$(readlink "${install_root}/current")" == "${current_v1}" ]] || die 'rollback did not restore the previous release'
[[ "$("${bin_dir}/logue" --version)" == "${release_v1}" ]] || die 'rollback did not restore the previous CLI'
[[ "$(status_data_dir)" != "" ]] || die 'rollback did not restart the previous Host'
if compgen -G "${install_root}/releases/${release_v2}.*" >/dev/null; then die 'rollback left the failed candidate behind'; fi
printf 'Rollback: previous release, CLI, and service restored; failed candidate removed.\n'

run_installer "file://${fixture_v2}" "${test_root}/upgrade.log"
current_v2="$(readlink "${install_root}/current")"
[[ "${current_v2}" == "${install_root}/releases/${release_v2}."* ]] || die 'upgrade did not switch current'
[[ "${current_v2}" != "${current_v1}" ]] || die 'upgrade reused the previous release directory'
[[ "$("${bin_dir}/logue" --version)" == "${release_v2}" ]] || die 'upgrade did not switch the CLI'
[[ "$(status_data_dir)" != "" ]] || die 'upgrade did not leave a running Host'
serves_app || die 'upgrade left the Host serving the API only'
[[ "$(file_sha256 "${data_root}/items/installer-sentinel.txt")" == "${sentinel_before}" ]] || die 'upgrade changed persistent data'

printf 'Installer overlap, checksum, atomic switch, rollback, and data-preservation regression passed.\n'
