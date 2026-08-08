import { cn } from "@logue/ui";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Containers and status surfaces. These carry the border, radius and spacing
 * decisions so a card in Settings cannot drift from a card in the inspector.
 */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-3.5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardText({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-2.5 text-[13px] leading-[1.55] text-ink-soft", className)} {...props}>{children}</p>;
}

export type BannerTone = "warning" | "danger" | "neutral";

const bannerTones: Record<BannerTone, string> = {
  warning: "border-[#ead8b3] bg-[#fffaf1] text-[#755117]",
  danger: "border-[#e7c8c3] bg-[#fff8f7] text-ink-soft",
  neutral: "border-line text-ink-soft",
};

/** A short explanation of a state the user has to act on. */
export function Banner({
  tone = "warning",
  className,
  children,
  ...props
}: { tone?: BannerTone } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border px-[11px] py-[9px] text-xs leading-[1.45]",
        bannerTones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A compact label. It becomes a button when it is given something to do. */
export function Pill({
  tone = "neutral",
  className,
  children,
  onClick,
  ...props
}: { tone?: "neutral" | "suggested" } & HTMLAttributes<HTMLElement>) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-[25px] items-center rounded-full border px-[9px] text-xs",
        tone === "suggested"
          ? "border-[#e8d5ad] bg-[#fffaf0] text-warning"
          : "border-line bg-surface text-muted",
        onClick && "hover:border-line-strong hover:text-ink",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

export function InlineActions({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function Meta({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-2 text-xs text-faint", className)} {...props}>{children}</div>;
}

export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-2.5 text-[13px] text-muted", className)} {...props}>{children}</div>;
}
