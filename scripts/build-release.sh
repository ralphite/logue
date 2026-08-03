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
if [[ ! "${version}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid release version: ${version}" >&2
  exit 64
fi

for command_name in npm go tar; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 69
  fi
done

echo "Building Logue ${version} from locked dependencies..."
cd "${repo_dir}"
npm ci

# Do not let a previous local build leak files into the release.
rm -rf -- "${repo_dir}/apps/web/dist" "${repo_dir}/apps/extension/dist" "${release_dir}"
mkdir -p "${release_dir}"

npm run build -w @logue/web
npm run build -w @logue/extension

extension_package_dir="$(mktemp -d "${TMPDIR:-/tmp}/logue-extension-release.XXXXXX")"
trap 'rm -rf -- "${extension_package_dir:-}"' EXIT
mkdir -p "${extension_package_dir}/extension"
cp -R "${repo_dir}/apps/extension/dist/." "${extension_package_dir}/extension/"
printf '%s\n' "${version}" > "${extension_package_dir}/VERSION"
COPYFILE_DISABLE=1 tar --no-xattrs -C "${extension_package_dir}" -czf \
  "${release_dir}/logue-extension.tar.gz" \
  extension VERSION
rm -rf -- "${extension_package_dir}"
trap - EXIT

for platform in darwin linux; do
  for arch in arm64 amd64; do
    package_dir="$(mktemp -d "${TMPDIR:-/tmp}/logue-release.XXXXXX")"
    trap 'rm -rf -- "${package_dir:-}"' EXIT

    mkdir -p "${package_dir}/bin" "${package_dir}/web" "${package_dir}/extension"
    cp -R "${repo_dir}/apps/web/dist/." "${package_dir}/web/"
    cp -R "${repo_dir}/apps/extension/dist/." "${package_dir}/extension/"
    printf '%s\n' "${version}" > "${package_dir}/VERSION"

    (
      cd "${repo_dir}/server"
      CGO_ENABLED=0 GOOS="${platform}" GOARCH="${arch}" \
        go build -trimpath -ldflags="-s -w -X main.version=${version}" \
        -o "${package_dir}/bin/logue" .
    )

    COPYFILE_DISABLE=1 tar --no-xattrs -C "${package_dir}" -czf \
      "${release_dir}/logue-${platform}-${arch}.tar.gz" \
      bin web extension VERSION
    rm -rf -- "${package_dir}"
    trap - EXIT
  done
done

(
  cd "${release_dir}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum ./*.tar.gz > checksums.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 ./*.tar.gz > checksums.txt
  else
    echo "Neither sha256sum nor shasum is available." >&2
    exit 69
  fi
)

echo "Release assets are ready in ${release_dir}:"
ls -1 "${release_dir}"
