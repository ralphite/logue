import { useState } from "react";

const blockBreak = /<\/(?:p|div|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi;

export function contentSummary(value: string | undefined, fallback = "") {
  if (!value?.trim()) return fallback;
  const withBreaks = value.replace(blockBreak, "\n");
  const template = document.createElement("template");
  template.innerHTML = withBreaks;
  template.content
    .querySelectorAll("script, style, noscript")
    .forEach((node) => node.remove());
  return (template.content.textContent ?? "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[`_]/g, "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

export function ContentSummary({
  value,
  fallback = "",
}: {
  value: string | undefined;
  fallback?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = contentSummary(value, fallback);
  const canExpand = text.length > 220;
  return (
    <div>
      <p className={expanded ? "" : "line-clamp-3"}>{text}</p>
      {canExpand ? (
        <button
          type="button"
          className="mt-[5px] text-xs text-muted hover:text-ink hover:underline hover:underline-offset-[3px] focus-visible:text-ink focus-visible:underline focus-visible:underline-offset-[3px]"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
