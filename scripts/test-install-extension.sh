#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-extension-installer-test.XXXXXX)"
test_home="${test_root}/home"
extension_dir="${test_home}/.local/share/logue/extension"
fixture_v1="${LOGUE_EXTENSION_TEST_FIXTURE_V1:-${test_root}/release-v1}"
fixture_v2="${LOGUE_EXTENSION_TEST_FIXTURE_V2:-${test_root}/release-v2}"

cleanup() {
  if [[ "${test_root}" == /tmp/logue-extension-installer-test.* && -d "${test_root}" ]]; then
    rm -rf -- "${test_root}"
  fi
}
trap cleanup EXIT

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

build_fixture() {
  local version="$1" destination="$2"
  mkdir -p "${destination}"
  bash "${repo_dir}/scripts/build-release.sh" "${version}" >/dev/null
  cp "${repo_dir}/dist/release/logue-extension.tar.gz" "${destination}/"
  cp "${repo_dir}/dist/release/checksums.txt" "${destination}/"
}

run_installer() {
  local base_url="$1" output_file="$2"
  HOME="${test_home}" \
  LOGUE_EXTENSION_DIR="${extension_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
  bash "${repo_dir}/install-extension.sh" >"${output_file}" 2>&1
}

assert_installed_extension() {
  local version="$1" manifest worker content sidepanel html_file html_dir asset_ref asset_count=0
  manifest="${extension_dir}/manifest.json"
  worker="$(sed -n 's/.*"service_worker": "\([^"]*\)".*/\1/p' "${manifest}")"
  content="$(sed -n 's/.*"js": \["\([^"]*\)"\].*/\1/p' "${manifest}")"
  sidepanel="$(sed -n 's/.*"default_path": "\([^"]*\)".*/\1/p' "${manifest}")"
  [[ "${worker}" == releases/${version}-*/background.js ]] || { printf '%s standalone worker is not versioned\n' "${version}" >&2; exit 1; }
  [[ "${content}" == releases/${version}-*/content.js ]] || { printf '%s standalone content script is not versioned\n' "${version}" >&2; exit 1; }
  [[ "${sidepanel}" == releases/${version}-*/sidepanel.html ]] || { printf '%s standalone Side Panel is not versioned\n' "${version}" >&2; exit 1; }
  [[ -f "${extension_dir}/${worker}" && -f "${extension_dir}/${content}" && -f "${extension_dir}/${sidepanel}" ]] || { printf '%s standalone Extension assets are incomplete\n' "${version}" >&2; exit 1; }
  html_file="${extension_dir}/${sidepanel}"
  html_dir="$(dirname "${html_file}")"
  while IFS= read -r asset_ref; do
    asset_count=$((asset_count + 1))
    case "${asset_ref}" in
      ./*) ;;
      *) printf 'Standalone Side Panel asset is not relative: %s\n' "${asset_ref}" >&2; exit 1 ;;
    esac
    asset_ref="${asset_ref%%\#*}"
    asset_ref="${asset_ref%%\?*}"
    [[ -f "${html_dir}/${asset_ref}" ]] || { printf 'Standalone Side Panel asset is missing: %s\n' "${asset_ref}" >&2; exit 1; }
  done < <(grep -Eo '(src|href)="[^"]+"' "${html_file}" | sed -e 's/^[^=]*="//' -e 's/"$//')
  (( asset_count > 0 )) || { printf 'Standalone Side Panel HTML has no asset references\n' >&2; exit 1; }
  installed_worker="${worker}"
  installed_content="${content}"
  installed_sidepanel="${sidepanel}"
}

if [[ -z "${LOGUE_EXTENSION_TEST_FIXTURE_V1:-}" || -z "${LOGUE_EXTENSION_TEST_FIXTURE_V2:-}" ]]; then
  printf 'Building standalone Extension fixtures...\n'
  build_fixture v0.1.0 "${fixture_v1}"
  build_fixture v0.1.1 "${fixture_v2}"
fi

mkdir -p "${test_home}"
first_install_log="${test_root}/first-install.log"
run_installer "file://${fixture_v1}" "${first_install_log}"
assert_installed_extension v0.1.0
worker_v1="${installed_worker}"
content_v1="${installed_content}"
sidepanel_v1="${installed_sidepanel}"
grep -Fq 'Chrome will not install or update an unpacked Extension silently.' "${first_install_log}" || { printf 'Standalone installer did not explain Chrome manual installation\n' >&2; exit 1; }
grep -Fq '1. Open chrome://extensions.' "${first_install_log}" || { printf 'Standalone installer omitted chrome://extensions\n' >&2; exit 1; }
grep -Fq '2. Turn on Developer mode.' "${first_install_log}" || { printf 'Standalone installer omitted Developer mode\n' >&2; exit 1; }
grep -Fq '3. Click Load unpacked.' "${first_install_log}" || { printf 'Standalone installer omitted Load unpacked\n' >&2; exit 1; }
grep -Fq "4. Select: ${extension_dir}" "${first_install_log}" || { printf 'Standalone installer omitted the exact stable folder\n' >&2; exit 1; }
grep -Fq '5. Open the Logue Side Panel.' "${first_install_log}" || { printf 'Standalone installer omitted opening the Side Panel\n' >&2; exit 1; }
grep -Fq '6. Open More options → Server settings.' "${first_install_log}" || { printf 'Standalone installer omitted Server settings\n' >&2; exit 1; }
grep -Fq '7. Enter http(s)://<Linux host>:8787, click Connect, and allow that origin.' "${first_install_log}" || { printf 'Standalone installer omitted the remote origin permission step\n' >&2; exit 1; }

printf '%s\n' 'preserve-extension-root' > "${extension_dir}/installer-sentinel.txt"
sentinel_before="$(file_sha256 "${extension_dir}/installer-sentinel.txt")"
manifest_before="$(file_sha256 "${extension_dir}/manifest.json")"

bad_fixture="${test_root}/bad-release"
mkdir -p "${bad_fixture}"
cp "${fixture_v2}/logue-extension.tar.gz" "${bad_fixture}/"
cp "${fixture_v2}/checksums.txt" "${bad_fixture}/"
printf '%s\n' 'corrupt' >> "${bad_fixture}/logue-extension.tar.gz"
if run_installer "file://${bad_fixture}" "${test_root}/bad-install.log"; then
  printf 'Standalone installer accepted a bad checksum\n' >&2
  exit 1
fi
[[ "$(file_sha256 "${extension_dir}/manifest.json")" == "${manifest_before}" ]] || { printf 'Bad standalone upgrade changed the active manifest\n' >&2; exit 1; }

upgrade_log="${test_root}/upgrade.log"
run_installer "file://${fixture_v2}" "${upgrade_log}"
assert_installed_extension v0.1.1
[[ "${installed_worker}" != "${worker_v1}" && "${installed_content}" != "${content_v1}" && "${installed_sidepanel}" != "${sidepanel_v1}" ]] || { printf 'Standalone upgrade did not switch every manifest entry\n' >&2; exit 1; }
[[ -f "${extension_dir}/${worker_v1}" && -f "${extension_dir}/${content_v1}" && -f "${extension_dir}/${sidepanel_v1}" ]] || { printf 'Standalone upgrade removed assets still used by Chrome\n' >&2; exit 1; }
[[ "$(file_sha256 "${extension_dir}/installer-sentinel.txt")" == "${sentinel_before}" ]] || { printf 'Standalone upgrade replaced the stable Extension folder\n' >&2; exit 1; }
grep -Fq 'click Reload on the Logue card' "${upgrade_log}" || { printf 'Standalone upgrade omitted the Reload step\n' >&2; exit 1; }
if grep -Fq 'Click Load unpacked' "${upgrade_log}"; then
  printf 'Standalone upgrade incorrectly repeated first-time Load unpacked instructions\n' >&2
  exit 1
fi
if grep -Fq 'Server settings' "${upgrade_log}"; then
  printf 'Standalone upgrade incorrectly repeated first-time Server settings instructions\n' >&2
  exit 1
fi

printf 'Standalone Extension checksum, install, asset, and overwrite regression passed.\n'
