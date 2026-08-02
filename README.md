# Logue

Logue 是一个本机优先的跨网页输入与资料沉淀工具。浏览器 Extension 负责在当前网页输入、采集选区和追加批注；本机 Go 服务负责保存资料、维护来源关系并通过 Gemini 处理音频；React Web App 用来整理资料与项目。

## 安装与升级（macOS）

在 Terminal 运行一行命令：

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash
```

安装器会自动识别 Apple Silicon 或 Intel Mac，校验下载内容，安装完成后立即启动 Logue，并询问是否随登录自动启动。浏览器打开 `http://127.0.0.1:8787` 即可使用。

再次运行同一条命令就是覆盖升级：安装器会停止自己管理的旧服务，再原子切换 `$HOME/.local/share/logue/current` 指向的新版本，只替换程序、Web App 和 Extension，不会覆盖位于 `$HOME/Library/Application Support/Logue` 的资料。命令行入口位于 `$HOME/.local/bin/logue`；登录时启动由 `$HOME/Library/LaunchAgents/com.ralphite.logue.plist` 管理。

无人值守环境可用 `LOGUE_AUTO_START=yes` 或 `LOGUE_AUTO_START=no` 明确选择；安装器在没有交互终端时默认不启用登录自动启动。安装完成后无论是否选择自动启动，当前服务都会立即运行。

Gemini API Key 只由本机服务读取，不会编译进 Web App 或 Extension。安装前可在同一 Terminal 设置：

```bash
export GEMINI_API_KEY="你的 API Key"
```

也兼容 `GOOGLE_GENERATIVE_AI_API_KEY`。安装器不会把 Key 写入程序、LaunchAgent、日志或仓库；本次启动的服务直接继承当前 Terminal 环境。未设置 Key 时，资料浏览和编辑仍可使用，但转写、自动整理和生成不可用。若希望登录后自动启动的服务也读取 Key，可由用户自行把 `export GEMINI_API_KEY=...` 放入 `~/.zprofile`；安装器不会替你保存密钥。

### 安装 Chrome Extension

1. 打开 `chrome://extensions`，启用右上角的“开发者模式”。
2. 点击“加载已解压的扩展程序”。
3. 选择 `$HOME/.local/share/logue/extension`。

升级后若 Chrome 尚未自动读取新文件，在同一页面点击 Logue 卡片上的“重新加载”；不需要重新选择目录。

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动：

- Web App：`http://localhost:5173`
- Go API：`http://localhost:8787`

默认启动会保留真实的空工作区，不会自动写入示例内容。只有在明确需要演示数据时才运行 `npm run dev:demo`；不要对正在使用的真实数据目录运行该命令。

Gemini 密钥只由 Go 服务读取。支持：

```bash
export GEMINI_API_KEY="..."
# 或 GOOGLE_GENERATIVE_AI_API_KEY
```

其他命令：

```bash
npm run storybook
npm run build
npm test
npm run build:extension
```

扩展构建产物位于 `apps/extension/dist`。数据默认保存在仓库下的 `.logue-data`，可用 `LOGUE_DATA_DIR` 修改。

设计文档见 [`docs`](./docs)。

## 发布

本地可从锁定依赖构建两个 macOS 架构的发布包：

```bash
bash scripts/build-release.sh v0.2.3
```

产物位于 `dist/release`：`logue-darwin-arm64.tar.gz`、`logue-darwin-amd64.tar.gz` 和 `checksums.txt`。推送 `v*` tag 后，GitHub Actions 会重新构建并创建 Release，同时上传一行安装脚本。
