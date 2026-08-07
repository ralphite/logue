import { Clipboard, FileText, LoaderCircle, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductStatus } from "./ProductStatus";

export type SelectionActionBusy = "primary" | "copy" | "keep" | "document";

export interface SelectionActionDocument {
  id: string;
  title: string;
  project?: string;
  revision: number;
}

export function SelectionActionCandidate({ skillName, text, primaryAction, anchor, busyAction, error, project, documents = [], keepUndoAvailable = false, documentUndoAvailable = false, documentUndoAction = "replace", onTextChange, onPrimary, onCopy, onKeep, onUndoKeep, onSaveDocument, onUndoDocument, onCancel }: {
  skillName: string;
  text: string;
  primaryAction: "Replace" | "Insert" | "Copy";
  anchor: { left: number; top: number };
  busyAction?: SelectionActionBusy;
  error?: string;
  project?: string;
  documents?: SelectionActionDocument[];
  keepUndoAvailable?: boolean;
  documentUndoAvailable?: boolean;
  documentUndoAction?: "document" | "replace";
  onTextChange: (text: string) => void;
  onPrimary: () => void;
  onCopy: () => void;
  onKeep: () => void;
  onUndoKeep?: () => void;
  onSaveDocument: (document?: SelectionActionDocument) => void;
  onUndoDocument?: () => void;
  onCancel: () => void;
}) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const busy = Boolean(busyAction);
  const projectDocuments = documents.filter((document) => document.project === project);
  useEffect(() => { editorRef.current?.focus({ preventScroll: true }); }, []);
  return <section
    className="fixed z-[var(--logue-overlay-layer,2147483644)] w-[min(390px,calc(100vw-16px))] rounded-xl border border-[#ddddda] bg-white p-3 shadow-[0_16px_42px_rgba(20,21,18,0.2)]"
    style={{ left: Math.max(8, Math.min(anchor.left, window.innerWidth - 398)), top: Math.max(8, Math.min(anchor.top, window.innerHeight - 330)) }}
    aria-label={`${skillName} result`}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <ProductStatus
      message={
        busyAction
          ? busyAction === "document"
            ? "Saving result as a Document…"
            : busyAction === "keep"
              ? "Saving result in Logue…"
              : busyAction === "copy"
                ? "Copying result…"
                : `${primaryAction} in progress…`
          : `${skillName} result ready.`
      }
    />
    <header className="mb-2 flex items-center justify-between gap-3">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[#666762]"><Sparkles size={13} /><span className="truncate">{skillName}</span></span>
      <button type="button" onClick={onCancel} disabled={busy} className="inline-flex size-7 items-center justify-center rounded text-[#8b8c87] hover:bg-[#f1f1ee]" aria-label="Cancel result"><X size={15} /></button>
    </header>
    <textarea ref={editorRef} value={text} onChange={(event) => onTextChange(event.target.value)} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onCancel(); }
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onPrimary(); }
    }} className="min-h-32 w-full resize-y rounded-lg border border-[#deded9] bg-[#fcfcfa] px-3 py-2.5 text-[14px] leading-5 text-[#30312d] outline-none focus:border-[#aaa]" aria-label="Skill result" />
    {error && <p role="alert" className="mt-2 rounded-md bg-[#fbefec] px-2.5 py-2 text-[13px] leading-4 text-[#a34b42]">{error}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={keepUndoAvailable ? onUndoKeep : onKeep} disabled={busy || (!keepUndoAvailable && !text.trim())} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-[#686964] hover:bg-[#f1f1ee] disabled:opacity-45">{keepUndoAvailable ? <RotateCcw size={12} /> : <Save size={12} />}{keepUndoAvailable ? "Undo Keep in Logue" : "Keep in Logue"}</button>
      {documentUndoAvailable ? <button type="button" onClick={onUndoDocument} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-[#686964] hover:bg-[#f1f1ee] disabled:opacity-45"><RotateCcw size={12} /> {documentUndoAction === "document" ? "Undo Save as document" : "Undo Document update"}</button> : <span className="relative"><button type="button" onClick={() => setDocumentMenuOpen((open) => !open)} disabled={busy || !text.trim()} aria-expanded={documentMenuOpen} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-[#686964] hover:bg-[#f1f1ee] disabled:opacity-45"><FileText size={12} /> Save as document…</button>{documentMenuOpen ? <span role="menu" aria-label="Choose Document target" className="absolute bottom-10 left-0 z-10 block max-h-64 w-72 overflow-auto rounded-lg border border-[#ddddda] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,21,18,0.18)]"><button type="button" role="menuitem" onClick={() => { setDocumentMenuOpen(false); onSaveDocument(); }} className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#f1f1ee]"><strong className="block text-[13px] text-[#30312d]">New Document</strong><small className="block text-[11px] text-[#8b8c87]">Start with this sourced result</small></button>{projectDocuments.map((document) => <button key={document.id} type="button" role="menuitem" onClick={() => { setDocumentMenuOpen(false); onSaveDocument(document); }} className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#f1f1ee]"><strong className="block truncate text-[13px] text-[#30312d]">{document.title}</strong><small className="block text-[11px] text-[#8b8c87]">Replace as revision {document.revision + 1}</small></button>)}</span> : null}</span>}
      <span className="flex-1" />
      {primaryAction !== "Copy" && <button type="button" onClick={onCopy} disabled={busy || !text.trim()} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#d9d9d5] px-2.5 text-[13px] font-medium text-[#656761] hover:bg-[#f5f5f2] disabled:opacity-45"><Clipboard size={12} /> Copy</button>}
      <button type="button" onClick={onPrimary} disabled={busy || !text.trim()} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#242522] px-3 text-[13px] font-medium text-white disabled:bg-[#bdbdb8]">{busyAction === "primary" || (primaryAction === "Copy" && busyAction === "copy") ? <LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" /> : primaryAction === "Copy" ? <Clipboard size={12} /> : null}{primaryAction}</button>
    </div>
    <p className="mt-2 text-right text-[11px] text-[#aaa]">Enter to {primaryAction.toLowerCase()} · Shift+Enter for a new line</p>
  </section>;
}
