import { Clipboard, Download, KeyRound, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

type SaveState = "saved" | "dirty" | "saving" | "error";

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
    <main className="min-w-0 flex-1 overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 border-b border-[#eeeeeb] bg-white/92 backdrop-blur"><div data-testid="settings-header-column" className="mx-auto flex h-12 w-full max-w-[820px] items-center justify-between px-[9%] max-[700px]:px-5"><h1 className="text-[13px] font-medium text-[#464743]">Settings</h1>{saveState === "error" && <span className="text-[10.5px] text-[#a84d44]">Save failed</span>}</div></header>
      <div data-testid="settings-content-column" className="mx-auto w-full max-w-[820px] px-[9%] pb-24 pt-8 max-[700px]:px-5">

        {loadState === "loading" && <div className="space-y-2" aria-label="Loading settings">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div>}
        {loadState === "error" && <div className="rounded-md border border-[#ead3ce] bg-[#fbefec] px-4 py-3"><p className="text-[11px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadSettings()} className="mt-2 h-7 rounded-md bg-white px-2.5 text-[10px] font-medium text-[#75534f] shadow-[0_0_0_1px_#e4cbc6]">Reload</button></div>}

        <fieldset disabled={loadState !== "ready"} className={loadState === "ready" ? "" : "pointer-events-none opacity-35"}>

        <div className="pb-2"><h2 className="text-[13px] font-semibold text-[#3f403c]">Preferences</h2><p className="mt-1 text-[10.5px] text-[#92938e]">Control how Logue understands your voice and terminology.</p></div>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Writing preferences</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Used by default when you dictate or generate documents with Logue.</p></div><textarea value={settings.personal_context} onChange={(event) => update({ ...settings, personal_context: event.target.value })} placeholder="For example: Keep the writing concise and direct; preserve product names…" className="min-h-28 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[12px] leading-5 outline-none focus:border-[#aaa]" /></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Global terms</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Pin words used across projects that transcription often misses.</p></div><div><div className="flex flex-wrap gap-1.5">{settings.glossary.map((value) => <span key={value} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f0f0ed] px-2.5 text-[11px] text-[#555651]">{value}<button type="button" onClick={() => update({ ...settings, glossary: settings.glossary.filter((item) => item !== value) })} className="text-[#999a95] hover:text-[#555]" aria-label={`Remove ${value}`}><X size={11} /></button></span>)}</div><div className="mt-3 flex gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="Add a term and press Enter" className="h-9 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[12px] outline-none focus:border-[#aaa]" /><button type="button" onClick={addTerm} className="h-9 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#62635e]">Add</button></div></div></div>
        </section>

        {suggestions.length > 0 && <section className="border-t border-[#e8e8e5] py-7"><div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Term suggestions</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Learned from recently adopted text. Suggestions do not affect transcription until accepted.</p></div><div className="space-y-1.5">{suggestions.map((suggestion) => <div key={suggestion.term} className="flex items-center justify-between rounded-md border border-[#e2e2de] px-3 py-2"><span><span className="text-[11.5px] font-medium text-[#4d4e49]">{suggestion.term}</span><span className="ml-2 text-[9.5px] text-[#999a95]">Used {suggestion.count} times</span></span><span className="flex gap-1"><button type="button" onClick={() => ignoreSuggestion(suggestion.term)} className="h-7 rounded px-2 text-[10px] text-[#8a8b86] hover:bg-[#f1f1ee]">Ignore</button><button type="button" onClick={() => acceptSuggestion(suggestion.term)} className="h-7 rounded bg-[#efefec] px-2 text-[10px] font-medium text-[#555651] hover:bg-[#e5e5e1]">Pin</button></span></div>)}</div></div></section>}

        <div className="mt-8 border-t border-[#e8e8e5] pt-8"><h2 className="text-[13px] font-semibold text-[#3f403c]">System and integrations</h2><p className="mt-1 text-[10.5px] text-[#92938e]">Local models, external agents, and library management.</p></div>

        <section className="py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Gemini and transcription</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Keys are read only from the local process environment and never written to the browser or library.</p></div><div><div className="rounded-md border border-[#deded9]"><div className="flex items-center justify-between border-b border-[#ecece9] px-3 py-2.5"><span className="inline-flex items-center gap-2 text-[11px] text-[#555651]"><KeyRound size={13} /> API key</span><span className={`text-[10.5px] ${status?.ai_configured ? "text-[#4c7b51]" : "text-[#ac4e44]"}`}>{status?.ai_configured ? "Loaded from terminal environment" : "Not configured"}</span></div><div className="flex items-center justify-between px-3 py-2.5"><span className="text-[11px] text-[#555651]">Transcription model</span><code className="text-[10.5px] text-[#777873]">{status?.model || "—"}</code></div></div><details className="mt-2 text-[10px] text-[#999a95]"><summary className="cursor-pointer select-none rounded py-1 hover:text-[#666762]">Environment and advanced configuration</summary><p className="mt-1 break-words font-mono leading-4">GEMINI_API_KEY · LOGUE_TRANSCRIPTION_MODEL · LOGUE_DICTATION_SKILL · LOGUE_TRANSCRIPTION_CONTEXT_LIMIT</p></details></div></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">External agents</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Read project bundles. Writes can only append derived materials with sources.</p></div><div className="space-y-2"><button type="button" onClick={() => void copy("GET http://127.0.0.1:8787/v1/project-bundles/{projectName}")} className="flex w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left"><span><span className="block text-[11px] font-medium text-[#4d4e49]">Read-only project bundle</span><code className="mt-0.5 block text-[9.5px] text-[#92938e]">GET /v1/project-bundles/&#123;projectName&#125;</code></span><Clipboard size={13} className="text-[#898a85]" /></button><button type="button" onClick={() => void copy("POST http://127.0.0.1:8787/v1/agent/import")} className="flex w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left"><span><span className="block text-[11px] font-medium text-[#4d4e49]">Append agent result</span><code className="mt-0.5 block text-[9.5px] text-[#92938e]">POST /v1/agent/import</code></span><Clipboard size={13} className="text-[#898a85]" /></button></div></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Export and restore</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">Exports include materials, audio, projects, documents, and settings.</p></div><div className="flex flex-wrap gap-2"><a href={exportWorkspaceURL()} download={`logue-export-${new Date().toISOString().slice(0, 10)}.json`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Download size={13} /> Export library</a><label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Upload size={13} /> {restoring ? "Restoring…" : "Restore from export"}<input type="file" accept="application/json,.json" disabled={restoring} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.currentTarget.value = ""; }} /></label><span className="inline-flex items-center gap-1 text-[10px] text-[#7b8a7d]"><ShieldCheck size={12} /> Automatic backup before restore</span></div></div>
        </section>
        </fieldset>
      </div>
      {notice && <div className="fixed bottom-5 right-5 rounded-md bg-[#30312d] px-3 py-2 text-[11px] text-white shadow-lg">{notice}</div>}
    </main>
  );
}
