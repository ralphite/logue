import { cn } from "@logue/ui";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Form controls. Every input in the app goes through these so a focus ring or a
 * border colour is decided once rather than per route.
 */

const control =
  "w-full min-w-0 rounded-md border border-line-strong bg-surface text-ink outline-0 transition focus:border-accent-line focus:shadow-[0_0_0_2px_var(--color-accent-soft)] disabled:bg-panel disabled:text-muted";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9 px-[11px]", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-[150px] resize-y px-3.5 py-3 leading-[1.6]", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-9 px-2", className)} {...props} />;
}

/** A select in a toolbar sizes to its content instead of filling the row. */
export function ToolbarSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <Select className={cn("w-auto max-w-37.5 min-w-31", className)} {...props} />;
}

/**
 * A labelled control. The label text and the control are both children, in that
 * order, which is how the markup already reads.
 */
export function Field({
  span,
  className,
  children,
  ...props
}: {
  /** Fill the whole row of a FieldGrid. */
  span?: boolean;
} & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("grid gap-[7px] text-[13px] text-ink-soft", span && "col-span-full", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function FieldGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("my-4.5 grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1", className)}>{children}</div>;
}

/** A checkbox and its label, laid out on one row. */
export function CheckboxField({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "grid min-h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-[7px] self-end text-[13px] text-ink-soft",
        "[&_input]:m-0 [&_input]:accent-accent",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function SearchField({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex h-10 flex-1 items-center gap-[9px] rounded-md border border-line-strong bg-surface px-3 text-muted",
        "[&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-ink [&_input]:outline-0",
        className,
      )}
    >
      {children}
    </label>
  );
}
