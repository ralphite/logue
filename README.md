# Logue

Logue is a local-first tool for capturing and organizing information across the web. The browser extension enters text on the current page, captures selections, and adds Comments. A Python 3.13 service stores content, maintains source relationships, and processes audio with a connected remote provider. The React Web App organizes content and projects.

Logue V2 spans the real Chrome Extension, local Host/API, Web App, persisted data, and release pipeline. Storybook is supporting design evidence, not the product deliverable. The single authoritative V2 design is [`docs/design/logue-ai-product-positioning-2026-08-04.md`](./docs/design/logue-ai-product-positioning-2026-08-04.md).

## Install and upgrade

### Linux server + Mac Chrome client

1. On the Linux server, install the service. The installer asks where to listen and defaults to network access (`0.0.0.0`):

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash
```

2. The Linux installer prints a Mac command pinned to the exact Host release. Run that printed command on the Mac. It has this form:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/download/vX.Y.Z/install-extension.sh | LOGUE_RELEASE=vX.Y.Z bash
```

The Mac command prints the one-time **Developer mode** → **Load unpacked** steps. Then open the Logue Side Panel, choose **More options** → **Server settings**, enter `http(s)://<Linux host>:8787`, click **Connect**, and allow that origin.

### All-in-one macOS

To run the service and Extension on the same Mac:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash
```

The installer supports macOS and Linux, verifies the release checksum, asks whether Logue should be available on the network or only this computer, starts Logue immediately, and asks whether it should start automatically when you sign in. The single release package contains the Python service, prebuilt Web App, and prebuilt Chrome Extension. Python 3.13 is required; source code, Go, Node.js, and other build tools are not. Open `http://127.0.0.1:8787` in a browser to use Logue locally.

Run the applicable command again to upgrade in place. The service installer stops the previous service it manages, verifies and stages the complete candidate, and atomically updates `$HOME/.local/share/logue/current`. It replaces only the program, Web App, extension, CLI, and startup configuration. A failed upgrade restores the previous version and service. On first install, the Extension is only ready on disk; Chrome starts running it after **Load unpacked**. On upgrade, Chrome keeps running the previous or unknown version until you click **Reload** on the existing Logue card; do not use **Load unpacked** again.

Persistent data is never overwritten. Its default location is `$HOME/Library/Application Support/Logue` on macOS and `${XDG_DATA_HOME:-$HOME/.local/share}/logue-data` on Linux. An existing managed Linux install using the former nested default is detected before any write; the installer asks before moving the workspace and every recoverable snapshot, keeps a migration backup, and restores the old version, path, service state, and data if the upgrade fails. Ambiguous or overlapping paths are rejected instead of starting an empty workspace. The command-line entry point is `$HOME/.local/bin/logue`. Login startup uses `$HOME/Library/LaunchAgents/com.ralphite.logue.plist` on macOS or `$HOME/.config/systemd/user/logue.service` on Linux.

For unattended installations, set `LOGUE_AUTO_START=yes` or `LOGUE_AUTO_START=no` explicitly. Set `LOGUE_ADDRESS=127.0.0.1:8787` to limit Logue to the current machine, or `LOGUE_ADDRESS=0.0.0.0:8787` for network access. Without an interactive terminal, the installer disables login startup and defaults the listener to `0.0.0.0:8787`. The current service starts immediately after installation regardless of this setting.

The default `0.0.0.0` listener accepts traffic on every interface so a separate Mac can use the Linux service. Use a specific private interface address when possible, and restrict port `8787` with the host firewall, VPN, or a controlled reverse proxy. Logue has no public-internet authentication boundary.

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
4. For a remote Linux service, open the Logue Side Panel, choose **More options** → **Server settings**, enter `http(s)://<Linux host>:8787`, click **Connect**, and allow that origin.

After every upgrade, click **Reload** on the existing Logue card. Do not click **Load unpacked** again.

For the split deployment above, the Mac-only installer uses the same stable folder without installing a local service. Chrome does not allow it to install an unpacked Extension silently, so the first run prints the exact Chrome and **Server settings** steps. Keeping the same folder preserves the unpacked Extension identity and its `chrome.storage.local` server setting.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts both services:

- Web App: `http://localhost:5173`
- Python API: `http://localhost:8787`

The default development environment keeps a real, empty workspace and never creates sample content.

Only the Python service reads the Gemini API key:

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

See the [`product design index`](./docs/design/README.md) for the V2 authority and V1 historical-document boundary.

## Release

Build the platform-independent Python release locally from locked dependencies:

```bash
bash scripts/build-release.sh "v$(node -p "require('./package.json').version")"
```

The output is written to `dist/release`: `logue-python.zip` and `checksums.txt`. The zip contains the Python service, production Web App, Chrome Extension, and version metadata for both macOS and Linux. Pushing a `v*` tag triggers GitHub Actions to rebuild the package, create a GitHub Release, and upload both one-command installers.
