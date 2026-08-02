import { Check, Clipboard, Download, KeyRound, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
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
      setLoadError(cause instanceof Error ? cause.message : "无法载入设置");
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
    setNotice("已复制");
    window.setTimeout(() => setNotice(undefined), 1800);
  }

  async function restore(file: File) {
    if (!window.confirm("恢复会用导出文件替换当前资料库。Logue 会先创建可恢复的完整备份。继续吗？")) return;
    setRestoring(true);
    try {
      const value = JSON.parse(await file.text()) as unknown;
      const result = await restoreWorkspace(value);
      window.alert(`恢复完成。原资料库备份在：${result.backup_path}`);
      window.location.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "恢复失败");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#eeeeeb] bg-white/92 px-5 backdrop-blur"><h1 className="text-[13px] font-medium text-[#464743]">设置</h1><span className={`inline-flex items-center gap-1 text-[10.5px] ${saveState === "error" ? "text-[#a84d44]" : "text-[#8d8e89]"}`}>{saveState === "saved" && <Check size={12} />}{saveState === "saving" ? "保存中…" : saveState === "dirty" ? "未保存" : saveState === "error" ? "保存失败" : "已保存"}</span></header>
      <div className="mx-auto max-w-[760px] px-8 pb-24 pt-8 max-[640px]:px-5">

        {loadState === "loading" && <div className="space-y-2" aria-label="正在载入设置">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-[#f3f3f0] motion-reduce:animate-none" />)}</div>}
        {loadState === "error" && <div className="rounded-md border border-[#ead3ce] bg-[#fbefec] px-4 py-3"><p className="text-[11px] text-[#a04b43]">{loadError}</p><button type="button" onClick={() => void loadSettings()} className="mt-2 h-7 rounded-md bg-white px-2.5 text-[10px] font-medium text-[#75534f] shadow-[0_0_0_1px_#e4cbc6]">重新载入</button></div>}

        <fieldset disabled={loadState !== "ready"} className={loadState === "ready" ? "" : "pointer-events-none opacity-35"}>

        <div className="pb-2"><h2 className="text-[13px] font-semibold text-[#3f403c]">偏好</h2><p className="mt-1 text-[10.5px] text-[#92938e]">控制 Logue 如何理解你的表达与专有词。</p></div>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">全局写作偏好</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">在你使用 Logue 输入或生成文档时作为默认参考。</p></div><textarea value={settings.personal_context} onChange={(event) => update({ ...settings, personal_context: event.target.value })} placeholder="例如：偏好简洁、直接的表达；保留中英文产品名…" className="min-h-28 w-full resize-y rounded-md border border-[#deded9] px-3 py-2.5 text-[12px] leading-5 outline-none focus:border-[#aaa]" /></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">全局术语</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">固定容易转写错误、跨项目都会使用的词。</p></div><div><div className="flex flex-wrap gap-1.5">{settings.glossary.map((value) => <span key={value} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f0f0ed] px-2.5 text-[11px] text-[#555651]">{value}<button type="button" onClick={() => update({ ...settings, glossary: settings.glossary.filter((item) => item !== value) })} className="text-[#999a95] hover:text-[#555]" aria-label={`移除 ${value}`}><X size={11} /></button></span>)}</div><div className="mt-3 flex gap-2"><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} placeholder="添加术语后按 Enter" className="h-9 min-w-0 flex-1 rounded-md border border-[#deded9] px-3 text-[12px] outline-none focus:border-[#aaa]" /><button type="button" onClick={addTerm} className="h-9 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#62635e]">添加</button></div></div></div>
        </section>

        {suggestions.length > 0 && <section className="border-t border-[#e8e8e5] py-7"><div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">术语建议</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">来自近期采用文字；接受前不会影响转写。</p></div><div className="space-y-1.5">{suggestions.map((suggestion) => <div key={suggestion.term} className="flex items-center justify-between rounded-md border border-[#e2e2de] px-3 py-2"><span><span className="text-[11.5px] font-medium text-[#4d4e49]">{suggestion.term}</span><span className="ml-2 text-[9.5px] text-[#999a95]">出现 {suggestion.count} 次</span></span><span className="flex gap-1"><button type="button" onClick={() => ignoreSuggestion(suggestion.term)} className="h-7 rounded px-2 text-[10px] text-[#8a8b86] hover:bg-[#f1f1ee]">忽略</button><button type="button" onClick={() => acceptSuggestion(suggestion.term)} className="h-7 rounded bg-[#efefec] px-2 text-[10px] font-medium text-[#555651] hover:bg-[#e5e5e1]">固定</button></span></div>)}</div></div></section>}

        <div className="mt-8 border-t border-[#e8e8e5] pt-8"><h2 className="text-[13px] font-semibold text-[#3f403c]">系统与集成</h2><p className="mt-1 text-[10.5px] text-[#92938e]">本机模型、外部 Agent 与资料库管理。</p></div>

        <section className="py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">Gemini 与转写</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">密钥只从本机进程环境读取，不写入浏览器或资料库。</p></div><div><div className="rounded-md border border-[#deded9]"><div className="flex items-center justify-between border-b border-[#ecece9] px-3 py-2.5"><span className="inline-flex items-center gap-2 text-[11px] text-[#555651]"><KeyRound size={13} /> API 密钥</span><span className={`text-[10.5px] ${status?.ai_configured ? "text-[#4c7b51]" : "text-[#ac4e44]"}`}>{status?.ai_configured ? "已从终端环境读取" : "未配置"}</span></div><div className="flex items-center justify-between px-3 py-2.5"><span className="text-[11px] text-[#555651]">转写模型</span><code className="text-[10.5px] text-[#777873]">{status?.model || "—"}</code></div></div><details className="mt-2 text-[10px] text-[#999a95]"><summary className="cursor-pointer select-none rounded py-1 hover:text-[#666762]">环境变量与高级配置</summary><p className="mt-1 break-words font-mono leading-4">GEMINI_API_KEY · LOGUE_TRANSCRIPTION_MODEL · LOGUE_DICTATION_SKILL · LOGUE_TRANSCRIPTION_CONTEXT_LIMIT</p></details></div></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">外部 Agent</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">读取项目资料包；写回只能追加带来源的派生资料。</p></div><div className="space-y-2"><button type="button" onClick={() => void copy("GET http://127.0.0.1:8787/v1/project-bundles/{项目名}")} className="flex w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left"><span><span className="block text-[11px] font-medium text-[#4d4e49]">只读项目资料包</span><code className="mt-0.5 block text-[9.5px] text-[#92938e]">GET /v1/project-bundles/&#123;项目名&#125;</code></span><Clipboard size={13} className="text-[#898a85]" /></button><button type="button" onClick={() => void copy("POST http://127.0.0.1:8787/v1/agent/import")} className="flex w-full items-center justify-between rounded-md border border-[#deded9] px-3 py-2.5 text-left"><span><span className="block text-[11px] font-medium text-[#4d4e49]">追加 Agent 结果</span><code className="mt-0.5 block text-[9.5px] text-[#92938e]">POST /v1/agent/import</code></span><Clipboard size={13} className="text-[#898a85]" /></button></div></div>
        </section>

        <section className="border-t border-[#e8e8e5] py-7">
          <div className="grid grid-cols-[180px_1fr] gap-8 max-[700px]:grid-cols-1 max-[700px]:gap-3"><div><h3 className="text-[12px] font-semibold text-[#484945]">导出与恢复</h3><p className="mt-1 text-[10.5px] leading-4 text-[#92938e]">导出包含资料、音频、项目、文档和设置。</p></div><div className="flex flex-wrap gap-2"><a href={exportWorkspaceURL()} download={`logue-export-${new Date().toISOString().slice(0, 10)}.json`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Download size={13} /> 导出资料库</a><label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#555651] hover:bg-[#f4f4f1]"><Upload size={13} /> {restoring ? "恢复中…" : "从导出恢复"}<input type="file" accept="application/json,.json" disabled={restoring} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.currentTarget.value = ""; }} /></label><span className="inline-flex items-center gap-1 text-[10px] text-[#7b8a7d]"><ShieldCheck size={12} /> 恢复前自动备份</span></div></div>
        </section>
        </fieldset>
      </div>
      {notice && <div className="fixed bottom-5 right-5 rounded-md bg-[#30312d] px-3 py-2 text-[11px] text-white shadow-lg">{notice}</div>}
    </main>
  );
}
