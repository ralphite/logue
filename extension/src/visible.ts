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

export type Surface = "voice" | "selection" | "none";

export interface Showing {
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
 * 1. the caret bar mid-recording — the only way to stop, and the only place the
 *    error is legible;
 * 2. the selection toolbar — selecting text is a deliberate act, and the
 *    toolbar sits on the selection, so it is what they are reaching for;
 * 3. the idle caret bar — ambient, and the cheapest thing to give up.
 *
 * Two surfaces have left this list. A transcript used to top it, waiting in a
 * panel to be accepted; spoken words go straight to the caret now. An ask box
 * came next, opened over the page to ask about the page — that lives in the
 * side panel, which is not on the page and so cannot cover it.
 */
export function visibleSurface(showing: Showing): Surface {
  if (showing.voice && showing.voiceBusy) return "voice";
  if (showing.selection) return "selection";
  if (showing.voice) return "voice";
  return "none";
}
