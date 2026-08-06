import { X } from "lucide-react";
import type { CaptureContext, VoiceProfileOverrides } from "./voiceProfileModels";

export function VoiceProfilePicker({ context, overrides, onChange, onClose }: {
  context?: CaptureContext;
  overrides: VoiceProfileOverrides;
  onChange: (value: VoiceProfileOverrides) => void;
  onClose: () => void;
}) {
  const profile = context?.resolved_voice_profile;
  const projectAvailable = Boolean(profile?.project_name && profile.project_mode !== "disabled");
  return <div className="logue-profile-picker" role="dialog" aria-label="Voice profile for the next recording">
    <div className="logue-profile-picker-heading"><div><strong>{profile?.label || "Default voice profile"}</strong><span>{profile?.primary_language || "Auto-detect"}</span></div><button type="button" onClick={onClose} aria-label="Close voice profile"><X size={14} /></button></div>
    <label className="logue-profile-switch"><input type="checkbox" checked={projectAvailable && !overrides.disable_project_profile} disabled={!projectAvailable} onChange={(event) => onChange({ ...overrides, disable_project_profile: !event.target.checked })} /><span>Use Project profile</span></label>
    <label>Language for this recording<input list="logue-profile-languages" value={overrides.primary_language ?? ""} onChange={(event) => onChange({ ...overrides, primary_language: event.target.value || undefined })} placeholder="Profile default" /><datalist id="logue-profile-languages"><option value="English" /><option value="中文" /><option value="日本語" /><option value="Español" /><option value="Français" /><option value="Deutsch" /></datalist></label>
    <label>Topic Vocabulary<select value={overrides.topic_vocabulary_id ?? ""} onChange={(event) => onChange({ ...overrides, topic_vocabulary_id: event.target.value || undefined })}><option value="">None for this recording</option>{context?.topic_vocabularies.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    <p>Applies once. Recording freezes these choices.</p>
  </div>;
}
