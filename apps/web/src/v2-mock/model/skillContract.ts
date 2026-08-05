import type { SkillCategory, SkillInputScope, SkillOutputFormat, SkillProjectContext, SkillResultBehavior, SkillTrigger } from "./types";

export interface SkillPolicyDefaults {
  trigger: SkillTrigger;
  allowedInputScopes: SkillInputScope[];
  outputFormat: SkillOutputFormat;
  languageTone: string;
  projectContext: SkillProjectContext;
  resultBehavior: SkillResultBehavior;
}

export const skillPolicyDefaults: Record<SkillCategory, SkillPolicyDefaults> = {
  transcription: {
    trigger: "after-speech",
    allowedInputScopes: ["voice-write", "voice-comment"],
    outputFormat: "plain-text",
    languageTone: "Preserve the speaker’s language and terminology.",
    projectContext: "optional",
    resultBehavior: "transcript-revision",
  },
  transformation: {
    trigger: "after-speech",
    allowedInputScopes: ["voice-write", "voice-comment"],
    outputFormat: "plain-text",
    languageTone: "Clear and concise, without changing meaning.",
    projectContext: "optional",
    resultBehavior: "transcript-revision",
  },
  "page-selection": {
    trigger: "explicit-action",
    allowedInputScopes: ["selection", "editable-selection", "page"],
    outputFormat: "plain-text",
    languageTone: "Clear and faithful to the source.",
    projectContext: "optional",
    resultBehavior: "replace-or-copy",
  },
  organization: {
    trigger: "background-organization",
    allowedInputScopes: ["project-sources"],
    outputFormat: "project-suggestion",
    languageTone: "Concise reason with no silent move.",
    projectContext: "required",
    resultBehavior: "membership-suggestion",
  },
  generation: {
    trigger: "ask-draft",
    allowedInputScopes: ["project-sources"],
    outputFormat: "markdown",
    languageTone: "Concise and grounded in cited Sources.",
    projectContext: "required",
    resultBehavior: "insert-copy-or-document",
  },
};

export const skillTriggerLabels: Record<SkillTrigger, string> = {
  "after-speech": "After speech",
  "explicit-action": "When chosen",
  "background-organization": "After capture",
  "ask-draft": "Ask or draft",
};

export const skillScopeLabels: Record<SkillInputScope, string> = {
  selection: "Selection",
  "editable-selection": "Editable selection",
  page: "Whole page",
  "voice-write": "Voice Write",
  "voice-comment": "Voice Comment",
  "project-sources": "Project Sources",
};
