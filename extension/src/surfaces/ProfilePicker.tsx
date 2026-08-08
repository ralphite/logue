import { Field, Select } from "@logue/ui";
import type { Context } from "../api";
import type { VoiceOverrides } from "../overrides";

const LANGUAGES = ["English", "中文", "日本語", "Español", "Français", "Deutsch"];

/**
 * What the next recording should assume. Three rows, one control vocabulary —
 * the recording freezes whatever is chosen here, so nothing needs explaining.
 */
export function ProfilePicker({
  context,
  overrides,
  onChange,
}: {
  context?: Context;
  overrides: VoiceOverrides;
  onChange: (value: VoiceOverrides) => void;
}) {
  const project = overrides.project ?? context?.voice_profile.project_name ?? "";
  const language = overrides.primary_language ?? "";
  const vocabulary = overrides.topic_vocabulary_id ?? "";
  const languages = language && !LANGUAGES.includes(language) ? [language, ...LANGUAGES] : LANGUAGES;

  return (
    <div className="grid gap-1.5" role="group" aria-label="Voice options">
      <Field label="Project">
        <Select value={project} onChange={(event) => onChange({ ...overrides, project: event.target.value })}>
          <option value="">None</option>
          {context?.projects.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Language">
        <Select
          value={language}
          onChange={(event) => onChange({ ...overrides, primary_language: event.target.value || undefined })}
        >
          <option value="">Auto</option>
          {languages.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Vocabulary">
        <Select
          value={vocabulary}
          onChange={(event) => onChange({ ...overrides, topic_vocabulary_id: event.target.value || undefined })}
        >
          <option value="">None</option>
          {context?.vocabularies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
