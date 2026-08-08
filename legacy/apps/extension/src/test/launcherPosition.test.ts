import { describe, expect, it } from "vitest";
import { caretLauncherPosition, clampLauncherPosition, defaultLauncherPosition, launcherErrorPlacement } from "../launcherPosition";

describe("launcher position", () => {
  const viewport = { width: 800, height: 600 };

  it("starts beside the active input and remains inside the viewport", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 590 }, viewport)).toEqual({ left: 552, top: 550 });
    expect(defaultLauncherPosition({ right: 12, bottom: 12 }, viewport)).toEqual({ left: 8, top: 8 });
  });

  it("keeps a dragged launcher reachable at every viewport edge", () => {
    expect(clampLauncherPosition({ left: -40, top: -10 }, viewport)).toEqual({ left: 8, top: 8 });
    expect(clampLauncherPosition({ left: 900, top: 700 }, viewport)).toEqual({ left: 558, top: 556 });
  });

  it("keeps the input edge fixed when the active recording controls expand left", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 590 }, viewport, 126)).toEqual({ left: 668, top: 550 });
    expect(clampLauncherPosition({ left: 900, top: 700 }, viewport, 126)).toEqual({ left: 674, top: 556 });
  });

  it("uses the real rendered control height at the bottom edge", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 598 }, viewport, 86, 46)).toEqual({ left: 708, top: 554 });
    expect(clampLauncherPosition({ left: 708, top: 598 }, viewport, 86, 46)).toEqual({ left: 708, top: 554 });
  });

  it("sits just under the caret rather than in the corner of a large editor", () => {
    expect(caretLauncherPosition({ left: 200, top: 300, bottom: 318 }, viewport)).toEqual({ left: 210, top: 328 });
  });

  it("flips above the caret when the line is near the bottom of the viewport", () => {
    expect(caretLauncherPosition({ left: 200, top: 560, bottom: 578 }, viewport)).toEqual({ left: 210, top: 506 });
  });

  it("keeps a caret-anchored launcher inside the viewport at the right edge", () => {
    expect(caretLauncherPosition({ left: 780, top: 100, bottom: 118 }, viewport)).toEqual({ left: 558, top: 128 });
  });

  it("keeps an actionable launcher error inside the viewport", () => {
    expect(launcherErrorPlacement({ left: 700, top: 554 }, 46)).toEqual({ vertical: "above", horizontal: "right" });
    expect(launcherErrorPlacement({ left: 8, top: 8 }, 46)).toEqual({ vertical: "below", horizontal: "left" });
  });
});
