import { AudioLines } from "lucide-react";
import { cn } from "./utils";

export function LogueMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[10px] bg-[#5b64f4] text-white shadow-[0_5px_14px_rgba(91,100,244,0.25)]",
        className,
      )}
      aria-hidden="true"
    >
      <AudioLines size={17} strokeWidth={2.2} />
    </span>
  );
}

export function LogueLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Logue">
      <LogueMark />
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-0.035em] text-[#181916]">
          Logue
        </span>
      )}
    </div>
  );
}
