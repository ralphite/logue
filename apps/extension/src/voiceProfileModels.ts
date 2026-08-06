export interface ExtensionProjectSkillBindings {
  transcription?: string;
  organization?: string;
  command?: string;
  ask?: string;
  draft?: string;
}

export interface VoiceProfileVocabulary {
  people: string[];
  companies: string[];
  products: string[];
  places: string[];
  acronyms: string[];
  preferred_spellings: Array<{ spoken: string; preferred: string }>;
}

export interface VoiceProfile {
  primary_language: string;
  mixed_languages: string[];
  custom_instructions: string;
  phrases: string[];
  avoid_terms: string[];
  formatting_preference: string;
  vocabulary: VoiceProfileVocabulary;
}

export interface ProjectVoiceProfile extends VoiceProfile {
  mode: "inherited" | "customized" | "disabled";
}

export interface ResolvedVoiceProfile {
  label: string;
  project_mode: "default" | "inherited" | "customized" | "disabled";
  project_name: string;
  primary_language: string;
  mixed_languages: string[];
  custom_instructions: string;
  phrases: string[];
  avoid_terms: string[];
  formatting_preference: string;
  vocabulary: string[];
  skill_id: string;
  skill_name: string;
  skill_revision: number;
  skill_instructions: string;
  personal_context: string;
  project_overview: string;
  topic_vocabulary_id: string;
  topic_vocabulary_name: string;
}

export interface TopicVocabulary {
  id: string;
  name: string;
  vocabulary: VoiceProfileVocabulary;
}

export interface VoiceProfileOverrides {
  disable_project_profile?: boolean;
  use_default_profile?: boolean;
  profile_project?: string;
  primary_language?: string;
  topic_vocabulary_id?: string;
}

export interface ProjectAssociation {
  id: string;
  scope: "page" | "site";
  key: string;
  project_id: string;
  project_name: string;
  created_at: string;
}

export interface CaptureContext {
  personal_context: string;
  voice_profile: VoiceProfile;
  resolved_voice_profile: ResolvedVoiceProfile;
  topic_vocabularies: TopicVocabulary[];
  recent_adopted: string[];
  recent_adopted_refs?: Array<{ id: string; text: string }>;
  suggested_project: string;
  project_associations: ProjectAssociation[];
  projects: Array<{ name: string; overview?: string; transcription_profile: ProjectVoiceProfile; skill_bindings?: ExtensionProjectSkillBindings }>;
}
