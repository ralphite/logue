#!/usr/bin/env bash

set -Eeuo pipefail

logue_home="${HOME:?HOME is required}"
# Stable on purpose: Chrome keeps this exact folder loaded as one unpacked
# extension. Replacing it would change the extension identity and drop its
# chrome.storage, so only the contents below it ever change.
extension_dir="${LOGUE_EXTENSION_DIR:-${logue_home}/.local/share/logue/extension}"
requested_release="${LOGUE_RELEASE:-}"
if [[ -n "${requested_release}" && ! "${requested_release}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]]; then
  printf 'LOGUE_RELEASE must be a full Logue release identity such as v1.0.0.\n' >&2
  exit 64
fi
if [[ -n "${LOGUE_ASSET_BASE_URL:-}" ]]; then
  asset_base_url="${LOGUE_ASSET_BASE_URL}"
elif [[ -n "${requested_release}" ]]; then
  asset_base_url="https://github.com/ralphite/logue/releases/download/${requested_release}"
else
  asset_base_url="https://github.com/ralphite/logue/releases/latest/download"
fi
asset_name="logue.zip"
install_tmp=""
staged_extension_assets=""
extension_manifest_next=""
manifest_switched="no"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nExtension installation did not complete: %s\n' "$*" >&2; exit 1; }

cleanup() {
  # Assets stay only if the manifest switch actually pointed Chrome at them.
  if [[ "${manifest_switched}" == "no" && -n "${staged_extension_assets}" && -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}"
  fi
  [[ -n "${extension_manifest_next}" ]] && rm -f -- "${extension_manifest_next}"
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
  return 0
}
trap cleanup EXIT

verify_checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${install_tmp}" && sha256sum -c selected-checksum.txt >/dev/null)
  else
    (cd "${install_tmp}" && shasum -a 256 -c selected-checksum.txt >/dev/null)
  fi
}

validate_release_contract() {
  "${python_bin}" - "${package_dir}/VERSION" "${package_dir}/extension/manifest.json" "${requested_release}" <<'PY'
import json
import re
import sys
from pathlib import Path

version_path, manifest_path, requested = sys.argv[1:]
identity = Path(version_path).read_text().strip()
match = re.fullmatch(r"v([0-9]+\.[0-9]+\.[0-9]+)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?", identity)
if not match:
    raise SystemExit(f"Invalid release identity: {identity}")
manifest = json.loads(Path(manifest_path).read_text())
if manifest.get("version") != match.group(1):
    raise SystemExit("Extension version does not match VERSION base")
if manifest.get("version_name") != identity:
    raise SystemExit("Extension version_name does not match VERSION")
# The Host installer prints a pinned command; a different identity here means
# the two machines would end up on different releases.
if requested and requested != identity:
    raise SystemExit(f"Requested {requested} but downloaded {identity}")
PY
}

validate_manifest_identity() {
  "${python_bin}" - "$1" "${logue_version}" <<'PY'
import json
import re
import sys
from pathlib import Path

manifest_path, identity = sys.argv[1:]
match = re.fullmatch(r"v([0-9]+\.[0-9]+\.[0-9]+)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?", identity)
manifest = json.loads(Path(manifest_path).read_text())
if not match or manifest.get("version") != match.group(1) or manifest.get("version_name") != identity:
    raise SystemExit("staged Extension identity does not match VERSION")
PY
}

validate_manifest_paths() {
  # Chrome resolves every path a manifest names against the folder it loaded,
  # and refuses the whole extension over a single missing file. The stable root
  # holds nothing but the manifest, so any path the rewrite below forgets to
  # move into releases/<id>/ names a file that is not there — which is how
  # "Could not load icon" made a verified release impossible to load.
  MANIFEST_PATH="$1" EXTENSION_ROOT="$2" "${python_bin}" - <<'PY'
import json
import os
from pathlib import Path

manifest = json.loads(Path(os.environ["MANIFEST_PATH"]).read_text())
root = Path(os.environ["EXTENSION_ROOT"])
declared = list((manifest.get("icons") or {}).values())
declared += list(((manifest.get("action") or {}).get("default_icon") or {}).values())
for value in ((manifest.get("background") or {}).get("service_worker"), (manifest.get("side_panel") or {}).get("default_path")):
    if value:
        declared.append(value)
for script in manifest.get("content_scripts") or []:
    declared += list(script.get("js") or []) + list(script.get("css") or [])
for entry in manifest.get("web_accessible_resources") or []:
    declared += [resource for resource in entry.get("resources") or [] if "*" not in resource]
if not declared:
    raise SystemExit("manifest names no files at all")
missing = [path for path in declared if not (root / path).is_file()]
if missing:
    raise SystemExit("manifest names files this folder does not hold: " + ", ".join(sorted(missing)))
PY
}

validate_extension_html_assets() {
  # Every page runs from releases/<id>/, so an absolute or missing asset
  # reference produces an extension that loads and then silently does nothing.
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

for required_command in curl python3.13; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "Missing required system command: ${required_command}."
done
python_bin="$(command -v python3.13)"
[[ "${python_bin}" == /* ]] || fail "python3.13 must resolve to an absolute path."
"${python_bin}" -c 'import sys; raise SystemExit(sys.version_info[:2] != (3, 13))' || fail "Logue requires Python 3.13."
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  fail "Missing required system command: sha256sum or shasum."
fi

printf '\nLogue Chrome Extension install and upgrade\n'
say "Stable folder: ${extension_dir}"
say "Chrome storage is preserved because this folder is never replaced"

install_tmp="$(mktemp -d "${TMPDIR:-/tmp}/logue-extension-install.XXXXXX")"

download_and_verify_release() {
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
  "${python_bin}" - "${install_tmp}/${asset_name}" "${package_dir}" <<'UNZIP'
import sys
from pathlib import Path
from zipfile import ZipFile

archive_path = Path(sys.argv[1])
destination = Path(sys.argv[2]).resolve()
with ZipFile(archive_path) as archive:
    for member in archive.infolist():
        # A `../` member would write outside the staging area, i.e. anywhere.
        target = (destination / member.filename).resolve()
        if destination not in target.parents and target != destination:
            raise SystemExit(f"Unsafe release path: {member.filename}")
    archive.extractall(destination)
UNZIP
}

# Run as the second half of the Host installer, which has already downloaded
# this exact release, verified its checksum and put it on disk. Downloading it a
# second time would not make it any more verified — and would leave two commands
# free to resolve `latest` to two different releases.
if [[ -n "${LOGUE_PACKAGE_DIR:-}" ]]; then
  package_dir="${LOGUE_PACKAGE_DIR}"
  [[ -f "${package_dir}/VERSION" && -f "${package_dir}/extension/manifest.json" ]] ||
    fail "LOGUE_PACKAGE_DIR does not hold a verified Logue release: ${package_dir}"
  step "1/3  Use the release the Host installer verified"
  say "From: ${package_dir}"
else
  download_and_verify_release
fi

[[ -f "${package_dir}/extension/manifest.json" ]] || fail "Release is missing extension/manifest.json."
[[ -f "${package_dir}/extension/background.js" && -f "${package_dir}/extension/content.js" && -f "${package_dir}/extension/sidepanel.html" && -f "${package_dir}/extension/offscreen.html" ]] || fail "Release Extension assets are incomplete."
[[ -f "${package_dir}/VERSION" ]] || fail "Release is missing VERSION."
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
validate_release_contract || fail "Release VERSION and Extension identity do not match; the existing Extension was not changed."
validate_extension_html_assets "${package_dir}/extension/sidepanel.html" || fail "Release Side Panel references missing or non-relative assets."
validate_extension_html_assets "${package_dir}/extension/offscreen.html" || fail "Release offscreen document references missing or non-relative assets."
validate_manifest_paths "${package_dir}/extension/manifest.json" "${package_dir}/extension" ||
  fail "Release manifest names files the release does not ship; the existing Extension was not changed."

step "2/3  Stage and switch atomically"
mkdir -p "${extension_dir}/releases"
extension_asset_id="${logue_version}-$$"
extension_stage="${extension_dir}/releases/.${extension_asset_id}.next"
staged_extension_assets="${extension_dir}/releases/${extension_asset_id}"
extension_manifest_next="${extension_dir}/.manifest.next.$$"
[[ ! -e "${extension_stage}" && ! -e "${staged_extension_assets}" ]] || fail "A conflicting staged Extension already exists; retry the install."
mkdir -p "${extension_stage}"
cp -R "${package_dir}/extension/." "${extension_stage}/"
# Only the stable root may hold a manifest; a second one inside the versioned
# directory would let Chrome load the wrong entry points.
rm -f -- "${extension_stage}/manifest.json"
mv "${extension_stage}" "${staged_extension_assets}"

EXTENSION_MANIFEST_SOURCE="${package_dir}/extension/manifest.json" \
EXTENSION_MANIFEST_TARGET="${extension_manifest_next}" \
EXTENSION_ASSET_ID="${extension_asset_id}" \
"${python_bin}" - <<'PY' || fail "Release manifest does not declare the entry points this installer must version."
import json
import os
from pathlib import Path

manifest = json.loads(Path(os.environ["EXTENSION_MANIFEST_SOURCE"]).read_text())
prefix = f"releases/{os.environ['EXTENSION_ASSET_ID']}"
manifest["background"]["service_worker"] = f"{prefix}/background.js"
manifest["side_panel"]["default_path"] = f"{prefix}/sidepanel.html"


def version_icons(holder, key):
    # The icons are declared twice — the extension's own mark and the toolbar
    # action's — and Chrome loads both from the folder it was pointed at.
    icons = holder.get(key)
    if icons:
        holder[key] = {size: f"{prefix}/{path}" for size, path in icons.items()}


version_icons(manifest, "icons")
version_icons(manifest.get("action") or {}, "default_icon")
versioned = False
for script in manifest.get("content_scripts", []):
    if script.get("js") == ["content.js"]:
        script["js"] = [f"{prefix}/content.js"]
        # An empty `css` is not written back: a key Chrome has to parse, listing
        # nothing, is a way for the rewrite to look like it happened.
        if script.get("css"):
            script["css"] = [f"{prefix}/{name}" for name in script["css"]]
        versioned = True
if not versioned:
    raise SystemExit("manifest has no content script to version")
Path(os.environ["EXTENSION_MANIFEST_TARGET"]).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
PY

validate_manifest_identity "${extension_manifest_next}" || fail "Staged Extension identity does not match VERSION."
# Assert against the file that is about to become live: a rewrite that silently
# did nothing would leave Chrome running the previous release's code.
grep -Fq "\"service_worker\": \"releases/${extension_asset_id}/background.js\"" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned worker."
grep -Fq "\"releases/${extension_asset_id}/content.js\"" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned content script."
grep -Fq "\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"" "${extension_manifest_next}" || fail "Staged manifest is missing the versioned Side Panel."
[[ -f "${staged_extension_assets}/background.js" && -f "${staged_extension_assets}/content.js" && -f "${staged_extension_assets}/sidepanel.html" && -f "${staged_extension_assets}/offscreen.html" ]] || fail "Staged Extension assets are incomplete."
validate_extension_html_assets "${staged_extension_assets}/sidepanel.html" || fail "Staged Side Panel references missing or non-versioned assets."
validate_extension_html_assets "${staged_extension_assets}/offscreen.html" || fail "Staged offscreen document references missing or non-versioned assets."
# Read the manifest that is about to become live against the folder Chrome will
# be pointed at: every path it names has to be a file that is already there.
validate_manifest_paths "${extension_manifest_next}" "${extension_dir}" ||
  fail "Staged manifest names files the Extension folder does not hold; the existing Extension was not changed."

if [[ -d "${extension_dir}/manifest.json" && ! -L "${extension_dir}/manifest.json" ]]; then
  fail "Extension manifest path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${extension_dir}/manifest.json" || -L "${extension_dir}/manifest.json" ]]; then
  first_install="no"
else
  first_install="yes"
fi
# One rename: Chrome either reads the whole previous manifest or the whole new
# one. The previous release's assets stay on disk because Chrome is still
# running them until the person clicks Reload.
/bin/mv -f "${extension_manifest_next}" "${extension_dir}/manifest.json"
manifest_switched="yes"
extension_manifest_next=""
staged_extension_assets=""

step "3/3  Finish Chrome setup"
say "Folder: ${extension_dir}"
if [[ "${first_install}" == "yes" ]]; then
  printf '\n✓ Logue Extension %s is ready to load\n' "${logue_version}"
  say "Chrome is not running Logue yet."
  printf '\nFirst-time Chrome setup:\n'
  printf '%s\n' '  1. Open chrome://extensions.'
  printf '%s\n' '  2. Turn on Developer mode.'
  printf '%s\n' '  3. Click Load unpacked.'
  printf '  4. Select: %s\n' "${extension_dir}"
  # The Extension talks to http://127.0.0.1:8787 and nothing else, so there is
  # no address to enter — only a model to connect, which lives in the app.
  printf '%s\n' '  5. Open http://127.0.0.1:8787 and connect a model under Settings.'
  printf '%s\n' '  6. Open the Logue Side Panel on any page.'
else
  printf '\n✓ Logue Extension %s update is ready\n' "${logue_version}"
  say "Chrome remains on the previous or unknown version until Reload."
  say "Open chrome://extensions and click Reload on the Logue card"
  say "Do not use Load unpacked again"
fi
