/**
 * One colour pair and one glyph per kind of act.
 *
 * A day of captures is a mixed list — spoken notes between kept passages
 * between saved pages — and the eye should split it without reading. The
 * kind is carried once, deliberately small: a 24px tinted badge. The verb
 * beside it stays ink — seven inks in one column read as noise, his ruling.
 * Tints, never alarms: this is provenance, not status.
 */

import type { JSX } from "react";
import { cn } from "./cn";

export type ActKind = "spoke" | "dictated" | "comment" | "kept" | "saved" | "generated" | "typed";

export const ACTS: Record<ActKind, { label: string; ink: string; soft: string }> = {
  spoke: { label: "Spoke to Logue", ink: "text-act-spoke", soft: "bg-act-spoke-soft" },
  dictated: { label: "Dictated into a page", ink: "text-act-dictated", soft: "bg-act-dictated-soft" },
  comment: { label: "Voice comment", ink: "text-act-comment", soft: "bg-act-comment-soft" },
  kept: { label: "Kept a passage", ink: "text-act-kept", soft: "bg-act-kept-soft" },
  saved: { label: "Saved a page", ink: "text-act-saved", soft: "bg-act-saved-soft" },
  generated: { label: "Generated a document", ink: "text-act-generated", soft: "bg-act-generated-soft" },
  typed: { label: "Typed a note", ink: "text-act-typed", soft: "bg-act-typed-soft" },
};

const STROKES: Record<ActKind, JSX.Element> = {
  spoke: (
    <>
      <rect x="8" y="3.5" width="8" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  dictated: (
    <>
      <path d="M5 5.5h14v10H5v-10Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 18.5h8M12 15.5v3M8.5 9h7M8.5 12h4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  comment: (
    <>
      <path d="M5 4.5h14v11H9l-4 4v-15Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 9h7M8.5 12h4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  kept: (
    <>
      <path d="M6 4.5h12v15H6v-15Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  saved: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 12h16.4M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5M12 3.5C9.6 5.8 8.4 8.6 8.4 12s1.2 6.2 3.6 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  generated: (
    <>
      <path d="M7 3.8h7l4 4v12.4H7V3.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3.8v4h4M4.2 9.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8ZM11 13h4M11 16h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  typed: (
    <path d="M5 6h14M12 6v12M8.5 18h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  ),
};

export function ActIcon({ kind, className }: { kind: ActKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-[15px] w-[15px]", className)}>
      {STROKES[kind]}
    </svg>
  );
}

/** The 24px tinted square that starts a list row. */
export function ActBadge({ kind, className }: { kind: ActKind; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 flex-none items-center justify-center rounded-[7px]",
        ACTS[kind].ink,
        ACTS[kind].soft,
        className,
      )}
    >
      <ActIcon kind={kind} className="h-[12px] w-[12px]" />
    </span>
  );
}

/** The small workhorse glyphs the design uses beside text. */
const GLYPHS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 12h16.4M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5M12 3.5C9.6 5.8 8.4 8.6 8.4 12s1.2 6.2 3.6 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  play: <path d="m8.5 6.8 9 5.2-9 5.2V6.8Z" fill="currentColor" />,
  external: (
    <path d="M13 5h6v6M19 5l-8 8M18 14v4.5H5.5v-13H10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  edit: (
    <>
      <path d="m5 16.5-.8 3.3 3.3-.8L18 8.5 15.5 6 5 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m13.8 7.7 2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  retry: (
    <path d="M19 8V4l-2 2a8 8 0 1 0 2.2 8.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  x: <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  undo: (
    <path d="m8.5 8.5-4 3.5 4 3.5M5 12h8a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chevron: (
    <path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  auto: (
    <path d="m12 4 1.2 3.2L16.5 8.5l-3.3 1.3L12 13l-1.2-3.2-3.3-1.3 3.3-1.3L12 4ZM18.5 13.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2ZM6 14.5l.6 1.5 1.5.6-1.5.6L6 18.7l-.6-1.5-1.5-.6 1.5-.6.6-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
  ),
  mic: (
    <>
      <rect x="8" y="3.5" width="8" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  activities: (
    <path d="M3.5 12h3l2-5 3.2 10 2.6-7 1.7 2h4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  folder: (
    <path d="M3.5 7.8c0-1 .8-1.8 1.8-1.8h4l1.8 2h7.6c1 0 1.8.8 1.8 1.8v7.9c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V7.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  ),
  document: (
    <>
      <path d="M6 3.8h8l4 4v12.4H6V3.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3.8v4h4M9 12h6M9 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  skills: (
    <path d="m12 3 1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3ZM18.3 14.3l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5.2 14.8l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  settings: (
    <>
      <path d="M4 7h8M16 7h4M4 17h4M12 17h8M12 4v6M8 14v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-[11px] w-[11px]", className)}>
      {GLYPHS[name]}
    </svg>
  );
}
