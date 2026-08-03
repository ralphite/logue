# Logue

Logue is a local-first tool for capturing and organizing information across the web. The browser extension enters text on the current page, captures selections, and appends annotations. A local Go service stores content, maintains source relationships, and processes audio with Gemini. The React Web App organizes content and projects.

## Install and upgrade (macOS)

Run one command in Terminal:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash
```

The installer detects Apple Silicon or Intel Macs, verifies the download, starts Logue immediately after installation, and asks whether it should start automatically at login. Open `http://127.0.0.1:8787` in a browser to use Logue.

Run the same command again to upgrade in place. The installer stops the previous service it manages and atomically updates `$HOME/.local/share/logue/current` to the new release. It replaces only the program, Web App, and extension; it never overwrites content stored in `$HOME/Library/Application Support/Logue`. The command-line entry point is `$HOME/.local/bin/logue`, and login startup is managed by `$HOME/Library/LaunchAgents/com.ralphite.logue.plist`.

For unattended installations, set `LOGUE_AUTO_START=yes` or `LOGUE_AUTO_START=no` explicitly. Without an interactive terminal, the installer disables login startup by default. The current service starts immediately after installation regardless of this setting.

The Gemini API key is read only by the local service and is never compiled into the Web App or extension. Set it in the same Terminal before installation:

```bash
export GEMINI_API_KEY="your API key"
```

The installer does not write the key to the program, LaunchAgent, logs, or repository; the service started during installation inherits the current Terminal environment. Without a key, browsing and editing content still work, but transcription, automatic organization, and generation are unavailable. To make the service started at login read the key, add `export GEMINI_API_KEY=...` to `~/.zprofile` yourself. The installer never stores the secret for you.

### Install the Chrome extension

1. Open `chrome://extensions` and enable **Developer mode** in the upper-right corner.
2. Click **Load unpacked**.
3. Select `$HOME/.local/share/logue/extension`.

After an upgrade, if Chrome has not picked up the new files automatically, click **Reload** on the Logue card on the same page. You do not need to select the directory again.

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

Build release packages for both macOS architectures locally from locked dependencies:

```bash
bash scripts/build-release.sh v0.2.3
```

The output is written to `dist/release`: `logue-darwin-arm64.tar.gz`, `logue-darwin-amd64.tar.gz`, and `checksums.txt`. Pushing a `v*` tag triggers GitHub Actions to rebuild the packages, create a GitHub Release, and upload the one-command installer.
