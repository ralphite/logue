/**
 * Which single surface is on screen.
 *
 * Every surface used to decide for itself, with a hand-maintained list of the
 * others to hide behind (`!candidate && !commandOpen`). One omission and two of
 * them float over the same page at once — which is what happened to the
 * caret bar and the selection toolbar. The rule lives here instead, in one
 * ordered list, so "only one at a time" is a property of the code rather than
 * something each surface has to remember.
 */

export type Surface = "command" | "voice" | "selection" | "none";

export interface Showing {
  /** The command box is open. */
  command: boolean;
  /** Text is selected and the toolbar has somewhere to sit. */
  selection: boolean;
  /** The caret bar has somewhere to sit. */
  voice: boolean;
  /** The caret bar is recording, transcribing, or showing an error. */
  voiceBusy: boolean;
}

/**
 * Ordered by how much the person would lose if it were covered:
 *
 * 1. the command box — they opened it on purpose;
 * 2. the caret bar mid-recording — the only way to stop, and the only place the
 *    error is legible;
 * 3. the selection toolbar — selecting text is a deliberate act, and the
 *    toolbar sits on the selection, so it is what they are reaching for;
 * 4. the idle caret bar — ambient, and the cheapest thing to give up.
 *
 * A transcript used to top this list, waiting in a panel to be accepted. It
 * does not wait any more: spoken words go straight to the caret, and the only
 * thing left to show is that they landed, which the caret bar itself says.
 */
export function visibleSurface(showing: Showing): Surface {
  if (showing.command) return "command";
  if (showing.voice && showing.voiceBusy) return "voice";
  if (showing.selection) return "selection";
  if (showing.voice) return "voice";
  return "none";
}
