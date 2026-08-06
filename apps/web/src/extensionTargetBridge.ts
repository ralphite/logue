import type { ExtensionInputTarget, ExtensionShortcut, ExtensionTargetBridgeRequest, ExtensionTargetBridgeResponse } from "@logue/ui";

function bridgeRequest(action: ExtensionTargetBridgeRequest["action"], input: Partial<Pick<ExtensionTargetBridgeRequest, "sessionId" | "text" | "undoToken" | "command" | "shortcut">> = {}) {
  const requestId = crypto.randomUUID();
  const request: ExtensionTargetBridgeRequest = {
    source: "logue-web",
    type: "logue:target-bridge-request",
    requestId,
    action,
    ...input,
  };
  return new Promise<ExtensionTargetBridgeResponse>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const response = event.data as Partial<ExtensionTargetBridgeResponse> | undefined;
      if (response?.source !== "logue-extension" || response.type !== "logue:target-bridge-response" || response.requestId !== requestId) return;
      cleanup();
      if (!response.ok) {
        reject(new Error(response.error || "Could not reach the selected input."));
        return;
      }
      resolve(response as ExtensionTargetBridgeResponse);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          action === "shortcuts" ||
            action === "update-shortcut" ||
            action === "reset-shortcut"
            ? "Open or install the Logue Extension, then try again."
            : "Open the input you want in Chrome, then try again.",
        ),
      );
    }, 3_000);
    window.addEventListener("message", onMessage);
    window.postMessage(request, window.location.origin);
  });
}

export async function listExtensionInputTargets(): Promise<ExtensionInputTarget[]> {
  return (await bridgeRequest("list")).targets ?? [];
}

export async function insertDocumentIntoTarget(sessionId: string, text: string) {
  const response = await bridgeRequest("insert", { sessionId, text });
  if (!response.target || !response.undoToken) throw new Error("The selected input did not confirm this insert.");
  return { target: response.target, undoToken: response.undoToken };
}

export async function undoDocumentTargetInsert(sessionId: string, undoToken: string) {
  return bridgeRequest("undo", { sessionId, undoToken });
}

export async function getExtensionShortcuts(): Promise<ExtensionShortcut[]> {
  return (await bridgeRequest("shortcuts")).shortcuts ?? [];
}

export async function updateExtensionShortcut(
  command: ExtensionShortcut["command"],
  shortcut: string,
) {
  return (
    await bridgeRequest("update-shortcut", { command, shortcut })
  ).shortcuts ?? [];
}

export async function resetExtensionShortcut(
  command: ExtensionShortcut["command"],
) {
  return (await bridgeRequest("reset-shortcut", { command })).shortcuts ?? [];
}
