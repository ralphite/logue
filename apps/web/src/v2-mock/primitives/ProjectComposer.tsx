import { ArrowUp, Mic } from "lucide-react";
import { useId, type FormEvent } from "react";
import { IconButton } from "../../components/ui";
import { Tooltip, TooltipProvider } from "../../components/Tooltip";

export function ProjectComposer({ value, onChange, onSubmit, placeholder = "Ask or draft with this project", disabled = false, showVoice = true, mode, onModeChange }: { value: string; onChange: (value: string) => void; onSubmit: () => void; placeholder?: string; disabled?: boolean; showVoice?: boolean; mode?: "ask" | "draft"; onModeChange?: (mode: "ask" | "draft") => void }) {
  const composerId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  };

  return (
    <form className="v2-composer" onSubmit={submit}>
      {mode && onModeChange ? <div className="v2-composer-mode" role="radiogroup" aria-label="Project request type"><button type="button" role="radio" aria-checked={mode === "ask"} className={mode === "ask" ? "is-active" : ""} onClick={() => onModeChange("ask")}>Ask</button><button type="button" role="radio" aria-checked={mode === "draft"} className={mode === "draft" ? "is-active" : ""} onClick={() => onModeChange("draft")}>Draft</button></div> : null}
      <label className="sr-only" htmlFor={composerId}>Project request</label>
      <textarea
        id={composerId}
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!disabled && value.trim()) onSubmit();
          }
        }}
      />
      <TooltipProvider>
        {showVoice ? <Tooltip content="Use voice" shortcut="⌘⇧V">
          <IconButton label="Use voice" variant="ghost"><Mic aria-hidden="true" size={18} /></IconButton>
        </Tooltip> : null}
        <Tooltip content="Run" shortcut="Enter">
          <IconButton label="Run project request" variant="primary" disabled={disabled || !value.trim()}><ArrowUp aria-hidden="true" size={17} /></IconButton>
        </Tooltip>
      </TooltipProvider>
    </form>
  );
}
