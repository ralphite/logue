import { cn } from "@logue/ui";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[#242522] text-white hover:bg-[#3a3b37] active:bg-[#171815] disabled:bg-[#c8c9c4]",
  secondary: "border border-[#d8d8d3] bg-white text-[#62635e] hover:bg-[#f4f4f1] active:bg-[#ecece8] disabled:text-[#a8a9a4]",
  ghost: "text-[#6d6e69] hover:bg-[#f1f1ee] hover:text-[#3e3f3b] active:bg-[#e7e7e3] disabled:text-[#b3b4af]",
  danger: "bg-[#b2483f] text-white hover:bg-[#9f3e36] active:bg-[#8b352f] disabled:bg-[#cf9a95]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[14px]",
  md: "h-10 gap-2 px-3.5 text-[15px]",
  icon: "size-8 justify-center p-0 max-[900px]:size-11",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "md", loading = false, loadingLabel, className, children, type = "button", disabled, "aria-label": ariaLabel, ...props }: ButtonProps) {
  const visibleLoadingLabel = loadingLabel ?? "Working";
  return (
    <button
      type={type}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b64f4] disabled:cursor-not-allowed disabled:opacity-80",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={loading ? visibleLoadingLabel : ariaLabel}
      {...props}
    >
      {loading ? (
        <>
          <span aria-hidden="true" className="invisible inline-flex items-center gap-1.5">{children}</span>
          <span className="absolute inset-0 inline-flex items-center justify-center gap-1.5">
            <LoaderCircle aria-hidden="true" size={15} className="animate-spin motion-reduce:animate-none" />
            <span className={size === "icon" ? "sr-only" : undefined}>{visibleLoadingLabel}</span>
          </span>
        </>
      ) : children}
    </button>
  );
}

export function IconButton({ label, children, ...props }: Omit<ButtonProps, "size" | "children" | "aria-label"> & { label: string; children: ReactNode }) {
  return <Button size="icon" aria-label={label} title={props.title ?? label} {...props}>{children}</Button>;
}
