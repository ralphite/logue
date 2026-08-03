import { cn } from "@logue/ui";
import type { ReactNode } from "react";
import { editorColumnClass, pageColumnClass, readingColumnClass } from "../layout";

export type HeaderAxis = "page" | "editor" | "reading" | "full";

const axisClasses: Record<HeaderAxis, string> = {
  page: pageColumnClass,
  editor: editorColumnClass,
  reading: readingColumnClass,
  full: "w-full px-4",
};

export function PageHeader({
  title,
  leading,
  actions,
  axis = "page",
  testId,
  className,
}: {
  title?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  axis?: HeaderAxis;
  testId?: string;
  className?: string;
}) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[#eeeeeb] bg-white/92 backdrop-blur-xl">
      <div data-testid={testId} className={cn(axisClasses[axis], "flex h-16 items-center justify-between gap-4", className)}>
        <div className="min-w-0">
          {leading ?? (title ? <h1 className="truncate text-[20px] font-semibold tracking-[-0.035em] text-[#20211e]">{title}</h1> : null)}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}

export function ContextHeader({
  leading,
  actions,
  axis = "editor",
  testId,
  className,
}: {
  leading: ReactNode;
  actions?: ReactNode;
  axis?: HeaderAxis;
  testId?: string;
  className?: string;
}) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-[#eeeeeb] bg-white/92 backdrop-blur-xl">
      <div data-testid={testId} className={cn(axisClasses[axis], "flex h-12 items-center justify-between gap-3", className)}>
        <div className="min-w-0">{leading}</div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PaneHeader({ title, leading, actions, className }: { title?: string; leading?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex h-12 shrink-0 items-center justify-between border-b border-[#eeeeeb] px-4", className)}>
      <div className="min-w-0">{leading ?? <h2 className="truncate text-[14px] font-semibold text-[#555651]">{title}</h2>}</div>
      {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
    </header>
  );
}
