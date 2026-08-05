import type { Id } from "./types";

export type MockEvent =
  | { type: "set-tab-project"; tabId: Id; projectId: Id | null }
  | { type: "select-article"; tabId: Id; pageId: Id }
  | { type: "start-voice-comment"; tabId: Id; pageId?: Id }
  | { type: "stop-voice-comment"; transcript: string }
  | { type: "edit-voice-comment"; sourceId: Id; content: string }
  | { type: "start-voice-write"; tabId: Id; targetSessionId: Id; pageId?: Id }
  | { type: "cancel-recording" }
  | { type: "stop-voice-write"; transcript: string; transcriptionProfileId?: string }
  | { type: "retranscribe-voice-write"; sourceId: Id; transcript: string; transcriptionProfileId: string }
  | { type: "edit-voice-write"; sourceId: Id; content: string }
  | { type: "insert-voice-write"; sourceId: Id; targetSessionId: Id }
  | { type: "set-source-membership"; sourceId: Id; projectId: Id; state: "added" | "excluded" | "saved-only" }
  | { type: "save-comment-bundle"; commentSourceId: Id; tabId: Id; pageId?: Id; projectId?: Id | null }
  | { type: "save-text-comment"; tabId: Id; text: string; pageId?: Id; projectId?: Id | null }
  | { type: "open-email-target"; targetSessionId: Id }
  | { type: "parse-command"; transcript: string; projectId: Id; targetSessionId: Id }
  | { type: "execute-command"; activityId: Id; contextSourceIds: Id[] }
  | { type: "generate-sourced-draft"; runId: Id; content: string; citations: Array<{ sourceId: Id; label: string; excerpt: string }> }
  | { type: "edit-candidate"; candidateId: Id; content: string }
  | { type: "insert-candidate"; candidateId: Id; targetSessionId: Id }
  | { type: "undo-target"; targetSessionId: Id }
  | { type: "open-citation"; sourceId: Id }
  | { type: "close-citation" };
