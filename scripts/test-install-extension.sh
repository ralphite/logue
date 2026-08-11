#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d /tmp/logue-extension-installer-test.XXXXXX)"
test_home="${test_root}/home"
extension_dir="${test_home}/.local/share/logue/extension"
fixture_v1="${test_root}/release-v1"
fixture_v2="${test_root}/release-v2"
workspace_version="$(node -p "require('${repo_dir}/package.json').version")"
release_v1="v${workspace_version}-fixture.1"
release_v2="v${workspace_version}-fixture.2"
python_bin="$(command -v python3.13)"

cleanup() {
  [[ "${test_root}" == /tmp/logue-extension-installer-test.* ]] && rm -rf -- "${test_root}"
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
# The icons are part of the shape under test: Chrome refuses to load an
# extension whose manifest names an icon that is not where it says it is.
(root / "icons").mkdir(parents=True)
icons = {str(size): f"icons/logue-{size}.png" for size in (16, 32, 48, 128)}
for name in icons.values():
    (root / name).write_bytes(b"\x89PNG\r\n\x1a\n stand-in\n")
(root / "manifest.json").write_text(json.dumps({
    "manifest_version": 3, "name": "Logue", "version": "0.0.0", "version_name": "v0.0.0",
    "icons": icons,
    "action": {"default_title": "Open Logue", "default_icon": icons},
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
  local base_url="$1" output_file="$2"
  HOME="${test_home}" \
  LOGUE_EXTENSION_DIR="${extension_dir}" \
  LOGUE_ASSET_BASE_URL="${base_url}" \
    bash "${repo_dir}/install-extension.sh" >"${output_file}" 2>&1
}

# Read the entry points out of the live manifest: what Chrome would load is the
# only thing worth asserting on.
manifest_entry() {
  "${python_bin}" - "${extension_dir}/manifest.json" "$1" <<'PY'
import json
import sys
from pathlib import Path

manifest = json.loads(Path(sys.argv[1]).read_text())
field = sys.argv[2]
if field == "worker":
    print(manifest["background"]["service_worker"])
elif field == "content":
    print(manifest["content_scripts"][0]["js"][0])
elif field == "sidepanel":
    print(manifest["side_panel"]["default_path"])
else:
    print(f'{manifest.get("version")} {manifest.get("version_name")}')
PY
}

# Chrome loads the stable folder, so every path in the live manifest has to
# resolve inside it. This is the check that was missing when a release shipped a
# manifest naming `icons/logue-16.png` and put the icons one directory down:
# every entry point was versioned, the installer said it was ready, and Chrome
# answered "Could not load icon" and loaded nothing.
assert_manifest_paths_resolve() {
  "${python_bin}" - "${extension_dir}" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
manifest = json.loads((root / "manifest.json").read_text())
declared = list((manifest.get("icons") or {}).values())
declared += list(((manifest.get("action") or {}).get("default_icon") or {}).values())
declared += [manifest["background"]["service_worker"], manifest["side_panel"]["default_path"]]
for script in manifest.get("content_scripts") or []:
    declared += list(script.get("js") or []) + list(script.get("css") or [])
if len(declared) < 3:
    raise SystemExit("live manifest names too few files to be the real one")
missing = [path for path in declared if not (root / path).is_file()]
if missing:
    raise SystemExit("live manifest names files Chrome cannot load: " + ", ".join(sorted(missing)))
unversioned = [path for path in declared if not path.startswith("releases/")]
if unversioned:
    raise SystemExit("live manifest names unversioned paths: " + ", ".join(sorted(unversioned)))
PY
}

assert_installed_extension() {
  local version="$1" worker content sidepanel offscreen
  [[ "$(manifest_entry identity)" == "${workspace_version} ${version}" ]] || die "installed manifest identity does not match ${version}"
  worker="$(manifest_entry worker)"
  content="$(manifest_entry content)"
  sidepanel="$(manifest_entry sidepanel)"
  [[ "${worker}" == releases/${version}-*/background.js ]] || die "${version} worker is not versioned: ${worker}"
  [[ "${content}" == releases/${version}-*/content.js ]] || die "${version} content script is not versioned: ${content}"
  [[ "${sidepanel}" == releases/${version}-*/sidepanel.html ]] || die "${version} Side Panel is not versioned: ${sidepanel}"
  offscreen="${sidepanel%/sidepanel.html}/offscreen.html"
  [[ -f "${extension_dir}/${worker}" && -f "${extension_dir}/${content}" && -f "${extension_dir}/${sidepanel}" && -f "${extension_dir}/${offscreen}" ]] || die "${version} Extension assets are incomplete"
  [[ -f "${extension_dir}/manifest.json" && ! -L "${extension_dir}/manifest.json" ]] || die 'stable manifest is not a regular file'
  [[ ! -e "${extension_dir}/${sidepanel%/*}/manifest.json" ]] || die 'versioned release directory must not hold a second manifest'
  assert_manifest_paths_resolve || die "${version} manifest does not resolve inside the folder Chrome loads"
  installed_worker="${worker}"
  installed_content="${content}"
  installed_sidepanel="${sidepanel}"
}

printf 'Building Extension fixtures...\n'
build_fixture "${release_v1}" "${fixture_v1}"
build_fixture "${release_v2}" "${fixture_v2}"

first_install_log="${test_root}/first-install.log"
run_installer "file://${fixture_v1}" "${first_install_log}"
assert_installed_extension "${release_v1}"
worker_v1="${installed_worker}"
content_v1="${installed_content}"
sidepanel_v1="${installed_sidepanel}"
grep -Fq "Logue Extension ${release_v1} is ready to load" "${first_install_log}" || die 'installer did not report the first-load state'
grep -Fq 'Chrome is not running Logue yet.' "${first_install_log}" || die 'installer did not explain the pre-load Chrome state'
grep -Fq '2. Turn on Developer mode.' "${first_install_log}" || die 'installer omitted Developer mode'
grep -Fq '3. Click Load unpacked.' "${first_install_log}" || die 'installer omitted Load unpacked'
grep -Fq "4. Select: ${extension_dir}" "${first_install_log}" || die 'installer omitted the exact stable folder'
printf 'First install: versioned assets under a stable folder, Load unpacked instructions verified.\n'

# Anything Chrome wrote into the stable folder has to survive every upgrade.
printf '%s\n' 'preserve-extension-root' > "${extension_dir}/installer-sentinel.txt"
sentinel_before="$(file_sha256 "${extension_dir}/installer-sentinel.txt")"
manifest_before="$(file_sha256 "${extension_dir}/manifest.json")"

bad_fixture="${test_root}/bad-release"
mkdir -p "${bad_fixture}"
cp "${fixture_v2}/logue.zip" "${fixture_v2}/checksums.txt" "${bad_fixture}/"
printf '%s\n' 'corrupt' >> "${bad_fixture}/logue.zip"
if run_installer "file://${bad_fixture}" "${test_root}/bad-install.log"; then
  die 'installer accepted a bad checksum'
fi
[[ "$(file_sha256 "${extension_dir}/manifest.json")" == "${manifest_before}" ]] || die 'bad checksum changed the active manifest'

missing_offscreen_fixture="${test_root}/missing-offscreen-release"
mkdir -p "${missing_offscreen_fixture}"
"${python_bin}" - "${fixture_v2}/logue.zip" "${missing_offscreen_fixture}/logue.zip" <<'PY'
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

source, destination = map(Path, sys.argv[1:])
with ZipFile(source) as archive, ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
    for member in archive.infolist():
        if member.filename == "extension/offscreen.html":
            continue
        output.writestr(member, archive.read(member.filename))
PY
(cd "${missing_offscreen_fixture}" && { command -v sha256sum >/dev/null 2>&1 && sha256sum logue.zip || shasum -a 256 logue.zip; } > checksums.txt)
if run_installer "file://${missing_offscreen_fixture}" "${test_root}/missing-offscreen.log"; then
  die 'installer accepted a release without offscreen.html'
fi
[[ "$(file_sha256 "${extension_dir}/manifest.json")" == "${manifest_before}" ]] || die 'incomplete release changed the active manifest'

# A release that declares an icon and forgets to ship it loads in nothing, so it
# has to be refused here rather than at Chrome's Load unpacked.
missing_icon_fixture="${test_root}/missing-icon-release"
mkdir -p "${missing_icon_fixture}"
"${python_bin}" - "${fixture_v2}/logue.zip" "${missing_icon_fixture}/logue.zip" <<'PY'
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

source, destination = map(Path, sys.argv[1:])
dropped = 0
with ZipFile(source) as archive, ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
    for member in archive.infolist():
        if member.filename.startswith("extension/icons/"):
            dropped += 1
            continue
        output.writestr(member, archive.read(member.filename))
if not dropped:
    raise SystemExit("fixture dropped no icons; the release under test declares none")
PY
(cd "${missing_icon_fixture}" && { command -v sha256sum >/dev/null 2>&1 && sha256sum logue.zip || shasum -a 256 logue.zip; } > checksums.txt)
if run_installer "file://${missing_icon_fixture}" "${test_root}/missing-icon.log"; then
  die 'installer accepted a release whose manifest names icons it does not ship'
fi
[[ "$(file_sha256 "${extension_dir}/manifest.json")" == "${manifest_before}" ]] || die 'release with missing icons changed the active manifest'

[[ "$(find "${extension_dir}/releases" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')" == "1" ]] || die 'a rejected release left staged assets behind'
printf 'Rejected releases: active manifest and stable folder untouched, staging cleaned up.\n'

upgrade_log="${test_root}/upgrade.log"
run_installer "file://${fixture_v2}" "${upgrade_log}"
assert_installed_extension "${release_v2}"
[[ "${installed_worker}" != "${worker_v1}" && "${installed_content}" != "${content_v1}" && "${installed_sidepanel}" != "${sidepanel_v1}" ]] || die 'upgrade did not switch every manifest entry'
# Chrome still runs the previous release until Reload, so its files must stay.
[[ -f "${extension_dir}/${worker_v1}" && -f "${extension_dir}/${content_v1}" && -f "${extension_dir}/${sidepanel_v1}" ]] || die 'upgrade removed assets Chrome is still running'
[[ "$(file_sha256 "${extension_dir}/installer-sentinel.txt")" == "${sentinel_before}" ]] || die 'upgrade replaced the stable Extension folder'
grep -Fq "Logue Extension ${release_v2} update is ready" "${upgrade_log}" || die 'upgrade did not report update ready'
grep -Fq 'Chrome remains on the previous or unknown version until Reload.' "${upgrade_log}" || die 'upgrade misstated the running Chrome version'
grep -Fq 'click Reload on the Logue card' "${upgrade_log}" || die 'upgrade omitted the Reload step'
if grep -Fq 'Click Load unpacked' "${upgrade_log}"; then die 'upgrade repeated first-time Load unpacked instructions'; fi
if grep -Fq 'connect a model under Settings' "${upgrade_log}"; then die 'upgrade repeated first-time model setup instructions'; fi

printf 'Extension checksum, versioned release, atomic manifest switch, and Reload regression passed.\n'
