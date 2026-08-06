# Logue 技术架构

## 运行结构

```text
apps/web         React 19 + TypeScript + Tailwind CSS Web App
apps/extension   Chrome MV3 Content Script + Background Service Worker
packages/ui      Web App / Extension 共用的基础交互组件与品牌组件
server           Go 本机 API、文件存储、Gemini 代理与静态 Web 服务
```

开发端口：Web `0.0.0.0:5173`，API `0.0.0.0:8787`，Storybook `127.0.0.1:6006`。生产安装默认监听 `127.0.0.1:8787`；只有显式设置 `LOGUE_ADDRESS` 才监听 Linux 私网接口。生产 Web 与 API 由同一个 Go 服务同源提供。Extension 的全部请求由 Background 统一发送到当前配置并验证过的 Server origin；Gemini 调用只发生在 Go 后端。

## 安装与服务管理

Release 同时包含 macOS/Linux 的 amd64 与 arm64 完整资产，每个资产均包含静态 Go 二进制、生产 Web App、Chrome Extension 和版本文件，并由统一的 `checksums.txt` 校验。一行安装器不依赖源码、Go 或 Node.js。

另有带 checksum 的平台无关 `logue-extension.tar.gz` 与 `install-extension.sh`。Linux 只运行服务、MacBook 只作为 Chrome 客户端时，Mac 可独立安装 Extension 而不安装 Go 服务。Extension 根目录保持稳定，仅原子切换指向版本化 worker、content script 与 Side Panel 的 manifest；旧版本资产保留到 Chrome Reload，Chrome profile 中的 `chrome.storage.local` 不被安装器触碰。

- 程序版本位于 `~/.local/share/logue/releases`，`current` 通过原子 symlink 切换；CLI 固定为 `~/.local/bin/logue`。
- macOS 数据默认位于 `~/Library/Application Support/Logue`，登录启动使用 LaunchAgent。
- Linux 数据默认位于 `${XDG_DATA_HOME:-$HOME/.local/share}/logue/data`，登录启动使用 `systemd --user` 的 `logue.service`。
- 安装与覆盖升级先校验并完整 staging，停止受管服务后再切换；候选服务健康检查失败或后续提交失败时恢复旧程序、Extension、CLI、启动配置和旧服务。数据目录从不参与程序覆盖。

## 持久化

默认数据根目录为 `.logue-data`，可用 `LOGUE_DATA_DIR` 覆盖：

```text
.logue-data/
  items/*.json       # 资料、request_id、来源、项目和父子关系
  audio/cap_*        # 原始录音
  docs/*.json        # 可编辑文档与 source_ids
  projects/*.json    # 项目概览与术语
  settings.json      # 全局写作偏好、术语和忽略项
```

写入使用临时文件 + rename。`request_id` 在资料层提供幂等创建；选区请求派生稳定的 `:source` / `:annotation` ID；Agent 写回同样支持稳定 `request_id`。

## API v1

### 状态与资料

- `GET /v1/status`
- `GET|POST /v1/items`
- `PATCH|DELETE /v1/items/{id}`
- `POST /v1/selections`
- `GET|DELETE /v1/captures/{id}`

### 语音与 Context

- `POST /v1/transcribe`：multipart 音频、页面、目标文字、选区、项目说明、术语和技能指令。
- `GET /v1/context?url=...`：个人说明/术语、项目说明/术语及按域名建议的项目。

### 项目、Run 与生成结果

- `GET|POST /v1/projects`
- `PATCH /v1/projects/{name}`
- `GET|POST /v1/skill-runs`
- `POST /v1/skill-runs/{id}/adopt`
- `POST /v1/skill-runs/{id}/document`
- `GET|POST /v1/docs`
- `GET|PATCH|DELETE /v1/docs/{id}`

### 设置与可移植性

- `GET|PATCH /v1/settings`
- `GET /v1/glossary-suggestions`
- `GET /v1/export`
- `POST /v1/restore`：校验 schema 和 ID，在同目录创建完整备份后原子切换。

## Gemini

- 默认模型：`gemini-3.6-flash`。
- 环境变量：`GEMINI_API_KEY`、`LOGUE_TRANSCRIPTION_MODEL`、`LOGUE_DICTATION_SKILL`、`LOGUE_TRANSCRIPTION_CONTEXT_LIMIT`。
- 音频使用 inline data 直接发送 `generateContent`；V1 限制 20MB。
- 转写 Prompt 把页面、目标文字、选区和项目背景放入带边界的不可信引用区；技能指令与上下文分离；只允许输出转写文本。
- 文档生成接收用户选中的资料与项目概览，并要求使用 `[Source n]` 行内引用；Skill 短回复可自动检索相关资料。

## 安全边界

- API 安全默认只监听 loopback；私网监听必须由用户显式配置，并配合主机防火墙、VPN 或受控反向代理，不能作为公网认证边界。CORS 只允许受支持的 Web 与 `chrome-extension://` 来源。
- Key 不出现在 API 响应、前端构建、Extension storage 或数据文件。
- Extension Background 负责网络请求；Content Script 不直接持有凭证。
- 不读取浏览器 Cookie、登录状态或未显式选择的整页正文。
- 不自动提交宿主表单；外部 Agent 通过 API 追加，避免直接并发写文件。

文档更新携带 `expected_revision`。服务端只接受与当前 revision 一致的写入，否则返回 `409`；Web 端串行提交自动保存，并在切换文档或离开页面前强制落盘，避免较慢的旧请求覆盖较新的正文与引用。

## 可恢复性

- Extension 提交顺序固定为：保存资料 → 写入宿主输入框。
- 本机服务断开时面板自动轮询恢复；失败保留可重试状态。
- Go 服务重启后从文件重新加载所有对象。
- 导出/恢复包含资料、音频、项目、文档与设置；恢复失败时回滚原目录。
