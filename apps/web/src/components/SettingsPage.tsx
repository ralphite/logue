import { Archive, Clipboard, KeyRound, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  backupWorkspace,
  deleteWorkspace,
  getAIConnection,
  getGlossarySuggestions,
  getWorkspaceSettings,
  getTopicVocabularies,
  saveWorkspaceSettings,
  saveAIConnection,
  testAIConnection,
  saveTopicVocabulary,
  deleteTopicVocabulary,
  createVoiceProfile,
  type ServiceStatus,
  type VoiceProfileVocabulary,
  type TopicVocabulary,
  type WorkspaceSettings,
  type GlossarySuggestion,
  type AIConnection,
  type AIConnectionInput,
} from "../api";
import { logueApiBase } from "../apiBase";
import { getSkills, type LogueSkill } from "../skillApi";
import { editorColumnClass } from "./layout";
import { PageHeader } from "./ui";

type SaveState = "saved" | "dirty" | "saving" | "error";
type VocabularyCategory = Exclude<keyof VoiceProfileVocabulary, "preferred_spellings">;

const vocabularyCategories: Array<{ key: VocabularyCategory; label: string }> = [
  { key: "people", label: "People" },
  { key: "companies", label: "Companies" },
  { key: "products", label: "Products" },
  { key: "places", label: "Places" },
  { key: "acronyms", label: "Acronyms" },
];

const fieldFocusClass = "focus:border-[#777dd9] focus:ring-2 focus:ring-[#777dd9]/20";

function SettingsRow({ label, children, border = true }: { label: string; children: ReactNode; border?: boolean }) {
  return (
    <section className={`${border ? "border-t border-[#e8e8e5]" : ""} py-7`}>
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-10 max-[700px]:grid-cols-1 max-[700px]:gap-3">
        <h3 className="pt-1 text-[14px] font-semibold text-[#484945]">{label}</h3>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function SettingsPage({ status }: { status?: ServiceStatus }) {
  const [settings, setSettings] = useState<WorkspaceSettings>({ personal_context: "", ignored_terms: [], voice_profile: createVoiceProfile() });
  const [term, setTerm] = useState("");
  const [termCategory, setTermCategory] = useState<VocabularyCategory>("products");
  const [spokenTerm, setSpokenTerm] = useState("");
  const [preferredTerm, setPreferredTerm] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string>();
  const [backingUp, setBackingUp] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [suggestions, setSuggestions] = useState<GlossarySuggestion[]>([]);
  const [skills, setSkills] = useState<LogueSkill[]>([]);
  const [topicVocabularies, setTopicVocabularies] = useState<TopicVocabulary[]>([]);
  const [topicVocabularyId, setTopicVocabularyId] = useState("");
  const [topicVocabularyName, setTopicVocabularyName] = useState("");
  const [topicVocabularyTerms, setTopicVocabularyTerms] = useState("");
  const [topicVocabularySaving, setTopicVocabularySaving] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string>();
  const [aiConnection, setAIConnection] = useState<AIConnection>({ provider: "gemini", model: "gemini-2.5-flash", transcription_model: "gemini-2.5-flash", base_url: "https://generativelanguage.googleapis.com/v1beta", configured: false, has_api_key: false });
  const [aiKey, setAIKey] = useState("");
  const [aiAction, setAIAction] = useState<"testing" | "saving">();
  const [aiNotice, setAINotice] = useState<string>();
  const [aiError, setAIError] = useState<string>();
  const initialized = useRef(false);

  async function loadSettings() {
    setLoadState("loading");
    setLoadError(undefined);
    try {
      const [value, terms, nextSkills, nextTopics, nextAIConnection] = await Promise.all([getWorkspaceSettings(), getGlossarySuggestions(), getSkills(), getTopicVocabularies(), getAIConnection()]);
      setSettings(value);
      setSuggestions(terms.filter((item) => item.count >= 2));
      setSkills(nextSkills);
      setTopicVocabularies(nextTopics);
      setAIConnection(nextAIConnection);
      initialized.current = true;
      setLoadState("ready");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Could not load settings");
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!initialized.current || saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void saveWorkspaceSettings(settings).then((saved) => { setSettings(saved); setSaveState("saved"); }).catch(() => setSaveState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [saveState, settings]);

  function update(next: WorkspaceSettings) {
    setSettings(next);
    setSaveState("dirty");
  }

  function addTerm() {
    const value = term.trim();
    const current = settings.voice_profile.vocabulary[termCategory];
    if (!value || current.includes(value)) return;
    update({ ...settings, voice_profile: { ...settings.voice_profile, vocabulary: { ...settings.voice_profile.vocabulary, [termCategory]: [...current, value] } } });
    setTerm("");
  }

  function acceptSuggestion(value: string) {
    const current = settings.voice_profile.vocabulary.products;
    update({ ...settings, voice_profile: { ...settings.voice_profile, vocabulary: { ...settings.voice_profile.vocabulary, products: current.includes(value) ? current : [...current, value] } } });
    setSuggestions((current) => current.filter((item) => item.term !== value));
  }

  function removeTerm(category: VocabularyCategory, value: string) {
    update({ ...settings, voice_profile: { ...settings.voice_profile, vocabulary: { ...settings.voice_profile.vocabulary, [category]: settings.voice_profile.vocabulary[category].filter((item) => item !== value) } } });
  }

  function addPreferredSpelling() {
    const spoken = spokenTerm.trim();
    const preferred = preferredTerm.trim();
    if (!spoken || !preferred || settings.voice_profile.vocabulary.preferred_spellings.some((entry) => entry.spoken.toLowerCase() === spoken.toLowerCase())) return;
    update({ ...settings, voice_profile: { ...settings.voice_profile, vocabulary: { ...settings.voice_profile.vocabulary, preferred_spellings: [...settings.voice_profile.vocabulary.preferred_spellings, { spoken, preferred }] } } });
    setSpokenTerm("");
    setPreferredTerm("");
  }

  function ignoreSuggestion(value: string) {
    update({ ...settings, ignored_terms: settings.ignored_terms.includes(value) ? settings.ignored_terms : [...settings.ignored_terms, value] });
    setSuggestions((current) => current.filter((item) => item.term !== value));
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setNotice("Copied");
    window.setTimeout(() => setNotice(undefined), 1800);
  }

  const globalSkillRows: Array<{ key: keyof Pick<WorkspaceSettings, "default_organization_skill" | "default_extension_skill" | "default_qa_skill" | "default_document_skill">; label: string; accepts: (skill: LogueSkill) => boolean }> = [
    { key: "default_organization_skill", label: "Organization", accepts: (skill) => skill.task === "organize" },
    { key: "default_extension_skill", label: "Voice Command", accepts: (skill) => skill.task === "generate" && skill.output === "insert" && skill.surfaces.includes("extension") },
    { key: "default_qa_skill", label: "Ask", accepts: (skill) => skill.task === "generate" && skill.output === "qa" },
    { key: "default_document_skill", label: "Draft", accepts: (skill) => skill.task === "generate" && skill.output === "document" },
  ];

  async function backUp() {
    setBackingUp(true);
    try {
      const result = await backupWorkspace();
      setNotice(`Backup created ${new Date(result.backup.created_at).toLocaleString()}`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Backup failed");
    } finally {
      setBackingUp(false);
    }
  }

  function aiConnectionInput(): AIConnectionInput {
    return {
      provider: aiConnection.provider,
      model: aiConnection.model.trim(),
      transcription_model: aiConnection.provider === "openai-compatible" ? aiConnection.transcription_model.trim() : aiConnection.model.trim(),
      base_url: aiConnection.base_url.trim(),
      api_key: aiKey.trim(),
      keep_api_key: !aiKey.trim() && aiConnection.has_api_key,
    };
  }

  async function testConnection() {
    setAIAction("testing");
    setAIError(undefined);
    setAINotice(undefined);
    try {
      await testAIConnection(aiConnectionInput());
      setAINotice("Connection ready. Save it to use across Logue.");
    } catch (cause) {
      setAIError(cause instanceof Error ? cause.message : "Could not reach this model");
    } finally {
      setAIAction(undefined);
    }
  }

  async function persistAIConnection() {
    setAIAction("saving");
    setAIError(undefined);
    setAINotice(undefined);
    try {
      const saved = await saveAIConnection(aiConnectionInput());
      setAIConnection(saved);
      setAIKey("");
      setAINotice("Voice and AI are ready on this Mac.");
    } catch (cause) {
      setAIError(cause instanceof Error ? cause.message : "Could not save this connection");
    } finally {
      setAIAction(undefined);
    }
  }

  async function deleteAllData() {
    if (deleteConfirmation !== "DELETE") return;
    try {
      const result = await deleteWorkspace();
      window.alert(`Local data deleted. A recoverable backup is available in Settings.`);
      window.location.reload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete local data");
    }
  }

  function chooseTopicVocabulary(id: string) {
    const selected = topicVocabularies.find((item) => item.id === id);
    setTopicVocabularyId(id);
    setTopicVocabularyName(selected?.name ?? "");
    setTopicVocabularyTerms(selected ? [...selected.vocabulary.people, ...selected.vocabulary.companies, ...selected.vocabulary.products, ...selected.vocabulary.places, ...selected.vocabulary.acronyms, ...selected.vocabulary.preferred_spellings.map((entry) => `${entry.spoken} → ${entry.preferred}`)].join("\n") : "");
  }

  async function persistTopicVocabulary() {
    const name = topicVocabularyName.trim();
    const terms = topicVocabularyTerms.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    const preferredSpellings = terms.flatMap((value) => {
      const parts = value.split(/\s*(?:→|=>)\s*/, 2);
      return parts.length === 2 && parts[0] && parts[1] ? [{ spoken: parts[0], preferred: parts[1] }] : [];
    });
    const plainTerms = terms.filter((value) => !/→|=>/.test(value));
    if (!name || topicVocabularySaving) return;
    setTopicVocabularySaving(true);
    try {
      const current = topicVocabularies.find((item) => item.id === topicVocabularyId);
      const saved = await saveTopicVocabulary(current?.id, {
        name,
        vocabulary: { people: [], companies: [], products: Array.from(new Set(plainTerms)), places: [], acronyms: [], preferred_spellings: preferredSpellings },
      });
      setTopicVocabularies((items) => current ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      chooseTopicVocabulary(saved.id);
      setTopicVocabularyId(saved.id);
      setTopicVocabularyName(saved.name);
      setTopicVocabularyTerms([...saved.vocabulary.products, ...saved.vocabulary.preferred_spellings.map((entry) => `${entry.spoken} → ${entry.preferred}`)].join("\n"));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not save Topic Vocabulary");
    } finally {
      setTopicVocabularySaving(false);
    }
  }

  async function removeTopicVocabulary() {
    if (!topicVocabularyId || topicVocabularySaving) return;
    setTopicVocabularySaving(true);
    try {
      await deleteTopicVocabulary(topicVocabularyId);
      setTopicVocabularies((items) => items.filter((item) => item.id !== topicVocabularyId));
      setTopicVocabularyId(""); setTopicVocabularyName(""); setTopicVocabularyTerms("");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not delete Topic Vocabulary");
    } finally {
      setTopicVocabularySaving(false);
    }
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <PageHeader title="Settings" axis="editor" testId="settings-header-column" actions={saveState === "error" ? <span className="text-[14px] text-[#a84d44]">Save failed</span> : undefined} />
      <div data-testid="settings-scroll-surface" className="scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div data-testid="settings-content-column" className={`${editorColumnClass} pb-24 pt-8`}>

        {loadState === "loading" && <div className="space-y-2" aria-label="Loading settings">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div>}
        {loadState === "error" && <div className="rounded-md border border-[#ead3ce] bg-[#fbefec] px-4 py-3"><p className="text-[15px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadSettings()} className="mt-2 h-7 rounded-md bg-white px-2.5 text-[14px] font-medium text-[#75534f] shadow-[0_0_0_1px_#e4cbc6]">Reload</button></div>}

        <fieldset disabled={loadState !== "ready"} className={loadState === "ready" ? "" : "pointer-events-none opacity-35"}>

        <div className="pb-2"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#30312d]">Preferences</h2></div>

        <SettingsRow label="Default voice profile">
          <div className="space-y-5">
            <label className="block text-[14px] font-medium text-[#555651]">Transcription Skill<select className={`mt-2 h-10 w-full rounded-md border border-[#deded9] bg-white px-3 text-[14px] text-[#555651] outline-none ${fieldFocusClass}`} value={settings.default_transcription_skill ?? ""} onChange={(event) => update({ ...settings, default_transcription_skill: event.target.value })}>{skills.filter((skill) => skill.enabled && skill.task === "transcribe").map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.system ? " · Built-in" : " · My Skill"}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1"><label className="text-[14px] font-medium text-[#555651]">Primary language<input className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} value={settings.voice_profile.primary_language} onChange={(event) => update({ ...settings, voice_profile: { ...settings.voice_profile, primary_language: event.target.value } })} placeholder="Auto-detect" /></label><label className="text-[14px] font-medium text-[#555651]">Mixed languages<input className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} value={settings.voice_profile.mixed_languages.join(", ")} onChange={(event) => update({ ...settings, voice_profile: { ...settings.voice_profile, mixed_languages: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } })} placeholder="English, 中文" /></label></div>
            <label className="block text-[14px] font-medium text-[#555651]">Personal context<textarea value={settings.personal_context} onChange={(event) => update({ ...settings, personal_context: event.target.value })} placeholder="Writing preferences, your role, and context Logue should know…" className={`mt-2 min-h-24 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[15px] leading-6 outline-none ${fieldFocusClass}`} /></label>
            <div><p className="text-[14px] font-medium text-[#555651]">Personal vocabulary</p><div className="mt-2 space-y-2">{vocabularyCategories.map((category) => settings.voice_profile.vocabulary[category.key].length ? <div key={category.key} className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-[13px] text-[#999a95]">{category.label}</span>{settings.voice_profile.vocabulary[category.key].map((value) => <span key={value} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#f0f0ed] px-2.5 text-[14px] text-[#555651]">{value}<button type="button" onClick={() => removeTerm(category.key, value)} className="inline-flex size-6 items-center justify-center rounded text-[#999a95] hover:bg-[#e4e4e0]" aria-label={`Remove ${value}`}><X size={12} /></button></span>)}</div> : null)}</div><div className="mt-3 flex gap-2 max-[700px]:flex-wrap"><select className={`h-10 rounded-md border border-[#deded9] bg-white px-3 text-[14px] ${fieldFocusClass}`} value={termCategory} onChange={(event) => setTermCategory(event.target.value as VocabularyCategory)}>{vocabularyCategories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="Add a term" className={`h-10 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} /><button type="button" onClick={addTerm} className="h-10 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#62635e] hover:bg-[#f4f4f1]">Add</button></div></div>
            <div><p className="text-[14px] font-medium text-[#555651]">Acronym and preferred spelling</p><div className="mt-2 flex flex-wrap gap-1.5">{settings.voice_profile.vocabulary.preferred_spellings.map((entry) => <button type="button" key={entry.spoken} onClick={() => update({ ...settings, voice_profile: { ...settings.voice_profile, vocabulary: { ...settings.voice_profile.vocabulary, preferred_spellings: settings.voice_profile.vocabulary.preferred_spellings.filter((value) => value.spoken !== entry.spoken) } } })} className="h-8 rounded-md bg-[#f0f0ed] px-2.5 text-[14px] text-[#555651]">{entry.spoken} → {entry.preferred} ×</button>)}</div><div className="mt-3 flex gap-2 max-[700px]:flex-wrap"><input className={`h-10 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} value={spokenTerm} onChange={(event) => setSpokenTerm(event.target.value)} placeholder="What Logue may hear" /><input className={`h-10 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} value={preferredTerm} onChange={(event) => setPreferredTerm(event.target.value)} placeholder="Preferred spelling" /><button type="button" onClick={addPreferredSpelling} disabled={!spokenTerm.trim() || !preferredTerm.trim()} className="h-10 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#62635e] hover:bg-[#f4f4f1] disabled:opacity-50">Add</button></div></div>
            <label className="block text-[14px] font-medium text-[#555651]">Custom instructions<textarea value={settings.voice_profile.custom_instructions} onChange={(event) => update({ ...settings, voice_profile: { ...settings.voice_profile, custom_instructions: event.target.value } })} placeholder="Optional transcription instructions that apply everywhere…" className={`mt-2 min-h-20 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[15px] leading-6 outline-none ${fieldFocusClass}`} /></label>
          </div>
        </SettingsRow>

        <SettingsRow label="Topic vocabularies">
          <div className="space-y-3">
            <div className="flex gap-2 max-[700px]:flex-wrap"><select className={`h-10 min-w-0 flex-1 rounded-md border border-[#deded9] bg-white px-3 text-[14px] ${fieldFocusClass}`} value={topicVocabularyId} onChange={(event) => chooseTopicVocabulary(event.target.value)} aria-label="Topic Vocabulary"><option value="">New Topic Vocabulary</option>{topicVocabularies.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>{topicVocabularyId && <button type="button" onClick={() => void removeTopicVocabulary()} disabled={topicVocabularySaving} className="h-10 rounded-md border border-[#e4cbc6] px-3 text-[14px] font-medium text-[#a04b43] hover:bg-[#fbefec]">Delete</button>}</div>
            <input className={`h-10 w-full rounded-md border border-[#deded9] px-3 text-[15px] outline-none ${fieldFocusClass}`} value={topicVocabularyName} onChange={(event) => setTopicVocabularyName(event.target.value)} placeholder="Topic name, for example Investor interview" aria-label="Topic Vocabulary name" />
            <textarea className={`min-h-24 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[15px] leading-6 outline-none ${fieldFocusClass}`} value={topicVocabularyTerms} onChange={(event) => setTopicVocabularyTerms(event.target.value)} placeholder="One term per line" aria-label="Topic Vocabulary terms" />
            <div className="flex items-center justify-between gap-3"><p className="text-[14px] text-[#92938e]">Used only for transcription. It never adds Sources or Project Context.</p><button type="button" onClick={() => void persistTopicVocabulary()} disabled={!topicVocabularyName.trim() || topicVocabularySaving} className="h-9 shrink-0 rounded-md bg-[#242522] px-3 text-[14px] font-medium text-white disabled:bg-[#bdbdb8]">{topicVocabularySaving ? "Saving…" : "Save"}</button></div>
          </div>
        </SettingsRow>

        {suggestions.length > 0 && <SettingsRow label="Term suggestions"><div className="space-y-1.5">{suggestions.map((suggestion) => <div key={suggestion.term} className="flex min-h-11 items-center justify-between rounded-md border border-[#e2e2de] px-3 py-2"><span><span className="text-[15px] font-medium text-[#4d4e49]">{suggestion.term}</span><span className="ml-2 text-[14px] text-[#999a95]">{suggestion.count} uses</span></span><span className="flex gap-1"><button type="button" onClick={() => ignoreSuggestion(suggestion.term)} className="min-h-9 rounded px-2 text-[14px] text-[#8a8b86] hover:bg-[#f1f1ee]">Ignore</button><button type="button" onClick={() => acceptSuggestion(suggestion.term)} className="min-h-9 rounded bg-[#efefec] px-2 text-[14px] font-medium text-[#555651] hover:bg-[#e5e5e1]">Pin</button></span></div>)}</div></SettingsRow>}

        <SettingsRow label="Global Skills">
          <div className="divide-y divide-[#ecece8]">{globalSkillRows.map((row) => <label className="flex min-h-14 items-center justify-between gap-5 py-2" key={row.key}><span className="text-[15px] font-medium text-[#555651]">{row.label}</span><select className={`h-10 min-w-[240px] rounded-md border border-[#deded9] bg-white px-3 text-[14px] text-[#555651] outline-none ${fieldFocusClass}`} value={settings[row.key] ?? ""} onChange={(event) => update({ ...settings, [row.key]: event.target.value })}>{skills.filter((skill) => skill.enabled && row.accepts(skill)).map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.system ? " · Built-in" : " · My Skill"}</option>)}</select></label>)}</div>
          <p className="mt-2 text-[14px] leading-5 text-[#92938e]">Projects inherit these defaults unless a Project override is set.</p>
        </SettingsRow>

        <div className="mt-8 border-t border-[#e8e8e5] pb-2 pt-8"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#30312d]">System</h2></div>

        <SettingsRow label="AI" border={false}>
          <div className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2.5 text-[14px] ${aiConnection.configured ? "border-[#d7e0d3] bg-[#f5f8f3] text-[#537052]" : "border-[#ead3ce] bg-[#fbefec] text-[#a04b43]"}`}><KeyRound size={14} />{aiConnection.configured ? `Ready · ${aiConnection.model}` : "Connect a model before using Voice or AI"}</div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
              <label className="text-[14px] font-medium text-[#555651]">Provider<select value={aiConnection.provider} onChange={(event) => {
                const provider = event.target.value as AIConnection["provider"];
                setAIConnection((current) => ({ ...current, provider, configured: false, model: provider === "gemini" ? "gemini-2.5-flash" : "gpt-4.1-mini", transcription_model: provider === "gemini" ? "gemini-2.5-flash" : "whisper-1", base_url: provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1" }));
                setAIKey(""); setAINotice(undefined); setAIError(undefined);
              }} className={`mt-2 h-10 w-full rounded-md border border-[#deded9] bg-white px-3 text-[14px] outline-none ${fieldFocusClass}`}><option value="gemini">Gemini</option><option value="openai-compatible">OpenAI-compatible provider</option></select></label>
              <label className="text-[14px] font-medium text-[#555651]">API key<input type="password" value={aiKey} onChange={(event) => setAIKey(event.target.value)} placeholder={aiConnection.has_api_key ? "Keep current key" : "Stored only on this Host"} className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[14px] outline-none ${fieldFocusClass}`} autoComplete="off" /></label>
            </div>
            <label className="block text-[14px] font-medium text-[#555651]">Endpoint<input value={aiConnection.base_url} onChange={(event) => setAIConnection((current) => ({ ...current, base_url: event.target.value, configured: false }))} className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[14px] outline-none ${fieldFocusClass}`} /></label>
            <div className={`grid gap-3 ${aiConnection.provider === "openai-compatible" ? "grid-cols-2 max-[700px]:grid-cols-1" : "grid-cols-1"}`}>
              <label className="text-[14px] font-medium text-[#555651]">Generation model<input value={aiConnection.model} onChange={(event) => setAIConnection((current) => ({ ...current, model: event.target.value, configured: false }))} className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[14px] outline-none ${fieldFocusClass}`} /></label>
              {aiConnection.provider === "openai-compatible" && <label className="text-[14px] font-medium text-[#555651]">Transcription model<input value={aiConnection.transcription_model} onChange={(event) => setAIConnection((current) => ({ ...current, transcription_model: event.target.value, configured: false }))} className={`mt-2 h-10 w-full rounded-md border border-[#deded9] px-3 text-[14px] outline-none ${fieldFocusClass}`} /></label>}
            </div>
            {aiError && <p role="alert" className="rounded-md bg-[#fbefec] px-3 py-2 text-[14px] leading-5 text-[#a04b43]">{aiError}</p>}
            {aiNotice && <p role="status" className="rounded-md bg-[#f3f6f1] px-3 py-2 text-[14px] leading-5 text-[#557054]">{aiNotice}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => void testConnection()} disabled={Boolean(aiAction) || !aiConnection.model.trim() || !aiConnection.base_url.trim() || (aiConnection.provider === "gemini" && !aiKey.trim() && !aiConnection.has_api_key)} className="h-9 rounded-md border border-[#d8d8d3] px-3 text-[14px] font-medium text-[#62635e] hover:bg-[#f4f4f1] disabled:opacity-50">{aiAction === "testing" ? "Testing…" : "Test connection"}</button><button type="button" onClick={() => void persistAIConnection()} disabled={Boolean(aiAction) || !aiConnection.model.trim() || !aiConnection.base_url.trim() || (aiConnection.provider === "gemini" && !aiKey.trim() && !aiConnection.has_api_key)} className="h-9 rounded-md bg-[#242522] px-3 text-[14px] font-medium text-white disabled:bg-[#bdbdb8]">{aiAction === "saving" ? "Saving…" : "Save and use"}</button></div>
          </div>
        </SettingsRow>

        <SettingsRow label="Library">
          <button type="button" onClick={() => void backUp()} disabled={backingUp} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#555651] hover:bg-[#f4f4f1] disabled:opacity-55"><Archive size={14} />{backingUp ? "Backing up…" : "Back up now"}</button>
        </SettingsRow>

        <SettingsRow label="Delete local data">
          {!deleteOpen ? <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#e4cbc6] px-3 text-[15px] font-medium text-[#a04b43] hover:bg-[#fbefec]"><Trash2 size={14} />Review deletion</button> : <div className="rounded-md border border-[#ead3ce] bg-[#fff8f6] p-4"><p className="text-[15px] leading-6 text-[#6d4b46]">This removes Sources, original audio, Projects, Documents, Activity, and My Skills from this Mac. Logue creates a full local backup first.</p><label className="mt-3 block text-[14px] font-medium text-[#75534f]">Type DELETE to continue<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className={`mt-2 h-10 w-full rounded-md border border-[#e0c7c2] bg-white px-3 text-[15px] outline-none ${fieldFocusClass}`} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); }} className="h-9 rounded-md px-3 text-[14px] text-[#777873] hover:bg-white">Cancel</button><button type="button" disabled={deleteConfirmation !== "DELETE"} onClick={() => void deleteAllData()} className="h-9 rounded-md bg-[#a04b43] px-3 text-[14px] font-medium text-white disabled:bg-[#d7b6b1]">Delete all local data</button></div></div>}
        </SettingsRow>

        <details className="border-t border-[#e8e8e5] py-5">
          <summary className="cursor-pointer select-none rounded py-1 text-[14px] font-medium text-[#777873] hover:text-[#555651]">Developer tools</summary>
          <div className="mt-4 grid grid-cols-[200px_minmax(0,1fr)] gap-10 max-[700px]:grid-cols-1 max-[700px]:gap-3">
            <h3 className="pt-1 text-[14px] font-semibold text-[#484945]">Developer API</h3>
            <div className="space-y-2"><button type="button" onClick={() => void copy(`GET ${logueApiBase}/v1/project-bundles/{projectName}`)} className="flex min-h-11 w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left hover:bg-[#fafaf8]"><span><span className="block text-[15px] font-medium text-[#4d4e49]">Project bundle</span><code className="mt-0.5 block text-[14px] text-[#92938e]">GET /v1/project-bundles/&#123;projectName&#125;</code></span><Clipboard size={14} className="text-[#898a85]" /></button><button type="button" onClick={() => void copy(`POST ${logueApiBase}/v1/external-agent/import`)} className="flex min-h-11 w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left hover:bg-[#fafaf8]"><span><span className="block text-[15px] font-medium text-[#4d4e49]">Import external result</span><code className="mt-0.5 block text-[14px] text-[#92938e]">POST /v1/external-agent/import</code></span><Clipboard size={14} className="text-[#898a85]" /></button></div>
          </div>
        </details>
        </fieldset>
      </div>
      </div>
      {notice && <div className="fixed bottom-5 right-5 rounded-md bg-[#30312d] px-3 py-2 text-[15px] text-white shadow-lg">{notice}</div>}
    </main>
  );
}
