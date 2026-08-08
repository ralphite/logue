import type { CaptureContext, VoiceProfileOverrides } from "./voiceProfileModels";

const LANGUAGES = ["English", "中文", "日本語", "Español", "Français", "Deutsch"];

const row = "grid grid-cols-[76px_minmax(0,1fr)] items-center gap-1.5";
const label = "text-xs text-muted";
const select =
  "h-7 w-full min-w-0 appearance-none rounded-md border border-line bg-surface px-1.5 text-xs text-ink outline-0 hover:border-line-strong focus:border-accent-line";

/**
 * Three quiet rows that pin the next recording's profile. Every control is the
 * same native select so the whole picker reads as one thing; the recording
 * freezes whatever is chosen here, so nothing needs explaining.
 */
export function VoiceProfilePicker({ context, overrides, onChange, onClose, embedded = false }: {
  context?: CaptureContext;
  overrides: VoiceProfileOverrides;
  onChange: (value: VoiceProfileOverrides) => void;
  onClose: () => void;
  embedded?: boolean;
}) {
  const profile = context?.resolved_voice_profile;
  const selectedProject = overrides.use_default_profile
    ? ""
    : overrides.profile_project ?? profile?.project_name ?? "";
  const selectedProjectProfile = context?.projects.find((project) => project.name === selectedProject)?.transcription_profile;
  const language = overrides.primary_language ?? "";
  const languages = language && !LANGUAGES.includes(language) ? [language, ...LANGUAGES] : LANGUAGES;
  return <div
    className="grid gap-1.5 text-xs text-ink"
    role={embedded ? "group" : "dialog"}
    aria-label="Voice profile for the next recording"
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }}
  >
    <label className={row}><span className={label}>Profile</span><select className={select} value={selectedProject} onChange={(event) => onChange(event.target.value
      ? { ...overrides, use_default_profile: false, profile_project: event.target.value, disable_project_profile: false }
      : { ...overrides, use_default_profile: true, profile_project: undefined, disable_project_profile: false }
    )}><option value="">Default</option>{context?.projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}</select></label>
    <label className={row}><span className={label}>Language</span><select className={select} value={language} onChange={(event) => onChange({ ...overrides, primary_language: event.target.value || undefined })}><option value="">Auto</option>{languages.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    <label className={row}><span className={label}>Vocabulary</span><select className={select} value={overrides.topic_vocabulary_id ?? ""} onChange={(event) => onChange({ ...overrides, topic_vocabulary_id: event.target.value || undefined })}><option value="">None</option>{context?.topic_vocabularies.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    {selectedProject ? <label className="flex items-center gap-1.5 text-muted [&_input]:m-0 [&_input]:accent-accent">
      <input type="checkbox" checked={!overrides.disable_project_profile && selectedProjectProfile?.mode !== "disabled"} disabled={selectedProjectProfile?.mode === "disabled"} onChange={(event) => onChange({ ...overrides, disable_project_profile: !event.target.checked })} />
      <span>Use Project profile</span>
    </label> : null}
  </div>;
}
