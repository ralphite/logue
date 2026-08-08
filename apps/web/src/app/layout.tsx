import type { ReactNode } from "react";

/**
 * Layout shared by every route. Routes stack a scroll container, a reading axis
 * and a heading; keeping those here is what stops the pages from drifting apart.
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

export const scrollClass = "scroll-surface @container min-h-0 flex-1 overflow-auto";

export function axisClass(axis: Axis = "list") {
  return `mx-auto w-full ${axisWidth[axis]} ${axisPadding[axis]} px-[42px] max-[820px]:px-6`;
}

export function PageScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${scrollClass} ${className}`}>{children}</div>;
}

export function PageAxis({ axis = "list", children, className = "" }: { axis?: Axis; children: ReactNode; className?: string }) {
  return <div className={`${axisClass(axis)} ${className}`}>{children}</div>;
}

export function PageHeading({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-10 flex items-start justify-between gap-6">
      <div className={headingCopyClass}>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export const cardClass = "rounded-lg border border-line bg-surface p-3.5 [&>p]:mt-2.5 [&>p]:text-[13px] [&>p]:leading-[1.55] [&>p]:text-ink-soft";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>;
}

export function CardText({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[13px] leading-[1.55] text-ink-soft">{children}</p>;
}

export function SearchField({ children }: { children: ReactNode }) {
  return (
    <label className="flex h-10 flex-1 items-center gap-[9px] rounded-md border border-line-strong bg-surface px-3 text-muted [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-ink [&_input]:outline-0">
      {children}
    </label>
  );
}

export function Segmented({ children, ...props }: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex items-center gap-0.5 border-b border-line" {...props}>
      {children}
    </div>
  );
}

export function segmentedTabClass(active: boolean) {
  return [
    "relative px-3 pt-2.5 pb-3 text-sm",
    active
      ? "font-[610] text-ink after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-ink after:content-['']"
      : "text-muted",
  ].join(" ");
}

/** A titled block of settings; the heading spacing is what separates sections. */
export function SettingsSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mt-[42px] mb-1.5 text-base font-[660] first:mt-[34px]">{title}</h2>
      {children}
    </section>
  );
}

export function PanelSectionHeading({ children }: { children: ReactNode }) {
  return <div className="mb-2.5 flex items-center justify-between gap-3 [&_h2]:text-[13px] [&_h2]:font-[650] [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted">{children}</div>;
}

const focusRing = "focus:border-accent-line focus:shadow-[0_0_0_2px_var(--color-accent-soft)]";

export const inputClass = `h-9 w-full min-w-0 rounded-md border border-line-strong bg-surface px-[11px] text-ink outline-0 ${focusRing}`;
export const textareaClass = `min-h-[150px] w-full resize-y rounded-md border border-line-strong bg-surface px-3.5 py-3 leading-[1.6] text-ink outline-0 ${focusRing}`;
export const selectClass = inputClass;

/** Toolbar selects size to their content instead of filling the row. */
export const toolbarSelectClass = `${inputClass} w-auto max-w-37.5 min-w-31`;

export const fieldLabelClass = "grid gap-[7px] text-[13px] text-ink-soft";
export const checkboxRowClass = "grid min-h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-[7px] self-end text-[13px] text-ink-soft";
export const formGridClass = "my-4.5 grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1";

export const inlineActionsClass = "flex items-center gap-2";
export const settingRowClass = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-line py-4 [&>div>p]:mt-1 [&>div>p]:max-w-125 [&>div>p]:text-[13px] [&>div>p]:leading-[1.5] [&>div>p]:text-muted [&_strong]:block [&_strong]:text-sm [&_strong]:font-[610]";
export const reviewListClass = "mt-5 border-t border-line";
export const reviewRowClass = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-line px-1 py-4.5 [&_h3]:mt-1.5 [&_h3]:mb-1 [&_h3]:text-[15px] [&_h3]:font-[650] [&_p]:max-w-165 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-ink-soft";

export const metaClass = "mt-2 text-xs text-faint";
export const eyebrowClass = "mb-2.5 text-[13px] text-muted";
export const leadClass = "mt-2.5 max-w-160 text-[15px] text-muted";

export const headingCopyClass = "min-w-0 [&>h1]:text-[32px] [&>h1]:leading-[1.16] [&>h1]:font-[690] [&>h1]:tracking-[-0.04em] [&>h1]:text-ink [&>p]:mt-2.5 [&>p]:max-w-160 [&>p]:text-[15px] [&>p]:text-muted";

export const contextSummaryClass = "mt-9 flex items-center justify-between gap-4 border-t border-line pt-4.5 text-[13px] text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5";

export const settingsSectionClass = "[&>h2]:mt-[42px] [&>h2]:mb-1.5 [&>h2]:text-base [&>h2]:font-[660] [&:first-of-type>h2]:mt-[34px]";
export const panelHeadingClass = "mb-2.5 flex items-center justify-between gap-3 [&_h2]:text-[13px] [&_h2]:font-[650] [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted";

export const inspectorHeaderClass = "flex min-h-14 items-center justify-between gap-3 border-b border-line pr-4 pl-5 [&_h2]:text-sm [&_h2]:font-[650]";
export const inspectorScrollClass = "scroll-surface min-h-0 flex-1 overflow-auto px-4 pt-3.5 pb-8";

export const sourceListClass = "flex flex-col";
export const sourceBundleClass = "border-b border-line px-1 pt-[15px] pb-4 first:pt-1";
export const sourceBundleActiveClass = "-mx-2 rounded-md border border-accent-line bg-[#fafaff] px-3 pt-3.5 pb-[15px]";
export const sourceHeadingClass = "flex items-start justify-between gap-2.5 [&_h3]:mt-[7px] [&_h3]:text-sm [&_h3]:leading-[1.35] [&_h3]:font-[640] [&_h3]:text-ink";
export const sourceBodyClass = "mt-3.5 [&_p]:mt-1.5 [&_p]:text-[13px] [&_p]:leading-[1.58] [&_p]:text-ink-soft";
export const sourceCitedClass = "rounded-r-md border-l-2 border-accent bg-accent-soft px-2.5 py-2";
export const sourceMetaClass = "mt-2.5 text-xs text-faint";
export const sourceToggleClass = "mt-[11px] inline-flex items-center gap-1 rounded-sm pt-[3px] pr-[5px] pb-[3px] pl-px text-xs text-muted hover:text-ink-soft";

export const dialogBackdropClass = "fixed inset-0 z-50 grid place-items-center bg-[rgba(24,25,23,0.24)] p-6";
export const dialogClass = "grid w-full max-w-[520px] gap-4.5 rounded-xl border border-line-strong bg-surface p-5 shadow-[0_18px_56px_rgba(30,31,29,0.18)] [&_h2]:mt-1.5 [&_h2]:text-[20px]";

export const skillPickerGroupClass = "border-line [&+&]:mt-[5px] [&+&]:border-t [&+&]:pt-[5px] [&>button]:block [&>button]:w-full [&>button]:rounded-sm [&>button]:p-2 [&>button]:text-left [&>button:hover]:bg-surface-muted [&_span]:block [&_span]:text-[13px] [&_span]:font-[560] [&_span]:text-ink [&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:text-muted";

/** Underlined tab used by the project sub-navigation and settings segments. */
export function tabClass(active: boolean) {
  return `relative px-3 py-[11px] text-[13px] ${active ? "font-[620] text-ink after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-ink after:content-['']" : "text-muted"}`;
}

export const documentMenuClass = "relative [&>summary]:inline-flex [&>summary]:size-8 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-center [&>summary]:rounded-sm [&>summary]:text-muted [&>summary:hover]:bg-surface-muted [&>summary:hover]:text-ink [&[open]>summary]:bg-surface-muted [&[open]>summary]:text-ink [&>div]:absolute [&>div]:top-9.5 [&>div]:right-0 [&>div]:z-20 [&>div]:w-44 [&>div]:rounded-md [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:p-1 [&>div]:shadow-[0_14px_36px_rgb(26_27_24/14%)] [&>div_button]:flex [&>div_button]:h-8.5 [&>div_button]:w-full [&>div_button]:items-center [&>div_button]:gap-2 [&>div_button]:rounded-sm [&>div_button]:px-[9px] [&>div_button]:text-left [&>div_button]:text-ink-soft [&>div_button:hover]:bg-surface-muted";

export const libraryListClass = "mt-4.5 border-t border-line";
export const libraryRowClass = "grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 border-b border-line px-1 py-[17px] [&_h3]:mt-[7px] [&_h3]:mb-1 [&_h3]:line-clamp-2 [&_h3]:text-[15px] [&_h3]:leading-[1.45] [&_h3]:font-[640] [&>button_p]:line-clamp-1 [&>button_p]:max-w-170 [&>button_p]:text-sm [&>button_p]:leading-[1.55] [&>button_p]:text-ink-soft";
export const libraryRowMainClass = "min-w-0 text-left text-inherit hover:[&_h3]:underline hover:[&_h3]:decoration-line-strong hover:[&_h3]:underline-offset-[3px]";
/** The checkbox stays out of the way until the row is touched or selection starts. */
export const rowSelectClass = "inline-flex pt-[3px] opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[input:checked]:opacity-100 [&_input]:accent-accent";

export const chipButtonClass = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft no-underline";
export const pillClass = "inline-flex h-[25px] items-center rounded-full border border-line bg-surface px-[9px] text-xs text-muted";
export const pillSuggestedClass = "border-[#e8d5ad] bg-[#fffaf0] text-warning";

export const warningBarClass ="mb-3 rounded-md border border-[#ead8b3] bg-[#fffaf1] px-[11px] py-[9px] text-xs leading-[1.45] text-[#755117]";
export const dangerCardClass = "mt-4.5 rounded-lg border border-[#e7c8c3] bg-[#fff8f7] px-3.5 py-3 text-[13px] leading-[1.55] [&>p]:mb-3.5 [&>p]:text-ink-soft";
export const readyBarClass = "mt-4.5 rounded-lg border border-line px-3.5 py-3 text-[13px] leading-[1.55]";
