import { describe, expect, it } from "vitest";
import { adoptedVoiceText, voiceMaterialPayload } from "../provenance";

describe("voice provenance", () => {
  it("keeps the machine transcript immutable when the adopted wording is edited", () => {
    const rawTranscript = "raw machine wording";
    const adopted = adoptedVoiceText("typed preface", "polished final wording");
    const payload = voiceMaterialPayload(adopted, rawTranscript);

    expect(payload.content).toBe("typed preface\n\npolished final wording");
    expect(payload.transcript).toBe("raw machine wording");
  });
});
