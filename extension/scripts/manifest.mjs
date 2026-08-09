/**
 * Writes dist/manifest.json.
 *
 * Generated rather than checked in so the version can never drift from
 * package.json, and so the built file names stay in one place.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/**
 * Which build this is, distinct from the marketing version.
 *
 * The deploy sets it, and the Host reads it back out of the installed folder to
 * tell a running worker that it has fallen behind. A local build says so, so a
 * developer's browser is never told to reload for a folder nobody deployed.
 */
const build = process.env.LOGUE_BUILD || `${version}-local`;

const manifest = {
  manifest_version: 3,
  name: "Logue",
  description: "Capture voice and selections anywhere, and keep every source.",
  version,
  version_name: build,
  /*
   * `audioCapture` is what makes the microphone work at all here. The recorder
   * lives in an offscreen document, which has no window to show a permission
   * prompt in — so without the declared permission getUserMedia simply fails,
   * and the only symptom is our own "Microphone access is blocked" message
   * with nowhere to go and grant it. The product is a microphone; declaring it
   * is the honest thing to do.
   */
  permissions: ["activeTab", "alarms", "audioCapture", "contextMenus", "offscreen", "scripting", "sidePanel", "storage", "tabs"],
  /*
   * Every http(s) page, declared rather than asked for later.
   *
   * The content scripts below already match every http(s) page — that is what
   * the product is — so the optional form was not protecting anything. What it
   * did do was break the one thing that needs it: `chrome.scripting` refuses
   * without host permission, so after a background update the extension could
   * not put its surfaces back on tabs that were already open. Those tabs kept
   * running the replaced build, which is how a bug that had been fixed stayed
   * on screen.
   */
  host_permissions: ["http://127.0.0.1:8787/*", "http://*/*", "https://*/*"],
  action: { default_title: "Open Logue" },
  side_panel: { default_path: "sidepanel.html" },
  background: { service_worker: "background.js", type: "module" },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["content.js"],
      run_at: "document_start",
      all_frames: false,
    },
  ],
  commands: {
    "start-voice": {
      suggested_key: { default: "Ctrl+Shift+Space", mac: "Command+Shift+Space" },
      description: "Start voice input in the current field",
    },
    /*
     * Not Command+Shift+M, which is what this asked for and never got: Chrome
     * keeps that one for its own profile menu on macOS, and it refuses an
     * extension's claim silently — the command exists, `getAll()` reports it
     * bound to nothing, and the key simply does nothing forever. A declared
     * shortcut is not a working one; this is checked in a real browser.
     */
    "start-command": {
      suggested_key: { default: "Ctrl+Shift+U", mac: "Command+Shift+U" },
      description: "Ask Logue about this page",
    },
    "toggle-side-panel": {
      suggested_key: { default: "Ctrl+Shift+L", mac: "Command+Shift+L" },
      description: "Open Logue",
    },
  },
};

writeFileSync(resolve(root, "dist/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`manifest.json written for v${version} (build ${build})\n`);
