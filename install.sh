#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Logue installer currently supports macOS only.\n' >&2
  exit 69
fi

case "$(uname -m)" in
  arm64) logue_arch="arm64" ;;
  x86_64) logue_arch="amd64" ;;
  *) printf 'Unsupported Mac architecture: %s\n' "$(uname -m)" >&2; exit 69 ;;
esac

logue_home="${HOME:?HOME is required}"
install_root="${LOGUE_INSTALL_ROOT:-${logue_home}/.local/share/logue}"
data_root="${LOGUE_DATA_DIR:-${logue_home}/Library/Application Support/Logue}"
bin_dir="${LOGUE_BIN_DIR:-${logue_home}/.local/bin}"
launch_agents_dir="${LOGUE_LAUNCH_AGENTS_DIR:-${logue_home}/Library/LaunchAgents}"
launch_label="${LOGUE_LAUNCH_LABEL:-com.ralphite.logue}"
launch_plist="${launch_agents_dir}/${launch_label}.plist"
logue_port="${LOGUE_PORT:-8787}"
logue_address="${LOGUE_ADDRESS:-0.0.0.0:${logue_port}}"
health_url="${LOGUE_HEALTH_URL:-http://127.0.0.1:${logue_port}/v1/status}"
asset_base_url="${LOGUE_ASSET_BASE_URL:-https://github.com/ralphite/logue/releases/latest/download}"
asset_name="logue-darwin-${logue_arch}.tar.gz"
current_link="${install_root}/current"
extension_dir="${install_root}/extension"
run_dir="${install_root}/run"
pid_file="${run_dir}/logue.pid"
log_file="${run_dir}/logue.log"
install_tmp=""

say() { printf '  %s\n' "$*"; }
step() { printf '\n%s\n' "$*"; }
fail() { printf '\n安装没有完成：%s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ -n "${install_tmp}" && -d "${install_tmp}" ]]; then
    rm -rf -- "${install_tmp}"
  fi
}
trap cleanup EXIT

for required_command in curl tar shasum; do
  command -v "${required_command}" >/dev/null 2>&1 || fail "缺少系统命令 ${required_command}。"
done

printf '\nLogue 安装与升级\n'
say "程序：${install_root}"
say "数据：${data_root}（永不覆盖）"

mkdir -p "${install_root}/releases" "${data_root}" "${bin_dir}" "${launch_agents_dir}" "${run_dir}"
install_tmp="$(mktemp -d "${install_root}/.install.XXXXXX")"

step "1/4  下载并校验发布包"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/${asset_name}" -o "${install_tmp}/${asset_name}"
curl -fsSL --retry 3 --retry-delay 1 "${asset_base_url}/checksums.txt" -o "${install_tmp}/checksums.txt"
checksum_line="$(awk -v wanted="${asset_name}" '$2 == wanted || $2 == "./" wanted { print; exit }' "${install_tmp}/checksums.txt")"
[[ -n "${checksum_line}" ]] || fail "checksums.txt 中没有 ${asset_name}。"
printf '%s\n' "${checksum_line}" > "${install_tmp}/selected-checksum.txt"
(cd "${install_tmp}" && shasum -a 256 -c selected-checksum.txt >/dev/null) || fail "发布包校验失败，现有安装未改动。"
say "校验通过"

package_dir="${install_tmp}/package"
mkdir -p "${package_dir}"
tar -xzf "${install_tmp}/${asset_name}" -C "${package_dir}"
[[ -x "${package_dir}/bin/logue" ]] || fail "发布包缺少可执行的 bin/logue。"
[[ -f "${package_dir}/web/index.html" ]] || fail "发布包缺少 Web App。"
[[ -f "${package_dir}/extension/manifest.json" ]] || fail "发布包缺少 Chrome Extension。"
[[ -f "${package_dir}/VERSION" ]] || fail "发布包缺少 VERSION。"
logue_version="$(tr -d '\r\n' < "${package_dir}/VERSION")"
[[ "${logue_version}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || fail "无效版本：${logue_version}。"
say "准备安装 ${logue_version}"

stop_managed_service() {
  launchctl bootout "gui/$(id -u)" "${launch_plist}" >/dev/null 2>&1 || launchctl unload "${launch_plist}" >/dev/null 2>&1 || true
  if [[ -f "${pid_file}" ]]; then
    local old_pid old_command wait_count
    old_pid="$(tr -dc '0-9' < "${pid_file}")"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" >/dev/null 2>&1; then
      old_command="$(ps -p "${old_pid}" -o command= 2>/dev/null || true)"
      if [[ "${old_command}" == *"${install_root}"*"/logue"* ]]; then
        say "正在停止旧服务（PID ${old_pid}）"
        kill "${old_pid}" >/dev/null 2>&1 || true
        for ((wait_count = 0; wait_count < 30; wait_count++)); do
          kill -0 "${old_pid}" >/dev/null 2>&1 || break
          sleep 0.1
        done
        if kill -0 "${old_pid}" >/dev/null 2>&1; then
          kill -KILL "${old_pid}" >/dev/null 2>&1 || true
          for ((wait_count = 0; wait_count < 20; wait_count++)); do
            kill -0 "${old_pid}" >/dev/null 2>&1 || break
            sleep 0.1
          done
        fi
      else
        fail "PID 文件指向的进程不是本次安装的 Logue；为避免误停其他程序，已中止。"
      fi
    fi
    rm -f -- "${pid_file}"
  fi
}

start_service() {
  local expected_version="$1" service_pid status_body wait_count
  : >> "${log_file}"
  nohup env \
    LOGUE_DATA_DIR="${data_root}" \
    LOGUE_WEB_DIST="${current_link}/web" \
    "${current_link}/bin/logue" -address "${logue_address}" \
    >> "${log_file}" 2>&1 </dev/null &
  service_pid=$!
  printf '%s\n' "${service_pid}" > "${pid_file}"
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

step "2/4  安全替换程序"
previous_current=""
if [[ -L "${current_link}" ]]; then
  previous_current="$(readlink "${current_link}")"
fi
stop_managed_service

release_dir="${install_root}/releases/${logue_version}"
release_backup=""
if [[ -e "${release_dir}" || -L "${release_dir}" ]]; then
  release_backup="${install_root}/releases/.${logue_version}.previous.$$"
  mv "${release_dir}" "${release_backup}"
fi
mv "${package_dir}" "${release_dir}"

legacy_current_backup=""
if [[ -e "${current_link}" && ! -L "${current_link}" ]]; then
  legacy_current_backup="${install_root}/.current.previous.$$"
  mv "${current_link}" "${legacy_current_backup}"
fi
next_link="${install_root}/.current.next.$$"
ln -s "${release_dir}" "${next_link}"
/bin/mv -f -h "${next_link}" "${current_link}"
say "程序已切换到 ${logue_version}"

step "3/4  启动并检查服务"
if ! start_service "${logue_version}"; then
  stop_managed_service
  failed_release="${install_root}/releases/.${logue_version}.failed.$$"
  if [[ -n "${release_backup}" && -d "${release_backup}" ]]; then
    mv "${release_dir}" "${failed_release}"
    mv "${release_backup}" "${release_dir}"
  elif [[ -n "${previous_current}" ]]; then
    rollback_link="${install_root}/.current.rollback.$$"
    ln -s "${previous_current}" "${rollback_link}"
    /bin/mv -f -h "${rollback_link}" "${current_link}"
  fi
  if [[ -n "${previous_current}" ]]; then
    start_service "$("${current_link}/bin/logue" -version 2>/dev/null || true)" || true
  fi
  printf '\n最近的服务日志：\n' >&2
  tail -n 12 "${log_file}" >&2 || true
  fail "新服务没有通过健康检查；已尽力恢复原版本，数据未改动。"
fi
say "服务已启动：${health_url}"

extension_next="${install_root}/.extension.next.$$"
extension_backup=""
cp -R "${release_dir}/extension" "${extension_next}"
if [[ -e "${extension_dir}" || -L "${extension_dir}" ]]; then
  extension_backup="${install_root}/.extension.previous.$$"
  mv "${extension_dir}" "${extension_backup}"
fi
mv "${extension_next}" "${extension_dir}"

cli_backup=""
if [[ -e "${bin_dir}/logue" && ! -L "${bin_dir}/logue" ]]; then
  cli_backup="${bin_dir}/.logue.previous.$$"
  mv "${bin_dir}/logue" "${cli_backup}"
fi
ln -sfn "${current_link}/bin/logue" "${bin_dir}/logue"

if [[ -n "${release_backup}" && -d "${release_backup}" ]]; then rm -rf -- "${release_backup}"; fi
if [[ -n "${legacy_current_backup}" && -e "${legacy_current_backup}" ]]; then rm -rf -- "${legacy_current_backup}"; fi
if [[ -n "${extension_backup}" && -e "${extension_backup}" ]]; then rm -rf -- "${extension_backup}"; fi
if [[ -n "${cli_backup}" && -e "${cli_backup}" ]]; then rm -f -- "${cli_backup}"; fi

choose_autostart() {
  local configured="${LOGUE_AUTO_START:-}" answer
  case "${configured}" in
    1|true|TRUE|True|yes|YES|Yes|y|Y) printf 'yes' ; return ;;
    0|false|FALSE|False|no|NO|No|n|N) printf 'no' ; return ;;
    "") ;;
    *) fail "LOGUE_AUTO_START 只接受 yes 或 no。" ;;
  esac
  if [[ -r /dev/tty && -w /dev/tty ]]; then
    printf '\n登录这台 Mac 时自动启动 Logue？[Y/n] ' > /dev/tty
    answer=""
    IFS= read -r answer < /dev/tty || true
    case "${answer}" in n|N|no|NO|No) printf 'no' ;; *) printf 'yes' ;; esac
  else
    say "当前没有交互终端；默认不启用登录时自动启动。可用 LOGUE_AUTO_START=yes 重新运行。" >&2
    printf 'no'
  fi
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

step "4/4  设置启动方式"
autostart="$(choose_autostart)"
if [[ "${autostart}" == "yes" ]]; then
  plist_tmp="${launch_plist}.tmp.$$"
  escaped_label="$(xml_escape "${launch_label}")"
  escaped_binary="$(xml_escape "${current_link}/bin/logue")"
  escaped_address="$(xml_escape "${logue_address}")"
  escaped_data="$(xml_escape "${data_root}")"
  escaped_web="$(xml_escape "${current_link}/web")"
  escaped_log="$(xml_escape "${log_file}")"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0"><dict>'
    printf '  <key>Label</key><string>%s</string>\n' "${escaped_label}"
    printf '%s\n' '  <key>ProgramArguments</key><array>'
    printf '%s\n' "    <string>/bin/zsh</string><string>-lc</string><string>exec \"\$1\" -address \"\$2\"</string><string>logue-autostart</string>"
    printf '    <string>%s</string><string>%s</string>\n' "${escaped_binary}" "${escaped_address}"
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>EnvironmentVariables</key><dict>'
    printf '    <key>LOGUE_DATA_DIR</key><string>%s</string>\n' "${escaped_data}"
    printf '    <key>LOGUE_WEB_DIST</key><string>%s</string>\n' "${escaped_web}"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    printf '  <key>StandardOutPath</key><string>%s</string>\n' "${escaped_log}"
    printf '  <key>StandardErrorPath</key><string>%s</string>\n' "${escaped_log}"
    printf '%s\n' '</dict></plist>'
  } > "${plist_tmp}"
  chmod 600 "${plist_tmp}"
  mv "${plist_tmp}" "${launch_plist}"
  say "已启用登录时自动启动（当前服务已由本次安装启动）"
else
  rm -f -- "${launch_plist}"
  say "未启用登录时自动启动"
fi

printf '\n✓ Logue %s 已安装并正在运行\n' "${logue_version}"
say "打开：http://127.0.0.1:${logue_port}"
say "Extension：${extension_dir}（在 chrome://extensions 中加载）"
say "命令：${bin_dir}/logue"
say "数据仍在：${data_root}"

open_browser="${LOGUE_OPEN_BROWSER:-}"
if [[ -z "${open_browser}" ]]; then
  [[ -r /dev/tty && -w /dev/tty ]] && open_browser="yes" || open_browser="no"
fi
case "${open_browser}" in
  1|true|TRUE|True|yes|YES|Yes|y|Y) open "http://127.0.0.1:${logue_port}" >/dev/null 2>&1 || true ;;
esac
