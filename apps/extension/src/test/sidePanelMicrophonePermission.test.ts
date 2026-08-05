import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
const background = readFileSync(resolve(process.cwd(), "src/background.ts"), "utf8");
const permissionPage = readFileSync(resolve(process.cwd(), "microphone.html"), "utf8");
const permissionScript = readFileSync(resolve(process.cwd(), "src/microphonePermission.ts"), "utf8");

describe("side panel microphone permission", () => {
  it("opens the extension permission document in permission mode", () => {
    expect(panel).toContain('siblingExtensionDocumentPath(\n  chrome.runtime.getManifest().side_panel!.default_path,\n  "microphone.html",\n)');
    expect(panel).toContain("${microphonePermissionPath}?mode=permission&token=${encodeURIComponent(token)}");
  });

  it("keeps inline recording and its permission page in the manifest asset directory", () => {
    expect(background).toContain(
      'const microphoneDocumentPath = siblingExtensionDocumentPath(sidePanelDocumentPath, "microphone.html");',
    );
    expect(background).toContain("url: `${microphoneDocumentPath}?mode=recorder`");
    expect(background).toContain("url: chrome.runtime.getURL(`${microphoneDocumentPath}?mode=permission&token=${encodeURIComponent(token)}`)");
  });

  it("uses an explicit extension-owned gesture for the one-time microphone grant", () => {
    expect(permissionPage).toContain('<button id="allow" type="button">Allow microphone</button>');
    expect(permissionScript).toContain('allowButton?.addEventListener("click", () => {');
    expect(permissionScript).toContain('navigator.mediaDevices.getUserMedia({ audio: true })');
  });
});
