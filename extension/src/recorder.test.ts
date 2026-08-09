import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABANDONED_MS, MAX_MS, cancel, holding, recording, start } from "./recorder";

/**
 * The recorder's two questions, which used to be one.
 *
 * "Is the microphone live" decides whether a reload would cost someone their
 * words. "Is there audio nobody has collected" decides whether closing the
 * offscreen document would throw words away. They were the same question —
 * `recorder !== undefined` — and after the ten-minute ceiling stops the
 * microphone, that answered yes forever: the object is only released on stop
 * or cancel, and a recording whose page has gone gets neither. Self-update
 * stands aside for a live microphone, so the browser stopped updating for
 * good. X10 again, through the door the ceiling opened.
 *
 * Ten real minutes prove nothing these fake timers do not.
 */

class FakeRecorder {
  state: "recording" | "inactive" | "paused" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"]) });
    this.onstop?.();
  }
}

let made: FakeRecorder | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  made = undefined;
  vi.stubGlobal(
    "MediaRecorder",
    class {
      constructor() {
        made = new FakeRecorder();
        return made;
      }
      static isTypeSupported() {
        return true;
      }
    },
  );
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }) },
  });
});

afterEach(() => {
  cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("what busy means", () => {
  it("is true while the microphone is live", async () => {
    await start();
    expect(recording()).toBe(true);
    expect(holding()).toBe(false);
  });

  it("stops being true the moment the ceiling stops the microphone", async () => {
    await start();
    vi.advanceTimersByTime(MAX_MS);
    expect(made?.state).toBe("inactive");
    expect(recording()).toBe(false);
    expect(holding()).toBe(true);
  });

  it("lets go of audio nobody comes for", async () => {
    await start();
    vi.advanceTimersByTime(MAX_MS);
    expect(holding()).toBe(true);
    // A live page collects at the ceiling too — useVoice keeps the same clock
    // — so this only ever ends recordings whose page has gone.
    vi.advanceTimersByTime(ABANDONED_MS);
    expect(holding()).toBe(false);
    expect(recording()).toBe(false);
  });

  it("keeps the audio for the person still looking at it", async () => {
    await start();
    vi.advanceTimersByTime(MAX_MS);
    vi.advanceTimersByTime(ABANDONED_MS - 1000);
    // A minute short of the grace period, the words are still there.
    expect(holding()).toBe(true);
  });

  it("is false before anything has started", () => {
    expect(recording()).toBe(false);
    expect(holding()).toBe(false);
  });
});
