import { describe, expect, it } from "vitest";
import { visibleSurface, type Showing } from "./visible";

const nothing: Showing = { command: false, selection: false, voice: false, voiceBusy: false };
const showing = (over: Partial<Showing>): Showing => ({ ...nothing, ...over });

describe("only one surface at a time", () => {
  /** The bug this exists for: a caret bar floating beside a selection toolbar. */
  it("hides the idle caret bar behind the selection toolbar", () => {
    expect(visibleSurface(showing({ voice: true, selection: true }))).toBe("selection");
  });

  it("never returns two surfaces for any combination of states", () => {
    const flags = ["command", "selection", "voice", "voiceBusy"] as const;
    for (let bits = 0; bits < 1 << flags.length; bits += 1) {
      const state = showing(Object.fromEntries(flags.map((flag, i) => [flag, Boolean(bits & (1 << i))])));
      expect(typeof visibleSurface(state)).toBe("string");
    }
  });
});

describe("what wins", () => {
  // A transcript used to top this list, waiting in a panel to be accepted.
  // Spoken words go straight to the caret now, so there is no such surface.

  it("keeps the command box above the bars", () => {
    expect(visibleSurface(showing({ command: true, selection: true, voice: true, voiceBusy: true }))).toBe("command");
  });

  /** Losing the caret bar mid-recording would leave no way to stop. */
  it("keeps a recording caret bar above a stale selection", () => {
    expect(visibleSurface(showing({ voice: true, voiceBusy: true, selection: true }))).toBe("voice");
  });

  it("shows the caret bar when nothing is selected", () => {
    expect(visibleSurface(showing({ voice: true }))).toBe("voice");
  });

  /** A busy bar with nowhere to sit must not swallow the selection toolbar. */
  it("falls through to the selection toolbar when the caret bar has no place", () => {
    expect(visibleSurface(showing({ voiceBusy: true, selection: true }))).toBe("selection");
  });

  it("shows nothing when there is nothing to show", () => {
    expect(visibleSurface(nothing)).toBe("none");
  });
});
