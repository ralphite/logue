# Logue

Capture voice and selections anywhere in the browser, keep them as traceable
Materials organized by Projects, and generate answers and documents whose every
claim cites a frozen Source.

Local-first. One zero-dependency Python 3.13 Host owns all of the data on your
machine. There is no account and no server of ours: the only thing that leaves
the computer is what you send to your own model provider.

```
Chrome Extension ──┐
                   ├──► Host (127.0.0.1:8787, stdlib http.server, JSON store)
Web App ───────────┘         └── your model (Gemini, or an OpenAI-compatible API)
```

## Requirements

| | |
|---|---|
| Host | macOS or Linux, with `python3.13` on `PATH` |
| Also needed | `curl`, and `shasum` or `sha256sum` |
| Browser | Google Chrome, on the same computer as the Host |

Python 3.13 is the whole runtime. No Node, no Go, no virtualenv, no compiler —
the release is one zip of Python source and prebuilt assets.

## Install

One line installs the Host and Web App, starts the server, and stages the Chrome
Extension:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | bash && curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install-extension.sh | bash
```

The first script asks where to listen — network (`0.0.0.0:8787`) or this
computer only (`127.0.0.1:8787`) — verifies the release checksum, and leaves
Logue **running**. When it finishes, open:

```
http://127.0.0.1:8787
```

To skip the question (scripts, CI, `ssh`), set the address up front:

```bash
curl -fsSL https://github.com/ralphite/logue/releases/latest/download/install.sh | LOGUE_ADDRESS=127.0.0.1:8787 bash
```

Run the same line again to upgrade. Nothing under your data directory is ever
touched by an install.

### Finish the Chrome setup — once

Chrome cannot be handed an unpacked extension by a script, so the last four
clicks are yours:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select `~/.local/share/logue/extension`.

Then open `http://127.0.0.1:8787` → **Settings**, pick a provider (Gemini or an
OpenAI-compatible API), paste your API key, and save. Without a key you can
still browse and edit everything; transcription, filing and generation are the
parts that need it.

After an upgrade, click **Reload** on the existing Logue card. Never **Load
unpacked** a second time — that would create a second extension identity and
lose the first one's storage.

## Using it

Everything below is available the moment the Side Panel is open on a page.

| | |
|---|---|
| **Voice into any page** | Put the caret in any editable field. The mic appears beside it — record, review the candidate, press ⌘↵ to insert. Works inside Google Docs too. |
| **Save a selection** | Select text anywhere → **Save**. The exact quote, page URL, title and time are kept as a Material. |
| **Comment on a selection** | Speak or type a comment on a saved selection. It becomes its own Material pointing back at the quote, which stays untouched. |
| **Capture the page** | One click in the Side Panel stores the readable page and files it under a Project. |
| **Ask with sources** | Ask a question about a Project. The answer cites `[Source n]`; clicking a citation opens that Source. |
| **Draft a document** | Run Draft over a Project. The document opens in the Web App, autosaves as you edit, and exports as Markdown. |

The Web App at `http://127.0.0.1:8787` is where the Stream, Projects, Documents,
Skills and Settings live. Every generation records the frozen set of Sources and
the exact prompt revision it used, so an answer can always be traced back.

## Where things live

| | macOS | Linux |
|---|---|---|
| App | `~/.local/share/logue` | same |
| Extension folder Chrome loads | `~/.local/share/logue/extension` | same |
| Your data | `~/Library/Application Support/Logue` | `${XDG_DATA_HOME:-~/.local/share}/logue-data` |
| Command | `~/.local/bin/logue` | same |
| Service log | `~/.local/share/logue/run/logue.log` | same |

Data is deliberately kept outside the app directory: rolling the program back
can never reach your workspace.

### Running it again

The installer starts the Host, but does not add a login item. After a reboot:

```bash
~/.local/bin/logue --address 127.0.0.1:8787
```

That runs in the foreground and prints the URL it is serving. `logue --version`
reports the installed release. Add `~/.local/bin` to your `PATH` to drop the
prefix.

### Environment variables

| Variable | Effect |
|---|---|
| `LOGUE_ADDRESS` | Listen address, e.g. `127.0.0.1:8787`. Skips the interactive question. |
| `LOGUE_PORT` | Port for the interactive choice (default `8787`). |
| `LOGUE_RELEASE` | Install an exact release, e.g. `v1.0.0`, instead of the latest. |
| `LOGUE_DATA_DIR` | Where the workspace lives. |
| `LOGUE_INSTALL_ROOT`, `LOGUE_BIN_DIR`, `LOGUE_EXTENSION_DIR` | Where the app, the CLI and the Chrome folder go. |

### A note on access

Logue has no password. Anything that can reach the port can read and rewrite the
whole workspace, so the Host refuses browser origins it does not know and demands
a header on every write. That protects you from web pages — not from the
network. Choose `0.0.0.0` only when you want to open the Web App from another
device on a network you trust, and put a firewall or VPN in front of port `8787`.
The Extension itself always talks to `127.0.0.1:8787`, so it needs Chrome and the
Host on the same computer.

### Uninstall

```bash
rm -rf ~/.local/share/logue ~/.local/bin/logue
```

Then remove the extension in `chrome://extensions`. Your data directory survives;
delete it separately if you mean to.

## Local development

```bash
npm install
npm run dev
```

- Web App: `http://localhost:5173`
- Host: `http://127.0.0.1:8787`, workspace in `.logue-data` at the repo root

A Host run straight from a checkout serves the API only — `npm run dev:web` is
the app in development. To put a real build on this machine instead, with the
Host under a login item and exactly one extension copy:

```bash
./scripts/deploy.sh
```

The four gates, all of which CI runs on every push:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` covers the UI package, Web App, Extension, Host and integrations.
The installers have their own end-to-end tests, which build a real release, serve
it over `file://` and check the atomic switch, the rollback and the Chrome
folder:

```bash
bash scripts/test-install.sh
bash scripts/test-install-extension.sh
```

## Release

Pushing a `v*` tag builds the package and publishes a GitHub Release with
`logue.zip`, `checksums.txt` and both installers — which is what the command at
the top of this file downloads. To build the same assets locally:

```bash
bash scripts/build-release.sh "v$(node -p "require('./package.json').version")"
```

The output lands in `dist/release`. The build refuses to run if the tag, the
workspace versions and the Extension manifest disagree.

## More

- [`docs/spec/features.md`](docs/spec/features.md) — what the product does, feature by feature
- [`docs/spec/cujs.md`](docs/spec/cujs.md) — the ten journeys a release has to pass in a real browser
- [`server/README.md`](server/README.md) — the Host: layout, and why it has no framework
- [`integrations/README.md`](integrations/README.md) — handing a document link to an outside agent
