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
    <div className="v2-content-summary">
      <p className={expanded ? "is-expanded" : ""}>{text}</p>
      {canExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
