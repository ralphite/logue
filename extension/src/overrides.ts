/**
 * What the person chose for the next recording, before it happens.
 *
 * A real type rather than a bag of unknowns: these three values are read in
 * four places, and a typo in one of them would silently transcribe with the
 * wrong language.
 */
export interface VoiceOverrides {
  project?: string;
  primary_language?: string;
  topic_vocabulary_id?: string;
}

export const NO_OVERRIDES: VoiceOverrides = {};
