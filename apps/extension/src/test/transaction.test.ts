import { describe, expect, it, vi } from "vitest";
import { completeSelectionVoiceInput, completeVoiceInput, saveBeforeInsert } from "../transaction";

describe("input transaction", () => {
  it("persists before touching the host page", async () => {
    const order: string[] = [];
    const result = await saveBeforeInsert({
      save: async () => { order.push("save"); return { id: "mat_1" }; },
      insert: () => { order.push("insert"); return true; },
    });
    expect(order).toEqual(["save", "insert"]);
    expect(result).toEqual({ materialId: "mat_1", inserted: true });
  });

  it("never inserts when persistence fails", async () => {
    const insert = vi.fn(() => true);
    await expect(saveBeforeInsert({
      save: async () => { throw new Error("offline"); },
      insert,
    })).rejects.toThrow("offline");
    expect(insert).not.toHaveBeenCalled();
  });

  it("reuses an already-saved material when the target is focused again", async () => {
    const save = vi.fn(async () => ({ id: "duplicate" }));
    const result = await saveBeforeInsert({
      savedMaterialId: "mat_existing",
      save,
      insert: () => true,
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.materialId).toBe("mat_existing");
  });
});

describe("automatic voice input transaction", () => {
  it("transcribes, saves, and inserts in one ordered operation", async () => {
    const order: string[] = [];
    const result = await completeVoiceInput({
      transcribe: async () => {
        order.push("transcribe");
        return { text: "  自动插入的文字  ", captureId: "cap_1" };
      },
      save: async (transcription) => {
        order.push(`save:${transcription.text}`);
        return { id: "mat_1" };
      },
      insert: (text) => {
        order.push(`insert:${text}`);
        return true;
      },
    });

    expect(order).toEqual(["transcribe", "save:自动插入的文字", "insert:自动插入的文字"]);
    expect(result).toEqual({
      materialId: "mat_1",
      inserted: true,
      transcription: { text: "自动插入的文字", captureId: "cap_1" },
    });
  });

  it("never inserts when the automatic save fails", async () => {
    const insert = vi.fn(() => true);
    await expect(completeVoiceInput({
      transcribe: async () => ({ text: "保留的转写", captureId: "cap_1" }),
      save: async () => { throw new Error("offline"); },
      insert,
    })).rejects.toMatchObject({
      step: "save",
      transcription: { text: "保留的转写", captureId: "cap_1" },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps a no-speech recording quiet and actionable", async () => {
    await expect(completeVoiceInput({
      transcribe: async () => { throw new Error("Gemini returned no transcription"); },
      save: async () => ({ id: "mat_1" }),
      insert: () => true,
    })).rejects.toMatchObject({
      step: "transcription",
      message: "Couldn't transcribe. Recording saved.",
    });
  });

  it("returns the saved material when the original target disappeared", async () => {
    const result = await completeVoiceInput({
      transcribe: async () => ({ text: "已保存文字", captureId: "cap_1" }),
      save: async () => ({ id: "mat_1" }),
      insert: () => false,
    });

    expect(result.materialId).toBe("mat_1");
    expect(result.inserted).toBe(false);
  });
});

describe("automatic selection voice annotation", () => {
  it("transcribes and saves in one ordered operation without a review confirmation", async () => {
    const order: string[] = [];
    const result = await completeSelectionVoiceInput({
      transcribe: async () => {
        order.push("transcribe");
        return { text: "  这是语音批注  ", captureId: "cap_selection" };
      },
      save: async (transcription) => {
        order.push(`save:${transcription.text}`);
      },
    });

    expect(order).toEqual(["transcribe", "save:这是语音批注"]);
    expect(result.transcription).toEqual({ text: "这是语音批注", captureId: "cap_selection" });
  });

  it("keeps the transcription recoverable when the automatic save is offline", async () => {
    await expect(completeSelectionVoiceInput({
      transcribe: async () => ({ text: "断线后仍可恢复", captureId: "cap_selection" }),
      save: async () => { throw new Error("offline"); },
    })).rejects.toMatchObject({
      step: "save",
      transcription: { text: "断线后仍可恢复", captureId: "cap_selection" },
    });
  });
});
