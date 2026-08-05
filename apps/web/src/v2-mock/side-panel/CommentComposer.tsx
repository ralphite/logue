import { Mic, Save } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../../components/ui";

export function CommentComposer({ onSave, onVoice }: { onSave: (text: string) => void; onVoice: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="v2-panel-composer">
      <textarea aria-label="Comment on this page" value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment about this page…" onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && text.trim()) {
          event.preventDefault();
          onSave(text.trim());
          setText("");
        }
      }} />
      <IconButton label="Add voice comment" variant="ghost" onClick={onVoice}><Mic aria-hidden="true" size={17} /></IconButton>
      <Button size="icon" variant="primary" aria-label="Save comment" disabled={!text.trim()} onClick={() => { onSave(text.trim()); setText(""); }}><Save aria-hidden="true" size={16} /></Button>
    </div>
  );
}
