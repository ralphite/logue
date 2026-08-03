#!/usr/bin/env bash

set -Eeuo pipefail

logue_home="${HOME:?HOME is required}"
extension_dir="${LOGUE_EXTENSION_DIR:-${logue_home}/.local/share/logue/extension}"
asset_base_url="${LOGUE_ASSET_BASE_URL:-https://github.com/ralphite/logue/releases/latest/download}"
asset_name="logue-extension.tar.gz"
install_tmp=""
staged_extension_assets=""
extension_manifest_next=""
manifest_switched="no"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nExtension installation did not complete: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ "${manifest_switched}" == "no" && -n "${staged_extension_assets}" && -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}"
  fi
  [[ -n "${extension_manifest_next}" ]] && rm -f -- "${extension_manifest_next}"
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
}
trap cleanup EXIT

verify_checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${install_tmp}" && sha256sum -c selected-checksum.txt >/dev/null)
  else
    (cd "${install_tmp}" && shasum -a 256 -c selected-checksum.txt >/dev/null)
  fi
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

for required_command in curl tar; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "Missing required system command: ${required_command}."
done
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  fail "Missing required system command: sha256sum or shasum."
fi

printf '\nLogue Chrome Extension install and upgrade\n'
say "Stable folder: ${extension_dir}"
say "Chrome storage is preserved because this folder is never replaced"

mkdir -p "${extension_dir}/releases"
install_tmp="$(mktemp -d "${extension_dir}/.install.XXXXXX")"

step "1/3  Download and verify the Extension"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/${asset_name}" -o "${install_tmp}/${asset_name}"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/checksums.txt" -o "${install_tmp}/checksums.txt"
checksum_line="$(awk -v wanted="${asset_name}" '$2 == wanted || $2 == "./" wanted { print; exit }' "${install_tmp}/checksums.txt")"
[[ -n "${checksum_line}" ]] || fail "checksums.txt does not contain ${asset_name}."
printf '%s\n' "${checksum_line}" > "${install_tmp}/selected-checksum.txt"
verify_checksum || fail "Release verification failed; the existing Extension was not changed."
say "Verified"

package_dir="${install_tmp}/package"
mkdir -p "${package_dir}"
tar -xzf "${install_tmp}/${asset_name}" -C "${package_dir}"
[[ -f "${package_dir}/extension/manifest.json" ]] || fail "Release is missing extension/manifest.json."
[[ -f "${package_dir}/extension/background.js" && -f "${package_dir}/extension/content.js" && -f "${package_dir}/extension/sidepanel.html" ]] || fail "Release Extension assets are incomplete."
[[ -f "${package_dir}/VERSION" ]] || fail "Release is missing VERSION."
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
[[ "${logue_version}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || fail "Invalid release version: ${logue_version}."
validate_extension_html_assets "${package_dir}/extension/sidepanel.html" || fail "Release Side Panel references missing or non-relative assets."

step "2/3  Stage and switch atomically"
extension_asset_id="${logue_version}-$$"
extension_releases_dir="${extension_dir}/releases"
extension_stage="${extension_releases_dir}/.${extension_asset_id}.next"
staged_extension_assets="${extension_releases_dir}/${extension_asset_id}"
extension_manifest_next="${extension_dir}/.manifest.next.$$"
[[ ! -e "${extension_stage}" && ! -e "${staged_extension_assets}" ]] || fail "A conflicting staged Extension already exists; retry the install."
mkdir -p "${extension_stage}"
cp -R "${package_dir}/extension/." "${extension_stage}/"
rm -f -- "${extension_stage}/manifest.json"
mv "${extension_stage}" "${staged_extension_assets}"

sed \
  -e "s|\"service_worker\": \"background.js\"|\"service_worker\": \"releases/${extension_asset_id}/background.js\"|" \
  -e "s|\"js\": \[\"content.js\"\]|\"js\": [\"releases/${extension_asset_id}/content.js\"]|" \
  -e "s|\"default_path\": \"sidepanel.html\"|\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"|" \
  "${package_dir}/extension/manifest.json" > "${extension_manifest_next}"

grep -Fq "\"service_worker\": \"releases/${extension_asset_id}/background.js\"" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned worker."
grep -Fq "\"js\": [\"releases/${extension_asset_id}/content.js\"]" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned content script."
grep -Fq "\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned Side Panel."
validate_extension_html_assets "${staged_extension_assets}/sidepanel.html" || fail "Staged Side Panel references missing or non-versioned assets."

if [[ -d "${extension_dir}/manifest.json" && ! -L "${extension_dir}/manifest.json" ]]; then
  fail "Extension manifest path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${extension_dir}/manifest.json" || -L "${extension_dir}/manifest.json" ]]; then
  first_install="no"
else
  first_install="yes"
fi
/bin/mv -f "${extension_manifest_next}" "${extension_dir}/manifest.json"
manifest_switched="yes"
staged_extension_assets=""

step "3/3  Finish Chrome setup"
printf '\n✓ Logue Extension %s is ready\n' "${logue_version}"
say "Folder: ${extension_dir}"
say "Chrome will not install or update an unpacked Extension silently."
if [[ "${first_install}" == "yes" ]]; then
  printf '\nFirst-time Chrome setup:\n'
  printf '%s\n' '  1. Open chrome://extensions.'
  printf '%s\n' '  2. Turn on Developer mode.'
  printf '%s\n' '  3. Click Load unpacked.'
  printf '  4. Select: %s\n' "${extension_dir}"
else
  say "Upgrade: open chrome://extensions and click Reload on the Logue card"
  say "Do not use Load unpacked again"
fi
