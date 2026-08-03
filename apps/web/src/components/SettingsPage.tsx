import { Clipboard, Download, KeyRound, Upload, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  exportWorkspaceURL,
  getGlossarySuggestions,
  getWorkspaceSettings,
  restoreWorkspace,
  saveWorkspaceSettings,
  type ServiceStatus,
  type WorkspaceSettings,
  type GlossarySuggestion,
} from "../api";
import { editorColumnClass } from "./layout";
import { PageHeader } from "./ui";

type SaveState = "saved" | "dirty" | "saving" | "error";

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
  const [settings, setSettings] = useState<WorkspaceSettings>({ personal_context: "", glossary: [], ignored_terms: [] });
  const [term, setTerm] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const [suggestions, setSuggestions] = useState<GlossarySuggestion[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string>();
  const initialized = useRef(false);

  async function loadSettings() {
    setLoadState("loading");
    setLoadError(undefined);
    try {
      const [value, terms] = await Promise.all([getWorkspaceSettings(), getGlossarySuggestions()]);
      setSettings(value);
      setSuggestions(terms.filter((item) => item.count >= 2));
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
    if (!value || settings.glossary.includes(value)) return;
    update({ ...settings, glossary: [...settings.glossary, value] });
    setTerm("");
  }

  function acceptSuggestion(value: string) {
    update({ ...settings, glossary: settings.glossary.includes(value) ? settings.glossary : [...settings.glossary, value] });
    setSuggestions((current) => current.filter((item) => item.term !== value));
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

  async function restore(file: File) {
    if (!window.confirm("Restoring replaces the current library with this export. Logue will create a complete recoverable backup first. Continue?")) return;
    setRestoring(true);
    try {
      const value = JSON.parse(await file.text()) as unknown;
      const result = await restoreWorkspace(value);
      window.alert(`Restore complete. The previous library is backed up at ${result.backup_path}`);
      window.location.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white">
      <PageHeader title="Settings" testId="settings-header-column" actions={saveState === "error" ? <span className="text-[14px] text-[#a84d44]">Save failed</span> : undefined} />
      <div data-testid="settings-content-column" className={`${editorColumnClass} pb-24 pt-8`}>

        {loadState === "loading" && <div className="space-y-2" aria-label="Loading settings">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div>}
        {loadState === "error" && <div className="rounded-md border border-[#ead3ce] bg-[#fbefec] px-4 py-3"><p className="text-[15px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadSettings()} className="mt-2 h-7 rounded-md bg-white px-2.5 text-[14px] font-medium text-[#75534f] shadow-[0_0_0_1px_#e4cbc6]">Reload</button></div>}

        <fieldset disabled={loadState !== "ready"} className={loadState === "ready" ? "" : "pointer-events-none opacity-35"}>

        <div className="pb-2"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#30312d]">Preferences</h2></div>

        <SettingsRow label="Writing preferences">
          <textarea value={settings.personal_context} onChange={(event) => update({ ...settings, personal_context: event.target.value })} placeholder="Keep writing concise and direct; preserve product names…" className="min-h-28 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[15px] leading-6 outline-none focus:border-[#aaa]" />
        </SettingsRow>

        <SettingsRow label="Global terms">
          <div className="flex flex-wrap gap-1.5">{settings.glossary.map((value) => <span key={value} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#f0f0ed] px-2.5 text-[15px] text-[#555651] max-[900px]:h-11">{value}<button type="button" onClick={() => update({ ...settings, glossary: settings.glossary.filter((item) => item !== value) })} className="inline-flex size-6 items-center justify-center rounded text-[#999a95] hover:bg-[#e4e4e0] hover:text-[#555] max-[900px]:-mr-2.5 max-[900px]:size-11" aria-label={`Remove ${value}`}><X size={12} /></button></span>)}</div>
          <div className="mt-3 flex gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="Add a term" className="h-10 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[15px] outline-none focus:border-[#aaa]" /><button type="button" onClick={addTerm} className="h-10 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#62635e] hover:bg-[#f4f4f1]">Add</button></div>
        </SettingsRow>

        {suggestions.length > 0 && <SettingsRow label="Term suggestions"><div className="space-y-1.5">{suggestions.map((suggestion) => <div key={suggestion.term} className="flex min-h-11 items-center justify-between rounded-md border border-[#e2e2de] px-3 py-2"><span><span className="text-[15px] font-medium text-[#4d4e49]">{suggestion.term}</span><span className="ml-2 text-[14px] text-[#999a95]">{suggestion.count} uses</span></span><span className="flex gap-1"><button type="button" onClick={() => ignoreSuggestion(suggestion.term)} className="min-h-9 rounded px-2 text-[14px] text-[#8a8b86] hover:bg-[#f1f1ee]">Ignore</button><button type="button" onClick={() => acceptSuggestion(suggestion.term)} className="min-h-9 rounded bg-[#efefec] px-2 text-[14px] font-medium text-[#555651] hover:bg-[#e5e5e1]">Pin</button></span></div>)}</div></SettingsRow>}

        <div className="mt-8 border-t border-[#e8e8e5] pb-2 pt-8"><h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#30312d]">System</h2></div>

        <SettingsRow label="AI" border={false}>
          {!status?.ai_configured && <div className="mb-2 flex items-center gap-2 rounded-md border border-[#ead3ce] bg-[#fbefec] px-3 py-2.5 text-[14px] text-[#a04b43]"><KeyRound size={14} /> GEMINI_API_KEY is not configured</div>}
          <div className="flex min-h-11 items-center justify-between rounded-md border border-[#deded9] px-3"><span className="text-[15px] text-[#555651]">Transcription model</span><code className="text-[14px] text-[#777873]">{status?.model || "—"}</code></div>
          <details className="mt-2 text-[14px] text-[#999a95]"><summary className="cursor-pointer select-none rounded py-1 hover:text-[#666762]">Advanced</summary><p className="mt-1 break-words font-mono leading-5">GEMINI_API_KEY · LOGUE_TRANSCRIPTION_MODEL · LOGUE_DICTATION_SKILL · LOGUE_TRANSCRIPTION_CONTEXT_LIMIT</p></details>
        </SettingsRow>

        <SettingsRow label="Library">
          <div className="flex flex-wrap gap-2"><a href={exportWorkspaceURL()} download={`logue-export-${new Date().toISOString().slice(0, 10)}.json`} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Download size={14} /> Export</a><label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[15px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Upload size={14} /> {restoring ? "Restoring…" : "Restore"}<input type="file" accept="application/json,.json" disabled={restoring} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.currentTarget.value = ""; }} /></label></div>
        </SettingsRow>

        <details className="border-t border-[#e8e8e5] py-5">
          <summary className="cursor-pointer select-none rounded py-1 text-[14px] font-medium text-[#777873] hover:text-[#555651]">Developer tools</summary>
          <div className="mt-4 grid grid-cols-[200px_minmax(0,1fr)] gap-10 max-[700px]:grid-cols-1 max-[700px]:gap-3">
            <h3 className="pt-1 text-[14px] font-semibold text-[#484945]">Developer API</h3>
            <div className="space-y-2"><button type="button" onClick={() => void copy("GET http://127.0.0.1:8787/v1/project-bundles/{projectName}")} className="flex min-h-11 w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left hover:bg-[#fafaf8]"><span><span className="block text-[15px] font-medium text-[#4d4e49]">Project bundle</span><code className="mt-0.5 block text-[14px] text-[#92938e]">GET /v1/project-bundles/&#123;projectName&#125;</code></span><Clipboard size={14} className="text-[#898a85]" /></button><button type="button" onClick={() => void copy("POST http://127.0.0.1:8787/v1/agent/import")} className="flex min-h-11 w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left hover:bg-[#fafaf8]"><span><span className="block text-[15px] font-medium text-[#4d4e49]">Import result</span><code className="mt-0.5 block text-[14px] text-[#92938e]">POST /v1/agent/import</code></span><Clipboard size={14} className="text-[#898a85]" /></button></div>
          </div>
        </details>
        </fieldset>
      </div>
      {notice && <div className="fixed bottom-5 right-5 rounded-md bg-[#30312d] px-3 py-2 text-[15px] text-white shadow-lg">{notice}</div>}
    </main>
  );
}
