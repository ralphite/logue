import { describe, expect, it } from "vitest";
import { shouldReload } from "./build";

const check = (over: Partial<Parameters<typeof shouldReload>[0]>) =>
  shouldReload({ running: "a", installed: "a", reloadedFor: "", ...over });

describe("staying on the deployed build", () => {
  it("reloads when the folder on disk moved ahead", () => {
    expect(check({ installed: "b" })).toBe(true);
  });

  it("stays put when it is already the installed build", () => {
    expect(check({})).toBe(false);
  });

  /** The gap did not close last time; restarting forever helps nobody. */
  it("tries a given build only once", () => {
    expect(check({ installed: "b", reloadedFor: "b" })).toBe(false);
  });

  it("reloads again for a build after that", () => {
    expect(check({ installed: "c", reloadedFor: "b" })).toBe(true);
  });

  it("does nothing when the Host reports no build", () => {
    expect(check({ installed: "" })).toBe(false);
  });

  /**
   * The build that most needs replacing is the one from before builds were
   * stamped — and it is the one that cannot ask. Treating it as up to date
   * stranded it for good behind a Host that had moved on.
   */
  it("reloads a build from before builds were named", () => {
    expect(check({ running: "", installed: "b" })).toBe(true);
  });
});
