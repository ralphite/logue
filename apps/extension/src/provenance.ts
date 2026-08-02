export function adoptedVoiceText(draft: string, reviewedTranscript: string) {
  return [draft.trim(), reviewedTranscript.trim()].filter(Boolean).join("\n\n");
}

export function voiceMaterialPayload(adoptedText: string, rawTranscript: string) {
  return {
    content: adoptedText,
    transcript: rawTranscript.trim(),
  };
}
