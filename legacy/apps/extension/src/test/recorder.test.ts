import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioRecorder } from "../recorder";

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported() { return true; }
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.dispatchEvent(new BlobEvent("dataavailable", { data: new Blob(["audio"]) }));
    this.dispatchEvent(new Event("stop"));
  }
}

describe("shared audio recorder", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stops every microphone track when the panel is disposed", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const recorder = createAudioRecorder({
      getStream: async () => stream,
      onStart: vi.fn(),
      onStop: vi.fn(),
      onError: vi.fn(),
    });

    await recorder.start();
    recorder.dispose();
    expect(stop).toHaveBeenCalled();
  });

  it("cancels a late permission result without starting a stale recording", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const stop = vi.fn();
    let resolveStream!: (value: MediaStream) => void;
    const streamPromise = new Promise<MediaStream>((resolve) => { resolveStream = resolve; });
    const onStart = vi.fn();
    const recorder = createAudioRecorder({
      getStream: () => streamPromise,
      onStart,
      onStop: vi.fn(),
      onError: vi.fn(),
    });

    const starting = recorder.start();
    recorder.cancel();
    resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await starting;

    expect(stop).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
