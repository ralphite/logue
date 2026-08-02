import { AlertCircle, Check, Copy, LoaderCircle, Sparkles, X } from "lucide-react";

export type AgentGenerationPhase = "ready" | "generating" | "result" | "error";

export interface ExtensionAgentOption {
  id: string;
  name: string;
  purpose?: string;
}

export interface AgentGenerationPanelProps {
  agents: ExtensionAgentOption[];
  selectedAgentId: string;
  instruction: string;
  output: string;
  phase: AgentGenerationPhase;
  contextLabel?: string;
  errorMessage?: string;
  onAgentChange: (id: string) => void;
  onInstructionChange: (value: string) => void;
  onOutputChange: (value: string) => void;
  onGenerate: () => void;
  onInsert: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function AgentGenerationPanel({
  agents,
  selectedAgentId,
  instruction,
  output,
  phase,
  contextLabel,
  errorMessage,
  onAgentChange,
  onInstructionChange,
  onOutputChange,
  onGenerate,
  onInsert,
  onCopy,
  onRetry,
  onClose,
}: AgentGenerationPanelProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const canGenerate = Boolean(selectedAgentId && instruction.trim());

  return (
    <aside className="w-full bg-white text-[#242522]" aria-label="Logue Agent 生成">
      <header className="flex items-center gap-2 border-b border-[#e8e8e4] px-3.5 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#f0f0ff] text-[#555ee7]">
          <Sparkles size={14} />
        </span>
        <select
          aria-label="选择 Agent"
          value={selectedAgentId}
          onChange={(event) => onAgentChange(event.target.value)}
          disabled={phase === "generating"}
          className="min-w-0 flex-1 appearance-none truncate bg-transparent text-[12px] font-semibold text-[#343531] outline-none disabled:opacity-60"
        >
          {agents.length === 0 && <option value="">没有可用 Agent</option>}
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#8c8d87] hover:bg-[#f3f3f0] hover:text-[#444540] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5b64f4]"
        >
          <X size={14} />
        </button>
      </header>

      {phase === "generating" ? (
        <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center" aria-live="polite">
          <LoaderCircle size={20} className="animate-spin text-[#5b64f4] motion-reduce:animate-none" />
          <p className="mt-3 text-[12px] font-medium text-[#454642]">{selectedAgent?.name || "Agent"} 正在生成…</p>
          <p className="mt-1 text-[10.5px] text-[#93948e]">正在理解当前页面与相关资料</p>
        </div>
      ) : phase === "result" ? (
        <div className="p-3">
          {errorMessage && (
            <div className="mb-2.5 flex gap-2 rounded-lg bg-[#fbefec] p-2.5 text-[#9d453d]" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p className="text-[10px] leading-4 text-[#8d625d]">{errorMessage}</p>
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[#9a9b95]">生成结果</span>
            <textarea
              aria-label="生成结果"
              value={output}
              onChange={(event) => onOutputChange(event.target.value)}
              rows={7}
              autoFocus
              className="block w-full resize-none rounded-lg border border-[#deded9] bg-[#fbfbf9] px-3 py-2.5 text-[12px] leading-[1.65] text-[#30312d] outline-none transition focus:border-[#a9acef] focus:bg-white focus:ring-2 focus:ring-[#5b64f4]/10"
            />
          </label>
          <p className="mt-2 truncate px-1 text-[9.5px] text-[#999a94]" title={contextLabel}>{contextLabel || "当前页面"}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={onCopy} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[10.5px] text-[#6f706b] hover:bg-[#f4f4f1]">
              <Copy size={12} /> 复制
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[10.5px] text-[#71726d] hover:bg-[#f4f4f1]">取消</button>
              <button
                type="button"
                onClick={onInsert}
                disabled={!output.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#242522] px-3.5 text-[10.5px] font-semibold text-white hover:bg-[#11120f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={12} /> 插入输入框
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3">
          {phase === "error" && (
            <div className="mb-2.5 flex gap-2 rounded-lg bg-[#fbefec] p-2.5 text-[#9d453d]" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold">生成没有完成</p>
                <p className="mt-0.5 text-[10px] leading-4 text-[#8d625d]">{errorMessage || "请稍后重试。"}</p>
              </div>
              <button type="button" onClick={onRetry} className="h-7 shrink-0 rounded-md bg-white/70 px-2 text-[10px] font-medium">重试</button>
            </div>
          )}
          <label className="block">
            <span className="sr-only">告诉 Agent 要生成什么</span>
            <textarea
              aria-label="告诉 Agent 要生成什么"
              value={instruction}
              onChange={(event) => onInstructionChange(event.target.value)}
              rows={4}
              autoFocus
              placeholder="告诉 Agent 要生成什么…"
              className="block w-full resize-none border-0 bg-transparent px-1 py-1 text-[12px] leading-[1.65] text-[#30312d] outline-none placeholder:text-[#aaaBA5]"
            />
          </label>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#eeeeea] pt-2.5">
            <p className="min-w-0 truncate text-[9.5px] text-[#999a94]" title={contextLabel}>
              {contextLabel || "自动使用当前页面上下文"}
            </p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#5b64f4] px-3.5 text-[10.5px] font-semibold text-white hover:bg-[#4d56e7] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={12} /> 生成
            </button>
          </div>
          {selectedAgent?.purpose && <p className="mt-2 truncate px-1 text-[9.5px] text-[#aaaBA5]">{selectedAgent.purpose}</p>}
        </div>
      )}

      <footer className="border-t border-[#eeeeea] px-3.5 py-2 text-[9px] text-[#a3a49e]">结果只会插入，不会自动发送</footer>
    </aside>
  );
}
