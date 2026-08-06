import { ArrowUp } from "lucide-react";
import { useId, type FormEvent } from "react";
import { IconButton } from "./ui";
import { Tooltip, TooltipProvider } from "./Tooltip";

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
    <form className="v2-composer" onSubmit={submit}>
      <div
        className="v2-composer-mode"
        role="radiogroup"
        aria-label="Project request type"
      >
        {(["ask", "compare", "draft"] as const).map((requestMode) => (
          <button
            key={requestMode}
            type="button"
            role="radio"
            aria-checked={mode === requestMode}
            className={mode === requestMode ? "is-active" : ""}
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
