# Logue

Logue is a local-first tool for capturing and organizing information across the web. The browser extension enters text on the current page, captures selections, and appends annotations. A local Go service stores content, maintains source relationships, and processes audio with Gemini. The React Web App organizes content and projects.

## Install and upgrade (macOS and Linux)

Run one command in Terminal:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash
```

The installer detects macOS or Linux and the current amd64 or arm64 architecture, verifies the release checksum, starts Logue immediately, and asks whether it should start automatically when you sign in. It downloads the complete Go service, Web App, and Chrome Extension; source code, Go, Node.js, and other build tools are not required. Open `http://127.0.0.1:8787` in a browser to use Logue.

Run the same command again to upgrade in place. The installer stops the previous service it manages, verifies and stages the complete candidate, and atomically updates `$HOME/.local/share/logue/current`. It replaces only the program, Web App, extension, CLI, and startup configuration. A failed upgrade restores the previous version and service.

Persistent data is never overwritten. Its default location is `$HOME/Library/Application Support/Logue` on macOS and `${XDG_DATA_HOME:-$HOME/.local/share}/logue/data` on Linux. The command-line entry point is `$HOME/.local/bin/logue`. Login startup uses `$HOME/Library/LaunchAgents/com.ralphite.logue.plist` on macOS or `$HOME/.config/systemd/user/logue.service` on Linux.

For unattended installations, set `LOGUE_AUTO_START=yes` or `LOGUE_AUTO_START=no` explicitly. Without an interactive terminal, the installer disables login startup by default. The current service starts immediately after installation regardless of this setting.

The secure default listens only on loopback. To make a Linux service reachable on a trusted LAN or VPN, pass an explicit listen address to the installer:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh \
  | LOGUE_ADDRESS=0.0.0.0:8787 LOGUE_AUTO_START=yes bash
```

`0.0.0.0` accepts traffic on every interface. Use a specific private interface address when possible, and restrict port `8787` with the host firewall or a controlled reverse proxy. Logue has no public-internet authentication boundary. The default remains `127.0.0.1:8787` unless `LOGUE_ADDRESS` is set explicitly.

The Gemini API key is read only by the local service and is never compiled into the Web App or extension. Set it in the same Terminal before installation:

```bash
export GEMINI_API_KEY="your API key"
```

The installer does not write the key to the program, LaunchAgent, systemd unit, logs, or repository; the service started during installation inherits the current Terminal environment. Without a key, browsing and editing content still work, but transcription, automatic organization, and generation are unavailable. On macOS, you can make login startup read the key by adding `export GEMINI_API_KEY=...` to `~/.zprofile` yourself. On Linux, configure the key through a user-controlled systemd environment or service drop-in. The installer never stores the secret for you.

### Install the Chrome extension

The full installer places the Extension in a stable folder:

1. Open `chrome://extensions` and enable **Developer mode** in the upper-right corner.
2. Click **Load unpacked**.
3. Select `$HOME/.local/share/logue/extension`.

After an upgrade, if Chrome has not picked up the new files automatically, click **Reload** on the Logue card on the same page. You do not need to select the directory again.

If Logue runs only on a Linux server and this Mac is only the Chrome client, install the platform-independent Extension asset without installing the local service:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install-extension.sh | bash
```

Chrome does not allow this script to silently install an unpacked Extension. On the first install, the script prints the exact `chrome://extensions` → **Developer mode** → **Load unpacked** steps and the stable folder to select. Run the same command to upgrade, then click **Reload** on the existing Logue card; do not use **Load unpacked** again. Keeping the same folder preserves the unpacked Extension identity and its `chrome.storage.local` server setting.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts both services:

- Web App: `http://localhost:5173`
- Go API: `http://localhost:8787`

The default development environment keeps a real, empty workspace and never creates sample content.

Only the Go service reads the Gemini API key:

```bash
export GEMINI_API_KEY="..."
```

Other commands:

```bash
npm run storybook
npm run build
npm test
npm run build:extension
```

The extension build output is written to `apps/extension/dist`. Development data is stored in `.logue-data` at the repository root by default; set `LOGUE_DATA_DIR` to use another location.

See [`docs`](./docs) for design documentation.

## Release

Build release packages for both supported operating systems and architectures locally from locked dependencies:

```bash
bash scripts/build-release.sh v0.2.3
```

The output is written to `dist/release`: macOS and Linux packages for amd64 and arm64, the platform-independent `logue-extension.tar.gz`, and `checksums.txt`. Each service package contains the Go service, production Web App, Chrome Extension, and version metadata. Pushing a `v*` tag triggers GitHub Actions to rebuild the packages, create a GitHub Release, and upload both one-command installers.
