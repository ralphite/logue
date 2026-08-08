/**
 * The design vocabulary of every surface injected into a host page. One
 * floating family, Notion-density: 28px controls, quiet grays, a single
 * accented action per surface, everything else disclosed on demand.
 */

/** Three-layer hairline + soft shadow, like a Notion popover. */
export const floatingPanel =
  "fixed z-surface overflow-hidden rounded-[10px] bg-white text-ink shadow-[0_0_0_1px_rgb(15_15_15/6%),0_3px_6px_rgb(15_15_15/8%),0_9px_24px_rgb(15_15_15/12%)]";

/** The one-row variant for toolbars that sit beside text. */
export const floatingBar =
  "fixed z-surface flex h-8 items-center gap-0.5 rounded-[10px] bg-white p-0.5 text-ink shadow-[0_0_0_1px_rgb(15_15_15/6%),0_3px_6px_rgb(15_15_15/8%),0_9px_24px_rgb(15_15_15/12%)]";

export const iconButton =
  "inline-flex size-7 min-w-7 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted hover:text-ink disabled:opacity-45";

export const actionButton =
  "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-transparent px-1.5 text-xs font-[560] whitespace-nowrap text-ink-soft hover:bg-surface-muted hover:text-ink disabled:opacity-45 [&_kbd]:font-sans [&_kbd]:text-[10px] [&_kbd]:opacity-60";

export const primaryAction = "bg-accent text-white hover:bg-accent-hover hover:text-white";

/** Low-frequency pickers open from a bare chevron, not a labeled button. */
export const disclosureButton =
  "inline-flex h-7 w-4.5 min-w-4.5 items-center justify-center rounded-md text-faint hover:bg-surface-muted hover:text-ink aria-expanded:bg-surface-muted aria-expanded:text-ink";

export const profilePopover =
  "absolute bottom-[calc(100%+6px)] z-popover w-[280px] rounded-[10px] border border-line bg-surface p-2.5 shadow-[0_9px_24px_rgb(15_15_15/14%)]";

export const errorBubble =
  "absolute w-max max-w-64 rounded-lg border border-[#efc9c4] bg-white px-2 py-1.5 text-xs leading-[1.4] text-[#9b3e35] shadow-[0_6px_18px_rgb(15_15_15/10%)]";

export const errorAction =
  "ml-1.5 font-[650] underline underline-offset-2";

export const spinner = "shrink-0 animate-[logue-spin_0.8s_linear_infinite]";

/** Recording is the pulsing dot itself; the word lives in the status tree. */
export const recordingDot =
  "mx-1.5 size-2 shrink-0 animate-[logue-recording-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger";

export const menuSurface =
  "min-w-44 max-w-72 rounded-lg border border-line bg-surface p-1 shadow-[0_9px_24px_rgb(15_15_15/14%)] [&>button]:flex [&>button]:h-7 [&>button]:w-full [&>button]:items-center [&>button]:gap-1.5 [&>button]:overflow-hidden [&>button]:rounded-[5px] [&>button]:px-1.5 [&>button]:text-left [&>button]:text-xs [&>button]:whitespace-nowrap [&>button]:text-ink-soft [&>button:hover]:bg-surface-muted [&>button:hover]:text-ink";

export const closeButton =
  "inline-flex size-6 items-center justify-center rounded-[5px] text-faint hover:bg-surface-muted hover:text-ink";

/** Dismiss pinned to a panel corner so it never needs a header row. */
export const cornerClose = "absolute top-1 right-1 z-10";

export const fieldInput =
  "h-7 min-w-0 rounded-md border border-line-strong bg-surface px-1.5 text-xs text-ink";

/** The chevron is absolutely placed, so the native select arrow is removed. */
export const barSelect =
  "relative inline-flex min-w-0 max-w-44 items-center [&>select]:h-7 [&>select]:max-w-44 [&>select]:appearance-none [&>select]:overflow-hidden [&>select]:rounded-md [&>select]:border-0 [&>select]:bg-transparent [&>select]:py-0 [&>select]:pr-5.5 [&>select]:pl-1.5 [&>select]:text-xs [&>select]:text-ellipsis [&>select]:text-ink-soft [&>select]:outline-0 [&>select:hover]:bg-surface-muted [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-1.5 [&>svg]:text-faint";

/** A short confirmation or failure pinned beside the selection it belongs to. */
export const selectionFeedback =
  "fixed z-hint max-w-64 rounded-md border border-line bg-surface px-2 py-1.5 text-xs leading-[1.4] text-ink-soft shadow-[0_6px_18px_rgb(15_15_15/10%)] [&_button]:ml-1.5 [&_button]:font-[650] [&_button]:text-accent [&_button]:underline [&_button]:underline-offset-2";
