import { X } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "./cn";

type Press = (event: MouseEvent<HTMLButtonElement>) => void;

/**
 * A label someone put on a Source.
 *
 * The `#` is doing real work: a tag and a Project sit side by side on the same
 * line, and without it the two read as one list of interchangeable words. A
 * Project is somewhere a Source belongs; a tag is something it is about.
 */
export function Tag({
  name,
  onClick,
  onRemove,
  className,
}: {
  name: string;
  /** Given the event, because a tag often sits inside something else clickable. */
  onClick?: Press;
  onRemove?: Press;
  className?: string;
}) {
  const label = (
    <>
      <span aria-hidden className="text-muted">
        #
      </span>
      {name}
    </>
  );
  const shape = cn(
    "inline-flex max-w-40 items-center gap-px rounded-sm bg-surface-muted px-1 text-ink-soft",
    className,
  );

  return (
    <span className={cn(shape, onRemove && "pr-0.5")}>
      {onClick ? (
        <button
          type="button"
          className="max-w-full truncate hover:text-ink"
          onClick={onClick}
          title={`Only #${name}`}
        >
          {label}
        </button>
      ) : (
        <span className="max-w-full truncate">{label}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove #${name}`}
          className="shrink-0 rounded-xs p-px text-muted hover:text-ink"
          onClick={onRemove}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
