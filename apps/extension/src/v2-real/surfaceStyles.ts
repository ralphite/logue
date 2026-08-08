/**
 * Tailwind classes shared by the surfaces injected into a host page. They live
 * together because the inline, selection, candidate and command surfaces are
 * one floating control family and must stay visually identical.
 */

export const floatingPanel =
  "fixed z-surface overflow-hidden rounded-[13px] border border-[rgb(35_37_31/13%)] bg-[rgb(255_255_255/98%)] text-ink shadow-[0_18px_50px_rgb(25_27_23/18%)] backdrop-blur-[14px]";

export const iconButton =
  "inline-flex size-8.5 min-w-8.5 items-center justify-center rounded-md text-ink-soft";

export const actionButton =
  "inline-flex h-8 items-center justify-center gap-[5px] rounded-[7px] border border-transparent px-[9px] text-xs font-[560] whitespace-nowrap text-ink-soft hover:bg-surface-muted hover:text-ink disabled:opacity-[0.46] [&_kbd]:font-sans [&_kbd]:opacity-[0.68]";

export const primaryAction = "bg-accent text-white hover:bg-accent-hover hover:text-white";

export const profileButton =
  "inline-flex min-w-0 items-center justify-between gap-[5px] overflow-hidden rounded-[7px] px-[7px] text-xs whitespace-nowrap text-muted hover:bg-surface-muted hover:text-ink aria-expanded:bg-surface-muted aria-expanded:text-ink [&_span]:overflow-hidden [&_span]:text-ellipsis";

export const profilePopover =
  "absolute bottom-[calc(100%+8px)] z-popover w-[284px] rounded-xl border border-line bg-surface p-3 shadow-[0_18px_48px_rgb(20_21_18/18%)]";

export const errorBubble =
  "absolute w-max max-w-65 rounded-[9px] border border-[#efc9c4] bg-white px-2.5 py-2 text-xs leading-[1.4] text-[#9b3e35] shadow-[0_8px_24px_rgb(25_27_23/12%)]";

export const errorAction =
  "ml-2 font-[650] underline underline-offset-2";

export const spinner = "shrink-0 animate-[logue-spin_0.8s_linear_infinite]";

export const recordingChip =
  "inline-flex items-center gap-[7px] px-1.5 text-xs whitespace-nowrap text-ink-soft";

export const recordingDot =
  "size-[7px] animate-[logue-recording-pulse_1.4s_ease-in-out_infinite] rounded-full bg-danger";

export const menuSurface =
  "min-w-48 max-w-75 rounded-[9px] border border-line bg-surface p-1 shadow-[0_14px_38px_rgb(20_21_18/16%)] [&>button]:flex [&>button]:min-h-9 [&>button]:w-full [&>button]:items-center [&>button]:gap-2 [&>button]:overflow-hidden [&>button]:rounded-sm [&>button]:px-[9px] [&>button]:text-left [&>button]:whitespace-nowrap [&>button]:text-ink-soft [&>button:hover]:bg-surface-muted [&>button:hover]:text-ink";

export const closeButton =
  "inline-flex size-7 items-center justify-center rounded-sm text-muted hover:bg-surface-muted hover:text-ink";

export const commandIcon =
  "inline-flex h-8 w-8 items-center justify-center gap-[5px] rounded-[7px] text-xs font-semibold text-muted hover:bg-surface-muted hover:text-ink disabled:opacity-45";

export const commandPrimary =
  "inline-flex h-8 items-center justify-center gap-[5px] rounded-[7px] bg-accent px-2.5 text-xs font-semibold text-white disabled:opacity-45";

/** The chevron is absolutely placed, so the native select arrow is removed. */
export const commandSelect =
  "relative inline-flex min-w-0 max-w-47.5 items-center [&>select]:h-8 [&>select]:max-w-47.5 [&>select]:appearance-none [&>select]:overflow-hidden [&>select]:rounded-[7px] [&>select]:border-0 [&>select]:bg-transparent [&>select]:py-0 [&>select]:pr-6.5 [&>select]:pl-2 [&>select]:text-xs [&>select]:text-ellipsis [&>select]:text-ink-soft [&>select]:outline-0 [&>select:hover]:bg-surface-muted [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-2 [&>svg]:text-muted";

export const candidateAction =
  "inline-flex min-h-8 max-w-[54%] items-center gap-[5px] overflow-hidden rounded-[7px] px-[9px] whitespace-nowrap text-muted hover:bg-surface-muted hover:text-ink disabled:opacity-[0.46]";

export const fieldInput =
  "h-8.5 min-w-0 rounded-[7px] border border-line-strong bg-surface px-2 text-ink";
