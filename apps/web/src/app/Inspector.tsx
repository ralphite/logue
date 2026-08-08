import { cn } from "@logue/ui";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * The right-hand Sources panel. Every route that opens one shows the same
 * bundle: where a Source came from, what it said, and what you added to it.
 */

export function InspectorHeader({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 border-b border-line pr-4 pl-5",
        "[&_h2]:text-sm [&_h2]:font-[650]",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function InspectorScroll({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("scroll-surface min-h-0 flex-1 overflow-auto px-4 pt-3.5 pb-8", className)} {...props}>
      {children}
    </div>
  );
}

export function SourceList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {children}
    </div>
  );
}

/** One Source. The active one lifts out of the list so the citation is obvious. */
export function SourceBundle({
  active = false,
  className,
  children,
  ...props
}: { active?: boolean } & HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        active
          ? "-mx-2 rounded-md border border-accent-line bg-[#fafaff] px-3 pt-3.5 pb-[15px]"
          : "border-b border-line px-1 pt-[15px] pb-4 first:pt-1",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function SourceHeading({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2.5",
        "[&_h3]:mt-[7px] [&_h3]:text-sm [&_h3]:leading-[1.35] [&_h3]:font-[640] [&_h3]:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The evidence or the comment. `cited` marks the passage a citation points at,
 * and `clamp` keeps a long excerpt from swallowing the panel until it is opened.
 */
export function SourceBody({
  cited = false,
  clamp = false,
  className,
  children,
  ...props
}: { cited?: boolean; clamp?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-3.5 [&_p]:mt-1.5 [&_p]:text-[13px] [&_p]:leading-[1.58] [&_p]:text-ink-soft",
        cited && "rounded-r-md border-l-2 border-accent bg-accent-soft px-2.5 py-2",
        clamp && "[&_p]:line-clamp-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SourceMeta({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-2.5 text-xs text-faint", className)} {...props}>
      {children}
    </div>
  );
}

export function SourceToggle({
  as = "button",
  expanded,
  className,
  children,
  ...props
}: { as?: "button" | "a"; expanded?: boolean; className?: string; children: ReactNode } & Record<string, unknown>) {
  const Tag = as;
  return (
    <Tag
      {...(as === "button" ? { type: "button" } : {})}
      aria-expanded={expanded}
      className={cn(
        "mt-[11px] inline-flex items-center gap-1 rounded-sm pt-[3px] pr-[5px] pb-[3px] pl-px text-xs text-muted hover:text-ink-soft",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

export function SourceExcerptToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <SourceToggle expanded={expanded} onClick={onToggle}>
      <ChevronDown size={13} className={expanded ? "rotate-180" : undefined} aria-hidden="true" />
      {expanded ? "Show less" : "Show original"}
    </SourceToggle>
  );
}

export function Chip({
  as = "button",
  className,
  children,
  ...props
}: { as?: "button" | "a"; className?: string; children: ReactNode } & Record<string, unknown>) {
  const Tag = as;
  return (
    <Tag
      {...(as === "button" ? { type: "button" } : {})}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft no-underline hover:bg-surface-muted hover:text-ink",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}
