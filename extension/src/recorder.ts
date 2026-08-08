/**
 * Microphone capture, running in an offscreen document.
 *
 * A content script cannot hold a microphone permission that survives page
 * navigation, and the service worker has no DOM. An offscreen document is the
 * one place in an MV3 extension that has both.
 */

let recorder: MediaRecorder | undefined;
let chunks: Blob[] = [];
let stream: MediaStream | undefined;

export function preferredMimeType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export async function start(): Promise<void> {
  if (recorder) throw new Error("Already recording.");
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = preferredMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();
}

function release() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  recorder = undefined;
}

/** Stops and returns the recording as base64, which is how the Host takes it. */
export async function stop(): Promise<{ audio: string; mediaType: string }> {
  const active = recorder;
  if (!active) throw new Error("Not recording.");
  const mediaType = active.mimeType.split(";")[0] || "audio/webm";

  const blob = await new Promise<Blob>((resolve) => {
    active.onstop = () => resolve(new Blob(chunks, { type: mediaType }));
    active.stop();
  });
  release();

  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return { audio: btoa(binary), mediaType };
}

export function cancel(): void {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  chunks = [];
  release();
}
