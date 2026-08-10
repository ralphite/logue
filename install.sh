#!/usr/bin/env bash

set -Eeuo pipefail

case "$(uname -s)" in
  Darwin) logue_platform="darwin" ;;
  Linux) logue_platform="linux" ;;
  *) printf 'Unsupported operating system: %s\n' "$(uname -s)" >&2; exit 69 ;;
esac

has_interactive_terminal() {
  [[ -t 0 || -t 1 || -t 2 ]] && [[ -r /dev/tty && -w /dev/tty ]]
}

logue_home="${HOME:?HOME is required}"
install_root="${LOGUE_INSTALL_ROOT:-${logue_home}/.local/share/logue}"
if [[ "${logue_platform}" == "darwin" ]]; then
  default_data_root="${logue_home}/Library/Application Support/Logue"
else
  # DR-070: the Linux data root sits beside the install root, never inside it,
  # so rolling the program back can never reach a person's workspace.
  default_data_root="${XDG_DATA_HOME:-${logue_home}/.local/share}/logue-data"
fi
data_root="${LOGUE_DATA_DIR:-${default_data_root}}"
bin_dir="${LOGUE_BIN_DIR:-${logue_home}/.local/bin}"
current_link="${install_root}/current"
run_dir="${install_root}/run"
pid_file="${run_dir}/logue.pid"
log_file="${run_dir}/logue.log"
asset_name="logue.zip"
install_tmp=""
staged_release_dir=""
cli_next=""
current_switched="no"
managed_pid=""
previous_current=""
previous_current_backup=""
had_cli="no"
service_was_active="no"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nInstallation did not complete: %s\n' "$*" >&2; exit 1; }

cleanup() {
  # A candidate that never became `current` is dead weight; leaving it behind
  # would make the next run guess which half-written release is real.
  if [[ "${current_switched}" == "no" && -n "${staged_release_dir}" && -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}"
  fi
  [[ -n "${cli_next}" ]] && rm -f -- "${cli_next}"
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
  return 0
}
trap cleanup EXIT

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

logue_port="${LOGUE_PORT:-8787}"
choose_address() {
  local configured="${LOGUE_ADDRESS:-}" answer
  if [[ -n "${configured}" ]]; then printf '%s' "${configured}"; return; fi
  if has_interactive_terminal; then
    printf '\nWhere should Logue listen?\n' > /dev/tty
    printf '  1) Network — 0.0.0.0:%s (recommended)\n' "${logue_port}" > /dev/tty
    printf '  2) This computer only — 127.0.0.1:%s\n' "${logue_port}" > /dev/tty
    printf 'Choose 1 or 2 [1]: ' > /dev/tty
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in 2|local|LOCAL|Local) printf '127.0.0.1:%s' "${logue_port}" ;; *) printf '0.0.0.0:%s' "${logue_port}" ;; esac
    return
  fi
  printf '0.0.0.0:%s' "${logue_port}"
}
logue_address="$(choose_address)"
if [[ ! "${logue_address}" =~ ^(\[[^]]+\]|[^:]+):([0-9]+)$ ]]; then
  printf 'LOGUE_ADDRESS must be a host and port, for example 127.0.0.1:8787.\n' >&2
  exit 64
fi
address_host="${BASH_REMATCH[1]}"
address_port="${BASH_REMATCH[2]}"
(( address_port >= 1 && address_port <= 65535 )) || { printf 'LOGUE_ADDRESS uses an invalid port: %s.\n' "${address_port}" >&2; exit 64; }
case "${address_host}" in
  0.0.0.0|'*'|'[::]') health_host="127.0.0.1" ;;
  *) health_host="${address_host}" ;;
esac
health_url="${LOGUE_HEALTH_URL:-http://${health_host}:${address_port}/v1/status}"
open_url="${health_url%/v1/status}"

case "${LOGUE_INSTALLER_FAIL_AT:-}" in
  ""|service|cli) ;;
  *) fail "LOGUE_INSTALLER_FAIL_AT accepts only service or cli." ;;
esac
inject_failure() {
  if [[ "${LOGUE_INSTALLER_FAIL_AT:-}" == "$1" ]]; then
    printf '  [test] injected failure after %s switch\n' "$1" >&2
    return 1
  fi
  return 0
}

replace_path() {
  # rename(2) over an existing name is atomic. -T (GNU) and -h (BSD) stop mv
  # from descending into an existing symlinked directory instead of replacing it.
  if [[ "${logue_platform}" == "linux" ]]; then
    /bin/mv -fT -- "$1" "$2"
  else
    /bin/mv -f -h "$1" "$2"
  fi
}

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
# A split install resolves `latest` once; every later step is pinned, so a
# different identity here means the two machines would disagree.
if requested and requested != identity:
    raise SystemExit(f"Requested {requested} but downloaded {identity}")
PY
}

preflight_managed_paths() {
  # DR-070: run before any download, mkdir or service stop. If the workspace
  # and an installer-managed path overlap, a rollback would delete real data,
  # so an ambiguous layout has to fail with zero writes.
  # Host snapshots live *inside* the data root (`<data>/backups`), so the data
  # root alone is the thing to protect; legacy also had to guard sibling
  # snapshot directories, which this schema no longer creates.
  "${python_bin}" - "${data_root}" "${install_root}" "${bin_dir}/logue" <<'PY'
import sys
from pathlib import Path

data_raw, *managed_raw = sys.argv[1:]
for value in (data_raw, *managed_raw):
    if not Path(value).expanduser().is_absolute():
        raise SystemExit(f"path must be absolute: {value}")

def resolved(value: str) -> Path:
    return Path(value).expanduser().resolve(strict=False)

data = resolved(data_raw)
for target in (resolved(value) for value in managed_raw):
    if data == target or data in target.parents or target in data.parents:
        raise SystemExit(f"Logue data path overlaps an installer-managed path: {data} <> {target}")
if data.is_symlink():
    raise SystemExit(f"Logue data root cannot be a symlink: {data}")
PY
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

preflight_managed_paths || fail "Logue data overlaps installer-managed paths. Nothing was downloaded or changed."

printf '\nLogue install and upgrade\n'
say "App: ${install_root}"
say "Data: ${data_root} (never overwritten)"

install_tmp="$(mktemp -d "${TMPDIR:-/tmp}/logue-install.XXXXXX")"

step "1/4  Download and verify the release"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/${asset_name}" -o "${install_tmp}/${asset_name}"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/checksums.txt" -o "${install_tmp}/checksums.txt"
checksum_line="$(awk -v wanted="${asset_name}" '$2 == wanted || $2 == "./" wanted { print; exit }' "${install_tmp}/checksums.txt")"
[[ -n "${checksum_line}" ]] || fail "checksums.txt does not contain ${asset_name}."
printf '%s\n' "${checksum_line}" > "${install_tmp}/selected-checksum.txt"
verify_checksum || fail "Release verification failed; the existing installation was not changed."
say "Verified"

package_dir="${install_tmp}/package"
mkdir -p "${package_dir}"
"${python_bin}" - "${install_tmp}/${asset_name}" "${package_dir}" <<'PY'
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
PY
[[ -f "${package_dir}/server/logue_host/__main__.py" ]] || fail "Release is missing the Logue Host."
[[ -f "${package_dir}/web/index.html" ]] || fail "Release is missing the Web App."
[[ -f "${package_dir}/extension/manifest.json" ]] || fail "Release is missing the Chrome Extension."
[[ -f "${package_dir}/VERSION" ]] || fail "Release is missing VERSION."
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
validate_release_contract || fail "Release VERSION and Extension identity do not match; the existing installation was not changed."
say "Preparing ${logue_version}"

mkdir -p "${install_root}/releases" "${bin_dir}" "${run_dir}" "${data_root}"

step "2/4  Stage and verify the full candidate"
# The whole candidate lands on disk, under its own name, before anything the
# running installation depends on is touched.
release_dir="$(mktemp -d "${install_root}/releases/${logue_version}.XXXXXX")"
rmdir -- "${release_dir}"
mv "${package_dir}" "${release_dir}"
staged_release_dir="${release_dir}"

if [[ -L "${current_link}" ]]; then
  previous_current="$(readlink "${current_link}")"
elif [[ -e "${current_link}" && ! -d "${current_link}" ]]; then
  fail "Existing current is neither a symlink nor a directory; stopped to avoid overwriting an unknown file."
fi
cli_backup="${bin_dir}/.logue.previous.$$"
if [[ -d "${bin_dir}/logue" && ! -L "${bin_dir}/logue" ]]; then
  fail "CLI path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${bin_dir}/logue" || -L "${bin_dir}/logue" ]]; then
  /bin/cp -pP "${bin_dir}/logue" "${cli_backup}"
  had_cli="yes"
fi
cli_next="${bin_dir}/.logue.next.$$"
{
  printf '%s\n' '#!/usr/bin/env bash'
  printf 'export LOGUE_VERSION="$(tr -d '\''\\r\\n'\'' < %q)"\n' "${current_link}/VERSION"
  # `--version` is answered here so the CLI can report the installed release
  # without the Host having to grow a flag for it.
  printf '%s\n' '[[ "${1:-}" == --version ]] && { printf "%s\n" "${LOGUE_VERSION}"; exit 0; }'
  printf 'export PYTHONPATH=%q${PYTHONPATH:+:${PYTHONPATH}}\n' "${current_link}/server"
  printf 'exec %q -m logue_host --data-dir %q "$@"\n' "${python_bin}" "${data_root}"
} > "${cli_next}"
chmod 755 "${cli_next}"
say "App, Web App, and CLI candidates are ready"

link_web() {
  # The Host looks for the app at `<install root>/web` and serves the API alone
  # when it is not there, so an install without this link answers every browser
  # with JSON. `current` is the only thing an upgrade moves, so a fixed symlink
  # through it never needs a second switch — and a rollback of `current` takes
  # the app back with it.
  local web_link="${install_root}/web" web_next
  [[ "$(readlink "${web_link}" 2>/dev/null)" == "${current_link}/web" ]] && return 0
  # Anything else at this name is a previous install's copy of the app: the
  # install root holds only installer-managed files, and the preflight has
  # already refused a data root that overlaps it.
  if [[ -e "${web_link}" && ! -L "${web_link}" ]]; then
    rm -rf -- "${web_link}" || return 1
  fi
  web_next="${install_root}/.web.next.$$"
  rm -f -- "${web_next}"
  ln -s "${current_link}/web" "${web_next}" || return 1
  replace_path "${web_next}" "${web_link}" || return 1
  return 0
}

managed_command_belongs_to_install() {
  # Only ever signal a Host that is serving this workspace. Legacy matched the
  # install root in argv; `-m logue_host` hides it, so the data root — which
  # this installer owns — is the identifying argument.
  [[ "$1" == *"-m logue_host"* && "$1" == *"--data-dir ${data_root}"* ]]
}

validate_managed_service() {
  local old_command
  managed_pid=""
  [[ -f "${pid_file}" ]] || return 0
  managed_pid="$(tr -dc '0-9' < "${pid_file}")"
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    old_command="$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)"
    managed_command_belongs_to_install "${old_command}" || fail "The recorded PID does not belong to this Logue installation; stopped to avoid terminating another process."
    service_was_active="yes"
  else
    managed_pid=""
  fi
}

stop_managed_service() {
  local wait_count
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    managed_command_belongs_to_install "$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)" || return 1
    say "Stopping existing service (PID ${managed_pid})"
    kill "${managed_pid}" >/dev/null 2>&1 || true
    for ((wait_count = 0; wait_count < 50; wait_count++)); do
      kill -0 "${managed_pid}" >/dev/null 2>&1 || break
      sleep 0.1
    done
    kill -0 "${managed_pid}" >/dev/null 2>&1 && kill -KILL "${managed_pid}" >/dev/null 2>&1 || true
    for ((wait_count = 0; wait_count < 20; wait_count++)); do
      kill -0 "${managed_pid}" >/dev/null 2>&1 || break
      sleep 0.1
    done
    kill -0 "${managed_pid}" >/dev/null 2>&1 && return 1
  fi
  rm -f -- "${pid_file}"
  managed_pid=""
  return 0
}

start_service() {
  local wait_count status_body
  # Started through `current`, so a rollback of the symlink is enough to make
  # the previous release the one that comes back up.
  (
    cd "${install_root}"
    PYTHONPATH="${current_link}/server" nohup "${python_bin}" -m logue_host \
      --address "${logue_address}" --data-dir "${data_root}" >>"${log_file}" 2>&1 &
    printf '%s\n' "$!" > "${pid_file}"
  )
  managed_pid="$(tr -dc '0-9' < "${pid_file}")"
  for ((wait_count = 0; wait_count < 100; wait_count++)); do
    if status_body="$(curl -fsS --max-time 2 "${health_url}" 2>/dev/null)"; then
      # Answering the port is not proof: confirm it is this workspace, so a
      # stray Host on the same port cannot be mistaken for a good upgrade.
      if STATUS_BODY="${status_body}" EXPECTED_ROOT="${data_root}" "${python_bin}" - <<'PY'
import json
import os
from pathlib import Path

status = json.loads(os.environ["STATUS_BODY"])
if not status.get("ok"):
    raise SystemExit("Host reported a failure")
if Path(str(status.get("data_dir"))).resolve() != Path(os.environ["EXPECTED_ROOT"]).resolve():
    raise SystemExit("Host is serving a different data root")
PY
      then
        return 0
      fi
    fi
    kill -0 "${managed_pid}" >/dev/null 2>&1 || break
    sleep 0.1
  done
  return 1
}

commit_install() {
  local next_link
  if [[ -e "${current_link}" && ! -L "${current_link}" ]]; then
    previous_current_backup="${install_root}/.current.previous.$$"
    mv "${current_link}" "${previous_current_backup}" || return 1
  fi
  next_link="${install_root}/.current.next.$$"
  ln -s "${release_dir}" "${next_link}" || return 1
  replace_path "${next_link}" "${current_link}" || return 1
  current_switched="yes"
  say "App switched to ${logue_version}"

  link_web || return 1

  start_service || return 1
  inject_failure service || return 1
  say "Service started: ${health_url}"

  replace_path "${cli_next}" "${bin_dir}/logue" || return 1
  cli_next=""
  inject_failure cli || return 1
  return 0
}

rollback_install() {
  local rollback_failed="no" rollback_link
  stop_managed_service || rollback_failed="yes"
  if [[ "${had_cli}" == "yes" ]]; then
    replace_path "${cli_backup}" "${bin_dir}/logue" || rollback_failed="yes"
  else
    rm -f -- "${bin_dir}/logue" || rollback_failed="yes"
  fi
  if [[ -n "${previous_current}" ]]; then
    rollback_link="${install_root}/.current.rollback.$$"
    ln -s "${previous_current}" "${rollback_link}" || rollback_failed="yes"
    replace_path "${rollback_link}" "${current_link}" || rollback_failed="yes"
  elif [[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]]; then
    rm -f -- "${current_link}" || rollback_failed="yes"
    mv "${previous_current_backup}" "${current_link}" || rollback_failed="yes"
  else
    rm -f -- "${current_link}" || rollback_failed="yes"
  fi
  current_switched="no"
  if [[ -n "${staged_release_dir}" && -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}" || rollback_failed="yes"
    staged_release_dir=""
  fi
  # The previous release only counts as restored if it is serving again.
  if [[ "${service_was_active}" == "yes" && -f "${current_link}/server/logue_host/__main__.py" ]]; then
    start_service || rollback_failed="yes"
  fi
  [[ "${rollback_failed}" == "no" ]]
}

step "3/4  Commit atomically and check the service"
validate_managed_service
stop_managed_service || fail "Could not stop the existing service safely; the existing installation was not switched."
if ! commit_install; then
  printf '\nUpgrade commit failed; restoring the complete previous version…\n' >&2
  if rollback_install; then
    fail "Upgrade did not complete; the app, CLI, and previous service were restored. Data was not changed."
  fi
  printf '\nLatest service log:\n' >&2
  tail -n 12 "${log_file}" >&2 || true
  fail "Upgrade did not complete and automatic recovery was incomplete. Data was not changed; keep the log above."
fi

rm -f -- "${cli_backup}"
[[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]] && rm -rf -- "${previous_current_backup}"
staged_release_dir=""

step "4/4  Install the Chrome Extension"
# One command, both halves. Two commands meant a machine could sit with a Host
# and no Extension — the half that has no way of telling you that is what it is.
# The Extension installer takes the release this one already downloaded and
# verified, so `latest` is resolved once and both halves are the same release.
if [[ "${LOGUE_SKIP_EXTENSION:-}" == "1" ]]; then
  say "Skipped: LOGUE_SKIP_EXTENSION=1"
  say "Later, on the computer with Chrome, pinned to this release:"
  say "curl -fsSL https://github.com/ralphite/logue/releases/download/${logue_version}/install-extension.sh | LOGUE_RELEASE='${logue_version}' bash"
else
  curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/install-extension.sh" \
    -o "${install_tmp}/install-extension.sh" ||
    fail "The Host is installed and running, but the Extension installer could not be downloaded."
  # Not rolled back if this fails: the Host is up and serving, and taking a
  # working installation away is the worse of the two outcomes. The failure is
  # reported instead, with the command that retries only this half.
  LOGUE_PACKAGE_DIR="${current_link}" \
  LOGUE_EXTENSION_DIR="${LOGUE_EXTENSION_DIR:-${install_root}/extension}" \
  LOGUE_RELEASE="${logue_version}" \
    bash "${install_tmp}/install-extension.sh" ||
    fail "The Host is installed and running at ${open_url}, but the Extension was not installed."
fi

printf '\n✓ Logue %s is installed and running\n' "${logue_version}"
say "Open: ${open_url}"
say "Listen address: ${logue_address}"
case "${address_host}" in
  0.0.0.0|'*'|'[::]') say "Security: Logue has no public-internet authentication. Limit access with a firewall, VPN, or controlled reverse proxy." ;;
esac
say "Command: ${bin_dir}/logue"
say "Data remains at: ${data_root}"
say "Web App files: ${current_link}/web"
