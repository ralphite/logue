import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidePanelView } from "../../../extension/src/sidePanelView";

const state = {
  tabId: 1,
  intent: "page" as const,
  source: { url: "https://example.com/page", title: "Example page", domain: "example.com" },
  targetAvailable: false,
  updatedAt: 1,
};

function props(overrides: Partial<ComponentProps<typeof SidePanelView>> = {}) {
  return {
    state,
    phase: "idle" as const,
    draft: "",
    generatedText: "",
    skills: [],
    skillId: "",
    pageMaterials: [{ id: "saved", content: "Saved page note", createdAt: "2026-08-03T10:00:00Z" }],
    elapsed: 0,
    insertingPending: false,
    generating: false,
    canRetry: false,
    serverURLDraft: "https://logue.example.com",
    serverCandidateURL: undefined,
    serverSettingsOpen: false,
    serverConnecting: false,
    onDraftChange: vi.fn(),
    onGeneratedTextChange: vi.fn(),
    onSkillIdChange: vi.fn(),
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onCancelRecording: vi.fn(),
    onRetryTranscription: vi.fn(),
    onSave: vi.fn(),
    onRequestGeneration: vi.fn(),
    onReturnToPage: vi.fn(),
    onGenerate: vi.fn(),
    onInsertGenerated: vi.fn(),
    onRetryInsert: vi.fn(),
    onCopyPendingInsert: vi.fn(),
    onServerURLDraftChange: vi.fn(),
    onOpenServerSettings: vi.fn(),
    onCloseServerSettings: vi.fn(),
    onConnectServer: vi.fn(),
    onConnectCandidateServer: vi.fn(),
    onRetryServer: vi.fn(),
    ...overrides,
  } satisfies ComponentProps<typeof SidePanelView>;
}

describe("native side panel server connection states", () => {
  it("keeps a disconnected panel limited to recovery actions", () => {
    render(<SidePanelView {...props({
      phase: "error",
      error: { kind: "service", message: "Can’t reach Logue.", action: "change-server" },
    })} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change server…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
    expect(screen.queryByText("Saved page note")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
  });

  it("offers the marked Logue page origin as the primary recovery action", () => {
    const onConnectCandidateServer = vi.fn();
    render(<SidePanelView {...props({
      phase: "error",
      error: { kind: "service", message: "Can’t reach Logue.", action: "change-server" },
      serverCandidateURL: "https://logue.example.com:9443",
      onConnectCandidateServer,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect to logue.example.com:9443" }));
    expect(onConnectCandidateServer).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Change server…" })).toBeTruthy();
  });

  it("uses a dismissible keyboard menu without leaking the recording shortcut", async () => {
    const onStartRecording = vi.fn();
    render(<SidePanelView {...props({ onStartRecording })} />);
    const trigger = screen.getByRole("button", { name: "More options" });

    fireEvent.click(trigger);
    const menuItem = screen.getByRole("menuitem", { name: "Server settings…" });
    await waitFor(() => expect(document.activeElement).toBe(menuItem));

    fireEvent.keyDown(menuItem, { key: "r" });
    expect(onStartRecording).not.toHaveBeenCalled();

    fireEvent.keyDown(menuItem, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: "Server settings…" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("associates connection errors with the server URL field", () => {
    render(<SidePanelView {...props({
      serverSettingsOpen: true,
      serverSettingsError: "This address is not a Logue server.",
    })} />);

    const field = screen.getByRole("textbox", { name: "Server URL" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe("logue-server-url-error");
    expect(document.getElementById("logue-server-url-error")?.textContent).toBe("This address is not a Logue server.");
  });
});
