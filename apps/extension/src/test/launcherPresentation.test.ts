import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("page launcher presentation", () => {
  it("starts voice input in place and replaces the launcher with accessible capture controls", () => {
    const content = readFileSync(resolve(process.cwd(), "src/content.tsx"), "utf8");
    const surface = readFileSync(resolve(process.cwd(), "src/v2-real/V2InlineVoiceSurface.tsx"), "utf8");

    expect(content).toContain("<V2InlineVoiceSurface");
    expect(surface).toContain('aria-label="Start voice input"');
    expect(surface).toContain('aria-label="Cancel voice input"');
    expect(surface).toContain('aria-label="Stop voice input"');
    expect(surface).toContain('aria-keyshortcuts="Escape"');
    expect(surface).toContain('aria-keyshortcuts="Enter"');
    expect(content).toContain("startInlineVoice");
    expect(content).toContain("cancelMaterialSave(session.id)");
    expect(content).toContain("requestId: session.id");
    expect(content).toContain("projects: []");
    expect(content).toContain("recordingShortcutAction");
    expect(content).toContain("docsTarget && document.activeElement === docsTarget");
    expect(content).not.toContain("logue:google-docs-focus-start");
    expect(content).not.toContain('openSidePanel("input", true)');
    expect(content).not.toContain("logue-launcher-generation");
    expect(content).not.toContain("logue-inline-live");
    expect(content).not.toContain("targetRect.width >");
    expect(content).not.toContain("targetRect.height >");
  });

  it("uses the parent Docs hostname when its text event iframe is about:blank", () => {
    const content = readFileSync(resolve(process.cwd(), "src/content.tsx"), "utf8");

    expect(content).toContain("const topPage = topLevelWindow()");
    expect(content).toContain('topPage.location.hostname === "docs.google.com"');
  });
});
