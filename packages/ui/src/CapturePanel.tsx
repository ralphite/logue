import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleStop,
  LoaderCircle,
  Mic,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { ContextChips } from "./ContextChips";
import { LogueLogo } from "./Logo";
import type { CapturePhase, ContextSource } from "./types";
import { cn } from "./utils";

export interface CapturePanelProps {
  phase: CapturePhase;
  contexts: ContextSource[];
  selectedText?: string;
  draft: string;
  transcript?: string;
  elapsedSeconds?: number;
  errorMessage?: string;
  errorKind?: "transcription" | "microphone" | "save" | "target";
  serviceConnected?: boolean;
  committing?: boolean;
  projectOptions?: Array<{ value: string; label: string }>;
  selectedProject?: string;
  selectedProjects?: string[];
  tags?: string[];
  onDraftChange: (value: string) => void;
  onTranscriptChange?: (value: string) => void;
  onClose: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onUseTranscript: () => void;
  onRetry: () => void;
  onDeleteRecording: () => void;
  onPrimary: () => void;
  onProjectChange?: (value: string) => void;
  onSelectedProjectsChange?: (value: string[]) => void;
  onTagsChange?: (value: string[]) => void;
  onRemoveContext?: (id: string) => void;
}

function formatDuration(value = 0) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function Waveform() {
  return (
    <span className="flex h-7 items-center gap-[3px]" aria-hidden="true">
      {[8, 14, 20, 12, 18, 10, 16, 7, 13].map((height, index) => (
        <span key={`${height}-${index}`} className="logue-wave block w-[3px] rounded-full bg-current motion-reduce:animate-none" style={{ height, animationDelay: `${index * 70}ms` }} />
      ))}
    </span>
  );
}

function errorTitle(kind: NonNullable<CapturePanelProps["errorKind"]>) {
  if (kind === "target") return "输入框已不可用";
  if (kind === "save") return "尚未保存";
  if (kind === "microphone") return "无法开始录音";
  return "转写失败";
}

export function CapturePanel(props: CapturePanelProps) {
  const {
    phase,
    contexts,
    selectedText,
    draft,
    transcript = "",
    elapsedSeconds,
    errorMessage,
    errorKind = "transcription",
    serviceConnected = true,
    committing = false,
    projectOptions = [],
    selectedProject = "",
    selectedProjects = [],
    tags = [],
  } = props;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filingOpen, setFilingOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  function toggleSelectedProject(project: string) {
    props.onSelectedProjectsChange?.(
      selectedProjects.includes(project)
        ? selectedProjects.filter((item) => item !== project)
        : [...selectedProjects, project],
    );
  }

  function addTag() {
    const value = tagDraft.trim().replace(/^#/, "");
    if (!value || tags.includes(value)) return;
    props.onTagsChange?.([...tags, value]);
    setTagDraft("");
  }

  const isBusy = phase === "recording" || phase === "processing";
  const primaryLabel = draft.trim() ? "保存原文与批注" : "保存选区";
  const primaryDisabled =
    isBusy || committing || phase === "review" || !serviceConnected ||
    (phase === "error" && errorKind === "transcription") ||
    !selectedText?.trim();
  const referenceCount = contexts.length;

  return (
    <aside className="flex max-h-[min(720px,calc(100vh-24px))] w-full flex-col overflow-hidden bg-white text-[#242522]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#ecece8] px-3">
        <LogueLogo />
        <button type="button" onClick={() => setDetailsOpen((value) => !value)} className="ml-auto flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-[10.5px] text-[#777873] hover:bg-[#f2f2ef]" aria-expanded={detailsOpen} aria-label="查看本次参考">
          <span>参考{referenceCount ? ` ${referenceCount}` : ""}</span>
          <ChevronDown size={12} className={cn("shrink-0 transition", detailsOpen && "rotate-180")} />
        </button>
        {!serviceConnected && <span className="size-2 shrink-0 rounded-full bg-[#cc554b]" title="本机服务未连接" />}
        <button type="button" onClick={props.onClose} className="rounded-md p-1.5 text-[#858680] hover:bg-[#f1f1ee] hover:text-[#444541]" aria-label="关闭 Logue"><X size={15} /></button>
      </header>

      {detailsOpen && (
        <section className="shrink-0 border-b border-[#ecece8] bg-[#fafaf8] px-3 py-3">
          <p className="mb-2 text-[10px] font-medium text-[#888984]">只发送下列参考，不读取整张网页</p>
          <ContextChips items={contexts} onRemove={props.onRemoveContext} />
          {projectOptions.length > 0 && (
            <label className="mt-2.5 flex items-center justify-between gap-3 border-t border-[#e6e6e1] pt-2.5"><span className="text-[10.5px] text-[#777873]">参考项目</span><select value={selectedProject} onChange={(event) => props.onProjectChange?.(event.target.value)} className="h-7 max-w-[190px] rounded-md border border-[#dcdcd7] bg-white px-2 text-[10.5px] outline-none"><option value="">不使用项目</option>{projectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          )}
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedText && (
          <>
            <section className="mb-2.5 rounded-md bg-[#f5f5f2] px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between text-[9.5px] font-medium text-[#92938e]"><span>已选原文</span><span>完整原文 · 只读</span></div>
              <blockquote className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-[#b3b4ae] pl-2.5 pr-1 text-[11.5px] leading-5 text-[#555651]">{selectedText}</blockquote>
            </section>
            <section className="mb-3 rounded-md border border-[#e7e7e3]">
              <button type="button" onClick={() => setFilingOpen((value) => !value)} aria-expanded={filingOpen} aria-label="设置归入" className="flex h-9 w-full items-center gap-2 px-3 text-left text-[10.5px] text-[#6f706b] hover:bg-[#fafaf8]">
                <span className="font-medium text-[#555651]">归入</span>
                <span className="min-w-0 flex-1 truncate text-[#92938e]">{selectedProjects.length || tags.length ? [selectedProjects.length ? `${selectedProjects.length} 个项目` : "", tags.length ? `${tags.length} 个标签` : ""].filter(Boolean).join(" · ") : "未归项目"}</span>
                <ChevronDown size={12} className={cn("shrink-0 transition", filingOpen && "rotate-180")} />
              </button>
              {filingOpen && (
                <div className="space-y-3 border-t border-[#ecece8] px-3 py-3">
                  <div>
                    <p className="mb-1.5 text-[9.5px] font-medium text-[#8c8d88]">项目 <span className="font-normal text-[#aaa]">可多选</span></p>
                    {projectOptions.length ? <div className="flex flex-wrap gap-1.5">{projectOptions.map((option) => { const selected = selectedProjects.includes(option.value); return <button key={option.value} type="button" aria-pressed={selected} onClick={() => toggleSelectedProject(option.value)} className={cn("h-7 rounded-md border px-2.5 text-[10.5px] transition", selected ? "border-[#a7a8a2] bg-[#eeeeeb] text-[#444541]" : "border-[#deded9] text-[#777873] hover:bg-[#f7f7f5]")}>{option.label}</button>; })}</div> : <p className="text-[10px] text-[#aaa]">暂无项目</p>}
                  </div>
                  <div>
                    <p className="mb-1.5 text-[9.5px] font-medium text-[#8c8d88]">标签</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tags.map((tag) => <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e0e1dc] px-2.5 text-[10.5px] text-[#74786f]">#{tag}<button type="button" onClick={() => props.onTagsChange?.(tags.filter((item) => item !== tag))} className="text-[#a0a19c] hover:text-[#555651]" aria-label={`移除标签 ${tag}`}><X size={10} /></button></span>)}
                      <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }} onBlur={addTag} className="h-7 min-w-28 flex-1 rounded-md border border-[#deded9] px-2.5 text-[10.5px] outline-none placeholder:text-[#a8a9a4] focus:border-[#aaa]" placeholder="添加标签后按 Enter" aria-label="添加标签" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {phase === "recording" ? (
          <section className="py-2">
            <div className="flex items-center justify-between rounded-lg bg-[#fff4f1] px-4 py-4 text-[#cc493d]"><span className="flex items-center gap-3"><span className="relative flex size-9 items-center justify-center rounded-full bg-white"><span className="absolute size-3 animate-ping rounded-full bg-[#e44c3f]/35 motion-reduce:animate-none" /><span className="relative size-3 rounded-full bg-[#e44c3f]" /></span><span><span className="block text-[12.5px] font-semibold">正在录音</span><span className="mt-0.5 block font-mono text-[11px] text-[#a75a52]">{formatDuration(elapsedSeconds)}</span></span></span><Waveform /></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={props.onCancelRecording} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#deded9] text-[11px] font-medium text-[#6b6c67] hover:bg-[#f6f6f3]"><X size={13} /> 取消</button><button type="button" onClick={props.onStopRecording} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#d94b3f] text-[11px] font-medium text-white hover:bg-[#c84237]"><CircleStop size={13} /> 停止</button></div>
          </section>
        ) : phase === "processing" ? (
          <section className="flex items-center gap-3 py-5"><LoaderCircle size={19} className="animate-spin text-[#666762] motion-reduce:animate-none" /><div><p className="text-[12px] font-medium text-[#454642]">正在转写…</p><p className="mt-0.5 text-[10px] text-[#92938e]">音频已发送到本机服务</p></div></section>
        ) : phase === "review" ? (
          <section>
            <label className="mb-1.5 block text-[10px] font-medium text-[#858680]" htmlFor="logue-transcript">检查转写</label>
            <textarea id="logue-transcript" autoFocus value={transcript} onChange={(event) => props.onTranscriptChange?.(event.target.value)} className="min-h-28 w-full resize-y rounded-md border border-[#dcdcd7] px-3 py-2.5 text-[13px] leading-5 outline-none focus:border-[#aaa]" />
            <div className="mt-3 flex items-center justify-between gap-2"><div className="flex gap-1"><button type="button" onClick={props.onDeleteRecording} disabled={committing} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10.5px] text-[#777873] hover:bg-[#f1f1ee] disabled:opacity-40"><X size={12} /> 取消</button><button type="button" onClick={props.onStartRecording} disabled={committing} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10.5px] text-[#6f706b] hover:bg-[#f1f1ee] disabled:opacity-40"><RotateCcw size={12} /> 重录</button></div><button type="button" onClick={props.onUseTranscript} disabled={!transcript.trim() || committing} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[11px] font-medium text-white hover:bg-[#393a36] disabled:bg-[#bdbdb8]">{committing ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} {committing ? "处理中…" : "保存原文与批注"}</button></div>
          </section>
        ) : phase === "error" ? (
          <section className="rounded-md bg-[#fbefec] p-3"><div className="flex gap-2.5 text-[#a9473e]"><AlertCircle size={16} className="mt-0.5 shrink-0" /><div><p className="text-[11.5px] font-semibold">{errorTitle(errorKind)}</p><p className="mt-0.5 text-[10.5px] leading-4 text-[#8d625d]">{errorMessage || "内容仍保留，可重试。"}</p></div></div><div className="mt-3 flex justify-end gap-1.5">{errorKind === "transcription" && <button type="button" onClick={props.onDeleteRecording} disabled={committing} className="h-8 rounded-md px-2.5 text-[10.5px] text-[#855d58] hover:bg-white/60 disabled:opacity-40">删除录音</button>}<button type="button" onClick={props.onRetry} disabled={committing} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#242522] px-3 text-[10.5px] font-medium text-white disabled:bg-[#bdbdb8]">{committing ? <LoaderCircle size={12} className="animate-spin" /> : <RotateCcw size={12} />} {committing ? "处理中…" : errorKind === "save" ? "重新保存" : errorKind === "microphone" ? "再次录音" : "重新转写"}</button></div></section>
        ) : (
          <section>
            <textarea id="logue-draft" autoFocus value={draft} onChange={(event) => props.onDraftChange(event.target.value)} disabled={isBusy} placeholder="添加批注（可选）" className="min-h-20 w-full resize-y border-0 bg-transparent px-1 py-1 text-[13px] leading-5 text-[#353632] outline-none placeholder:text-[#aaa] disabled:text-[#777]" />
            {!serviceConnected && <p className="mb-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[10px] text-[#a34a42]">本机服务未连接。启动 Logue 后可继续。</p>}
            <div className="flex items-center justify-between border-t border-[#ecece8] pt-2.5"><button type="button" onClick={props.onStartRecording} disabled={!serviceConnected || committing} className="inline-flex size-9 items-center justify-center rounded-full bg-[#f0f0ed] text-[#555651] hover:bg-[#e6e6e2] disabled:opacity-40" aria-label="开始语音"><Mic size={16} /></button><button type="button" onClick={props.onPrimary} disabled={primaryDisabled} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[11px] font-medium text-white hover:bg-[#393a36] disabled:cursor-not-allowed disabled:bg-[#bdbdb8]">{committing && <LoaderCircle size={12} className="animate-spin" />}{committing ? "处理中…" : primaryLabel}</button></div>
          </section>
        )}
      </div>
    </aside>
  );
}
