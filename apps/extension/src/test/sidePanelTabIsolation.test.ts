import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const background = readFileSync(resolve(process.cwd(), "src/background.ts"), "utf8");
const panel = readFileSync(resolve(process.cwd(), "src/sidePanel.tsx"), "utf8");

describe("tab-scoped native Side Panel wiring", () => {
  it("disables the global panel and preconfigures each tab-specific path", () => {
    expect(background).toContain("disableDefaultSidePanel(nativeSidePanel)");
    expect(background).toContain("disableTabSidePanel(nativeSidePanel, tabId)");
    expect(background).toContain("prepareTabSidePanel(nativeSidePanel, tabId, sidePanelDocumentPath)");
    expect(background).toContain("Promise.all([chrome.storage.session.get(null), chrome.tabs.query({})])");
    expect(background).toContain("chrome.tabs.onCreated.addListener");
    expect(background).toContain("chrome.tabs.onUpdated.addListener");
    expect(background).toContain('message?.type === "logue:page-context-ready"');
    expect(background).toContain("prepareSidePanel(tab.id).catch(() => undefined)");
    expect(background).toContain("if (typeof tab.id === \"number\") syncSidePanelOption(tab.id)");

    const toggle = background.slice(
      background.indexOf("async function toggleTabPanel"),
      background.indexOf("async function setPanelContext"),
    );
    expect(toggle).toContain("toggleTrackedSidePanel(tabId)");
    expect(toggle).not.toContain("prepareSidePanel(tabId)");
    expect(toggle).toContain("const priorOpen = chrome.storage.session.get(openPanelStorageKey(tabId))");
    expect(toggle.indexOf("openPanelWithPreparedState")).toBeLessThan(toggle.indexOf("const wasOpen = (await priorOpen)"));
    expect(toggle).toContain("await nativeSidePanel.close({ tabId })");

    const commandHandler = background.slice(
      background.indexOf("chrome.commands.onCommand.addListener"),
      background.indexOf("nativeSidePanel.onOpened"),
    );
    expect(commandHandler).toContain("if (tab)");
    expect(commandHandler).toContain("toggleTabPanel(tab)");
    expect(commandHandler).not.toContain("chrome.tabs.query");
  });

  it("keeps draft/state messages and broadcasts bound to the URL tab id", () => {
    expect(background).not.toContain("activePanelStorageKey");
    expect(background).not.toContain("activePanelTabId");
    expect(background).toContain("restorePanelState(message.tabId)");
    expect(background).toContain('type: "logue:panel-state-changed",\n    tabId: state.tabId');

    expect(panel).toContain("const panelTabId = sidePanelTabId(window.location.search)");
    expect(panel).toContain('type: "logue:get-panel-state", tabId: panelTabId');
    expect(panel).toContain('type: "logue:update-panel-state", tabId: panelTabId');
    expect(panel).toContain("panelMessageTargetsTab(panelTabId, panelMessage)");
    expect(panel).toContain("panelMessage.tabId === panelTabId");
  });

  it("hides only the old tab capture without dropping a completed transcription", () => {
    expect(background).toContain("activeTabByWindow.get(windowId)");
    expect(background).toContain('type: "logue:side-panel-hidden", tabId');
    expect(background).toContain("disposeTabCapture(previousTabId)");
    expect(background).not.toContain("closeTrackedPanel(previousTabId)");
    expect(panel).toContain('panelMessage.type === "logue:side-panel-hidden" && panelMessage.tabId === panelTabId');
    expect(panel).toContain("cancelRecording()");
    expect(panel).not.toContain("captureEpochRef");
    expect(panel).not.toContain("current.tabId !== panelTabId");
  });

  it("rehydrates per-tab open tracking after a cold MV3 worker restart", () => {
    expect(background).toContain("chrome.storage.session.get(null)");
    expect(background).toContain("key.startsWith(openPanelStoragePrefix)");
    expect(background).toContain("openPanelTabs.add(tabId)");
    expect(background).toContain("chrome.storage.session.get(activeTabStorageKey(windowId))");
    expect(background).toContain("disposeTabCapture(restoredTabId)");
  });

  it("reads a cold tab draft before staging and keeps the update channel alive until persisted", () => {
    const stage = background.slice(
      background.indexOf("function stagePanelState"),
      background.indexOf("async function restorePanelState"),
    );
    expect(stage.indexOf("chrome.storage.session.get(storageKey)")).toBeLessThan(stage.indexOf("panelStates.set"));
    expect(stage).toContain("const restoredFromSession = preserveTabProjects(");
    expect(stage).toContain("preserveMatchingPanelDraft(current, sessionState)");
    expect(stage).toContain("await persistPanelState(restored)");

    const update = background.slice(
      background.indexOf('message?.type === "logue:update-panel-state"'),
      background.indexOf('message?.type === "logue:consume-panel-autostart"'),
    );
    expect(update).toContain("persistPanelState(mergePanelCaptureState(current, message.patch))");
    expect(update).toContain("sendResponse({ ok: true })");
    expect(update).toContain("return true");
  });
});
