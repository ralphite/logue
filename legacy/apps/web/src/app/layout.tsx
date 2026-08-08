import { cn } from "@logue/ui";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

/**
 * Page composition. Routes stack a scroll container, a reading axis and a
 * heading; keeping that here is what stops the pages from drifting apart.
 * Anything that isn't page-shaped lives in ../ui.
 */

export type Axis = "reading" | "list" | "settings";

const axisWidth: Record<Axis, string> = {
  reading: "max-w-reading",
  list: "max-w-list",
  settings: "max-w-settings",
};

const axisPadding: Record<Axis, string> = {
  reading: "pt-[72px] pb-[148px]",
  list: "pt-[58px] pb-24",
  settings: "pt-14 pb-25",
};

/** The one scrolling element on a route, so scrollbars never resize a layout. */
export const PageScroll = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function PageScroll({ className, children, ...props }, ref) {
    return (
      <div ref={ref} className={cn("scroll-surface @container min-h-0 flex-1 overflow-auto", className)} {...props}>
        {children}
      </div>
    );
  },
);

export function PageAxis({
  axis = "list",
  className,
  children,
  ...props
}: { axis?: Axis } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full px-[42px] max-[820px]:px-6", axisWidth[axis], axisPadding[axis], className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Title and lead. Both are styled here so every route's h1 matches. */
export function HeadingCopy({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0",
        "[&>h1]:text-[32px] [&>h1]:leading-[1.16] [&>h1]:font-[690] [&>h1]:tracking-[-0.04em] [&>h1]:text-ink",
        "[&>p]:mt-2.5 [&>p]:max-w-160 [&>p]:text-[15px] [&>p]:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeading({ title, lead, actions }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-10 flex items-start justify-between gap-6">
      <HeadingCopy>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </HeadingCopy>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Lead({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-2.5 max-w-160 text-[15px] text-muted", className)} {...props}>
      {children}
    </p>
  );
}

/** A titled block of settings; the heading spacing is what separates sections. */
export function SettingsSection({
  title,
  className,
  children,
  ...props
}: { title?: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "[&>h2]:mt-[42px] [&>h2]:mb-1.5 [&>h2]:text-base [&>h2]:font-[660] [&:first-of-type>h2]:mt-[34px]",
        className,
      )}
      {...props}
    >
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

/**
 * One labelled setting with its control on the right. Pass `title`/`detail` for
 * the common shape, or compose the two columns yourself.
 */
export function SettingRow({
  title,
  detail,
  className,
  children,
  ...props
}: { title?: ReactNode; detail?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Below 640px the control drops under its label instead of overflowing.
        "grid grid-cols-1 items-start gap-2 border-b border-line py-4",
        "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5",
        "[&_strong]:block [&_strong]:text-sm [&_strong]:font-[610]",
        // A row's control column stays one width so the rows read as a column.
        "[&_select]:w-full sm:[&_select]:w-60",
        "[&>div>p]:mt-1 [&>div>p]:max-w-125 [&>div>p]:text-[13px] [&>div>p]:leading-[1.5] [&>div>p]:text-muted",
        className,
      )}
      {...props}
    >
      {title === undefined ? children : (
        <>
          <div>
            <strong>{title}</strong>
            {detail ? <p>{detail}</p> : null}
          </div>
          {children ? <div className="flex items-center gap-2">{children}</div> : null}
        </>
      )}
    </div>
  );
}

export function ReviewList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-5 border-t border-line", className)} {...props}>
      {children}
    </div>
  );
}

export function ReviewRow({
  as = "article",
  className,
  children,
  ...props
}: { as?: "article" | "button"; className?: string; children: ReactNode } & Record<string, unknown>) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "grid grid-cols-1 items-start gap-3 border-b border-line px-1 py-4.5",
        "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6",
        "[&_h3]:mt-1.5 [&_h3]:mb-1 [&_h3]:text-[15px] [&_h3]:font-[650]",
        "[&_p]:max-w-165 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-ink-soft",
        as === "button" && "w-full text-left disabled:opacity-60",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

export function PanelSectionHeading({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-2.5 flex items-center justify-between gap-3",
        "[&_h2]:text-[13px] [&_h2]:font-[650] [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** What the document says about the Sources frozen into it. */
export function ContextSummary({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-9 flex items-center justify-between gap-4 border-t border-line pt-4.5 text-[13px] text-muted",
        "[&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** The Skill picker that drops out of a target button. */
export function PickerGroup({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-line [&+&]:mt-[5px] [&+&]:border-t [&+&]:pt-[5px]",
        "[&>button]:block [&>button]:w-full [&>button]:rounded-sm [&>button]:p-2 [&>button]:text-left [&>button:hover]:bg-surface-muted",
        "[&_span]:block [&_span]:text-[13px] [&_span]:font-[560] [&_span]:text-ink",
        "[&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A dropdown built on <details> so it closes without extra state. */
export function DetailsMenu({ className, children, ...props }: HTMLAttributes<HTMLDetailsElement>) {
  return (
    <details
      className={cn(
        "relative",
        "[&>summary]:inline-flex [&>summary]:size-8 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-center [&>summary]:rounded-sm [&>summary]:text-muted",
        "[&>summary:hover]:bg-surface-muted [&>summary:hover]:text-ink [&[open]>summary]:bg-surface-muted [&[open]>summary]:text-ink",
        "[&>div]:absolute [&>div]:top-9.5 [&>div]:right-0 [&>div]:z-20 [&>div]:w-44 [&>div]:rounded-md [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:p-1 [&>div]:shadow-[0_14px_36px_rgb(26_27_24/14%)]",
        "[&>div_button]:flex [&>div_button]:h-8.5 [&>div_button]:w-full [&>div_button]:items-center [&>div_button]:gap-2 [&>div_button]:rounded-sm [&>div_button]:px-[9px] [&>div_button]:text-left [&>div_button]:text-ink-soft [&>div_button:hover]:bg-surface-muted",
        className,
      )}
      {...props}
    >
      {children}
    </details>
  );
}

/** The saved-content list. Its checkbox stays hidden until a row is touched. */
export function LibraryList({
  selecting = false,
  className,
  children,
  ...props
}: { selecting?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4.5 border-t border-line", selecting && "[&_label]:opacity-100", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function LibraryRow({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        "group/row grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 border-b border-line px-1 py-[17px]",
        "[&_h3]:mt-[7px] [&_h3]:mb-1 [&_h3]:line-clamp-2 [&_h3]:text-[15px] [&_h3]:leading-[1.45] [&_h3]:font-[640]",
        "[&>button_p]:line-clamp-1 [&>button_p]:max-w-170 [&>button_p]:text-sm [&>button_p]:leading-[1.55] [&>button_p]:text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function LibraryRowMain({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "min-w-0 text-left text-inherit",
        "hover:[&_h3]:underline hover:[&_h3]:decoration-line-strong hover:[&_h3]:underline-offset-[3px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function RowSelect({ className, children, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "inline-flex pt-[3px] opacity-0 transition-opacity duration-120",
        "group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[input:checked]:opacity-100",
        "[&_input]:accent-accent",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

/**
 * A provenance-first row: who or what produced it on the left, the thing itself
 * on the right. The origin column has to fit "Draft reply · complete" without
 * wrapping, which is what sets its width.
 */
export function ProvenanceRow({
  as = "div",
  className,
  children,
  ...props
}: { as?: "div" | "button"; className?: string; children: ReactNode } & Record<string, unknown>) {
  const Tag = as;
  return (
    <Tag
      {...(as === "button" ? { type: "button" } : {})}
      className={cn(
        "grid w-full grid-cols-[190px_minmax(0,1fr)] items-start gap-3 border-b border-line py-3 text-left text-[13px] text-ink-soft",
        as === "button" && "hover:bg-surface-muted",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

/** A numbered Source behind a generated answer. Pressed means its panel is open. */
export function CitationChip({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-7 items-center gap-[5px] rounded-full border border-accent-line bg-accent-soft px-[9px] py-1 text-xs text-[#424ebc]",
        "hover:bg-[#e4e6fc] aria-pressed:border-accent aria-pressed:bg-[#dfe1fb]",
        "[&>span:first-child]:font-[650]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
