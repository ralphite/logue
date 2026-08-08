import { FileText, FolderOpen, Layers, Settings2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@logue/ui";

export const ROUTES = ["stream", "projects", "documents", "skills", "settings"] as const;
export type Route = (typeof ROUTES)[number];

const NAV: Record<Route, { label: string; icon: typeof Layers }> = {
  stream: { label: "Stream", icon: Layers },
  projects: { label: "Projects", icon: FolderOpen },
  documents: { label: "Documents", icon: FileText },
  skills: { label: "Skills", icon: Sparkles },
  settings: { label: "Settings", icon: Settings2 },
};

/**
 * Five equal destinations in a quiet rail. The rail never announces itself —
 * no product name banner, no section headers, no counts competing with content.
 */
export function AppShell({
  route,
  onRoute,
  children,
  status,
}: {
  route: Route;
  onRoute: (route: Route) => void;
  children: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <nav className="flex w-[188px] shrink-0 flex-col gap-0.5 border-r border-line bg-nav p-2" aria-label="Sections">
        {ROUTES.map((key) => {
          const { label, icon: Icon } = NAV[key];
          const active = route === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onRoute(key)}
              className={cn(
                "flex h-control items-center gap-2 rounded-md px-2 text-left text-[13px]",
                active ? "bg-active font-[560] text-ink" : "text-ink-soft hover:bg-hover",
              )}
            >
              <Icon size={15} className="shrink-0 text-muted" />
              {label}
            </button>
          );
        })}
        <div className="mt-auto">{status}</div>
      </nav>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

/** Every route is a scroll container, a reading axis, and a heading. */
export function Page({
  title,
  actions,
  axis = "list",
  children,
}: {
  title: string;
  actions?: ReactNode;
  axis?: "reading" | "list" | "settings";
  children: ReactNode;
}) {
  const width = { reading: "max-w-reading", list: "max-w-list", settings: "max-w-settings" }[axis];
  return (
    <div className="logue-scroll h-full">
      <div className={cn("mx-auto px-8 py-7", width)}>
        <header className="mb-4 flex min-h-control items-center justify-between gap-3">
          <h1 className="truncate text-[19px] font-[650] tracking-[-0.01em]">{title}</h1>
          {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
        </header>
        {children}
      </div>
    </div>
  );
}

/** A list of rows separated by hairlines, the way Notion lists anything. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line border-y border-line">{children}</div>;
}

export function Row({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex items-center gap-3 px-1.5 py-2",
        onClick && "cursor-pointer hover:bg-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Row actions appear on hover, so a resting list shows only content. */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </span>
  );
}
