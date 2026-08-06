import {
  FileText,
  FolderKanban,
  LibraryBig,
  PanelLeftClose,
  Settings,
  Sparkles,
} from "lucide-react";
import { LogueLogo } from "@logue/ui";
import { cn } from "@logue/ui";
import { useState } from "react";
import { PanelResizer } from "./PanelResizer";
import { Tooltip, TooltipProvider } from "./Tooltip";

export type Section = "stream" | "projects" | "documents" | "skills" | "settings";

const navItems = [
  { id: "projects" as const, label: "Projects", icon: FolderKanban },
  { id: "stream" as const, label: "Library", icon: LibraryBig },
  { id: "documents" as const, label: "Documents", icon: FileText },
  { id: "skills" as const, label: "Skills", icon: Sparkles },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

const mainNavItems = navItems.filter((item) => item.id !== "settings");
const settingsItem = navItems.find((item) => item.id === "settings")!;

export function MobileNav({
  active,
  onChange,
}: {
  active: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <nav data-testid="mobile-primary-navigation" className="fixed inset-x-0 bottom-0 z-[60] hidden h-16 items-stretch border-t border-[#deded9] bg-white/96 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl max-[640px]:flex" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[14px] font-medium transition focus-visible:outline-2 focus-visible:outline-[#5b64f4] ${selected ? "text-[#343630]" : "text-[#858680] active:bg-[#f0f0ed]"}`}
          >
            <span className={`inline-flex h-7 min-w-10 items-center justify-center rounded-md ${selected ? "bg-[#ececea]" : ""}`}><Icon size={17} strokeWidth={selected ? 2.2 : 1.8} /></span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function NavRail({
  active,
  onChange,
  connected,
  collapsed = false,
  onCollapsedChange = () => undefined,
  width = 252,
  onWidthChange = () => undefined,
}: {
  active: Section;
  onChange: (section: Section) => void;
  connected: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}) {
  const [resizing, setResizing] = useState(false);

  return (
    <TooltipProvider>
    <aside
      data-testid="primary-navigation-shell"
      data-collapsed={collapsed ? "true" : "false"}
      data-resizing={resizing ? "true" : "false"}
      style={{ width: collapsed ? 56 : width }}
      className={cn(
        "group/sidebar flex h-screen min-h-0 shrink-0 flex-col overflow-hidden border-r border-[#e7e7e3] bg-[#fbfbfa] transition-[width] duration-200 ease-out motion-reduce:transition-none max-[640px]:hidden",
        resizing && "transition-none",
        collapsed ? "w-14 max-[900px]:w-14" : "",
      )}
    >
      <div data-testid="sidebar-header" className="flex h-16 shrink-0 items-center px-2.5">
        {collapsed ? (
          <Tooltip content="Open sidebar">
            <button
              type="button"
              data-testid="sidebar-brand-toggle"
              aria-label="Open sidebar"
              aria-expanded="false"
              aria-controls="primary-navigation"
              onClick={() => onCollapsedChange(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#73756f] transition hover:bg-[#f1f1ef] hover:text-[#20211f] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#535fdb]"
            >
              <span data-testid="sidebar-brand-mark" aria-hidden="true">
                <LogueLogo compact />
              </span>
            </button>
          </Tooltip>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate px-1.5 text-[20px] font-semibold tracking-[-0.035em] text-[#20211f]">
              Logue
            </span>
            <Tooltip content="Close sidebar">
              <button
                type="button"
                data-testid="sidebar-brand-toggle"
                aria-label="Close sidebar"
                aria-expanded="true"
                aria-controls="primary-navigation"
                onClick={() => onCollapsedChange(true)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#73756f] opacity-0 transition hover:bg-[#f1f1ef] hover:text-[#20211f] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#535fdb] group-hover/sidebar:opacity-100"
              >
                <PanelLeftClose data-testid="sidebar-toggle-icon" size={18} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <nav id="primary-navigation" className="scroll-surface min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-1" aria-label="Primary navigation">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.id} content={item.label} disabled={!collapsed}>
            <button
              onClick={() => onChange(item.id)}
              className={cn(
                "flex h-9 w-full items-center rounded-md text-[15px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#535fdb]",
                active === item.id
                  ? "bg-[#ececea] text-[#20211f]"
                  : "text-[#4e504b] hover:bg-[#f1f1ef] hover:text-[#20211f]",
              )}
              type="button"
              aria-current={active === item.id ? "page" : undefined}
            >
              <span data-nav-icon-slot="true" className="flex size-9 shrink-0 items-center justify-center">
                <Icon size={18} strokeWidth={active === item.id ? 2.2 : 1.8} aria-hidden="true" />
              </span>
              <span className={cn("min-w-0 flex-1 truncate pr-2 text-left", collapsed && "sr-only")}>{item.label}</span>
            </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="shrink-0 px-2.5 pb-3 pt-1">
        <Tooltip content={settingsItem.label} disabled={!collapsed}>
          <button
            onClick={() => onChange(settingsItem.id)}
            className={cn(
              "flex h-9 w-full items-center rounded-md text-[15px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#535fdb]",
              active === settingsItem.id ? "bg-[#ececea] text-[#20211f]" : "text-[#4e504b] hover:bg-[#f1f1ef] hover:text-[#20211f]",
            )}
            type="button"
            aria-current={active === settingsItem.id ? "page" : undefined}
          >
            <span data-nav-icon-slot="true" className="flex size-9 shrink-0 items-center justify-center">
              <Settings size={18} strokeWidth={active === settingsItem.id ? 2.2 : 1.8} aria-hidden="true" />
            </span>
            <span className={cn("min-w-0 flex-1 truncate pr-2 text-left", collapsed && "sr-only")}>{settingsItem.label}</span>
          </button>
        </Tooltip>
      </div>

      {!connected && <div className="mt-2 shrink-0 border-t border-[#e7e7e4] pt-2">
        <div
          role="status"
          aria-label="Service disconnected"
          className="flex min-h-11 items-center rounded-lg"
        >
          <span className="flex size-11 shrink-0 items-center justify-center">
            <span className="flex size-2 shrink-0 rounded-full bg-[#cf574c]" />
          </span>
          <span className={cn("min-w-0 flex-1 truncate pr-2 text-[15px] font-medium text-[#74776f]", collapsed && "sr-only")}>
            Service disconnected
          </span>
        </div>
      </div>}
    </aside>
    {!collapsed && (
      <PanelResizer
        label="Resize primary navigation"
        value={width}
        min={200}
        max={300}
        defaultValue={232}
        onChange={onWidthChange}
        onDraggingChange={setResizing}
        className="max-[640px]:hidden"
      />
    )}
    <MobileNav active={active} onChange={onChange} />
    </TooltipProvider>
  );
}
