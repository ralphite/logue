import {
  FolderKanban,
  LibraryBig,
  Settings,
  Sparkles,
} from "lucide-react";
import { LogueLogo } from "@logue/ui";
import { cn } from "@logue/ui";

export type Section = "stream" | "projects" | "views" | "settings";

const navItems = [
  { id: "stream" as const, label: "资料流", icon: LibraryBig },
  { id: "projects" as const, label: "项目", icon: FolderKanban },
  { id: "views" as const, label: "生成", icon: Sparkles },
  { id: "settings" as const, label: "设置", icon: Settings },
];

export function MobileNav({
  active,
  onChange,
}: {
  active: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <nav data-testid="mobile-primary-navigation" className="fixed inset-x-0 bottom-0 z-[60] hidden h-16 items-stretch border-t border-[#deded9] bg-white/96 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl max-[640px]:flex" aria-label="主导航">
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
}: {
  active: Section;
  onChange: (section: Section) => void;
  connected: boolean;
}) {
  return (
    <>
    <aside data-testid="primary-navigation-shell" className="flex h-screen w-[252px] shrink-0 flex-col border-r border-[#e7e7e4] bg-[#f7f7f5] px-2.5 py-3 max-[900px]:w-[188px] max-[640px]:hidden">
      <div className="flex h-10 items-center px-1">
        <span>
          <LogueLogo />
        </span>
      </div>

      <nav className="mt-3 space-y-0.5" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-[#5b64f4]",
                active === item.id
                  ? "bg-[#e9e9e6] text-[#373834]"
                  : "text-[#686965] hover:bg-[#ededeb] hover:text-[#30322d]",
              )}
              type="button"
              aria-current={active === item.id ? "page" : undefined}
              title={item.label}
            >
              <Icon size={17} strokeWidth={active === item.id ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#e7e7e4] pt-2">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <span
            className={cn(
              "relative flex size-2 shrink-0 rounded-full",
              connected ? "bg-[#5f8c62]" : "bg-[#cf574c]",
            )}
          >
            {connected && <span className="absolute inset-0 animate-ping rounded-full bg-[#5f8c62]/35 motion-reduce:animate-none" />}
          </span>
          <span className="text-[11px] font-medium text-[#74776f]">
            {connected ? "本机运行中" : "服务未连接"}
          </span>
        </div>
      </div>
    </aside>
    <MobileNav active={active} onChange={onChange} />
    </>
  );
}
