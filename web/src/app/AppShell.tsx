import { ChevronRight, FileText, FolderOpen, Layers, PanelLeft, Search, Settings2, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LogueLogo, LogueMark, Resizer, cn, usePersistentSize } from "@logue/ui";

export const ROUTES = ["stream", "projects", "documents", "skills", "settings"] as const;
export type Route = (typeof ROUTES)[number];

const NAV: Record<Route, { label: string; icon: typeof Layers }> = {
  stream: { label: "Stream", icon: Layers },
  projects: { label: "Projects", icon: FolderOpen },
  documents: { label: "Documents", icon: FileText },
  skills: { label: "Skills", icon: Sparkles },
  settings: { label: "Settings", icon: Settings2 },
};

const RAIL = { key: "logue.rail.width", min: 180, max: 320, base: 208 };
const COLLAPSED_KEY = "logue.rail.collapsed";
/** Wide enough for an icon with the same padding it has when expanded. */
const COLLAPSED_WIDTH = 48;

function wasCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Five equal destinations in a quiet rail.
 *
 * The rail carries the one piece of the product's own identity in the whole
 * interface — everything else on screen is the person's material. It can be
 * narrowed to icons or widened to taste, and remembers which; a window
 * arrangement is not worth re-doing every morning.
 */
export function AppShell({
  route,
  onRoute,
  children,
  offline = false,
  onFind,
}: {
  route: Route;
  onRoute: (route: Route) => void;
  children: ReactNode;
  /** The Host is unreachable — nothing on any screen is current. */
  offline?: boolean;
  onFind?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(wasCollapsed);
  const { size, setSize } = usePersistentSize({
    storageKey: RAIL.key,
    defaultSize: RAIL.base,
    min: RAIL.min,
    max: RAIL.max,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // The rail still collapses when storage is unavailable.
    }
  }, [collapsed]);

  // ⌘\ — what every app with a sidebar uses, so nobody has to learn it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        setCollapsed((was) => !was);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen">
      <nav
        aria-label="Sections"
        style={{ width: collapsed ? COLLAPSED_WIDTH : size }}
        className="flex shrink-0 flex-col gap-0.5 bg-nav p-1.5"
      >
        <div className={cn("mb-1 flex h-control items-center", collapsed ? "justify-center" : "gap-1 pl-1.5")}>
          {collapsed ? (
            <button
              type="button"
              aria-label="Open sidebar"
              title="Open sidebar · ⌘\"
              onClick={() => setCollapsed(false)}
              className="group inline-flex size-7 items-center justify-center rounded-md hover:bg-hover"
            >
              {/* The mark itself is the way back: on a rail this narrow there is
                  no room for both an identity and a control, and the identity
                  is the thing someone aims at. */}
              <LogueMark className="group-hover:hidden" />
              <PanelLeft size={15} className="hidden text-muted group-hover:block" />
            </button>
          ) : (
            <>
              <LogueLogo />
              <button
                type="button"
                aria-label="Close sidebar"
                title="Close sidebar · ⌘\"
                onClick={() => setCollapsed(true)}
                className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-transparent hover:bg-hover hover:text-muted focus-visible:text-muted"
              >
                <PanelLeft size={15} />
              </button>
            </>
          )}
        </div>

        {onFind && (
          // Above the destinations, because it reaches all of them.
          <button
            type="button"
            aria-label="Find anything"
            title="Find anything · ⌘K"
            onClick={onFind}
            className={cn(
              "flex h-control items-center rounded-md text-left text-[13px] text-ink-soft hover:bg-hover",
              collapsed ? "justify-center" : "gap-2 px-2",
            )}
          >
            <Search size={15} className="shrink-0 text-muted" />
            {!collapsed && (
              <>
                <span className="truncate">Find</span>
                <kbd className="ml-auto font-sans text-[11px] text-faint">⌘K</kbd>
              </>
            )}
          </button>
        )}

        {ROUTES.map((key) => {
          const { label, icon: Icon } = NAV[key];
          const active = route === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
              onClick={() => onRoute(key)}
              className={cn(
                "flex h-control items-center rounded-md text-left text-[13px]",
                collapsed ? "justify-center" : "gap-2 px-2",
                active ? "bg-active font-[560] text-ink" : "text-ink-soft hover:bg-hover",
              )}
            >
              <Icon size={15} className="shrink-0 text-muted" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
        {offline && (
          // Kept in both states: a rail narrowed to icons is exactly when
          // someone would otherwise stare at stale data and wonder.
          <p
            title="Logue is not running on this Mac."
            className={cn(
              "mt-auto flex items-center gap-1.5 text-[11px] leading-[1.4] text-warning",
              collapsed ? "justify-center" : "px-2 py-1",
            )}
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
            {!collapsed && <span>Logue is not running on this Mac.</span>}
            {collapsed && <span className="sr-only">Logue is not running on this Mac.</span>}
          </p>
        )}
      </nav>

      {collapsed ? (
        <div aria-hidden className="w-px shrink-0 bg-line" />
      ) : (
        <Resizer
          label="Resize the sidebar"
          value={size}
          min={RAIL.min}
          max={RAIL.max}
          defaultValue={RAIL.base}
          onChange={setSize}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

/**
 * A route: a fixed bar naming where you are, then everything else scrolling
 * under it.
 *
 * The bar is fixed because what it holds — search, New, Export — is what you
 * reach for partway down a long list, and a heading that scrolls away takes
 * those with it.
 */
export function Page({
  title,
  onBack,
  here,
  actions,
  axis = "list",
  children,
}: {
  title: string;
  /** Given when `title` names the list this page came from. */
  onBack?: () => void;
  /** What is open, when the title alone only names the section. */
  here?: string;
  actions?: ReactNode;
  axis?: "reading" | "list" | "settings";
  children: ReactNode;
}) {
  const width = { reading: "max-w-reading", list: "max-w-list", settings: "max-w-settings" }[axis];
  return (
    <>
      {/*
        The bar's contents sit on the same column as the page's, so the section
        name is directly above the list it names and the actions are above its
        right edge. A full-width bar over a centred column reads as two
        unrelated things.
      */}
      <header className="shrink-0 border-b border-line">
        <div className={cn("mx-auto flex h-11 items-center gap-1 px-8", width)}>
          <h1 className="flex min-w-0 items-center gap-1 text-[13px] font-[560] text-ink">
            {onBack ? (
              // The way back is the section's own name, which is where a back
              // button would have taken you anyway.
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 rounded-md px-1.5 py-0.5 font-[500] text-muted hover:bg-hover hover:text-ink"
              >
                {title}
              </button>
            ) : (
              <span className="truncate">{title}</span>
            )}
            {here !== undefined && (
              <>
                <ChevronRight size={13} aria-hidden className="shrink-0 text-faint" />
                <span className="truncate">{here || "Untitled"}</span>
              </>
            )}
          </h1>
          {actions && <span className="ml-auto flex shrink-0 items-center gap-1">{actions}</span>}
        </div>
      </header>
      <div className="logue-scroll min-h-0 flex-1">
        <div className={cn("mx-auto px-8 py-6", width)}>{children}</div>
      </div>
    </>
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
