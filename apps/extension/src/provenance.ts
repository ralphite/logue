export function adoptedVoiceText(draft: string, reviewedTranscript: string) {
  return [draft.trim(), reviewedTranscript.trim()].filter(Boolean).join("\n\n");
}

export function voiceMaterialPayload(adoptedText: string, rawTranscript: string) {
  return {
    content: adoptedText,
    rawTranscript: rawTranscript.trim(),
    transcript: adoptedText.trim(),
  };
}
