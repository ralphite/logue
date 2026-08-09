import { cloneElement, useId } from "react";
import type { InputHTMLAttributes, ReactElement, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "min-w-0 rounded-md bg-surface text-xs text-ink outline-0 transition-colors disabled:bg-panel disabled:text-muted";

/**
 * The frame, kept apart from the control so it can be left off.
 *
 * A caller cannot undo `focus:border-…` with `border-0`: the focus variant
 * still wins whenever the control has focus, and a box that autofocuses has it
 * always. Find's box lives inside a dialog that already has a border, so the
 * ring was a second frame drawn permanently around the first — and no amount
 * of overriding at the call site could remove it.
 */
const framed =
  "border border-line-strong hover:border-line-strong focus:border-accent-line focus:shadow-[0_0_0_2px_var(--color-accent-soft)]";

/**
 * A control fills its row unless the caller gave it a width. Deciding this here
 * rather than always emitting `w-full` means an explicit `w-40` actually wins:
 * two competing width utilities would otherwise be settled by stylesheet order.
 */
function width(className?: string) {
  return /(^|\s)(w-|max-w-)/.test(className ?? "") ? "" : "w-full";
}

export function Input({
  className,
  bare = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  /** No frame of its own — for a box inside something already framed. */
  bare?: boolean;
}) {
  return (
    <input
      className={cn(control, !bare && framed, "h-control px-2", width(className), className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, framed, "min-h-16 resize-y px-2 py-1.5 leading-[1.5]", width(className), className)}
      {...props}
    />
  );
}

/**
 * Every choice in the product is this element. A native select is the one
 * control that behaves correctly on every page we inject into — look-alikes
 * built from inputs and datalists are why the old picker felt broken.
 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        control,
        "h-control cursor-pointer appearance-none bg-(image:--logue-chevron) bg-[length:12px] bg-[position:right_6px_center] bg-no-repeat pr-6 pl-2",
        width(className),
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * Label left, control right — a group of these reads as a table.
 *
 * The label points at the control by id rather than wrapping it: a `<label>`
 * around a `<select>` folds every option into the accessible name, so the
 * field announces itself as "ProfileDefaultMobile researchLogue".
 */
export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-xs text-ink-soft", className)}>
      <input type="checkbox" className="m-0 size-3.5 accent-accent" {...props} />
      {label}
    </label>
  );
}
