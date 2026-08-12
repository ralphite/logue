import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * One accented button per surface; everything else is quiet. `ghost` carries
 * row-level actions that should stay invisible until hovered.
 */
export type ButtonVariant = "default" | "primary" | "ghost" | "danger";

const base =
  "inline-flex h-control shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-[560] whitespace-nowrap transition-colors select-none disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent [&_kbd]:font-sans [&_kbd]:text-[10px] [&_kbd]:opacity-60 [&_svg]:shrink-0 " +
  // One disabled look for every variant. Fading the accent kept white text
  // on pale violet — measured at 1.93:1, which is not text. A control that
  // cannot be pressed is grey the same way everywhere.
  "disabled:border disabled:border-line disabled:bg-surface-muted disabled:text-muted";

const variants: Record<ButtonVariant, string> = {
  default: "border border-control-line bg-surface text-ink-soft hover:bg-surface-muted hover:text-ink",
  primary: "bg-accent text-white hover:bg-accent-hover",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
  danger: "border border-control-line bg-surface text-danger hover:bg-danger-soft",
};

export function Button({
  variant = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      // Lets a container find its one committing action for ⌘↵.
      data-primary={variant === "primary" ? "" : undefined}
      className={cn(base, variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * An action reduced to its icon. `label` is required — it names the button for
 * screen readers and doubles as the tooltip, which is where low-frequency
 * actions keep their words.
 */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & {
  label: string;
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], "w-control px-0", className)}
      {...props}
    >
      {children}
    </button>
  );
}
