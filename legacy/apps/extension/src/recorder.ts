import { stopMediaStream } from "./capturePrimitives";

export interface AudioRecorderController {
  start(): Promise<void>;
  stop(): void;
  cancel(): void;
  dispose(): void;
}

export interface AudioRecorderInput {
  getStream: () => Promise<MediaStream>;
  onStart: () => void;
  onStop: (blob: Blob) => void;
  onError: (cause: unknown) => void;
}

export function createAudioRecorder(input: AudioRecorderInput): AudioRecorderController {
  let attempt = 0;
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let chunks: Blob[] = [];
  let cancelled = false;

  return {
    async start() {
      const currentAttempt = ++attempt;
      cancelled = false;
      chunks = [];
      try {
        const nextStream = await input.getStream();
        if (currentAttempt !== attempt) {
          stopMediaStream(nextStream);
          return;
        }
        stream = nextStream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        recorder = new MediaRecorder(stream, { mimeType });
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener("stop", () => {
          stopMediaStream(stream);
          stream = undefined;
          if (cancelled || currentAttempt !== attempt) return;
          input.onStop(new Blob(chunks, { type: mimeType }));
        });
        recorder.start(250);
        input.onStart();
      } catch (cause) {
        if (currentAttempt === attempt) input.onError(cause);
      }
    },
    stop() {
      if (recorder?.state === "recording") recorder.stop();
    },
    cancel() {
      attempt += 1;
      cancelled = true;
      if (recorder?.state === "recording") recorder.stop();
      stopMediaStream(stream);
      stream = undefined;
    },
    dispose() {
      this.cancel();
    },
  };
}
