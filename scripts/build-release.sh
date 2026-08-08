#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_dir="${repo_dir}/dist/release"
asset_name="logue.zip"
raw_version="${1:-${GITHUB_REF_NAME:-}}"

if [[ -z "${raw_version}" ]]; then
  echo "Usage: scripts/build-release.sh <version>" >&2
  echo "A version argument or GITHUB_REF_NAME is required." >&2
  exit 64
fi

# DR-070: one verifiable version contract. The tag carries the full release
# identity (prerelease suffix allowed); Chrome's numeric manifest version can
# only hold the X.Y.Z base, so the full identity lives in version_name.
version="${raw_version#refs/tags/}"
if [[ ! "${version}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]]; then
  echo "Invalid release version: ${version}" >&2
  exit 64
fi
release_base="${BASH_REMATCH[1]}"
release_identity="${version}"

for command_name in node npm python3.13; do
  command -v "${command_name}" >/dev/null 2>&1 || { echo "Required command is missing: ${command_name}" >&2; exit 69; }
done

echo "Building Logue ${version}..."
cd "${repo_dir}"

# A release whose parts disagree about their own version cannot be diagnosed
# after the fact, so the mismatch has to stop the build before anything ships.
RELEASE_BASE="${release_base}" node <<'NODE'
const fs = require("node:fs");
const expected = process.env.RELEASE_BASE;
for (const file of ["package.json", "web/package.json", "extension/package.json", "packages/ui/package.json"]) {
  const version = JSON.parse(fs.readFileSync(file, "utf8")).version;
  if (version !== expected) throw new Error(`${file} version ${version} does not match ${expected}`);
}
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
if (lock.version !== expected) throw new Error(`package-lock.json version ${lock.version} does not match ${expected}`);
for (const entry of ["", "extension", "packages/ui", "web"]) {
  const version = lock.packages?.[entry]?.version;
  if (version !== expected) throw new Error(`package-lock.json packages[${JSON.stringify(entry)}] version ${version} does not match ${expected}`);
}
NODE

# Locked dependencies are what makes a tag reproducible. The self-tests build
# many fixtures against an already-installed tree and opt out explicitly.
if [[ "${LOGUE_RELEASE_SKIP_NPM_CI:-}" != "1" ]]; then
  npm ci
fi

rm -rf -- "${repo_dir}/web/dist" "${release_dir}"
mkdir -p "${release_dir}"
npm run build -w @logue/web

# The Extension is built in its own tree; LOGUE_EXTENSION_DIST accepts a dist
# produced elsewhere (split CI job, or the self-tests' stand-in) unchanged.
extension_dist="${LOGUE_EXTENSION_DIST:-${repo_dir}/extension/dist}"
if [[ -z "${LOGUE_EXTENSION_DIST:-}" ]]; then
  rm -rf -- "${extension_dist}"
  npm run build --prefix "${repo_dir}/extension"
fi
[[ -f "${extension_dist}/manifest.json" ]] || { echo "Extension build is missing manifest.json: ${extension_dist}" >&2; exit 69; }

package_dir=""
trap 'rm -rf -- "${package_dir:-}"' EXIT
package_dir="$(mktemp -d "${TMPDIR:-/tmp}/logue-release.XXXXXX")"
mkdir -p "${package_dir}/server" "${package_dir}/web" "${package_dir}/extension"
cp -R "${repo_dir}/server/logue_host" "${package_dir}/server/"
cp -R "${repo_dir}/web/dist/." "${package_dir}/web/"
cp -R "${extension_dist}/." "${package_dir}/extension/"
printf '%s\n' "${version}" > "${package_dir}/VERSION"

RELEASE_MANIFEST="${package_dir}/extension/manifest.json" RELEASE_BASE="${release_base}" RELEASE_IDENTITY="${release_identity}" python3.13 - <<'PY'
import json
import os
from pathlib import Path

manifest_path = Path(os.environ["RELEASE_MANIFEST"])
manifest = json.loads(manifest_path.read_text())
manifest["version"] = os.environ["RELEASE_BASE"]
manifest["version_name"] = os.environ["RELEASE_IDENTITY"]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
PY

PACKAGE_DIR="${package_dir}" RELEASE_ZIP="${release_dir}/${asset_name}" python3.13 - <<'PY'
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

package_dir = Path(os.environ["PACKAGE_DIR"])
skip = {"__pycache__", "tests"}
with ZipFile(os.environ["RELEASE_ZIP"], "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(package_dir.rglob("*")):
        relative = path.relative_to(package_dir)
        if path.is_file() and not skip & set(relative.parts) and path.name not in {".gitignore", ".DS_Store"}:
            archive.write(path, relative)
PY
rm -rf -- "${package_dir}"
package_dir=""
trap - EXIT

# Read the identity back out of the artifact: what was packaged is the only
# thing an installer will ever see.
RELEASE_ZIP="${release_dir}/${asset_name}" RELEASE_BASE="${release_base}" RELEASE_IDENTITY="${release_identity}" python3.13 - <<'PY'
import json
import os
from zipfile import ZipFile

with ZipFile(os.environ["RELEASE_ZIP"]) as archive:
    version = archive.read("VERSION").decode().strip()
    manifest = json.loads(archive.read("extension/manifest.json"))
    names = set(archive.namelist())
for required in ("server/logue_host/__main__.py", "web/index.html", "extension/manifest.json"):
    if required not in names:
        raise SystemExit(f"packaged release is missing {required}")
if version != os.environ["RELEASE_IDENTITY"]:
    raise SystemExit(f"packaged VERSION {version!r} does not match release identity")
if manifest.get("version") != os.environ["RELEASE_BASE"]:
    raise SystemExit("packaged Extension version does not match release base")
if manifest.get("version_name") != os.environ["RELEASE_IDENTITY"]:
    raise SystemExit("packaged Extension version_name does not match release identity")
PY

printf '%s\n' "${version}" > "${release_dir}/VERSION"
(
  cd "${release_dir}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${asset_name}" > checksums.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${asset_name}" > checksums.txt
  else
    echo "Neither sha256sum nor shasum is available." >&2
    exit 69
  fi
)

echo "Release assets are ready in ${release_dir}:"
ls -1 "${release_dir}"
