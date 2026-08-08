import { Bot, Globe2, UserRound } from "lucide-react";

export type OriginLabelType = "web" | "you" | "ai";

const originLabels: Record<OriginLabelType, string> = {
  web: "Web",
  you: "You",
  ai: "AI",
};

export function OriginLabel({ origin, detail }: { origin: OriginLabelType; detail?: string }) {
  const Icon = origin === "web" ? Globe2 : origin === "you" ? UserRound : Bot;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-[570] text-muted">
      <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
      <span>{originLabels[origin]}</span>
      {detail ? <span aria-hidden="true">·</span> : null}
      {detail ? <span>{detail}</span> : null}
    </span>
  );
}
