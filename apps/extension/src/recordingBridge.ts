import {
  createAudioRecorder,
  type AudioRecorderController,
  type AudioRecorderInput,
} from "./recorder";

export type RecordingControlAction = "start" | "stop" | "cancel";

export interface RecordingControlMessage {
  type: "logue:recording-control";
  action: RecordingControlAction;
  sessionId: string;
}

export interface RecordingDisposeMessage {
  type: "logue:recording-dispose";
}

export interface RecordingBridgeEvent {
  type: "logue:recording-bridge-event";
  event: "started" | "stopped" | "cancelled" | "error";
  sessionId: string;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
}

export interface RecordingPanelEvent extends Omit<RecordingBridgeEvent, "type"> {
  type: "logue:recording-event";
  tabId: number;
}

export interface ContentRecordingBridge {
  handle(message: RecordingControlMessage): { ok: boolean };
  dispose(): void;
}

export interface RecordingLifecyclePort {
  name: string;
  onDisconnect: {
    addListener(listener: () => void): void;
    removeListener?(listener: () => void): void;
  };
  disconnect(): void;
}

export interface RecordingLifecycleRegistry {
  accept(port: RecordingLifecyclePort): boolean;
  dispose(): void;
}

export function createRecordingLifecycleRegistry(onOrphaned: () => void): RecordingLifecycleRegistry {
  const ports = new Set<RecordingLifecyclePort>();
  const listeners = new Map<RecordingLifecyclePort, () => void>();

  return {
    accept(port) {
      if (port.name !== "logue:recording-lifecycle") return false;
      ports.add(port);
      const onDisconnect = () => {
        ports.delete(port);
        listeners.delete(port);
        if (ports.size === 0) onOrphaned();
      };
      listeners.set(port, onDisconnect);
      port.onDisconnect.addListener(onDisconnect);
      return true;
    },
    dispose() {
      const activePorts = [...ports];
      ports.clear();
      for (const port of activePorts) {
        const listener = listeners.get(port);
        if (listener) port.onDisconnect.removeListener?.(listener);
        port.disconnect();
      }
      listeners.clear();
    },
  };
}

async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read the recording.")));
    reader.readAsDataURL(blob);
  });
}

export function audioBlobFromEvent(event: Pick<RecordingPanelEvent, "audioBase64" | "mimeType">) {
  if (!event.audioBase64) throw new Error("The recording is empty.");
  const binary = atob(event.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: event.mimeType || "audio/webm" });
}

export function createContentRecordingBridge(input: {
  emit: (event: RecordingBridgeEvent) => void | Promise<unknown>;
  getStream?: () => Promise<MediaStream>;
  createRecorder?: (input: AudioRecorderInput) => AudioRecorderController;
}): ContentRecordingBridge {
  let activeSessionId: string | undefined;
  const emit = (event: RecordingBridgeEvent) => { void input.emit(event); };
  const recorder = (input.createRecorder ?? createAudioRecorder)({
    getStream: input.getStream ?? (() => navigator.mediaDevices.getUserMedia({ audio: true })),
    onStart: () => {
      if (!activeSessionId) return;
      emit({ type: "logue:recording-bridge-event", event: "started", sessionId: activeSessionId });
    },
    onStop: (blob) => {
      const sessionId = activeSessionId;
      activeSessionId = undefined;
      if (!sessionId) return;
      void blobToBase64(blob).then((audioBase64) => emit({
        type: "logue:recording-bridge-event",
        event: "stopped",
        sessionId,
        audioBase64,
        mimeType: blob.type || "audio/webm",
      })).catch((cause: unknown) => emit({
        type: "logue:recording-bridge-event",
        event: "error",
        sessionId,
        error: cause instanceof Error ? cause.message : "Could not read the recording.",
      }));
    },
    onError: (cause) => {
      const sessionId = activeSessionId;
      activeSessionId = undefined;
      if (!sessionId) return;
      emit({
        type: "logue:recording-bridge-event",
        event: "error",
        sessionId,
        error: cause instanceof Error ? cause.message : "Could not start recording.",
      });
    },
  });

  const cancelActive = () => {
    const sessionId = activeSessionId;
    activeSessionId = undefined;
    recorder.cancel();
    if (sessionId) emit({ type: "logue:recording-bridge-event", event: "cancelled", sessionId });
  };

  return {
    handle(message) {
      if (message.action === "start") {
        if (activeSessionId && activeSessionId !== message.sessionId) cancelActive();
        activeSessionId = message.sessionId;
        void recorder.start();
        return { ok: true };
      }
      if (activeSessionId !== message.sessionId) return { ok: false };
      if (message.action === "stop") recorder.stop();
      if (message.action === "cancel") cancelActive();
      return { ok: true };
    },
    dispose() {
      cancelActive();
      recorder.dispose();
    },
  };
}
