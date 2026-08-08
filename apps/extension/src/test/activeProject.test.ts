import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  captureOrganization,
  explicitProjects,
  mergePanelCaptureState,
  preserveTabProjects,
  tabProjectRequestSender,
} from "../capturePrimitives";
import type { PanelCaptureState } from "../sidePanelModels";

const source = { url: "https://example.com/article", title: "Article", domain: "example.com" };

function panelState(overrides: Partial<PanelCaptureState> = {}): PanelCaptureState {
  return {
    tabId: 42,
    intent: "page",
    source,
    targetAvailable: false,
    updatedAt: 1,
    ...overrides,
  };
}

describe("tab active Project", () => {
  it("merges one explicit Project and can return to Saved only", () => {
    const selected = mergePanelCaptureState(panelState(), { projects: [" Mobile research ", "Ignored"] });
    expect(selected.projects).toEqual(["Mobile research"]);
    expect(mergePanelCaptureState(selected, { projects: [] }).projects).toEqual([]);
  });

  it("keeps Project authorization through same-tab navigation but never another tab", () => {
    const current = panelState({ projects: ["Mobile research"] });
    const navigated = panelState({ source: { ...source, url: "https://example.com/next" }, updatedAt: 2 });
    expect(preserveTabProjects(navigated, current).projects).toEqual(["Mobile research"]);
    expect(preserveTabProjects({ ...navigated, tabId: 43 }, current).projects).toBeUndefined();
  });

  it("derives content requests only from sender.tab.id and ignores a spoofed tabId", () => {
    expect(tabProjectRequestSender({ type: "logue:get-tab-projects", tabId: 999 }, 42)).toBe(42);
    expect(tabProjectRequestSender({ type: "logue:get-tab-projects" })).toBeUndefined();
    expect(tabProjectRequestSender({ type: "logue:get-panel-state", tabId: 42 }, 42)).toBeUndefined();
  });

  it("uses the explicit Project in both page and selection save payloads", () => {
    const organization = captureOrganization(panelState({ projects: ["Mobile research"], tags: [" evidence "] }));
    expect(organization).toEqual({ projects: ["Mobile research"], tags: ["evidence"] });
    expect(explicitProjects(panelState())).toEqual([]);

    // Page save and selection save must both organize from the same resolution.
    const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");
    expect(panel.match(/const organization = captureOrganization\(current\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(panel).toContain("...organization,");
    expect(panel).toContain("tags: organization.tags");
  });

  it("wires the content contract to restored sender-tab state", () => {
    const background = readFileSync(resolve(process.cwd(), "src/background.ts"), "utf8");
    expect(background).toContain("tabProjectRequestSender(message, sender.tab?.id)");
    expect(background).toContain("resolveTabProjects(sender.tab!)");
    expect(background).toContain("sendResponse({ ok: true, value: projects })");
    // resolveTabProjects is the only path that answers the content contract.
    expect(background).toContain("return explicitProjects(current)");
  });
});
