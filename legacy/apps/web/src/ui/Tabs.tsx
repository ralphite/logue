import { cn } from "@logue/ui";
import type { ReactNode } from "react";

/**
 * The underlined tab strip. Three places used to draw their own version of it
 * with slightly different padding and weight; they all come through here now.
 */

export type TabsSize = "sm" | "md";

export function Tabs({
  label,
  size = "md",
  className,
  children,
}: {
  label: string;
  size?: TabsSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex border-b border-line", size === "sm" ? "gap-5" : "gap-0.5", className)}
    >
      {children}
    </div>
  );
}

export function Tab({
  active,
  size = "md",
  className,
  children,
  ...props
}: {
  active: boolean;
  size?: TabsSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "relative",
        size === "sm" ? "px-px pt-[9px] pb-[11px] text-[13px]" : "px-3 pt-2.5 pb-3 text-sm",
        active
          ? cn(
              "font-[620] text-ink after:absolute after:-bottom-px after:h-0.5 after:bg-ink after:content-['']",
              size === "sm" ? "after:inset-x-0" : "after:inset-x-2.5",
            )
          : "text-muted hover:text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
