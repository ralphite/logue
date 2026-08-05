import { Copy, FileText, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui";
import type { Candidate, TargetSession } from "../model/types";

export function DraftPreview({ candidate, target, onChange, onCitation, onInsert, onUndo }: { candidate: Candidate; target?: TargetSession; onChange: (value: string) => void; onCitation: (sourceId: string, revisionId: string) => void; onInsert: () => void; onUndo: () => void }) {
  return (
    <div className="v2-draft-card">
      <textarea aria-label="Draft reply" value={candidate.content} onChange={(event) => onChange(event.target.value)} />
      <div className="v2-citation-list" aria-label="Draft citations">
        {candidate.citations.map((citation, index) => <button key={`${citation.sourceId}:${citation.revisionId}`} type="button" className="v2-citation-chip" onClick={() => onCitation(citation.sourceId, citation.revisionId)}><span>{index + 1}</span>{citation.label}</button>)}
      </div>
      <div className="v2-inline-actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <Button size="sm"><Copy aria-hidden="true" size={14} />Copy</Button>
        <Button size="sm"><FileText aria-hidden="true" size={14} />Save as document</Button>
        {target?.lastInsertion ? <Button size="sm" onClick={onUndo}><RotateCcw aria-hidden="true" size={14} />Undo insert</Button> : target?.isValid ? <Button size="sm" variant="primary" onClick={onInsert}>Insert into {target.label}</Button> : null}
      </div>
    </div>
  );
}
