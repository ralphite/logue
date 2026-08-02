import { FilePlus2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getProjects } from "../api";

export function NewMaterialDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (content: string, projects: string[]) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getProjects().then((items) => setProjectOptions(items.map((item) => item.name)));
  }, []);

  async function submit() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(
        content.trim(),
        projects,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1f1a]/25 p-4 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="w-full max-w-[500px] overflow-hidden rounded-xl border border-[#deded9] bg-white shadow-[0_24px_70px_rgba(24,26,22,0.2)]" role="dialog" aria-modal="true" aria-labelledby="new-material-title">
        <header className="flex h-12 items-center justify-between border-b border-[#e8e8e5] px-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#f0f0ed] text-[#696a65]"><FilePlus2 size={14} /></span>
            <h2 id="new-material-title" className="text-[13px] font-semibold text-[#353632]">New material</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close new material dialog" className="inline-flex size-11 items-center justify-center rounded-md text-[#858680] hover:bg-[#efefeb] focus-visible:outline-2 focus-visible:outline-[#5b64f4]"><X size={15} /></button>
        </header>
        <div className="space-y-5 p-5">
          <label className="block"><span className="mb-2 block text-[11px] font-medium text-[#666762]">Content</span><textarea autoFocus value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste or write something…" className="min-h-40 w-full resize-y rounded-md border border-[#d8dad3] bg-white px-3.5 py-3 text-[13px] leading-6 outline-none placeholder:text-[#a0a39b] focus:border-[#aaa]" /></label>
          {projectOptions.length > 0 && <section><p className="mb-2 text-[11px] font-medium text-[#666762]">Projects <span className="font-normal text-[#999a95]">(optional, select multiple)</span></p><div className="flex flex-wrap gap-1.5">{projectOptions.map((project) => { const selected = projects.includes(project); return <button key={project} type="button" onClick={() => setProjects((current) => selected ? current.filter((item) => item !== project) : [...current, project])} className={`h-7 rounded-md border px-2.5 text-[10.5px] ${selected ? "border-[#a7a8a2] bg-[#eeeeeb] text-[#444541]" : "border-[#deded9] text-[#777873] hover:bg-[#f7f7f5]"}`}>{project}</button>; })}</div></section>}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-[#e8e8e5] bg-[#fcfcfa] px-5 py-3.5">
          <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[11px] font-medium text-[#71756c] hover:bg-[#efefeb] focus-visible:outline-2 focus-visible:outline-[#5b64f4]">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={!content.trim() || saving} className="h-8 rounded-md bg-[#242522] px-3.5 text-[11px] font-medium text-white hover:bg-[#393a36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4] disabled:cursor-not-allowed disabled:bg-[#c7c9d1]">{saving ? "Saving…" : "Save material"}</button>
        </footer>
      </section>
    </div>
  );
}
