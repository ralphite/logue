import type { Material } from "@logue/ui";
import {
  Bot,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  adoptAgentRun,
  createAgent,
  createAgentRun,
  getAgentRuns,
  getAgents,
  updateAgent,
  type AgentContext,
  type AgentOutput,
  type AgentSurface,
  type AgentTask,
  type LogueAgent,
  type LogueAgentRun,
} from "../agentApi";
import { getWorkspaceSettings, saveWorkspaceSettings } from "../api";
import { groupIdenticalMaterials } from "../materialGroups";
import { ViewWorkspace } from "./DocumentWorkspace";
import { MaterialGroupPicker } from "./MaterialGroupPicker";

export type GenerationMode = "new" | "agents" | "documents";

const outputLabels: Record<AgentOutput, string> = { insert: "可插入文字", material: "新资料", qa: "问答", document: "文档" };
const taskLabels: Record<AgentTask, string> = { transcribe: "转写", organize: "自动整理", generate: "生成" };
const surfaceLabels: Record<AgentSurface, string> = { web: "Web", extension: "Extension", background: "后台" };
const contextLabels: Record<AgentContext, string> = { page: "当前页面", target: "输入框", selection: "选区", project: "项目", materials: "资料", personal: "个人偏好" };

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function outputIcon(output: AgentOutput) {
  if (output === "document") return FileText;
  if (output === "qa") return MessageSquareText;
  return Sparkles;
}

export function GenerationWorkspace({
  materials,
  initialMode = "new",
  initialDocumentId,
  initialProject,
  onModeChange,
  onSelectedDocumentChange,
  onOpenMaterials,
  onLeaveGuardChange,
}: {
  materials: Material[];
  initialMode?: GenerationMode;
  initialDocumentId?: string;
  initialProject?: string;
  onModeChange: (mode: GenerationMode) => void;
  onSelectedDocumentChange: (documentId?: string, replace?: boolean) => void;
  onOpenMaterials: () => void;
  onLeaveGuardChange?: (guard?: () => Promise<boolean>) => void;
}) {
  const [mode, setMode] = useState<GenerationMode>(initialMode);
  const [agents, setAgents] = useState<LogueAgent[]>([]);
  const [runs, setRuns] = useState<LogueAgentRun[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"none" | "recent">("none");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  useEffect(() => {
    if (mode === "documents") { setLoading(false); return; }
    let cancelled = false;
    void Promise.all([getAgents(), getAgentRuns()])
      .then(([nextAgents, nextRuns]) => {
        if (cancelled) return;
        setAgents(nextAgents);
        setRuns(nextRuns);
        setSelectedAgentId((current) => current ?? nextAgents.find((agent) => agent.id === "agt_reply")?.id ?? nextAgents.find((agent) => agent.task === "generate" && agent.enabled)?.id ?? nextAgents[0]?.id);
        setLoading(false);
      })
      .catch((cause) => { if (!cancelled) { setLoadError(cause instanceof Error ? cause.message : "无法载入 Agent"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mode]);

  function changeMode(next: GenerationMode) {
    setMode(next);
    setSelectedRunId(undefined);
    setMobilePanel("none");
    onModeChange(next);
  }

  if (mode === "documents") {
    return (
      <ViewWorkspace
        materials={materials}
        initialDocumentId={initialDocumentId}
        initialProject={initialProject}
        onSelectedDocumentChange={onSelectedDocumentChange}
        onOpenMaterials={onOpenMaterials}
        onLeaveGuardChange={onLeaveGuardChange}
        onOpenGenerate={() => changeMode("new")}
        onManageAgents={() => changeMode("agents")}
      />
    );
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-white text-[#242522] max-[900px]:flex-col">
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-[#e7e7e4] bg-[#f7f7f5] max-[900px]:hidden" aria-label="生成导航">
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <h1 className="text-[12px] font-semibold text-[#555651]">生成</h1>
          <button type="button" onClick={() => changeMode("new")} className="inline-flex size-8 items-center justify-center rounded text-[#777873] hover:bg-[#e8e8e5]" aria-label="新生成"><Plus size={15} /></button>
        </header>
        <nav className="space-y-0.5 px-2.5 pb-3" aria-label="生成区域">
          <button type="button" onClick={() => changeMode("new")} className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[12px] font-medium ${mode === "new" && !selectedRunId ? "bg-[#e7e7e4] text-[#353632]" : "text-[#6d6e69] hover:bg-[#ececea]"}`}><Sparkles size={14} /> 新生成</button>
          <button type="button" onClick={() => changeMode("documents")} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[12px] font-medium text-[#6d6e69] hover:bg-[#ececea]"><FileText size={14} /> 文档</button>
          <button type="button" onClick={() => changeMode("agents")} className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[12px] font-medium ${mode === "agents" ? "bg-[#e7e7e4] text-[#353632]" : "text-[#6d6e69] hover:bg-[#ececea]"}`}><Bot size={14} /> Agents</button>
        </nav>
        <div className="mx-4 border-t border-[#e2e2df] pt-3 text-[10px] font-medium uppercase tracking-[0.1em] text-[#9a9b96]">{mode === "agents" ? "全部 Agents" : "最近生成"}</div>
        <div className="mt-1.5 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? <div className="space-y-1 px-1">{[0, 1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-md bg-[#ecece9]" />)}</div> : mode === "agents" ? agents.map((agent) => (
            <button key={agent.id} type="button" onClick={() => setSelectedAgentId(agent.id)} className={`flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-2 text-left ${agent.id === selectedAgentId ? "bg-[#e7e7e4]" : "hover:bg-[#ececea]"}`}>
              <Bot size={14} className="mt-0.5 shrink-0 text-[#777a72]" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#50514d]">{agent.name}</span><span className="mt-0.5 block truncate text-[9.5px] text-[#979893]">{taskLabels[agent.task]} · {outputLabels[agent.output]}</span></span>
              {!agent.enabled && <span className="mt-0.5 text-[9px] text-[#aaa]">停用</span>}
            </button>
          )) : runs.length ? runs.map((run) => {
            const Icon = outputIcon(run.output_type);
            return <button key={run.id} type="button" onClick={() => { setSelectedRunId(run.id); setMode("new"); }} className={`flex min-h-11 w-full items-start gap-2 rounded-md px-2 py-2 text-left ${run.id === selectedRunId ? "bg-[#e7e7e4]" : "hover:bg-[#ececea]"}`}><Icon size={14} className="mt-0.5 shrink-0 text-[#777a72]" /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#555651]">{run.instruction}</span><span className="mt-0.5 block text-[9.5px] text-[#999a95]">{run.agent_name} · {shortDate(run.created_at)}</span></span></button>;
          }) : <p className="px-3 py-5 text-[10.5px] leading-4 text-[#999a95]">第一次生成后，结果会留在这里。</p>}
        </div>
      </aside>

      <nav className="hidden h-12 shrink-0 items-center gap-1 border-b border-[#e7e7e4] bg-[#fafaf8] px-3 max-[900px]:flex" aria-label="生成区域">
        <button type="button" onClick={() => changeMode("new")} className={`h-9 flex-1 rounded-md text-[11px] font-medium ${mode === "new" && mobilePanel === "none" && !selectedRunId ? "bg-[#e7e7e4] text-[#343530]" : "text-[#757671]"}`}>新生成</button>
        <button type="button" onClick={() => { setMobilePanel("recent"); setSelectedRunId(undefined); }} className={`h-9 flex-1 rounded-md text-[11px] font-medium ${mobilePanel === "recent" || selectedRunId ? "bg-[#e7e7e4] text-[#343530]" : "text-[#757671]"}`}>最近</button>
        <button type="button" onClick={() => changeMode("documents")} className="h-9 flex-1 rounded-md text-[11px] font-medium text-[#757671]">文档</button>
        <button type="button" onClick={() => changeMode("agents")} className={`h-9 flex-1 rounded-md text-[11px] font-medium ${mode === "agents" ? "bg-[#e7e7e4] text-[#343530]" : "text-[#757671]"}`}>Agent</button>
      </nav>

      {loadError ? <main className="flex min-h-0 flex-1 items-center justify-center px-6"><div className="max-w-sm text-center"><p className="text-[13px] text-[#a34b42]">{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 h-8 rounded-md border border-[#ddd] px-3 text-[11px]">重新载入</button></div></main>
        : mobilePanel === "recent" ? (
          <MobileRecentRuns
            loading={loading}
            runs={runs}
            onSelect={(run) => { setSelectedRunId(run.id); setMode("new"); setMobilePanel("none"); }}
            onStart={() => changeMode("new")}
          />
        )
        : mode === "agents" ? (
          <AgentEditor agents={agents} selectedAgentId={selectedAgentId} onSelect={setSelectedAgentId} onAgentsChange={setAgents} />
        ) : selectedRun ? (
          <RunResult run={selectedRun} onRunChange={(updated) => setRuns((current) => current.map((run) => run.id === updated.id ? updated : run))} onOpenDocument={(id) => { onSelectedDocumentChange(id); changeMode("documents"); }} onBack={() => setSelectedRunId(undefined)} />
        ) : (
          <NewGeneration agents={agents} materials={materials} initialProject={initialProject} onCreated={(run) => { setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]); setSelectedRunId(run.id); }} />
        )}
    </div>
  );
}

function MobileRecentRuns({ loading, runs, onSelect, onStart }: { loading: boolean; runs: LogueAgentRun[]; onSelect: (run: LogueAgentRun) => void; onStart: () => void }) {
  return <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white" data-testid="mobile-recent-runs">
    <article className="mx-auto w-full max-w-[760px] px-10 pb-24 pt-12 max-[700px]:px-5 max-[700px]:pt-8">
      <div className="flex items-end justify-between gap-4 border-b border-[#e9e9e6] pb-4">
        <div><h2 className="text-[24px] font-bold tracking-[-0.035em] text-[#242522]">最近生成</h2><p className="mt-1 text-[11px] text-[#92938e]">继续查看、编辑或采用之前的结果。</p></div>
        <button type="button" onClick={onStart} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#242522] px-3 text-[11px] font-medium text-white"><Plus size={13} /> 新生成</button>
      </div>
      <div className="mt-2 divide-y divide-[#eeeeeb]">
        {loading ? [0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse bg-[#f5f5f2] motion-reduce:animate-none" />) : runs.length ? runs.map((run) => {
          const Icon = outputIcon(run.output_type);
          return <button key={run.id} type="button" onClick={() => onSelect(run)} className="group flex min-h-16 w-full items-start gap-3 px-1 py-3 text-left hover:bg-[#f7f7f5]"><span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[#efefec] text-[#70716c]"><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium text-[#444541]">{run.instruction}</span><span className="mt-1 block text-[10.5px] text-[#92938e]">{run.agent_name} · {outputLabels[run.output_type]} · {shortDate(run.created_at)}</span></span><span className="mt-2 text-[11px] text-[#aaa] group-hover:text-[#666]">打开</span></button>;
        }) : <div className="py-16 text-center"><p className="text-[12px] font-medium text-[#555651]">还没有生成记录</p><p className="mt-1 text-[10.5px] text-[#999a95]">第一次生成后，结果会留在这里。</p></div>}
      </div>
    </article>
  </main>;
}

function NewGeneration({ agents, materials, initialProject, onCreated }: { agents: LogueAgent[]; materials: Material[]; initialProject?: string; onCreated: (run: LogueAgentRun) => void }) {
  const generationAgents = agents.filter((agent) => agent.enabled && agent.task === "generate" && agent.surfaces.includes("web"));
  const [agentId, setAgentId] = useState(generationAgents.find((agent) => agent.id === "agt_reply")?.id ?? generationAgents[0]?.id ?? "");
  const [instruction, setInstruction] = useState("");
  const [project, setProject] = useState(initialProject ?? "");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [showSources, setShowSources] = useState(Boolean(initialProject));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const projects = useMemo(() => Array.from(new Set(materials.flatMap((item) => item.projects))).sort(), [materials]);
  const visibleSources = useMemo(() => {
    const normalized = sourceQuery.trim().toLowerCase();
    const filtered = materials.filter((item) =>
      (!project || item.projects.includes(project)) &&
      (!normalized || [item.content, item.source?.title, ...item.tags].filter(Boolean).some((value) => value!.toLowerCase().includes(normalized))),
    );
    return groupIdenticalMaterials(filtered).slice(0, 30).flatMap((group) => group.items);
  }, [materials, project, sourceQuery]);

  useEffect(() => {
    if (!agentId && generationAgents.length) setAgentId(generationAgents.find((item) => item.id === "agt_reply")?.id ?? generationAgents[0].id);
  }, [agentId, generationAgents]);

  useEffect(() => {
    if (!project || sourceIds.length) return;
    setSourceIds(groupIdenticalMaterials(materials.filter((item) => item.projects.includes(project))).slice(0, 3).map((group) => group.representative.id));
  }, [materials, project, sourceIds.length]);

  async function run() {
    if (!agentId || !instruction.trim() || running) return;
    setRunning(true); setError(undefined);
    try { onCreated(await createAgentRun({ agent_id: agentId, instruction: instruction.trim(), project, source_ids: sourceIds })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "生成失败"); }
    finally { setRunning(false); }
  }

  const agent = generationAgents.find((item) => item.id === agentId);
  return <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white">
    <article className="mx-auto w-full max-w-[760px] px-10 pb-24 pt-16 max-[700px]:px-5 max-[700px]:pt-9">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#eeeeeb] text-[#61635d]"><Sparkles size={19} /></span>
      <h2 className="mt-5 text-[34px] font-bold tracking-[-0.045em] text-[#242522] max-[640px]:text-[28px]">想生成什么？</h2>
      <p className="mt-2 text-[12px] leading-5 text-[#858680]">选择一个 Agent。回复、问答和文档都保留实际使用的资料来源。</p>
      <div className="mt-9 grid grid-cols-[160px_1fr] gap-6 max-[640px]:grid-cols-1 max-[640px]:gap-2">
        <label className="pt-2 text-[11px] font-medium text-[#6e706a]" htmlFor="generation-agent">Agent</label>
        <div><select id="generation-agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[12px] font-medium text-[#41423e] outline-none focus:border-[#aaa]"><option value="">选择 Agent</option>{generationAgents.map((item) => <option key={item.id} value={item.id}>{item.name} · {outputLabels[item.output]}</option>)}</select>{agent && <p className="mt-1.5 text-[10.5px] leading-4 text-[#999a95]">{agent.purpose}</p>}</div>
        <label className="pt-2 text-[11px] font-medium text-[#6e706a]" htmlFor="generation-instruction">这次要做什么</label>
        <textarea id="generation-instruction" autoFocus value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：根据这些资料，起草一条简洁但不生硬的回复" className="min-h-28 w-full resize-y rounded-md border border-[#dcdcd8] px-3.5 py-3 text-[13px] leading-6 outline-none placeholder:text-[#aaa] focus:border-[#aaa]" />
        <label className="pt-2 text-[11px] font-medium text-[#6e706a]" htmlFor="generation-project">项目</label>
        <select id="generation-project" value={project} onChange={(event) => { setProject(event.target.value); setSourceIds([]); }} className="h-10 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[12px] text-[#555651] outline-none focus:border-[#aaa]"><option value="">不限定项目</option>{projects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      <section className="mt-6 border-t border-[#e9e9e6] pt-4">
        <button type="button" onClick={() => setShowSources((value) => !value)} className="flex w-full items-center justify-between py-1 text-left"><span><span className="text-[11px] font-medium text-[#666762]">使用资料</span><span className="ml-2 text-[10px] text-[#999a95]">{sourceIds.length} 条</span></span><span className="text-[10px] text-[#888984]">{showSources ? "收起" : "选择"}</span></button>
        {showSources && <div className="mt-3 rounded-md border border-[#e1e1dd] p-2"><label className="relative block"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" /><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="搜索资料" className="h-8 w-full rounded bg-[#f5f5f2] pl-8 pr-2 text-[11px] outline-none" /></label><div className="mt-1 max-h-52 overflow-y-auto"><MaterialGroupPicker materials={visibleSources} selectedIds={sourceIds} onChange={setSourceIds} getLabel={(item) => item.content} /></div></div>}
      </section>
      {error && <p className="mt-5 rounded-md bg-[#fbefec] px-3 py-2.5 text-[11px] leading-4 text-[#a34b42]">{error}</p>}
      <div className="mt-7 flex justify-end"><button type="button" onClick={() => void run()} disabled={!agentId || !instruction.trim() || running} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#242522] px-4 text-[12px] font-medium text-white hover:bg-[#383934] disabled:cursor-not-allowed disabled:bg-[#c9cac5]">{running ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}{running ? "正在生成…" : "生成"}</button></div>
    </article>
  </main>;
}

function RunResult({ run, onRunChange, onOpenDocument, onBack }: { run: LogueAgentRun; onRunChange: (run: LogueAgentRun) => void; onOpenDocument: (id: string) => void; onBack: () => void }) {
  const [draft, setDraft] = useState(run.adopted_output || run.original_output || "");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setDraft(run.adopted_output || run.original_output || ""); }, [run]);
  async function copy() { const updated = await adoptAgentRun(run.id, draft); onRunChange(updated); await navigator.clipboard.writeText(draft); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white"><header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#eeeeeb] bg-white/92 px-5 backdrop-blur"><button type="button" onClick={onBack} className="text-[11px] font-medium text-[#777873] hover:text-[#3e3f3b]">← 新生成</button><span className="text-[10.5px] text-[#999a95]">{run.agent_name} · v{run.agent_revision}</span></header><article className="mx-auto w-full max-w-[820px] px-[9%] pb-24 pt-14 max-[700px]:px-5 max-[700px]:pt-9"><div className="flex items-center gap-2 text-[11px] text-[#777873]"><Sparkles size={14} /><span>{outputLabels[run.output_type]}</span>{run.project && <><span>·</span><span>{run.project}</span></>}</div><h2 className="mt-4 text-[32px] font-bold tracking-[-0.04em] text-[#242522] max-[640px]:text-[27px]">{run.instruction}</h2><p className="mt-2 text-[10.5px] text-[#999a95]">使用 {run.sources.length} 条资料 · {new Date(run.created_at).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p><section className="mt-9"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-72 w-full resize-y border-0 bg-transparent text-[14px] leading-7 text-[#30312d] outline-none" aria-label="生成结果" /></section><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e9e6] pt-4"><button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d8d8d3] px-3 text-[11px] font-medium text-[#555651] hover:bg-[#f4f4f1]">{copied ? <CheckCircle2 size={13} className="text-[#5e835f]" /> : <Clipboard size={13} />}{copied ? "已复制" : "复制结果"}</button>{run.document_id && <button type="button" onClick={() => onOpenDocument(run.document_id!)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[11px] font-medium text-white"><FileText size={13} /> 打开文档</button>}</div>{run.sources.length > 0 && <details className="mt-8 border-t border-[#eeeeeb] pt-4"><summary className="cursor-pointer text-[11px] font-medium text-[#666762]">查看实际使用的资料</summary><div className="mt-3 space-y-2">{run.sources.map((source, index) => <div key={source.id} className="border-l-2 border-[#dedeea] pl-3"><p className="text-[10px] font-medium text-[#696a65]">来源 {index + 1}</p><p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#858680]">{source.content}</p></div>)}</div></details>}</article></main>;
}

function AgentEditor({ agents, selectedAgentId, onSelect, onAgentsChange }: { agents: LogueAgent[]; selectedAgentId?: string; onSelect: (id: string) => void; onAgentsChange: (agents: LogueAgent[]) => void }) {
  const selected = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const [draft, setDraft] = useState<LogueAgent | undefined>(selected);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [defaultNotice, setDefaultNotice] = useState<string>();
  const dirtyRef = useRef(false);
  useEffect(() => { setDraft(selected); dirtyRef.current = false; setSaveState("saved"); }, [selected?.id, selected?.revision]);
  useEffect(() => {
    if (!draft || !dirtyRef.current || saveState !== "dirty") return;
    const timer = window.setTimeout(() => { setSaveState("saving"); void updateAgent(draft.id, { name: draft.name, purpose: draft.purpose, instructions: draft.instructions, task: draft.task, output: draft.output, surfaces: draft.surfaces, contexts: draft.contexts, enabled: draft.enabled, expected_revision: draft.revision }).then((saved) => { dirtyRef.current = false; setDraft(saved); onAgentsChange(agents.map((agent) => agent.id === saved.id ? saved : agent)); setSaveState("saved"); }).catch(() => setSaveState("error")); }, 650);
    return () => window.clearTimeout(timer);
  }, [agents, draft, onAgentsChange, saveState]);
  function change(changes: Partial<LogueAgent>) { if (!draft) return; dirtyRef.current = true; setDraft({ ...draft, ...changes }); setSaveState("dirty"); }
  async function duplicate() { if (!draft) return; const copy = await createAgent({ name: `${draft.name} 副本`, purpose: draft.purpose, instructions: draft.instructions, task: draft.task, output: draft.output, surfaces: draft.surfaces, contexts: draft.contexts, enabled: true }); onAgentsChange([...agents, copy]); onSelect(copy.id); }
  async function setDefault() { if (!draft) return; const settings = await getWorkspaceSettings(); const changes = draft.task === "transcribe" ? { default_transcription_agent: draft.id } : draft.task === "organize" ? { default_organization_agent: draft.id } : { default_extension_agent: draft.id }; await saveWorkspaceSettings({ ...settings, ...changes }); setDefaultNotice(draft.task === "transcribe" ? "已设为默认转写" : draft.task === "organize" ? "已设为自动整理" : "已设为 Extension 默认"); window.setTimeout(() => setDefaultNotice(undefined), 1800); }
  if (!draft) return <main className="flex flex-1 items-center justify-center text-[12px] text-[#999]">还没有 Agent</main>;
  const toggle = <T extends string>(items: T[], value: T) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
  return <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white"><header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#eeeeeb] bg-white/92 px-5 backdrop-blur"><span className={`inline-flex items-center gap-1 text-[10.5px] ${saveState === "error" ? "text-[#a34b42]" : "text-[#8d8e89]"}`}>{saveState === "saved" && <Check size={12} />}{saveState === "saving" ? "保存中…" : saveState === "dirty" ? "未保存" : saveState === "error" ? "保存失败" : "已保存"}</span><div className="flex items-center gap-1.5"><button type="button" onClick={() => void duplicate()} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10.5px] font-medium text-[#666762] hover:bg-[#f1f1ee]"><Copy size={12} /> 复制</button><button type="button" onClick={() => void setDefault()} disabled={!draft.enabled || (draft.task === "generate" && !draft.surfaces.includes("extension"))} className="h-8 rounded-md bg-[#242522] px-3 text-[10.5px] font-medium text-white disabled:bg-[#c8c9c4]">{draft.task === "transcribe" ? "设为默认转写" : draft.task === "organize" ? "设为自动整理" : "设为扩展默认"}</button></div></header><article className="mx-auto w-full max-w-[820px] px-[9%] pb-24 pt-12 max-[700px]:px-5 max-[700px]:pt-8"><select value={draft.id} onChange={(event) => onSelect(event.target.value)} className="mb-5 hidden h-11 w-full rounded-md border border-[#dcdcd8] bg-white px-3 text-[12px] max-[900px]:block" aria-label="选择 Agent">{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><div className="flex items-center gap-2 text-[10.5px] text-[#8d8e89]"><Bot size={14} /><span>{draft.system ? "Logue 默认 · 可直接编辑" : "自定义 Agent"}</span>{defaultNotice && <span className="text-[#5d805e]">· {defaultNotice}</span>}</div><input value={draft.name} onChange={(event) => change({ name: event.target.value })} className="mt-4 w-full border-0 bg-transparent text-[38px] font-bold tracking-[-0.045em] text-[#242522] outline-none max-[640px]:text-[30px]" /><input value={draft.purpose} onChange={(event) => change({ purpose: event.target.value })} className="mt-3 w-full border-0 bg-transparent text-[13px] text-[#777873] outline-none placeholder:text-[#aaa]" placeholder="一句话说明这个 Agent 做什么" /><section className="mt-9"><h3 className="text-[11px] font-semibold text-[#5c5d58]">指令</h3><textarea value={draft.instructions} onChange={(event) => change({ instructions: event.target.value })} className="mt-2 min-h-56 w-full resize-y rounded-md border border-[#e0e0dc] px-3.5 py-3 text-[12.5px] leading-6 text-[#343531] outline-none focus:border-[#aaa]" /></section><section className="mt-8 grid grid-cols-[160px_1fr] gap-x-7 gap-y-5 border-t border-[#e9e9e6] pt-7 max-[640px]:grid-cols-1 max-[640px]:gap-y-2"><span className="pt-2 text-[11px] font-medium text-[#6e706a]">工作方式</span><div className="grid grid-cols-2 gap-2"><label className="space-y-1"><span className="block text-[9.5px] text-[#969792]">任务</span><select aria-label="任务" value={draft.task} onChange={(event) => change({ task: event.target.value as AgentTask })} className="h-9 w-full rounded-md border border-[#dcdcd8] bg-white px-2.5 text-[11px]"><option value="transcribe">转写</option><option value="organize">自动整理</option><option value="generate">生成</option></select></label><label className="space-y-1"><span className="block text-[9.5px] text-[#969792]">输出</span><select aria-label="输出" value={draft.output} onChange={(event) => change({ output: event.target.value as AgentOutput })} className="h-9 w-full rounded-md border border-[#dcdcd8] bg-white px-2.5 text-[11px]"><option value="insert">可插入文字</option><option value="material">新资料</option><option value="qa">问答</option><option value="document">文档</option></select></label></div><span className="pt-1 text-[11px] font-medium text-[#6e706a]">可用位置</span><div className="flex flex-wrap gap-1.5">{(Object.keys(surfaceLabels) as AgentSurface[]).map((surface) => <button key={surface} type="button" onClick={() => change({ surfaces: toggle(draft.surfaces, surface) })} aria-pressed={draft.surfaces.includes(surface)} className={`h-8 rounded-md border px-2.5 text-[10.5px] ${draft.surfaces.includes(surface) ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] text-[#777873]"}`}>{surfaceLabels[surface]}</button>)}</div><span className="pt-1 text-[11px] font-medium text-[#6e706a]">可用上下文</span><div className="flex flex-wrap gap-1.5">{(Object.keys(contextLabels) as AgentContext[]).map((context) => <button key={context} type="button" onClick={() => change({ contexts: toggle(draft.contexts, context) })} aria-pressed={draft.contexts.includes(context)} className={`h-8 rounded-md border px-2.5 text-[10.5px] ${draft.contexts.includes(context) ? "border-[#c7c7dc] bg-[#f0f0f8] text-[#5e61a0]" : "border-[#deded9] text-[#777873]"}`}>{contextLabels[context]}</button>)}</div><span className="pt-1 text-[11px] font-medium text-[#6e706a]">状态</span><button type="button" onClick={() => change({ enabled: !draft.enabled })} className={`flex h-9 items-center justify-between rounded-md border px-3 text-[11px] ${draft.enabled ? "border-[#b9c4b8] bg-[#edf2eb] text-[#4f684f]" : "border-[#deded9] text-[#777873]"}`}><span>{draft.enabled ? "已启用" : "已停用"}</span><span className={`h-4 w-7 rounded-full p-0.5 ${draft.enabled ? "bg-[#708972]" : "bg-[#c8c8c3]"}`}><span className={`block size-3 rounded-full bg-white transition ${draft.enabled ? "translate-x-3" : ""}`} /></span></button></section></article></main>;
}
