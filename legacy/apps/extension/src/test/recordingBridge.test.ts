import { describe, expect, it, vi } from "vitest";
import {
  audioBlobFromEvent,
  createContentRecordingBridge,
  type RecordingBridgeEvent,
} from "../recordingBridge";
import type { AudioRecorderController, AudioRecorderInput } from "../recorder";

function bridgeHarness() {
  const events: RecordingBridgeEvent[] = [];
  let callbacks!: AudioRecorderInput;
  const recorder: AudioRecorderController = {
    start: vi.fn(async () => callbacks.onStart()),
    stop: vi.fn(() => callbacks.onStop(new Blob(["audio"], { type: "audio/webm" }))),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  const bridge = createContentRecordingBridge({
    emit: (event) => { events.push(event); },
    createRecorder: (input) => {
      callbacks = input;
      return recorder;
    },
  });
  return { bridge, events, recorder, callbacks: () => callbacks };
}

describe("content recording bridge", () => {
  it("returns a tab recording through a session-scoped base64 event", async () => {
    const { bridge, events } = bridgeHarness();
    expect(bridge.handle({ type: "logue:recording-control", action: "start", sessionId: "session-1" })).toEqual({ ok: true });
    await Promise.resolve();
    expect(events).toEqual([{ type: "logue:recording-bridge-event", event: "started", sessionId: "session-1" }]);

    bridge.handle({ type: "logue:recording-control", action: "stop", sessionId: "session-1" });
    await vi.waitFor(() => expect(events.some((event) => event.event === "stopped")).toBe(true));
    const stopped = events.at(-1)!;
    expect(stopped).toMatchObject({
      type: "logue:recording-bridge-event",
      event: "stopped",
      sessionId: "session-1",
      mimeType: "audio/webm",
    });
    expect(audioBlobFromEvent(stopped)).toMatchObject({ size: 5, type: "audio/webm" });
  });

  it("cancels the active session and ignores stale stop commands", async () => {
    const { bridge, events, recorder } = bridgeHarness();
    bridge.handle({ type: "logue:recording-control", action: "start", sessionId: "current" });
    await Promise.resolve();

    expect(bridge.handle({ type: "logue:recording-control", action: "stop", sessionId: "stale" })).toEqual({ ok: false });
    bridge.handle({ type: "logue:recording-control", action: "cancel", sessionId: "current" });
    expect(recorder.cancel).toHaveBeenCalled();
    expect(events.at(-1)).toEqual({ type: "logue:recording-bridge-event", event: "cancelled", sessionId: "current" });
  });

  it("cancels recording when the content page is disposed", async () => {
    const { bridge, events, recorder } = bridgeHarness();
    bridge.handle({ type: "logue:recording-control", action: "start", sessionId: "leaving-page" });
    await Promise.resolve();
    bridge.dispose();
    expect(recorder.cancel).toHaveBeenCalled();
    expect(recorder.dispose).toHaveBeenCalled();
    expect(events.at(-1)).toEqual({ type: "logue:recording-bridge-event", event: "cancelled", sessionId: "leaving-page" });
  });
});
