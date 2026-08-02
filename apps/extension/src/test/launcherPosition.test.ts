import { describe, expect, it } from "vitest";
import { clampLauncherPosition, defaultLauncherPosition } from "../launcherPosition";

describe("launcher position", () => {
  const viewport = { width: 800, height: 600 };

  it("starts beside the active input and remains inside the viewport", () => {
    expect(defaultLauncherPosition({ right: 790, bottom: 590 }, viewport)).toEqual({ left: 718, top: 556 });
    expect(defaultLauncherPosition({ right: 12, bottom: 12 }, viewport)).toEqual({ left: 8, top: 8 });
  });

  it("keeps a dragged launcher reachable at every viewport edge", () => {
    expect(clampLauncherPosition({ left: -40, top: -10 }, viewport)).toEqual({ left: 8, top: 8 });
    expect(clampLauncherPosition({ left: 900, top: 700 }, viewport)).toEqual({ left: 724, top: 562 });
  });
});
