#!/usr/bin/env bash

set -Eeuo pipefail

logue_system="$(uname -s)"
if [[ "${LOGUE_INSTALLER_TESTING:-}" == "1" ]]; then
  logue_system="${LOGUE_INSTALLER_TEST_OS:-${logue_system}}"
fi

case "${logue_system}" in
  Darwin) logue_platform="darwin" ;;
  Linux) logue_platform="linux" ;;
  *) printf 'Unsupported operating system: %s\n' "${logue_system}" >&2; exit 69 ;;
esac

has_interactive_terminal() {
  [[ -t 0 || -t 1 || -t 2 ]] && [[ -r /dev/tty && -w /dev/tty ]]
}

logue_home="${HOME:?HOME is required}"
install_root="${LOGUE_INSTALL_ROOT:-${logue_home}/.local/share/logue}"
legacy_default_data_root=""
if [[ "${logue_platform}" == "darwin" ]]; then
  default_data_root="${logue_home}/Library/Application Support/Logue"
else
  linux_data_base="${XDG_DATA_HOME:-${logue_home}/.local/share}"
  legacy_default_data_root="${linux_data_base}/logue/data"
  default_data_root="${linux_data_base}/logue-data"
fi
data_root="${LOGUE_DATA_DIR:-${default_data_root}}"
bin_dir="${LOGUE_BIN_DIR:-${logue_home}/.local/bin}"
launch_agents_dir="${LOGUE_LAUNCH_AGENTS_DIR:-${logue_home}/Library/LaunchAgents}"
launch_label="${LOGUE_LAUNCH_LABEL:-com.ralphite.logue}"
launch_plist="${launch_agents_dir}/${launch_label}.plist"
systemd_user_dir="${LOGUE_SYSTEMD_USER_DIR:-${XDG_CONFIG_HOME:-${logue_home}/.config}/systemd/user}"
systemd_unit_name="${LOGUE_SYSTEMD_UNIT_NAME:-logue.service}"
if [[ ! "${systemd_unit_name}" =~ ^[A-Za-z0-9_.@-]+\.service$ ]]; then
  printf 'LOGUE_SYSTEMD_UNIT_NAME must be a systemd service unit name without a path.\n' >&2
  exit 64
fi
systemd_unit="${systemd_user_dir}/${systemd_unit_name}"
logue_port="${LOGUE_PORT:-8787}"
choose_address() {
  local configured="${LOGUE_ADDRESS:-}" answer
  if [[ -n "${configured}" ]]; then
    printf '%s' "${configured}"
    return
  fi
  if has_interactive_terminal; then
    printf '\nWhere should Logue listen?\n' > /dev/tty
    printf '  1) Network — 0.0.0.0:%s (recommended)\n' "${logue_port}" > /dev/tty
    printf '  2) This computer only — 127.0.0.1:%s\n' "${logue_port}" > /dev/tty
    printf 'Choose 1 or 2 [1]: ' > /dev/tty
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in
      2|local|LOCAL|Local) printf '127.0.0.1:%s' "${logue_port}" ;;
      *) printf '0.0.0.0:%s' "${logue_port}" ;;
    esac
    return
  fi
  printf 'No interactive terminal; using 0.0.0.0:%s so Logue is reachable on the network. Restrict access with a firewall or VPN.\n' "${logue_port}" >&2
  printf '0.0.0.0:%s' "${logue_port}"
}
logue_address="$(choose_address)"
if [[ ! "${logue_address}" =~ ^(\[[^]]+\]|[^:]+):([0-9]+)$ ]]; then
  printf 'LOGUE_ADDRESS must be a host and port, for example 127.0.0.1:8787 or 0.0.0.0:8787.\n' >&2
  exit 64
fi
address_host="${BASH_REMATCH[1]}"
address_port="${BASH_REMATCH[2]}"
if (( address_port < 1 || address_port > 65535 )); then
  printf 'LOGUE_ADDRESS uses an invalid port: %s.\n' "${address_port}" >&2
  exit 64
fi
case "${address_host}" in
  0.0.0.0|'*'|'[::]') health_host="127.0.0.1" ;;
  *) health_host="${address_host}" ;;
esac
health_url="${LOGUE_HEALTH_URL:-http://${health_host}:${address_port}/v1/status}"
open_url="${LOGUE_OPEN_URL:-${health_url%/v1/status}}"
requested_release="${LOGUE_RELEASE:-}"
if [[ -n "${requested_release}" && ! "${requested_release}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]]; then
  printf 'LOGUE_RELEASE must be a full Logue release identity such as v0.2.13.\n' >&2
  exit 64
fi
if [[ -n "${LOGUE_ASSET_BASE_URL:-}" ]]; then
  asset_base_url="${LOGUE_ASSET_BASE_URL}"
elif [[ -n "${requested_release}" ]]; then
  asset_base_url="https://github.com/ralphite/logue/releases/download/${requested_release}"
else
  asset_base_url="https://github.com/ralphite/logue/releases/latest/download"
fi
asset_name="logue-python.zip"
current_link="${install_root}/current"
extension_dir="${install_root}/extension"
run_dir="${install_root}/run"
pid_file="${run_dir}/logue.pid"
log_file="${run_dir}/logue.log"
install_tmp=""
staged_release_dir=""
staged_extension_assets=""
extension_manifest_next=""
cli_next=""
launch_plist_next=""
systemd_unit_next=""
current_switched="no"
data_migration_required="no"
data_migration_applied="no"
migration_plan_file=""
migration_backup_root=""
service_was_active="no"

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\nInstallation did not complete: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ "${data_migration_applied}" == "yes" && "${current_switched}" == "no" ]]; then
    rollback_legacy_migration >/dev/null 2>&1 || true
  fi
  if [[ "${current_switched}" == "no" && -n "${staged_release_dir}" && -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}"
  fi
  if [[ -n "${staged_extension_assets}" && -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}"
  fi
  [[ -n "${extension_manifest_next}" ]] && rm -f -- "${extension_manifest_next}"
  [[ -n "${cli_next}" ]] && rm -f -- "${cli_next}"
  [[ -n "${launch_plist_next}" ]] && rm -f -- "${launch_plist_next}"
  [[ -n "${systemd_unit_next}" ]] && rm -f -- "${systemd_unit_next}"
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
}
trap cleanup EXIT

choose_autostart() {
  local configured="${LOGUE_AUTO_START:-}" answer
  case "${configured}" in
    1|true|TRUE|True|yes|YES|Yes|y|Y) printf 'yes' ; return ;;
    0|false|FALSE|False|no|NO|No|n|N) printf 'no' ; return ;;
    "") ;;
    *) fail "LOGUE_AUTO_START accepts only yes or no." ;;
  esac
  if has_interactive_terminal; then
    if [[ "${logue_platform}" == "darwin" ]]; then
      printf '\nStart Logue when you sign in to this Mac? [Y/n] ' > /dev/tty
    else
      printf '\nCreate a systemd user service to start Logue when you sign in? [Y/n] ' > /dev/tty
    fi
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in n|N|no|NO|No) printf 'no' ;; *) printf 'yes' ;; esac
  else
    say "No interactive terminal; automatic startup stays off. Re-run with LOGUE_AUTO_START=yes to enable it." >&2
    printf 'no'
  fi
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

systemd_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/%/%%/g'
}

replace_path() {
  local source="$1" destination="$2"
  if [[ "$(uname -s)" == "Linux" ]]; then
    /bin/mv -fT -- "${source}" "${destination}"
  else
    /bin/mv -f -h "${source}" "${destination}"
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

read_systemd_data_root() {
  "${python_bin}" - "$1" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
if path.is_symlink() or not path.is_file():
    raise SystemExit(1)
matches = re.findall(r'^Environment="LOGUE_DATA_DIR=(.*)"$', path.read_text(), flags=re.MULTILINE)
if not matches:
    raise SystemExit(1)
value = matches[-1].replace("%%", "%")
value = re.sub(r'\\(["\\])', r'\1', value)
print(value)
PY
}

choose_data_migration() {
  local configured="${LOGUE_MIGRATE_DATA:-}" answer
  case "${configured}" in
    1|true|TRUE|True|yes|YES|Yes|y|Y) return ;;
    0|false|FALSE|False|no|NO|No|n|N) fail "The existing Linux workspace was left at ${legacy_default_data_root}. Re-run with LOGUE_DATA_DIR set to an independent path or allow the one-time migration." ;;
    "") ;;
    *) fail "LOGUE_MIGRATE_DATA accepts only yes or no." ;;
  esac
  if ! has_interactive_terminal; then
    fail "Existing Logue data must move from ${legacy_default_data_root} to ${default_data_root}. Re-run with LOGUE_MIGRATE_DATA=yes after reviewing these paths."
  fi
  printf '\nMove the existing Logue workspace and all recoverable snapshots?\n' > /dev/tty
  printf '  From: %s\n' "${legacy_default_data_root}" > /dev/tty
  printf '  To:   %s\n' "${default_data_root}" > /dev/tty
  printf 'The installer keeps a migration backup and restores the old service if the upgrade fails. [y/N] ' > /dev/tty
  answer=""
  IFS= read -r answer < /dev/tty || true
  case "${answer}" in
    y|Y|yes|YES|Yes) ;;
    *) fail "Migration was not confirmed; the existing workspace was not changed." ;;
  esac
}

preflight_managed_paths() {
  "${python_bin}" - "${data_root}" "${legacy_default_data_root}" "${data_migration_required}" "${install_root}" "${bin_dir}/logue" "$([[ "${logue_platform}" == "darwin" ]] && printf '%s' "${launch_plist}" || printf '%s' "${systemd_unit}")" <<'PY'
import sys
from pathlib import Path

data_raw, legacy_raw, migration, *managed_raw = sys.argv[1:]

for label, value in [("data root", data_raw), ("legacy data root", legacy_raw), *[("managed target", item) for item in managed_raw]]:
    if value and not Path(value).expanduser().is_absolute():
        raise SystemExit(f"{label} must be an absolute path: {value}")

def resolved(value: str) -> Path:
    return Path(value).expanduser().resolve(strict=False)

def overlaps(left: Path, right: Path) -> bool:
    return left == right or left in right.parents or right in left.parents

data = resolved(data_raw)
legacy = resolved(legacy_raw) if legacy_raw else None
managed = [resolved(value) for value in managed_raw]
protected = [data]
for candidate in data.parent.glob(f"{data.name}.backup-*"):
    if candidate.is_symlink() or not candidate.is_dir():
        raise SystemExit(f"Unsafe Logue snapshot path: {candidate}")
    if not candidate.name.startswith(f"{data.name}.backup-backup_"):
        raise SystemExit(f"Unrecognized Logue snapshot path: {candidate}")
    protected.append(candidate.resolve())
for item in protected:
    for target in managed:
        if overlaps(item, target):
            raise SystemExit(f"Logue data path overlaps an installer-managed path: {item} <> {target}")
if data.exists() and data.is_symlink():
    raise SystemExit(f"Logue data root cannot be a symlink: {data}")
if migration == "yes":
    if legacy is None or not legacy.is_dir() or legacy.is_symlink():
        raise SystemExit("The exact legacy Logue data root is missing or unsafe")
    if data.exists():
        raise SystemExit(f"Migration target already exists: {data}")
    if legacy == data:
        raise SystemExit("Legacy and destination data roots are the same")
PY
}

validate_legacy_migration_source() {
  "${python_bin}" - "${legacy_default_data_root}" <<'PY'
import json
import re
import stat
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
required = (
    "items", "item-revisions", "audio", "docs", "doc-revisions",
    "transcript-revisions", "projects", "skills", "skill-revisions",
    "skill-runs", "topic-vocabularies", "topics", "clients",
)

def parse_object(path: Path) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{path} is not a JSON object")
    return value

def validate_tree(path: Path, *, snapshot_id: str = "") -> None:
    if path.is_symlink() or not path.is_dir():
        raise ValueError(f"unsafe Logue data directory: {path}")
    for name in required:
        child = path / name
        if child.is_symlink() or not child.is_dir():
            raise ValueError(f"missing current-schema directory: {name}")
    parse_object(path / "settings.json")
    for child in path.rglob("*"):
        if child.is_symlink():
            raise ValueError(f"links are not allowed in Logue data: {child}")
        mode = child.stat(follow_symlinks=False).st_mode
        if child.is_file() and not stat.S_ISREG(mode):
            raise ValueError(f"unsupported data file: {child}")
        if child.is_file() and child.suffix == ".json":
            parse_object(child)
    if snapshot_id:
        marker = parse_object(path / ".logue-backup.json")
        if marker.get("schema_version") != 2 or marker.get("snapshot_id") != snapshot_id:
            raise ValueError(f"snapshot marker does not match {path.name}")

validate_tree(root)
prefix = f"{root.name}.backup-"
for snapshot in sorted(root.parent.glob(f"{root.name}.backup-*")):
    snapshot_id = snapshot.name.removeprefix(prefix)
    if not re.fullmatch(r"backup_[0-9a-f]{20}", snapshot_id):
        raise ValueError(f"invalid snapshot identity: {snapshot.name}")
    validate_tree(snapshot, snapshot_id=snapshot_id)
PY
}

inject_failure() {
  if [[ "${LOGUE_INSTALLER_FAIL_AT:-}" == "$1" ]]; then
    printf '  [test] injected failure after %s switch\n' "$1" >&2
    return 1
  fi
  return 0
}

case "${LOGUE_INSTALLER_FAIL_AT:-}" in
  ""|extension|cli|autostart) ;;
  *) fail "LOGUE_INSTALLER_FAIL_AT accepts only extension, cli, or autostart." ;;
esac

autostart="$(choose_autostart)"

for required_command in curl python3.13; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "Missing required system command: ${required_command}."
done
python_bin="$(command -v python3.13)"
[[ "${python_bin}" == /* ]] || fail "python3.13 must resolve to an absolute path."
"${python_bin}" -c 'import sys; raise SystemExit(sys.version_info[:2] != (3, 13))' || fail "Logue requires Python 3.13."
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  fail "Missing required system command: sha256sum or shasum."
fi
if [[ "${logue_platform}" == "darwin" ]]; then
  command -v plutil >/dev/null 2>&1 || fail "Missing required system command: plutil."
elif [[ "${autostart}" == "yes" || -f "${systemd_unit}" ]]; then
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required to manage the existing or requested systemd user service."
fi

if [[ "${logue_platform}" == "linux" && -z "${LOGUE_DATA_DIR:-}" ]]; then
  existing_systemd_data_root=""
  if [[ -e "${systemd_unit}" || -L "${systemd_unit}" ]]; then
    existing_systemd_data_root="$(read_systemd_data_root "${systemd_unit}" 2>/dev/null || true)"
    [[ -n "${existing_systemd_data_root}" ]] || fail "The existing Logue systemd unit has no readable LOGUE_DATA_DIR; set LOGUE_DATA_DIR explicitly before upgrading."
    [[ "${existing_systemd_data_root}" == /* ]] || fail "The existing Logue systemd unit uses a relative data path; set LOGUE_DATA_DIR to the intended absolute workspace path before upgrading."
  fi
  if [[ -n "${existing_systemd_data_root}" && "$("${python_bin}" -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve(strict=False))' "${existing_systemd_data_root}")" != "$("${python_bin}" -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve(strict=False))' "${legacy_default_data_root}")" ]]; then
    [[ -d "${existing_systemd_data_root}" ]] || fail "The existing systemd data directory is missing: ${existing_systemd_data_root}. Set LOGUE_DATA_DIR explicitly instead of starting an empty workspace."
    data_root="${existing_systemd_data_root}"
  elif [[ -n "${existing_systemd_data_root}" || ( -d "${legacy_default_data_root}" && ( -e "${current_link}" || -L "${current_link}" ) ) ]]; then
    [[ -d "${legacy_default_data_root}" ]] || fail "The existing service points to missing Logue data at ${legacy_default_data_root}; the installer will not start an empty workspace."
    [[ ! -e "${default_data_root}" && ! -L "${default_data_root}" ]] || fail "Both legacy and new Logue data roots exist. Set LOGUE_DATA_DIR explicitly after choosing the authoritative workspace."
    data_root="${default_data_root}"
    data_migration_required="yes"
    choose_data_migration
    validate_legacy_migration_source || fail "The legacy workspace or one of its snapshots is not a complete current-schema Logue workspace. Nothing was changed."
  fi
fi

preflight_managed_paths || fail "Logue data or snapshots overlap installer-managed paths. Nothing was downloaded or changed."

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
        target = (destination / member.filename).resolve()
        if destination not in target.parents and target != destination:
            raise SystemExit(f"Unsafe release path: {member.filename}")
    archive.extractall(destination)
PY
[[ -f "${package_dir}/python_server/logue_server.py" ]] || fail "Release is missing the Python server."
[[ -f "${package_dir}/web/index.html" ]] || fail "Release is missing the Web App."
[[ -f "${package_dir}/extension/manifest.json" ]] || fail "Release is missing the Chrome Extension."
[[ -f "${package_dir}/extension/background.js" && -f "${package_dir}/extension/content.js" && -f "${package_dir}/extension/sidepanel.html" && -f "${package_dir}/extension/microphone.html" ]] || fail "Release Extension assets are incomplete."
[[ -f "${package_dir}/VERSION" ]] || fail "Release is missing VERSION."
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
validate_release_contract || fail "Release VERSION and Extension identity do not match; the existing installation was not changed."
say "Preparing ${logue_version}"

mkdir -p "${install_root}/releases" "${bin_dir}" "${run_dir}"
if [[ "${data_migration_required}" == "no" ]]; then
  mkdir -p "${data_root}"
fi
if [[ "${logue_platform}" == "darwin" ]]; then
  mkdir -p "${launch_agents_dir}"
else
  mkdir -p "${systemd_user_dir}"
fi

managed_pid=""
previous_current=""
previous_current_version=""
previous_current_backup=""
extension_manifest_backup="${extension_dir}/.manifest.previous.$$"
cli_backup="${bin_dir}/.logue.previous.$$"
launch_plist_backup="${launch_agents_dir}/.${launch_label}.previous.$$"
systemd_unit_backup="${systemd_user_dir}/.${systemd_unit_name}.previous.$$"
had_extension_manifest="no"
had_cli="no"
had_launch_plist="no"
had_systemd_unit="no"
systemd_was_enabled="no"

validate_managed_service() {
  local old_command systemd_pid
  managed_pid=""
  if [[ "${logue_platform}" == "linux" && -f "${systemd_unit}" ]] && command -v systemctl >/dev/null 2>&1; then
    systemd_pid="$(systemctl --user show --property MainPID --value "${systemd_unit_name}" 2>/dev/null || true)"
    if [[ "${systemd_pid}" =~ ^[1-9][0-9]*$ ]] && kill -0 "${systemd_pid}" >/dev/null 2>&1; then
      old_command="$(ps -p "${systemd_pid}" -o command= 2>/dev/null || true)"
      [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || fail "The systemd user service does not belong to this Logue installation; stopped to avoid terminating another process."
      managed_pid="${systemd_pid}"
      return
    fi
  fi
  if [[ -f "${pid_file}" ]]; then
    managed_pid="$(tr -dc '0-9' < "${pid_file}")"
    if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
      old_command="$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)"
      [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || fail "The PID file does not belong to this Logue installation; stopped to avoid terminating another process."
    else
      managed_pid=""
    fi
  fi
}

stop_managed_service() {
  local old_command wait_count systemd_state systemd_main_pid
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    old_command="$(ps -p "${managed_pid}" -o command= 2>/dev/null || true)"
    [[ "${old_command}" == *"${install_root}"*"/logue"* ]] || return 1
  fi
  if [[ "${logue_platform}" == "darwin" ]]; then
    launchctl bootout "gui/$(id -u)" "${launch_plist}" >/dev/null 2>&1 || launchctl unload "${launch_plist}" >/dev/null 2>&1 || true
  elif [[ -f "${systemd_unit}" ]]; then
    systemctl --user stop "${systemd_unit_name}" >/dev/null 2>&1 || return 1
    systemd_state="$(systemctl --user show --property ActiveState --value "${systemd_unit_name}" 2>/dev/null || true)"
    systemd_main_pid="$(systemctl --user show --property MainPID --value "${systemd_unit_name}" 2>/dev/null || true)"
    [[ "${systemd_state}" == "inactive" || "${systemd_state}" == "failed" || -z "${systemd_state}" ]] || return 1
    [[ -z "${systemd_main_pid}" || "${systemd_main_pid}" == "0" ]] || return 1
  fi
  if [[ -n "${managed_pid}" ]] && kill -0 "${managed_pid}" >/dev/null 2>&1; then
    say "Stopping existing service (PID ${managed_pid})"
    kill "${managed_pid}" >/dev/null 2>&1 || true
    for ((wait_count = 0; wait_count < 30; wait_count++)); do
      kill -0 "${managed_pid}" >/dev/null 2>&1 || break
      sleep 0.1
    done
    if kill -0 "${managed_pid}" >/dev/null 2>&1; then
      kill -KILL "${managed_pid}" >/dev/null 2>&1 || true
      for ((wait_count = 0; wait_count < 20; wait_count++)); do
        kill -0 "${managed_pid}" >/dev/null 2>&1 || break
        sleep 0.1
      done
    fi
    kill -0 "${managed_pid}" >/dev/null 2>&1 && return 1
  fi
  rm -f -- "${pid_file}"
  managed_pid=""
  return 0
}

prepare_legacy_migration() {
  migration_plan_file="${install_tmp}/data-migration.json"
  "${python_bin}" - "${legacy_default_data_root}" "${data_root}" "${migration_plan_file}" <<'PY'
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

source, destination, plan_path = map(Path, sys.argv[1:])
source = source.resolve()
destination = destination.resolve(strict=False)
required = (
    "items", "item-revisions", "audio", "docs", "doc-revisions",
    "transcript-revisions", "projects", "skills", "skill-revisions",
    "skill-runs", "topic-vocabularies", "topics", "clients",
)

def parse_object(path: Path) -> dict:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"{path} is not a JSON object")
    return value

def validate_live(path: Path) -> None:
    if path.is_symlink() or not path.is_dir():
        raise ValueError(f"unsafe workspace: {path}")
    for name in required:
        if not (path / name).is_dir() or (path / name).is_symlink():
            raise ValueError(f"missing current-schema directory: {name}")
    parse_object(path / "settings.json")
    for child in path.rglob("*"):
        if child.is_symlink():
            raise ValueError(f"workspace link is not allowed: {child}")
        if child.is_file() and child.suffix == ".json":
            parse_object(child)

def validate_snapshot(path: Path, snapshot_id: str) -> None:
    validate_live(path)
    marker = parse_object(path / ".logue-backup.json")
    if marker.get("schema_version") != 2 or marker.get("snapshot_id") != snapshot_id:
        raise ValueError(f"snapshot marker does not match {path.name}")

def manifest(path: Path) -> dict[str, tuple[int, str]]:
    result: dict[str, tuple[int, str]] = {}
    for child in sorted(path.rglob("*")):
        if child.is_file():
            digest = hashlib.sha256()
            with child.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1 << 20), b""):
                    digest.update(chunk)
            result[str(child.relative_to(path))] = (child.stat().st_size, digest.hexdigest())
    return result

validate_live(source)
prefix = f"{source.name}.backup-"
snapshots: list[tuple[Path, Path]] = []
for old in sorted(source.parent.glob(f"{source.name}.backup-*")):
    snapshot_id = old.name.removeprefix(prefix)
    if not re.fullmatch(r"backup_[0-9a-f]{20}", snapshot_id):
        raise ValueError(f"invalid snapshot identity: {old.name}")
    validate_snapshot(old, snapshot_id)
    new = destination.parent / f"{destination.name}.backup-{snapshot_id}"
    if new.exists() or new.is_symlink():
        raise ValueError(f"migration snapshot target already exists: {new}")
    snapshots.append((old, new))

timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup = destination.parent / f"{destination.name}.migration-backup-{timestamp}"
if destination.exists() or destination.is_symlink() or backup.exists() or backup.is_symlink():
    raise ValueError("migration destination or backup already exists")
if source.stat().st_dev != destination.parent.stat().st_dev:
    raise ValueError("legacy and destination data roots must be on the same filesystem")

moved: list[tuple[Path, Path]] = []
try:
    os.replace(source, backup)
    for old, new in snapshots:
        os.replace(old, new)
        moved.append((old, new))
    shutil.copytree(backup, destination, copy_function=shutil.copy2)
    validate_live(destination)
    if manifest(backup) != manifest(destination):
        raise ValueError("frozen workspace copy does not match its migration backup")
    for old, new in snapshots:
        snapshot_id = new.name.removeprefix(f"{destination.name}.backup-")
        validate_snapshot(new, snapshot_id)
    plan_path.write_text(json.dumps({
        "schema_version": 2,
        "source": str(source),
        "destination": str(destination),
        "backup": str(backup),
        "snapshots": [{"old": str(old), "new": str(new)} for old, new in snapshots],
    }, indent=2) + "\n")
except BaseException:
    shutil.rmtree(destination, ignore_errors=True)
    for old, new in reversed(moved):
        if new.exists() and not old.exists():
            os.replace(new, old)
    if backup.exists() and not source.exists():
        os.replace(backup, source)
    raise
PY
  migration_backup_root="$("${python_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["backup"])' "${migration_plan_file}")"
  data_migration_applied="yes"
}

rollback_legacy_migration() {
  [[ "${data_migration_applied}" == "yes" ]] || return 0
  "${python_bin}" - "${migration_plan_file}" <<'PY'
import json
import os
import shutil
import sys
from pathlib import Path

plan = json.loads(Path(sys.argv[1]).read_text())
source = Path(plan["source"])
destination = Path(plan["destination"])
backup = Path(plan["backup"])
if source.exists() or source.is_symlink():
    raise SystemExit(f"cannot restore legacy workspace over existing path: {source}")
shutil.rmtree(destination, ignore_errors=True)
for entry in reversed(plan.get("snapshots", [])):
    old, new = Path(entry["old"]), Path(entry["new"])
    if old.exists() or old.is_symlink():
        raise SystemExit(f"cannot restore legacy snapshot over existing path: {old}")
    if new.exists():
        os.replace(new, old)
if not backup.is_dir() or backup.is_symlink():
    raise SystemExit("migration backup is missing")
os.replace(backup, source)
PY
  data_root="${legacy_default_data_root}"
  data_migration_applied="no"
}

start_service() {
  local expected_version="$1" service_pid status_body wait_count
  : >> "${log_file}" || return 1
  nohup env \
    LOGUE_DATA_DIR="${data_root}" \
    LOGUE_WEB_DIST="${current_link}/web" \
    LOGUE_VERSION="${expected_version}" \
    "${python_bin}" "${current_link}/python_server/logue_server.py" --address "${logue_address}" \
    >> "${log_file}" 2>&1 </dev/null &
  service_pid=$!
  printf '%s\n' "${service_pid}" > "${pid_file}" || return 1
  managed_pid="${service_pid}"
  for ((wait_count = 0; wait_count < 40; wait_count++)); do
    if ! kill -0 "${service_pid}" >/dev/null 2>&1; then
      return 1
    fi
    status_body="$(curl -fsS --max-time 1 "${health_url}" 2>/dev/null || true)"
    if [[ "${status_body}" == *'"ok":true'* && "${status_body}" == *"\"version\":\"${expected_version}\""* ]]; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

create_launch_plist() {
  local escaped_label escaped_python escaped_server escaped_address escaped_data escaped_web escaped_log escaped_version
  escaped_label="$(xml_escape "${launch_label}")"
  escaped_python="$(xml_escape "${python_bin}")"
  escaped_server="$(xml_escape "${current_link}/python_server/logue_server.py")"
  escaped_address="$(xml_escape "${logue_address}")"
  escaped_data="$(xml_escape "${data_root}")"
  escaped_web="$(xml_escape "${current_link}/web")"
  escaped_log="$(xml_escape "${log_file}")"
  escaped_version="$(xml_escape "${logue_version}")"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0"><dict>'
    printf '  <key>Label</key><string>%s</string>\n' "${escaped_label}"
    printf '%s\n' '  <key>ProgramArguments</key><array>'
    printf '    <string>%s</string><string>%s</string><string>--address</string><string>%s</string>\n' "${escaped_python}" "${escaped_server}" "${escaped_address}"
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>EnvironmentVariables</key><dict>'
    printf '    <key>LOGUE_DATA_DIR</key><string>%s</string>\n' "${escaped_data}"
    printf '    <key>LOGUE_WEB_DIST</key><string>%s</string>\n' "${escaped_web}"
    printf '    <key>LOGUE_VERSION</key><string>%s</string>\n' "${escaped_version}"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    printf '  <key>StandardOutPath</key><string>%s</string>\n' "${escaped_log}"
    printf '  <key>StandardErrorPath</key><string>%s</string>\n' "${escaped_log}"
    printf '%s\n' '</dict></plist>'
  } > "${launch_plist_next}" || return 1
  chmod 600 "${launch_plist_next}" || return 1
  plutil -lint "${launch_plist_next}" >/dev/null || return 1
}

create_systemd_unit() {
  local escaped_python escaped_server escaped_address escaped_data escaped_web escaped_version
  escaped_python="$(systemd_escape "${python_bin}")"
  escaped_server="$(systemd_escape "${current_link}/python_server/logue_server.py")"
  escaped_address="$(systemd_escape "${logue_address}")"
  escaped_data="$(systemd_escape "${data_root}")"
  escaped_web="$(systemd_escape "${current_link}/web")"
  escaped_version="$(systemd_escape "${logue_version}")"
  {
    printf '%s\n' '[Unit]'
    printf '%s\n' 'Description=Logue service'
    printf '%s\n' 'After=network-online.target'
    printf '%s\n' 'Wants=network-online.target'
    printf '%s\n' ''
    printf '%s\n' '[Service]'
    printf 'Environment="LOGUE_DATA_DIR=%s"\n' "${escaped_data}"
    printf 'Environment="LOGUE_WEB_DIST=%s"\n' "${escaped_web}"
    printf 'Environment="LOGUE_VERSION=%s"\n' "${escaped_version}"
    printf 'ExecStart="%s" "%s" --address "%s"\n' "${escaped_python}" "${escaped_server}" "${escaped_address}"
    printf '%s\n' 'Restart=on-failure'
    printf '%s\n' 'RestartSec=2'
    printf '%s\n' ''
    printf '%s\n' '[Install]'
    printf '%s\n' 'WantedBy=default.target'
  } > "${systemd_unit_next}" || return 1
  chmod 600 "${systemd_unit_next}" || return 1
  grep -Fq "ExecStart=\"${escaped_python}\" \"${escaped_server}\" --address \"${escaped_address}\"" "${systemd_unit_next}" || return 1
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

step "2/4  Stage and verify the full upgrade"
release_dir="$(mktemp -d "${install_root}/releases/${logue_version}.XXXXXX")"
rmdir -- "${release_dir}"
mv "${package_dir}" "${release_dir}"
staged_release_dir="${release_dir}"

if [[ -L "${current_link}" ]]; then
  previous_current="$(readlink "${current_link}")"
elif [[ -e "${current_link}" && ! -d "${current_link}" ]]; then
  fail "Existing current is neither a symlink nor a directory; stopped to avoid overwriting an unknown file."
fi
if [[ -f "${current_link}/python_server/logue_server.py" ]]; then
  previous_current_version="$(tr -d '\r\n' < "${current_link}/VERSION" 2>/dev/null || true)"
fi

extension_asset_id="${logue_version}-$$"
extension_releases_dir="${extension_dir}/releases"
extension_stage="${extension_releases_dir}/.${extension_asset_id}.next"
staged_extension_assets="${extension_releases_dir}/${extension_asset_id}"
extension_manifest_next="${extension_dir}/.manifest.next.$$"
mkdir -p "${extension_stage}"
cp -R "${release_dir}/extension/." "${extension_stage}/"
rm -f -- "${extension_stage}/manifest.json"
mv "${extension_stage}" "${staged_extension_assets}"
sed \
  -e "s|\"service_worker\": \"background.js\"|\"service_worker\": \"releases/${extension_asset_id}/background.js\"|" \
  -e "s|\"js\": \[\"content.js\"\]|\"js\": [\"releases/${extension_asset_id}/content.js\"]|" \
  -e "s|\"default_path\": \"sidepanel.html\"|\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"|" \
  "${release_dir}/extension/manifest.json" > "${extension_manifest_next}"
validate_manifest_identity "${extension_manifest_next}" || fail "Staged Extension identity does not match VERSION; the existing installation was not changed."
grep -Fq "\"service_worker\": \"releases/${extension_asset_id}/background.js\"" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned worker; the existing installation was not changed."
grep -Fq "\"js\": [\"releases/${extension_asset_id}/content.js\"]" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned content script; the existing installation was not changed."
grep -Fq "\"default_path\": \"releases/${extension_asset_id}/sidepanel.html\"" "${extension_manifest_next}" || fail "Extension manifest is missing a versioned Side Panel; the existing installation was not changed."
[[ -f "${staged_extension_assets}/background.js" && -f "${staged_extension_assets}/content.js" && -f "${staged_extension_assets}/sidepanel.html" && -f "${staged_extension_assets}/microphone.html" ]] || fail "Extension assets are incomplete; the existing installation was not changed."
validate_extension_html_assets "${staged_extension_assets}/sidepanel.html" || fail "Extension Side Panel references missing or non-versioned assets; the existing installation was not changed."
validate_extension_html_assets "${staged_extension_assets}/microphone.html" || fail "Extension microphone permission page references missing or non-versioned assets; the existing installation was not changed."

if [[ -d "${extension_dir}/manifest.json" && ! -L "${extension_dir}/manifest.json" ]]; then
  fail "Extension manifest path is a directory; stopped to avoid overwriting unknown content."
fi
if [[ -e "${extension_dir}/manifest.json" || -L "${extension_dir}/manifest.json" ]]; then
  cp -p "${extension_dir}/manifest.json" "${extension_manifest_backup}"
  had_extension_manifest="yes"
fi

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
  printf 'exec %q %q "$@"\n' "${python_bin}" "${current_link}/python_server/logue_server.py"
} > "${cli_next}"
chmod 755 "${cli_next}"

if [[ "${logue_platform}" == "darwin" ]]; then
  if [[ -d "${launch_plist}" && ! -L "${launch_plist}" ]]; then
    fail "LaunchAgent path is a directory; stopped to avoid overwriting unknown content."
  fi
  if [[ -e "${launch_plist}" || -L "${launch_plist}" ]]; then
    /bin/cp -pP "${launch_plist}" "${launch_plist_backup}"
    had_launch_plist="yes"
  fi
  if [[ "${autostart}" == "yes" ]]; then
    launch_plist_next="${launch_agents_dir}/.${launch_label}.next.$$"
    create_launch_plist || fail "Could not create a valid LaunchAgent; the existing installation was not changed."
  fi
else
  if [[ -d "${systemd_unit}" && ! -L "${systemd_unit}" ]]; then
    fail "systemd unit path is a directory; stopped to avoid overwriting unknown content."
  fi
  if [[ -e "${systemd_unit}" || -L "${systemd_unit}" ]]; then
    if ! grep -Fq "${current_link}/python_server/logue_server.py" "${systemd_unit}" &&
       ! grep -Fq "${current_link}/bin/logue" "${systemd_unit}"; then
      fail "The existing ${systemd_unit_name} does not belong to this Logue installation; stopped to avoid overwriting it."
    fi
    /bin/cp -pP "${systemd_unit}" "${systemd_unit_backup}"
    had_systemd_unit="yes"
    if systemctl --user is-enabled "${systemd_unit_name}" >/dev/null 2>&1; then
      systemd_was_enabled="yes"
    fi
    if systemctl --user is-active "${systemd_unit_name}" >/dev/null 2>&1; then
      service_was_active="yes"
    fi
  fi
  if [[ "${autostart}" == "yes" || "${had_systemd_unit}" == "yes" ]]; then
    systemctl --user show-environment >/dev/null 2>&1 || fail "The systemd user manager is unavailable. Re-run with LOGUE_AUTO_START=no or enable the user manager first."
  fi
  if [[ "${autostart}" == "yes" ]]; then
    systemd_unit_next="${systemd_user_dir}/.${systemd_unit_name}.next.$$"
    create_systemd_unit || fail "Could not create a valid systemd user service; the existing installation was not changed."
  fi
fi

validate_managed_service
if [[ -n "${managed_pid}" ]]; then
  service_was_active="yes"
fi
say "App, Extension, CLI, and startup settings are ready"

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

  start_service "${logue_version}" || return 1
  say "Service started: ${health_url}"

  /bin/mv -f "${extension_manifest_next}" "${extension_dir}/manifest.json" || return 1
  say "Extension switched atomically to ${logue_version}"
  inject_failure extension || return 1

  replace_path "${cli_next}" "${bin_dir}/logue" || return 1
  inject_failure cli || return 1

  if [[ "${logue_platform}" == "darwin" ]]; then
    if [[ "${autostart}" == "yes" ]]; then
      replace_path "${launch_plist_next}" "${launch_plist}" || return 1
    else
      rm -f -- "${launch_plist}" || return 1
    fi
  else
    if [[ "${autostart}" == "yes" ]]; then
      replace_path "${systemd_unit_next}" "${systemd_unit}" || return 1
      systemctl --user daemon-reload >/dev/null || return 1
      systemctl --user enable "${systemd_unit_name}" >/dev/null || return 1
    elif [[ "${had_systemd_unit}" == "yes" ]]; then
      systemctl --user disable "${systemd_unit_name}" >/dev/null || return 1
      rm -f -- "${systemd_unit}" || return 1
      systemctl --user daemon-reload >/dev/null || return 1
    fi
  fi
  inject_failure autostart || return 1
  return 0
}

rollback_install() {
  local rollback_failed="no" migration_rollback_ok="yes" rollback_link restored_version
  validate_managed_service
  stop_managed_service || rollback_failed="yes"

  if [[ "${had_extension_manifest}" == "yes" ]]; then
    /bin/mv -f "${extension_manifest_backup}" "${extension_dir}/manifest.json" || rollback_failed="yes"
  else
    rm -f -- "${extension_dir}/manifest.json" || rollback_failed="yes"
  fi
  if [[ "${had_cli}" == "yes" ]]; then
    replace_path "${cli_backup}" "${bin_dir}/logue" || rollback_failed="yes"
  else
    rm -f -- "${bin_dir}/logue" || rollback_failed="yes"
  fi
  if [[ "${logue_platform}" == "darwin" ]]; then
    if [[ "${had_launch_plist}" == "yes" ]]; then
      replace_path "${launch_plist_backup}" "${launch_plist}" || rollback_failed="yes"
    else
      rm -f -- "${launch_plist}" || rollback_failed="yes"
    fi
  else
    if [[ "${had_systemd_unit}" == "yes" ]]; then
      replace_path "${systemd_unit_backup}" "${systemd_unit}" || rollback_failed="yes"
    else
      rm -f -- "${systemd_unit}" || rollback_failed="yes"
    fi
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --user daemon-reload >/dev/null || rollback_failed="yes"
      if [[ "${systemd_was_enabled}" == "yes" ]]; then
        systemctl --user enable "${systemd_unit_name}" >/dev/null || rollback_failed="yes"
      else
        systemctl --user disable "${systemd_unit_name}" >/dev/null 2>&1 || true
      fi
    fi
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

  if [[ -d "${staged_extension_assets}" ]]; then
    rm -rf -- "${staged_extension_assets}" || rollback_failed="yes"
  fi
  staged_extension_assets=""
  if [[ -d "${staged_release_dir}" ]]; then
    rm -rf -- "${staged_release_dir}" || rollback_failed="yes"
  fi
  staged_release_dir=""

  if ! rollback_legacy_migration; then
    rollback_failed="yes"
    migration_rollback_ok="no"
  fi

  if [[ "${migration_rollback_ok}" == "yes" && "${service_was_active}" == "yes" && -f "${current_link}/python_server/logue_server.py" ]]; then
    restored_version="${previous_current_version}"
    [[ -n "${restored_version}" ]] || restored_version="$(tr -d '\r\n' < "${current_link}/VERSION" 2>/dev/null || true)"
    start_service "${restored_version}" || rollback_failed="yes"
  fi
  [[ "${rollback_failed}" == "no" ]]
}

step "3/4  Commit atomically and check the service"
if ! stop_managed_service; then
  fail "Could not stop the existing service safely; the existing installation was not switched."
fi
if [[ "${data_migration_required}" == "yes" ]] && ! prepare_legacy_migration; then
  data_root="${legacy_default_data_root}"
  if [[ "${service_was_active}" == "yes" && -n "${previous_current_version}" ]]; then
    if ! start_service "${previous_current_version}" >/dev/null 2>&1; then
      fail "The legacy workspace copy failed. The old data path and release are intact, but the previous service could not restart; run ${bin_dir}/logue after checking ${log_file}."
    fi
  fi
  fail "The legacy workspace could not be copied and verified. The old data path, release, and prior service state were restored."
fi
if ! commit_install; then
  printf '\nUpgrade commit failed; restoring the complete previous version…\n' >&2
  if rollback_install; then
    fail "Upgrade did not complete; the app, Extension, CLI, startup settings, and previous service were restored. Data was not changed."
  fi
  printf '\nLatest service log:\n' >&2
  tail -n 12 "${log_file}" >&2 || true
  fail "Upgrade did not complete and automatic recovery was incomplete. Data was not changed; keep the log above."
fi

step "4/4  Finish startup settings"
if [[ "${autostart}" == "yes" ]]; then
  say "Logue will start when you sign in (the current service was started by this install)"
else
  say "Logue will not start automatically when you sign in"
fi

rm -f -- "${extension_manifest_backup}" "${cli_backup}" "${launch_plist_backup}" "${systemd_unit_backup}"
if [[ -n "${previous_current_backup}" && -e "${previous_current_backup}" ]]; then rm -rf -- "${previous_current_backup}"; fi
staged_release_dir=""
staged_extension_assets=""
data_migration_applied="no"

printf '\n✓ Logue Host/Web %s is installed and running\n' "${logue_version}"
say "Open: ${open_url}"
say "Listen address: ${logue_address}"
case "${address_host}" in
  0.0.0.0|'*'|'[::]') say "Security: Logue has no public-internet authentication. Limit access with a firewall, VPN, or controlled reverse proxy." ;;
esac
if [[ "${logue_platform}" == "linux" ]]; then
  say "Next on your Mac (pinned to this Host release):"
  say "curl -fsSL https://github.com/ralphite/logue/releases/download/${logue_version}/install-extension.sh | LOGUE_RELEASE='${logue_version}' bash"
else
  say "Extension folder: ${extension_dir}"
fi
if [[ "${logue_platform}" == "darwin" && "${had_extension_manifest}" == "no" ]]; then
  say "Extension ${logue_version} is ready to load; Chrome is not running Logue yet"
  printf '\nFirst-time Chrome setup:\n'
  printf '%s\n' '  1. Open chrome://extensions.'
  printf '%s\n' '  2. Turn on Developer mode.'
  printf '%s\n' '  3. Click Load unpacked.'
  printf '  4. Select: %s\n' "${extension_dir}"
elif [[ "${logue_platform}" == "darwin" ]]; then
  say "Extension ${logue_version} update is ready; Chrome remains on the previous or unknown version until Reload"
  say "Open chrome://extensions and click Reload on the Logue card"
  say "Do not use Load unpacked again"
fi
say "Command: ${bin_dir}/logue"
say "Data remains at: ${data_root}"
if [[ -n "${migration_backup_root}" ]]; then
  say "Previous Linux workspace backup: ${migration_backup_root}"
fi

open_browser="${LOGUE_OPEN_BROWSER:-}"
if [[ -z "${open_browser}" ]]; then
  has_interactive_terminal && open_browser="yes" || open_browser="no"
fi
case "${open_browser}" in
  1|true|TRUE|True|yes|YES|Yes|y|Y)
    if [[ "${logue_platform}" == "darwin" ]]; then
      open "${open_url}" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "${open_url}" >/dev/null 2>&1 || true
    fi
    ;;
esac
