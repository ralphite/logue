import { createContentRecordingBridge, type RecordingBridgeEvent, type RecordingControlAction, type RecordingControlMessage } from "./recordingBridge";

const parameters = new URLSearchParams(window.location.search);
const token = parameters.get("token") ?? "";
const isPermissionRequest = parameters.get("mode") === "permission";
const statusElement = document.getElementById("status");

interface ExtensionRecorderControl {
  type: "logue:extension-recorder-control";
  action: RecordingControlAction;
  sessionId: string;
}

function isExtensionRecorderControl(message: unknown): message is ExtensionRecorderControl {
  return Boolean(
    message && typeof message === "object" &&
    (message as { type?: unknown }).type === "logue:extension-recorder-control" &&
    ["start", "stop", "cancel"].includes(String((message as { action?: unknown }).action)) &&
    typeof (message as { sessionId?: unknown }).sessionId === "string",
  );
}

async function completePermission(ok: boolean, error?: string) {
  await chrome.runtime.sendMessage({ type: "logue:microphone-permission-result", token, ok, error });
}

if (isPermissionRequest) {
  void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    stream.getTracks().forEach((track) => track.stop());
    return completePermission(true).then(() => window.close());
  }).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "Microphone access was not granted.";
    if (statusElement) statusElement.textContent = message;
    void completePermission(false, message);
  });
} else {
  const recorder = createContentRecordingBridge({
    emit: (event: RecordingBridgeEvent) => chrome.runtime.sendMessage({
      ...event,
      type: "logue:extension-recorder-event",
    }),
  });
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isExtensionRecorderControl(message)) return false;
    sendResponse(recorder.handle({
      type: "logue:recording-control",
      action: message.action,
      sessionId: message.sessionId,
    } satisfies RecordingControlMessage));
    return false;
  });
}
