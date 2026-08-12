import {
  ChevronRight,
  FileText,
  FolderOpen,
  Inbox,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LogueLogo, LogueMark, Resizer, cn, usePersistentSize } from "@logue/ui";
import { FIND_KEYS, RAIL_KEYS } from "./shortcuts";

export const ROUTES = ["stream", "projects", "documents", "skills", "settings"] as const;

/**
 * What is open when `+` has been pressed and nothing has been typed yet.
 *
 * Pressing `+` used to write an empty row into the workspace immediately, so
 * pressing it five times left five of them. Nothing goes in until it is meant.
 */
// "new" because it is also the address: `/skills/new` is a URL that says
// what the page is, which `/skills/draft` said less plainly.
export const DRAFT = "new";
export type Route = (typeof ROUTES)[number];

const NAV: Record<Route, { label: string; icon: typeof Inbox }> = {
  // Inbox, because that is what it does now: new captures wait at the top to
  // be filed, and everything already filed reads below. "Stream" named the
  // storage; this names the activity. The route id stays `stream` so every
  // saved link keeps working.
  stream: { label: "Inbox", icon: Inbox },
  projects: { label: "Projects", icon: FolderOpen },
  documents: { label: "Documents", icon: FileText },
  skills: { label: "Skills", icon: Sparkles },
  settings: { label: "Settings", icon: Settings2 },
};

const RAIL = { key: "logue.rail.width", min: 180, max: 320, base: 208 };
const COLLAPSED_KEY = "logue.rail.collapsed";
/**
 * Chosen so the icons do not move.
 *
 * Every row puts its icon in the same `size-6` slot at the same left padding —
 * 6px on the rail plus 8px on the row — so the slot's centre is 26px in, brand
 * mark included. A collapsed rail of twice that has the icons in exactly the
 * place the open one does: collapsing narrows the rail around them instead of
 * sliding them sideways, which had made the two states read as two different
 * applications.
 */
export const ICON_SLOT = "inline-flex size-6 shrink-0 items-center justify-center";
const COLLAPSED_WIDTH = 52;

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
  onNew,
  list,
}: {
  route: Route;
  onRoute: (route: Route) => void;
  children: ReactNode;
  /** The Host is unreachable — nothing on any screen is current. */
  offline?: boolean;
  onFind?: () => void;
  /** Sections that can make something, shown as a `+` on hover. */
  onNew?: Partial<Record<Route, () => void>>;
  /** The open section's own list, shown under it in the rail. */
  list?: ReactNode;
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
  // ⌘1…5 for the five destinations, which is the only reason the rail has to
  // be open at all once you know where you are going.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key === "\\") {
        event.preventDefault();
        setCollapsed((was) => !was);
        return;
      }
      const nth = ROUTES[Number(event.key) - 1];
      if (nth) {
        event.preventDefault();
        onRoute(nth);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRoute]);

  return (
    <div className="flex h-screen">
      {/* First thing a Tab reaches. The rail holds nearly every tab stop in
          the app, so without this a keyboard user walks the whole list before
          reaching the thing they opened. */}
      <a
        href="#logue-main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-[13px] text-ink shadow-lg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-popover"
      >
        Skip to what is open
      </a>
      <nav
        aria-label="Sections"
        style={{ width: collapsed ? COLLAPSED_WIDTH : size }}
        className="group/rail flex shrink-0 flex-col gap-0.5 bg-nav p-1.5"
      >
        {/* The mark sits in the same slot as every other icon, so the whole
            rail reads as one column of icons with words beside them. */}
        <div className="mb-1 flex h-control items-center gap-2 px-2">
          {collapsed ? (
            <button
              type="button"
              aria-label="Open sidebar"
              title={`Open sidebar · ${RAIL_KEYS}`}
              onClick={() => setCollapsed(false)}
              className={cn("group rounded-md hover:bg-hover", ICON_SLOT)}
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
                title={`Close sidebar · ${RAIL_KEYS}`}
                onClick={() => setCollapsed(true)}
                // Appears when the pointer is anywhere in the rail, not only
                // on the button: nobody hovers a control they cannot see.
                className="-mr-1 ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-md text-transparent group-hover/rail:text-muted hover:bg-hover hover:!text-ink focus-visible:text-muted"
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
            title={`Find anything · ${FIND_KEYS}`}
            onClick={onFind}
            className="flex h-control items-center gap-2 rounded-md px-2 text-left text-[13px] text-ink-soft hover:bg-hover"
          >
            <span className={ICON_SLOT}>
              <Search size={15} className="text-muted" />
            </span>
            {!collapsed && (
              <>
                <span className="truncate">Find</span>
                <kbd className="ml-auto font-sans text-xs text-muted">{FIND_KEYS}</kbd>
              </>
            )}
          </button>
        )}

        {ROUTES.map((key, index) => {
          const { label, icon: Icon } = NAV[key];
          const active = route === key;
          const make = onNew?.[key];
          return (
            <div key={key} className="group/nav relative flex items-center">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={collapsed ? `${label} · ⌘${index + 1}` : undefined}
                onClick={() => onRoute(key)}
                className={cn(
                  "flex h-control min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[13px]",
                  active ? "bg-active font-[560] text-ink" : "text-ink-soft hover:bg-hover",
                )}
              >
                <span className={ICON_SLOT}>
                  <Icon size={15} className="text-muted" />
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
              {make && !collapsed && (
                // On the section that will hold it, when the pointer is there.
                // A permanent New button costs a row of the rail forever to
                // save one hover.
                <button
                  type="button"
                  aria-label={`New ${label.replace(/s$/, "")}`}
                  title={`New ${label.replace(/s$/, "")}`}
                  onClick={make}
                  className="absolute right-1 inline-flex size-6 items-center justify-center rounded-md text-transparent group-hover/nav:text-muted hover:bg-surface-muted hover:!text-ink focus-visible:text-muted"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          );
        })}

        {/*
          The section's own list, under the section — the arrangement
          chatgpt.com and Codex use. Only the open section shows one, so the
          rail stays a thing you scan rather than a thing you scroll. The line
          above it keeps the five destinations from reading as its first rows.
        */}
        {!collapsed && list && (
          <div className="logue-scroll mt-1.5 min-h-0 flex-1 border-t border-line pt-1.5 pb-2">{list}</div>
        )}

        {offline && (
          // Kept in both states: a rail narrowed to icons is exactly when
          // someone would otherwise stare at stale data and wonder.
          <p
            title="Logue is not running on this Mac."
            className={cn(
              "flex items-center gap-1.5 text-xs leading-[1.4] text-warning",
              collapsed ? "mt-auto justify-center" : "px-2 py-1",
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

      <main id="logue-main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        {children}
      </main>
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
  children,
}: {
  title: string;
  /** Given when `title` names the list this page came from. */
  onBack?: () => void;
  /** What is open, when the title alone only names the section. */
  here?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/*
        The bar's contents sit on the same column as the page's, so the section
        name is directly above the list it names and the actions are above its
        right edge. A full-width bar over a centred column reads as two
        unrelated things.
      */}
      <header className="shrink-0 border-b border-line">
        <div className="mx-auto flex h-11 max-w-page items-center gap-1 px-8">
          {/*
            The h1 is whatever the page is about: the open thing when one is
            open, the section otherwise. It used to wrap the whole crumb, so a
            screen reader heard "ProjectsAgent Harness" as one word — and had a
            button inside a heading, which is two jobs in one element.
          */}
          <div className="flex min-w-0 items-center gap-1 text-[13px] font-[560] text-ink">
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
            ) : here !== undefined ? (
              <span className="truncate">{title}</span>
            ) : (
              <h1 className="truncate">{title}</h1>
            )}
            {here !== undefined && (
              <>
                <ChevronRight size={13} aria-hidden className="shrink-0 text-muted" />
                <h1 className="truncate">{here || "Untitled"}</h1>
              </>
            )}
          </div>
          {actions && <span className="ml-auto flex shrink-0 items-center gap-1">{actions}</span>}
        </div>
      </header>
      <div className="logue-scroll min-h-0 flex-1">
        <div className="mx-auto max-w-page px-8 py-6">{children}</div>
      </div>
    </>
  );
}

/**
 * A section with nothing chosen yet.
 *
 * Says which section you are in and what to do, rather than a blank page or a
 * second copy of the list that is already in the rail.
 */
export function Nothing({ section, hint }: { section: string; hint: string }) {
  return (
    <Page title={section}>
      <p className="py-10 text-center text-xs text-muted">{hint}</p>
    </Page>
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
