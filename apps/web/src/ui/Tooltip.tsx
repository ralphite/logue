import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@logue/ui";
import type { ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={160} disableHoverableContent>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  children,
  content,
  disabled = false,
  side = "right",
  shortcut,
}: {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  if (disabled) return <>{children}</>;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={10}
          className={cn(
            "z-[var(--logue-overlay-layer,40)] flex max-w-[18rem] select-none items-center gap-2 rounded-[10px] bg-[#2d2e2b] px-2.5 py-2",
            "text-[14px] font-medium leading-5 text-white shadow-[0_7px_22px_rgba(24,25,22,0.22)]",
            "data-[state=delayed-open]:animate-[tooltip-in_120ms_ease-out] data-[state=instant-open]:animate-[tooltip-in_120ms_ease-out] motion-reduce:animate-none",
          )}
        >
          <span>{content}</span>
          {shortcut && <kbd className="text-[13px] font-normal text-white/55">{shortcut}</kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
