import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelMaterialSave, createExtensionSkillRun, getPageMaterials, saveSelection, transcribeAudio } from "../api";

describe("selection API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the complete original in one idempotent source request", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: { source: { id: "src_source" } } }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const sourceContent = `${"完整原文".repeat(100)}末尾校验`;

    await saveSelection({
      requestId: "stable-request-id",
      sourceContent,
      source: { url: "https://example.com/article", title: "Article", selection: sourceContent },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "save-selection",
      payload: expect.objectContaining({
        request_id: "stable-request-id",
        source_content: sourceContent,
      }),
    });
  });

  it("records the page, editor context, and exact selection for a Skill run", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      value: { id: "run_1", skill_id: "translate", skill_name: "Translate", status: "complete" },
    }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await createExtensionSkillRun({
      skillId: "translate",
      instruction: "Transform only the selected text. Return only the replacement text.",
      pageTitle: "Draft reply",
      pageUrl: "https://example.com/thread/42",
      targetText: "Before selected words after",
      selection: "selected words",
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "skill-run",
      payload: expect.objectContaining({
        skill_id: "translate",
        page_title: "Draft reply",
        page_url: "https://example.com/thread/42",
        target_text: "Before selected words after",
        selection: "selected words",
      }),
    });
  });

  it("reuses the exact request id and voice context after a disconnected retry", async () => {
    const sent: unknown[] = [];
    let attempt = 0;
    const sendMessage = vi.fn(async (message: unknown) => {
      sent.push(message);
      attempt += 1;
      if (attempt === 1) return { ok: false, error: "offline" };
      return { ok: true, value: { source: { id: "src_source" }, annotation: { id: "src_annotation" } } };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const input = {
      requestId: "stable-selection-voice",
      sourceContent: "完整原文",
      annotation: "语音批注",
      transcript: "语音批注",
      source: { url: "https://example.com/article", title: "Article", selection: "完整原文" },
      captureId: "cap_selection",
      appliedContext: {
        page_url: "https://example.com/article",
        page_title: "Article",
        reference_project: "Logue",
        glossary: ["Logue"],
      },
    };

    await expect(saveSelection(input)).rejects.toThrow("offline");
    await expect(saveSelection(input)).resolves.toEqual({
      source: { id: "src_source" },
      annotation: { id: "src_annotation" },
    });

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
  });

  it("cancels the exact in-flight source request", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: null }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await cancelMaterialSave("inline-voice-request");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "cancel-source-save",
      payload: { requestId: "inline-voice-request" },
    });
  });

  it("uses the same request id while transcribing the inline recording", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: { capture_id: "cap_1", text: "Inserted text" } }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await transcribeAudio({
      requestId: "inline-voice-request",
      audio: {
        type: "audio/webm",
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Blob,
      source: { url: "https://example.com", title: "Example" },
    });

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: "transcribe",
      payload: expect.objectContaining({ requestId: "inline-voice-request" }),
    }));
  });

  it("loads current-page sources from the source endpoint with the newest first", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      value: {
        sources: [
          { id: "older", content: "Earlier note", created_at: "2026-08-01T10:00:00Z" },
          { id: "newer", content: "Latest note", created_at: "2026-08-02T10:00:00Z" },
        ],
      },
    }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(getPageMaterials("https://example.com/current page")).resolves.toEqual([
      { id: "newer", content: "Latest note", annotation: undefined, createdAt: "2026-08-02T10:00:00Z" },
      { id: "older", content: "Earlier note", annotation: undefined, createdAt: "2026-08-01T10:00:00Z" },
    ]);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "page-sources",
      payload: { pageUrl: "https://example.com/current page" },
    });
  });
});
