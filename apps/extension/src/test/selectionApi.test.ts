import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelMaterialSave, saveSelection, transcribeAudio } from "../api";

describe("selection API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the complete original, multiple projects, and tags in one idempotent request", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: { source: { id: "mat_source" } } }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const sourceContent = `${"完整原文".repeat(100)}末尾校验`;

    await saveSelection({
      requestId: "stable-request-id",
      sourceContent,
      source: { url: "https://example.com/article", title: "Article", selection: sourceContent },
      projects: ["Agent Harness", "Logue"],
      tags: ["research", "provenance"],
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "save-selection",
      payload: expect.objectContaining({
        request_id: "stable-request-id",
        source_content: sourceContent,
        projects: ["Agent Harness", "Logue"],
        tags: ["research", "provenance"],
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
      return { ok: true, value: { source: { id: "mat_source" }, annotation: { id: "mat_annotation" } } };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const input = {
      requestId: "stable-selection-voice",
      sourceContent: "完整原文",
      annotation: "语音批注",
      transcript: "语音批注",
      source: { url: "https://example.com/article", title: "Article", selection: "完整原文" },
      projects: ["Logue"],
      tags: ["voice"],
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
      source: { id: "mat_source" },
      annotation: { id: "mat_annotation" },
    });

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
  });

  it("cancels the exact in-flight material request", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, value: null }));
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await cancelMaterialSave("inline-voice-request");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "cancel-material-save",
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
});
