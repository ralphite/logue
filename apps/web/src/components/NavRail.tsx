import {
  FolderKanban,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from "lucide-react";
import { LogueLogo } from "@logue/ui";
import { cn } from "@logue/ui";
import { useState } from "react";
import { PanelResizer } from "./PanelResizer";
import { Tooltip, TooltipProvider } from "./Tooltip";

export type Section = "stream" | "projects" | "views" | "settings";

const navItems = [
  { id: "stream" as const, label: "Stream", icon: LibraryBig },
  { id: "projects" as const, label: "Projects", icon: FolderKanban },
  { id: "views" as const, label: "Generate", icon: Sparkles },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

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
            className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition focus-visible:outline-2 focus-visible:outline-[#5b64f4] ${selected ? "text-[#343630]" : "text-[#858680] active:bg-[#f0f0ed]"}`}
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
  const toggleLabel = collapsed ? "Open sidebar" : "Close sidebar";

  return (
    <TooltipProvider>
    <aside
      data-testid="primary-navigation-shell"
      data-collapsed={collapsed ? "true" : "false"}
      data-resizing={resizing ? "true" : "false"}
      style={{ width: collapsed ? 56 : width }}
      className={cn(
        "flex h-screen shrink-0 flex-col bg-[#f7f7f5] py-3 transition-[width,padding] duration-200 ease-out motion-reduce:transition-none max-[640px]:hidden",
        resizing && "transition-none",
        collapsed
          ? "w-14 border-r border-[#e7e7e4] px-1.5 max-[900px]:w-14"
          : "px-2.5",
      )}
    >
      <div className={cn("flex h-11 items-center", collapsed ? "justify-center" : "pl-1")}>
        {!collapsed && (
          <span className="min-w-0 flex-1 overflow-hidden">
            <LogueLogo />
          </span>
        )}
        <Tooltip content={toggleLabel} disabled={!collapsed}>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls="primary-navigation"
          onClick={() => onCollapsedChange(!collapsed)}
          className="group flex size-11 shrink-0 items-center justify-center rounded-lg text-[#73756f] transition hover:bg-[#ebebe8] hover:text-[#30322d] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5b64f4]"
        >
          {collapsed ? (
            <>
              <span className="group-hover:hidden group-focus-visible:hidden" aria-hidden="true"><LogueLogo compact /></span>
              <PanelLeftOpen className="hidden group-hover:block group-focus-visible:block" size={18} strokeWidth={1.9} aria-hidden="true" />
            </>
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.9} aria-hidden="true" />
          )}
        </button>
        </Tooltip>
      </div>

      <nav id="primary-navigation" className="mt-2 space-y-0.5" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.id} content={item.label} disabled={!collapsed}>
            <button
              onClick={() => onChange(item.id)}
              className={cn(
                "flex w-full items-center rounded-lg text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5b64f4]",
                collapsed ? "h-11 justify-center px-0" : "h-9 gap-2 px-2",
                active === item.id
                  ? "bg-[#e9e9e6] text-[#373834]"
                  : "text-[#686965] hover:bg-[#ededeb] hover:text-[#30322d]",
              )}
              type="button"
              aria-current={active === item.id ? "page" : undefined}
            >
              <Icon className="shrink-0" size={18} strokeWidth={active === item.id ? 2.2 : 1.8} aria-hidden="true" />
              <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
            </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#e7e7e4] pt-2">
        <div
          role="status"
          aria-label={connected ? "Local service running" : "Service disconnected"}
          className={cn(
            "flex min-h-11 items-center rounded-lg",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2",
          )}
        >
          <span
            className={cn(
              "relative flex size-2 shrink-0 rounded-full",
              connected ? "bg-[#5f8c62]" : "bg-[#cf574c]",
            )}
          >
            {connected && <span className="absolute inset-0 animate-ping rounded-full bg-[#5f8c62]/35 motion-reduce:animate-none" />}
          </span>
          <span className={cn("text-[11px] font-medium text-[#74776f]", collapsed && "sr-only")}>
            {connected ? "Local service running" : "Service disconnected"}
          </span>
        </div>
      </div>
    </aside>
    {!collapsed && (
      <PanelResizer
        label="Resize primary navigation"
        value={width}
        min={200}
        max={320}
        defaultValue={252}
        onChange={onWidthChange}
        onDraggingChange={setResizing}
        className="max-[640px]:hidden"
      />
    )}
    <MobileNav active={active} onChange={onChange} />
    </TooltipProvider>
  );
}
