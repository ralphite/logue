export async function saveBeforeInsert(input: {
  savedMaterialId?: string;
  save: () => Promise<{ id: string }>;
  insert: () => boolean;
}) {
  const materialId = input.savedMaterialId || (await input.save()).id;
  return { materialId, inserted: input.insert() };
}

export interface VoiceTranscription {
  text: string;
  captureId: string;
}

export class VoiceInputTransactionError extends Error {
  step: "transcription" | "save";
  transcription?: VoiceTranscription;
  cause: unknown;

  constructor(step: "transcription" | "save", cause: unknown, transcription?: VoiceTranscription) {
    super(cause instanceof Error ? cause.message : step === "save" ? "Voice input could not be saved." : "Voice transcription could not be completed.");
    this.name = "VoiceInputTransactionError";
    this.step = step;
    this.transcription = transcription;
    this.cause = cause;
  }
}

/** Runs the input-box happy path without exposing an intermediate review state. */
export async function completeVoiceInput(input: {
  savedMaterialId?: string;
  transcribe: () => Promise<VoiceTranscription>;
  save: (transcription: VoiceTranscription) => Promise<{ id: string }>;
  insert: (text: string) => boolean;
}) {
  let transcription: VoiceTranscription;
  try {
    transcription = await input.transcribe();
  } catch (cause) {
    throw new VoiceInputTransactionError("transcription", cause);
  }
  transcription = { ...transcription, text: transcription.text.trim() };
  if (!transcription.text) {
    throw new VoiceInputTransactionError("transcription", new Error("No clear speech was detected."), transcription);
  }

  try {
    const result = await saveBeforeInsert({
      savedMaterialId: input.savedMaterialId,
      save: () => input.save(transcription),
      insert: () => input.insert(transcription.text),
    });
    return { ...result, transcription };
  } catch (cause) {
    throw new VoiceInputTransactionError("save", cause, transcription);
  }
}

/** Transcribes and persists a voice annotation without an intermediate review/confirm step. */
export async function completeSelectionVoiceInput(input: {
  transcribe: () => Promise<VoiceTranscription>;
  save: (transcription: VoiceTranscription) => Promise<unknown>;
}) {
  let transcription: VoiceTranscription;
  try {
    transcription = await input.transcribe();
  } catch (cause) {
    throw new VoiceInputTransactionError("transcription", cause);
  }
  transcription = { ...transcription, text: transcription.text.trim() };
  if (!transcription.text) {
    throw new VoiceInputTransactionError("transcription", new Error("No clear speech was detected."), transcription);
  }

  try {
    await input.save(transcription);
    return { transcription };
  } catch (cause) {
    throw new VoiceInputTransactionError("save", cause, transcription);
  }
}
