import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ask, blockedMessage, canAsk, reading, settingsUrl } from "./microphone";

/**
 * Asking for the microphone somewhere Chrome can answer.
 *
 * Two releases shipped a product whose only `getUserMedia` ran in the offscreen
 * document — no window, so Chrome refused without asking anyone, and the message
 * sent people to a setting that has no entry point. What is checked here is the
 * part that decides *where* the asking happens, because getting that wrong is
 * indistinguishable from the bug: a prompt that cannot appear, and a permission
 * that reads `prompt` forever.
 */

const realLocation = globalThis.location;

function pretendOrigin(protocol: string): void {
  // jsdom's location cannot be assigned to, and it is a class instance rather
  // than a bag of fields — so this stands a plain object in its place. The
  // protocol is the whole question: which origin is this code running at.
  Object.defineProperty(globalThis, "location", { configurable: true, value: { protocol } });
}

beforeEach(() => {
  vi.stubGlobal("chrome", { runtime: { id: "abcdefghijklmnopabcdefghijklmnop" } });
});

afterEach(() => {
  Object.defineProperty(globalThis, "location", { configurable: true, value: realLocation });
  vi.unstubAllGlobals();
});

describe("where the asking may happen", () => {
  it("asks on an extension page, which has a window Chrome can prompt in", () => {
    pretendOrigin("chrome-extension:");
    expect(canAsk()).toBe(true);
  });

  it("does not ask from a content script: a grant there belongs to the page, not to Logue", () => {
    pretendOrigin("https:");
    expect(canAsk()).toBe(false);
  });
});

describe("ask", () => {
  it("does not touch the device when Chrome already granted it", async () => {
    pretendOrigin("chrome-extension:");
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", {
      permissions: { query: () => Promise.resolve({ state: "granted" }) },
      mediaDevices: { getUserMedia },
    });
    await expect(ask()).resolves.toBe("granted");
    // Opening it here would take the device the recorder is about to want.
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("prompts once when nobody has been asked, and releases the device again", async () => {
    pretendOrigin("chrome-extension:");
    const stop = vi.fn();
    const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [{ stop }] }));
    vi.stubGlobal("navigator", {
      permissions: { query: () => Promise.resolve({ state: "prompt" }) },
      mediaDevices: { getUserMedia },
    });
    await expect(ask()).resolves.toBe("granted");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("reports denied when the prompt is refused or dismissed", async () => {
    pretendOrigin("chrome-extension:");
    vi.stubGlobal("navigator", {
      permissions: { query: () => Promise.resolve({ state: "prompt" }) },
      mediaDevices: { getUserMedia: () => Promise.reject(new DOMException("no", "NotAllowedError")) },
    });
    await expect(ask()).resolves.toBe("denied");
  });

  it("refuses to try where no prompt can appear, rather than producing a refusal of its own", async () => {
    pretendOrigin("https:");
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    await expect(ask()).resolves.toBe("unavailable");
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("reading", () => {
  it("says unknown rather than guessing when Chrome will not answer", async () => {
    vi.stubGlobal("navigator", { permissions: { query: () => Promise.reject(new Error("nope")) } });
    await expect(reading()).resolves.toBe("unknown");
  });
});

describe("the way out", () => {
  it("names the extension's own origin, which is what that page keys on", () => {
    expect(settingsUrl()).toBe(
      "chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2Fabcdefghijklmnopabcdefghijklmnop",
    );
  });

  it("tells a panel about the setting and a web page to open Logue", () => {
    pretendOrigin("chrome-extension:");
    expect(blockedMessage()).toContain("Allow it for Logue");
    pretendOrigin("https:");
    // A page cannot be granted the extension's microphone, so sending someone
    // to a setting from here would be sending them nowhere.
    expect(blockedMessage()).toContain("Open Logue");
  });
});
