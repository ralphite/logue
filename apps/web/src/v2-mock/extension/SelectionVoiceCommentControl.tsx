import { MessageSquarePlus, Mic } from "lucide-react";
import { useEffect } from "react";
import { Button, IconButton } from "../../components/ui";

interface SelectionVoiceCommentControlProps {
  isRecording: boolean;
  onStart: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onTextComment: () => void;
}

/** The selected-text fast path. Durable work happens only on Accept. */
export function SelectionVoiceCommentControl({ isRecording, onStart, onAccept, onCancel, onTextComment }: SelectionVoiceCommentControlProps) {
  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        onAccept();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, onAccept, onCancel]);

  return (
    <div className="v2-selection-comment-control" aria-label="Comment on selected text" data-recording={isRecording || undefined}>
      {isRecording ? (
        <>
          <span className="v2-recording-status" role="status"><span aria-hidden="true" />Recording 0:08</span>
          <Button size="sm" variant="primary" aria-keyshortcuts="Enter" title="Accept (Enter)" onClick={onAccept}>Accept <kbd aria-hidden="true">↵</kbd></Button>
          <Button size="sm" variant="ghost" aria-keyshortcuts="Escape" title="Cancel (Escape)" onClick={onCancel}>Cancel <kbd aria-hidden="true">Esc</kbd></Button>
        </>
      ) : (
        <>
          <IconButton label="Add voice comment" variant="primary" onClick={onStart}><Mic aria-hidden="true" size={16} /></IconButton>
          <IconButton label="Write comment" variant="ghost" onClick={onTextComment}><MessageSquarePlus aria-hidden="true" size={16} /></IconButton>
        </>
      )}
    </div>
  );
}
