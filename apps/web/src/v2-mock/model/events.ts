import type { Id, SkillCategory, SkillInputScope, SkillOutputFormat, SkillProjectContext, SkillResultBehavior } from "./types";

export type MockEvent =
  | { type: "set-tab-project"; tabId: Id; projectId: Id | null }
  | { type: "select-article"; tabId: Id; pageId: Id }
  | { type: "start-voice-comment"; tabId: Id; pageId?: Id }
  | { type: "accept-voice-comment"; transcript: string }
  | { type: "start-voice-write"; tabId: Id; targetSessionId: Id; pageId?: Id }
  | { type: "cancel-recording" }
  | { type: "stop-voice-write"; transcript: string; transcriptionProfileId?: string }
  | { type: "retranscribe-voice-write"; sourceId: Id; transcript: string; transcriptionProfileId: string }
  | { type: "edit-voice-write"; sourceId: Id; content: string }
  | { type: "insert-voice-write"; sourceId: Id; targetSessionId: Id }
  | { type: "set-source-membership"; sourceId: Id; projectId: Id; state: "added" | "excluded" | "removed" | "saved-only" }
  | { type: "save-text-comment"; tabId: Id; text: string; pageId?: Id; projectId?: Id | null }
  | { type: "open-email-target"; targetSessionId: Id }
  | { type: "submit-command"; transcript: string; inputMode: "voice" | "text"; projectId: Id; targetSessionId: Id; contextSourceIds: Id[]; idempotencyKey: string }
  | { type: "restore-run"; runId: Id }
  | { type: "retry-run"; runId: Id }
  | { type: "delete-run"; runId: Id }
  | { type: "run-skill"; category: SkillCategory; inputScope: SkillInputScope; input: string; explicitSkillId?: Id; projectId?: Id | null; contextSourceIds?: Id[] }
  | { type: "adopt-skill-candidate"; candidateId: Id; adoption: "replace" | "copy"; selectionTargetId?: Id }
  | { type: "dismiss-skill-candidate"; candidateId: Id }
  | { type: "undo-skill-adoption"; candidateId: Id; selectionTargetId: Id }
  | { type: "create-my-skill"; name: string; description: string; category: SkillCategory; instruction: string; allowedInputScopes: SkillInputScope[]; outputFormat: SkillOutputFormat; languageTone: string; projectContext: SkillProjectContext; resultBehavior: SkillResultBehavior }
  | { type: "revise-my-skill"; skillId: Id; name: string; description: string; instruction: string; allowedInputScopes: SkillInputScope[]; outputFormat: SkillOutputFormat; languageTone: string; projectContext: SkillProjectContext; resultBehavior: SkillResultBehavior }
  | { type: "duplicate-skill"; skillId: Id; name?: string }
  | { type: "set-skill-archived"; skillId: Id; archived: boolean }
  | { type: "set-built-in-hidden"; skillId: Id; hidden: boolean }
  | { type: "set-skill-pinned"; skillId: Id; pinned: boolean }
  | { type: "set-global-skill-binding"; category: SkillCategory; skillId: Id }
  | { type: "set-project-skill-binding"; projectId: Id; category: SkillCategory; skillId: Id }
  | { type: "reset-project-skill-binding"; projectId: Id; category: SkillCategory }
  | { type: "edit-candidate"; candidateId: Id; content: string }
  | { type: "insert-candidate"; candidateId: Id; targetSessionId: Id }
  | { type: "copy-candidate"; candidateId: Id }
  | { type: "undo-target"; targetSessionId: Id }
  | { type: "open-citation"; sourceId: Id; revisionId?: Id }
  | { type: "close-citation" };
