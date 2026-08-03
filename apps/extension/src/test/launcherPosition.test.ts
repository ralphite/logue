import { describe, expect, it } from "vitest";
import { clampLauncherPosition, defaultLauncherPosition, launcherErrorPlacement } from "../launcherPosition";

describe("launcher position", () => {
  const viewport = { width: 800, height: 600 };

  it("starts beside the active input and remains inside the viewport", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 590 }, viewport)).toEqual({ left: 748, top: 548 });
    expect(defaultLauncherPosition({ right: 12, bottom: 12 }, viewport)).toEqual({ left: 8, top: 8 });
  });

  it("keeps a dragged launcher reachable at every viewport edge", () => {
    expect(clampLauncherPosition({ left: -40, top: -10 }, viewport)).toEqual({ left: 8, top: 8 });
    expect(clampLauncherPosition({ left: 900, top: 700 }, viewport)).toEqual({ left: 754, top: 554 });
  });

  it("keeps the input edge fixed when the active recording controls expand left", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 590 }, viewport, 126)).toEqual({ left: 668, top: 548 });
    expect(clampLauncherPosition({ left: 900, top: 700 }, viewport, 126)).toEqual({ left: 674, top: 554 });
  });

  it("uses the real rendered control height at the bottom edge", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 598 }, viewport, 86, 46)).toEqual({ left: 708, top: 554 });
    expect(clampLauncherPosition({ left: 708, top: 598 }, viewport, 86, 46)).toEqual({ left: 708, top: 554 });
  });

  it("keeps an actionable launcher error inside the viewport", () => {
    expect(launcherErrorPlacement({ left: 700, top: 554 }, 46)).toEqual({ vertical: "above", horizontal: "right" });
    expect(launcherErrorPlacement({ left: 8, top: 8 }, 46)).toEqual({ vertical: "below", horizontal: "left" });
  });
});
