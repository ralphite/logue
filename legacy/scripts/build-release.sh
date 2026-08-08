#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_dir="${repo_dir}/dist/release"
raw_version="${1:-${GITHUB_REF_NAME:-}}"

if [[ -z "${raw_version}" ]]; then
  echo "Usage: scripts/build-release.sh <version>" >&2
  echo "A version argument or GITHUB_REF_NAME is required." >&2
  exit 64
fi

version="${raw_version#refs/tags/}"
if [[ ! "${version}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]]; then
  echo "Invalid release version: ${version}" >&2
  exit 64
fi
release_base="${BASH_REMATCH[1]}"
release_identity="${version}"

for command_name in node npm python3.13; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 69
  fi
done

echo "Building Logue ${version} from locked dependencies..."
cd "${repo_dir}"
workspace_version="$(node -p "require('./package.json').version")"
[[ "${release_base}" == "${workspace_version}" ]] || {
  echo "Release ${version} does not match workspace ${workspace_version}." >&2
  exit 64
}
node <<'NODE'
const fs = require("node:fs");
const packageFiles = [
  "package.json",
  "apps/web/package.json",
  "apps/extension/package.json",
  "packages/ui/package.json",
];
const versions = packageFiles.map((file) => [file, JSON.parse(fs.readFileSync(file, "utf8")).version]);
const expected = versions[0][1];
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const lockEntries = ["", "apps/web", "apps/extension", "packages/ui"];
for (const [file, version] of versions) {
  if (version !== expected) throw new Error(`${file} version ${version} does not match ${expected}`);
}
if (lock.version !== expected) throw new Error(`package-lock.json version ${lock.version} does not match ${expected}`);
for (const entry of lockEntries) {
  const version = lock.packages?.[entry]?.version;
  if (version !== expected) throw new Error(`package-lock.json packages[${JSON.stringify(entry)}] version ${version} does not match ${expected}`);
}
const manifest = JSON.parse(fs.readFileSync("apps/extension/public/manifest.json", "utf8"));
if (manifest.version !== expected || manifest.version_name !== `v${expected}`) {
  throw new Error(`source Extension manifest must use version ${expected} and version_name v${expected}`);
}
NODE
npm ci

# Do not let a previous local build leak files into the release.
rm -rf -- "${repo_dir}/apps/web/dist" "${repo_dir}/apps/extension/dist" "${release_dir}"
mkdir -p "${release_dir}"

npm run build -w @logue/web
npm run build -w @logue/extension

package_dir=""
trap 'rm -rf -- "${package_dir:-}"' EXIT

package_dir="$(mktemp -d "${TMPDIR:-/tmp}/logue-release.XXXXXX")"
mkdir -p "${package_dir}/python_server" "${package_dir}/web" "${package_dir}/extension"
cp -R "${repo_dir}/python_server/." "${package_dir}/python_server/"
cp -R "${repo_dir}/apps/web/dist/." "${package_dir}/web/"
cp -R "${repo_dir}/apps/extension/dist/." "${package_dir}/extension/"
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

PACKAGE_DIR="${package_dir}" RELEASE_ZIP="${release_dir}/logue-python.zip" python3.13 - <<'PY'
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

package_dir = Path(os.environ["PACKAGE_DIR"])
release_zip = Path(os.environ["RELEASE_ZIP"])
with ZipFile(release_zip, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(package_dir.rglob("*")):
        relative = path.relative_to(package_dir)
        if (
            path.is_file()
            and "__pycache__" not in relative.parts
            and "tests" not in relative.parts
            and path.name != ".gitignore"
        ):
            archive.write(path, relative)
PY
rm -rf -- "${package_dir}"
package_dir=""
trap - EXIT

RELEASE_ZIP="${release_dir}/logue-python.zip" RELEASE_BASE="${release_base}" RELEASE_IDENTITY="${release_identity}" python3.13 - <<'PY'
import json
import os
from zipfile import ZipFile

with ZipFile(os.environ["RELEASE_ZIP"]) as archive:
    version = archive.read("VERSION").decode().strip()
    manifest = json.loads(archive.read("extension/manifest.json"))
if version != os.environ["RELEASE_IDENTITY"]:
    raise SystemExit(f"packaged VERSION {version!r} does not match release identity")
if manifest.get("version") != os.environ["RELEASE_BASE"]:
    raise SystemExit("packaged Extension version does not match release base")
if manifest.get("version_name") != os.environ["RELEASE_IDENTITY"]:
    raise SystemExit("packaged Extension version_name does not match release identity")
PY

(
  cd "${release_dir}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum logue-python.zip > checksums.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 logue-python.zip > checksums.txt
  else
    echo "Neither sha256sum nor shasum is available." >&2
    exit 69
  fi
)

echo "Release assets are ready in ${release_dir}:"
ls -1 "${release_dir}"
