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
  permissions: ["activeTab", "alarms", "offscreen", "scripting", "sidePanel", "storage", "tabs"],
  host_permissions: ["http://127.0.0.1:8787/*"],
  optional_host_permissions: ["http://*/*", "https://*/*"],
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
    "start-command": {
      suggested_key: { default: "Ctrl+Shift+M", mac: "Command+Shift+M" },
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
