import { ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "./cn";

/**
 * Where a Source came from, as a way to go there.
 *
 * Wherever a Source is listed, the page behind it is one of the two things
 * someone wants from that row — the other being the Source itself. Printing
 * the domain as dead text makes them go and find it by hand.
 *
 * Rows are usually clickable themselves, so the link stops the click: opening
 * the page and opening the Source are different intentions.
 */
export function SourceLink({
  url,
  label,
  className,
}: {
  url?: string;
  /** What to show. The domain, usually. */
  label: string;
  className?: string;
}) {
  if (!url) return <span className={cn("truncate", className)}>{label}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      onClick={(event: MouseEvent) => event.stopPropagation()}
      className={cn(
        // Grown to the 24px floor with padding, handed back with margin, so a
        // 17px text line stays a 17px line while the finger gets a real target.
        "-my-1 inline-flex min-h-6 min-w-0 items-center gap-0.5 py-1 hover:text-accent hover:underline",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <ExternalLink size={10} className="shrink-0 opacity-60" />
    </a>
  );
}
