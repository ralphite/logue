import { X } from "lucide-react";
import type { CaptureContext, VoiceProfileOverrides } from "./voiceProfileModels";

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
  const projectAvailable = Boolean(selectedProject);
  const profileDetail = [
    profile?.primary_language || "Auto-detect",
    profile?.phrases.length ? `${profile.phrases.length} known phrase${profile.phrases.length === 1 ? "" : "s"}` : "No known phrases",
    profile?.avoid_terms.length ? `${profile.avoid_terms.length} avoided term${profile.avoid_terms.length === 1 ? "" : "s"}` : "No avoided terms",
    profile?.formatting_preference ? "Custom formatting" : "Default formatting",
  ].join(" · ");
  return <div className={`logue-profile-picker${embedded ? " is-embedded" : ""}`} role={embedded ? "group" : "dialog"} aria-label="Voice profile for the next recording">
    <div className="logue-profile-picker-heading"><div><strong>{profile?.label || "Default voice profile"}</strong><span>{profileDetail}</span></div>{!embedded && <button type="button" onClick={onClose} aria-label="Close voice profile"><X size={14} /></button>}</div>
    <label>Profile<select value={selectedProject} onChange={(event) => onChange(event.target.value
      ? { ...overrides, use_default_profile: false, profile_project: event.target.value, disable_project_profile: false }
      : { ...overrides, use_default_profile: true, profile_project: undefined, disable_project_profile: false }
    )}><option value="">Default</option>{context?.projects.map((project) => <option key={project.name} value={project.name}>{project.name} · {project.transcription_profile.mode[0].toUpperCase() + project.transcription_profile.mode.slice(1)}</option>)}</select></label>
    {projectAvailable && <label className="logue-profile-switch"><input type="checkbox" checked={!overrides.disable_project_profile && selectedProjectProfile?.mode !== "disabled"} disabled={selectedProjectProfile?.mode === "disabled"} onChange={(event) => onChange({ ...overrides, disable_project_profile: !event.target.checked })} /><span>Use Project profile</span></label>}
    <label>Language for this recording<input list="logue-profile-languages" value={overrides.primary_language ?? ""} onChange={(event) => onChange({ ...overrides, primary_language: event.target.value || undefined })} placeholder="Profile default" /><datalist id="logue-profile-languages"><option value="English" /><option value="中文" /><option value="日本語" /><option value="Español" /><option value="Français" /><option value="Deutsch" /></datalist></label>
    <label>Topic Vocabulary<select value={overrides.topic_vocabulary_id ?? ""} onChange={(event) => onChange({ ...overrides, topic_vocabulary_id: event.target.value || undefined })}><option value="">None for this recording</option>{context?.topic_vocabularies.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    {!embedded && <p>Applies once. Recording freezes these choices.</p>}
  </div>;
}
