import { ArrowUp } from "lucide-react";
import { useId, type FormEvent } from "react";
import { IconButton } from "../ui/Button";
import { Tooltip, TooltipProvider } from "../ui/Tooltip";

type ProjectRequestMode = "ask" | "compare" | "draft";

export function ProjectComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask, compare, or draft with this project",
  disabled = false,
  mode,
  onModeChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  mode: ProjectRequestMode;
  onModeChange: (mode: ProjectRequestMode) => void;
}) {
  const composerId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  };

  return (
    <form className="mx-auto flex w-full max-w-reading min-h-14 items-end gap-2.5 rounded-lg border border-line-strong bg-surface p-2 shadow-[0_4px_18px_rgba(30,31,29,0.06)]" onSubmit={submit}>
      <div
        className="flex items-center gap-0.5 self-stretch py-1 pr-0.5 pl-1.5"
        role="radiogroup"
        aria-label="Project request type"
      >
        {(["ask", "compare", "draft"] as const).map((requestMode) => (
          <button
            key={requestMode}
            type="button"
            role="radio"
            aria-checked={mode === requestMode}
            className={`h-6.5 rounded-[5px] px-2 text-xs/none font-semibold ${mode === requestMode ? "bg-surface-muted text-ink" : "text-muted"}`}
            onClick={() => onModeChange(requestMode)}
          >
            {requestMode[0].toUpperCase() + requestMode.slice(1)}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={composerId}>
        Project request
      </label>
      <textarea
        id={composerId}
        className="max-h-31 min-h-9.5 min-w-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-ink outline-0 placeholder:text-faint"
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
        <Tooltip content="Run" shortcut="Enter">
          <IconButton
            type="submit"
            label="Run project request"
            variant="primary"
            disabled={disabled || !value.trim()}
          >
            <ArrowUp aria-hidden="true" size={17} />
          </IconButton>
        </Tooltip>
      </TooltipProvider>
    </form>
  );
}
