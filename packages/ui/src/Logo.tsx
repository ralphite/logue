import { AudioLines } from "lucide-react";
import { cn } from "./cn";

/**
 * The one place the product says its own name.
 *
 * Everything else in this interface is the person's own material, so the mark
 * stays small and sits in the corner of the rail — present enough to know what
 * you are looking at, quiet enough not to compete with the content.
 */
export function LogueMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md bg-accent text-white",
        className,
      )}
    >
      <AudioLines size={14} strokeWidth={2.2} />
    </span>
  );
}

export function LogueLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LogueMark />
      {!compact && <span className="truncate text-[14px] font-[650] tracking-[-0.02em] text-ink">Logue</span>}
    </span>
  );
}
