/**
 * Tailwind classes for the Side Panel. It is a narrow, dense surface, so most
 * of these differ from the web app's equivalents and stay local to the panel.
 */

export const panelFrame = "flex min-h-screen flex-col bg-panel text-ink";

export const panelHeader =
  "flex min-h-13.5 shrink-0 items-center justify-between gap-3 border-b border-line pr-3.5 pl-4";

export const panelTitleButton =
  "min-w-0 flex-1 py-1.5 text-left [&>strong]:block [&>strong]:truncate [&>strong]:text-sm [&>strong]:font-[650] [&>span]:mt-px [&>span]:flex [&>span]:items-center [&>span]:gap-[3px] [&>span]:text-xs [&>span]:text-muted hover:[&>strong]:text-accent";

export const panelScroll =
  "min-h-0 flex-1 overflow-auto px-4 pt-4.5 pb-8 [scrollbar-gutter:stable] max-[360px]:px-3";

export const panelSection = "min-w-0 [&+&]:mt-7";

export const panelSectionHeading =
  "mb-2.5 flex items-center justify-between gap-3 [&_h2]:text-[13px] [&_h2]:font-[650] [&>a]:inline-flex [&>a]:text-muted [&>a:hover]:text-ink";

export const headingActions =
  "inline-flex items-center gap-1.5 [&>a]:inline-flex [&>a]:size-7 [&>a]:items-center [&>a]:justify-center [&>a]:rounded-sm [&>a]:text-muted [&>a:hover]:bg-surface-muted [&>a:hover]:text-ink";

export const settingsSection = "pt-0.5 pb-5";

export const panelFooter =
  "relative shrink-0 border-t border-line bg-panel px-4 pt-3 pb-4 max-[360px]:px-3";

export const panelComposer =
  "flex min-h-13.5 items-end gap-2 rounded-lg border border-line-strong bg-surface p-2 [&>textarea]:max-h-28 [&>textarea]:min-h-11 [&>textarea]:min-w-0 [&>textarea]:flex-1 [&>textarea]:resize-none [&>textarea]:border-0 [&>textarea]:bg-transparent [&>textarea]:p-1.5 [&>textarea]:text-sm [&>textarea]:outline-0";

export const card =
  "break-anywhere rounded-lg border border-line bg-surface p-3.5 [&>p]:mt-2.5 [&>p]:text-[13px] [&>p]:leading-[1.55] [&>p]:text-ink-soft";

export const commentCard = `${card} [&+&]:mt-2.5 [&_blockquote]:mt-2.5 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-2.5 [&_blockquote]:text-xs [&_blockquote]:leading-[1.5] [&_blockquote]:text-muted`;

export const contextCard = `${card} [&+&]:mt-2.5 [&>strong]:mt-2 [&>strong]:block [&>strong]:text-[13px]`;

export const draftCard = `${card} [&_textarea]:min-h-37`;

export const warningBar =
  "mb-3 rounded-md border border-[#ead8b3] bg-[#fffaf1] px-[11px] py-[9px] text-xs leading-[1.45] text-[#755117]";

export const meta = "mt-2 text-xs text-faint";

export const quietPill =
  "inline-flex h-[25px] items-center rounded-full border border-line bg-surface px-[9px] text-xs text-muted";

export const inlineActions = "flex flex-wrap items-center gap-[7px] [&>select]:h-9 [&>select]:w-auto [&>select]:min-w-37.5 [&>select]:flex-1 [&>select]:rounded-sm [&>select]:border [&>select]:border-line-strong [&>select]:bg-surface [&>select]:px-[9px] [&>select]:text-ink";

export const button =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-[13px] font-[540] text-ink-soft no-underline enabled:hover:border-line-strong enabled:hover:bg-surface-muted enabled:hover:text-ink disabled:opacity-[0.46]";

export const buttonPrimary =
  "border-accent bg-accent text-white enabled:hover:border-accent-hover enabled:hover:bg-accent-hover enabled:hover:text-white";

export const buttonIcon = "w-8 min-w-8 !px-0";

export const spin = "animate-[logue-spin_0.9s_linear_infinite] motion-reduce:animate-none";

export const recordingStatus =
  "mr-0.5 inline-flex items-center gap-[7px] text-[13px] whitespace-nowrap text-ink-soft [&>span]:size-[7px] [&>span]:rounded-full [&>span]:bg-danger [&>span]:motion-safe:animate-[logue-recording-pulse_1.4s_ease-in-out_infinite]";

export const menu =
  "min-w-43 rounded-md border border-line bg-surface p-1 shadow-[0_14px_36px_rgb(26_27_24/14%)] [&_button]:min-h-8.5 [&_button]:w-full [&_button]:rounded-sm [&_button]:px-[9px] [&_button]:text-left [&_button]:text-ink-soft [&_button:hover]:bg-surface-muted [&_button:hover]:text-ink";

export const organize =
  "mx-4 mt-2.5 shrink-0 rounded-lg border border-line bg-surface p-3";

export const choiceList =
  "grid gap-0.5 [&>button]:flex [&>label]:flex [&>button]:min-h-8.5 [&>label]:min-h-8.5 [&>button]:items-center [&>label]:items-center [&>button]:gap-2 [&>label]:gap-2 [&>button]:rounded-sm [&>label]:rounded-sm [&>button]:px-2 [&>label]:px-2 [&>button]:text-left [&>label]:text-left [&>button]:text-ink-soft [&>label]:text-ink-soft [&>button:hover]:bg-surface-muted [&>label:hover]:bg-surface-muted [&_input]:m-0 [&_input]:accent-accent";

export const field =
  "mt-3 grid gap-1.5 text-xs font-[570] text-muted [&_input]:h-9 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-sm [&_input]:border [&_input]:border-line-strong [&_input]:bg-surface [&_input]:px-[9px] [&_input]:text-ink [&_select]:h-9 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-sm [&_select]:border [&_select]:border-line-strong [&_select]:bg-surface [&_select]:px-[9px] [&_select]:text-ink";

export const associations =
  "mt-2.5 border-t border-line pt-0.5";

export const associationList =
  "mt-2.5 grid gap-0.5 [&>div]:flex [&>div]:min-h-9.5 [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&>div]:rounded-sm [&>div]:px-2 [&>div]:py-1 [&>div:hover]:bg-surface-muted [&_span]:grid [&_span]:min-w-0 [&_span]:gap-px [&_strong]:text-xs [&_strong]:font-[590] [&_strong]:text-ink-soft [&_small]:text-[11px] [&_small]:text-muted [&_button]:p-[5px] [&_button]:text-xs [&_button]:text-muted [&_button:hover]:text-ink";

export const sources =
  "mt-3 overflow-hidden rounded-lg border border-line [&>button]:flex [&>button]:min-h-9.5 [&>button]:w-full [&>button]:items-center [&>button]:justify-between [&>button]:gap-2.5 [&>button]:bg-surface [&>button]:px-[11px] [&>button]:text-left [&>button]:text-ink-soft [&>button>span:last-child]:flex [&>button>span:last-child]:items-center [&>button>span:last-child]:gap-1 [&>button>span:last-child]:text-xs [&>button>span:last-child]:text-muted [&>label]:grid [&>label]:grid-cols-[auto_minmax(0,1fr)_auto] [&>label]:items-start [&>label]:gap-[9px] [&>label]:border-t [&>label]:border-line [&>label]:px-[11px] [&>label]:py-2.5 [&>label>input]:mt-[3px] [&>label>input]:accent-accent [&>label>span]:grid [&>label>span]:min-w-0 [&>label>span]:gap-0.5 [&>label_strong]:truncate [&>label_strong]:text-xs [&>label_strong]:font-[620] [&>label_strong]:text-ink [&>label_small]:line-clamp-2 [&>label_small]:text-[11px] [&>label_small]:leading-[1.4] [&>label_small]:text-muted [&>label>button]:inline-flex [&>label>button]:size-6.5 [&>label>button]:items-center [&>label>button]:justify-center [&>label>button]:rounded-sm [&>label>button]:text-muted [&>label>button:hover]:bg-surface-muted [&>label>button:hover]:text-ink";

export const profileButton =
  "inline-flex min-h-7 max-w-[58%] items-center gap-1 overflow-hidden rounded-sm px-[5px] text-xs whitespace-nowrap text-ellipsis text-muted hover:bg-surface-muted hover:text-ink aria-expanded:bg-surface-muted aria-expanded:text-ink";

export const profilePopover =
  "absolute right-4 bottom-[calc(100%-4px)] left-4 z-20 rounded-lg border border-line bg-surface p-3 shadow-[0_16px_44px_rgb(24_25_22/16%)]";

export const commentSource = "mt-1.5 line-clamp-2 text-xs leading-[1.45] text-muted";

export const inserted =
  "flex min-h-28 items-center justify-center gap-[7px] text-sm text-[#42734a]";

export const correction =
  "mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[7px] text-muted max-[360px]:grid-cols-1 [&_input]:h-9 [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded-sm [&_input]:border [&_input]:border-line-strong [&_input]:bg-surface [&_input]:px-[9px] [&_input]:text-ink max-[360px]:[&>span]:hidden";

export const citationChip =
  "inline-flex min-h-7 items-center gap-[5px] rounded-full border border-accent-line bg-accent-soft px-[9px] py-1 text-xs text-[#424ebc] aria-pressed:border-accent aria-pressed:bg-[#e8eafd] [&>span:first-child]:font-[650]";

export const skillPicker =
  "absolute top-[calc(100%+8px)] right-0 left-0 z-10 overflow-hidden rounded-md border border-line-strong bg-surface shadow-[0_14px_36px_rgba(30,31,29,0.16)]";

export const skillPickerLabel = "px-2 pt-1.5 pb-1 text-[11px] font-[650] text-muted";

export const skillPickerGroup =
  "border-line [&+&]:mt-[5px] [&+&]:border-t [&+&]:pt-[5px] [&>button]:block [&>button]:w-full [&>button]:rounded-sm [&>button]:p-2 [&>button]:text-left [&>button:hover]:bg-surface-muted [&_span]:block [&_span]:text-[13px] [&_span]:font-[560] [&_span]:text-ink [&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:text-muted";

export const originLabel = "inline-flex items-center gap-1.5 text-xs font-[570] text-muted [&_svg]:shrink-0";
