const selectionMenuId = "logue-save-selection";
const voiceInputCommand = "start-voice-input";
const apiBase = "http://127.0.0.1:8787";

interface ApiMessage {
  type: "logue:api";
  action: "status" | "context" | "transcribe" | "save-material" | "save-selection" | "delete-capture" | "agents" | "settings" | "agent-run" | "adopt-agent-run";
  payload?: Record<string, unknown>;
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  let value: unknown = text;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    // Keep the plain-text error for actionable diagnostics.
  }
  if (!response.ok) {
    const message =
      typeof value === "object" && value && "error" in value
        ? String((value as { error: unknown }).error)
        : text || `本机服务返回错误 (${response.status})`;
    const error = new Error(message) as Error & { captureId?: string };
    if (typeof value === "object" && value && "capture_id" in value) {
      error.captureId = String((value as { capture_id: unknown }).capture_id);
    }
    throw error;
  }
  return value;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function handleApiMessage(message: ApiMessage) {
  const payload = message.payload ?? {};
  if (message.action === "status") {
    return parseResponse(await fetch(`${apiBase}/v1/status`));
  }
  if (message.action === "context") {
    const query = new URLSearchParams({ url: String(payload.pageUrl ?? ""), project: String(payload.project ?? "") });
    return parseResponse(await fetch(`${apiBase}/v1/context?${query.toString()}`));
  }
  if (message.action === "agents") {
    return parseResponse(await fetch(`${apiBase}/v1/agents`));
  }
  if (message.action === "settings") {
    return parseResponse(await fetch(`${apiBase}/v1/settings`));
  }
  if (message.action === "agent-run") {
    return parseResponse(
      await fetch(`${apiBase}/v1/agent-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "adopt-agent-run") {
    const id = encodeURIComponent(String(payload.id ?? ""));
    return parseResponse(
      await fetch(`${apiBase}/v1/agent-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adopted_output: payload.adoptedOutput }),
      }),
    );
  }
  if (message.action === "transcribe") {
    const audioBase64 = String(payload.audioBase64 ?? "");
    if (!audioBase64) throw new Error("录音数据为空");
    const mimeType = String(payload.mimeType ?? "audio/webm");
    const form = new FormData();
    form.append("audio", new Blob([decodeBase64(audioBase64)], { type: mimeType }), "logue-recording.webm");
    form.append("page_url", String(payload.pageUrl ?? ""));
    form.append("page_title", String(payload.pageTitle ?? ""));
    form.append("target_text", String(payload.targetText ?? ""));
    form.append("selected_text", String(payload.selectedText ?? ""));
    form.append("project_context", String(payload.projectContext ?? ""));
    form.append("glossary", String(payload.glossary ?? ""));
    form.append("instructions", String(payload.instructions ?? ""));
    if (payload.appliedContext) form.append("applied_context", JSON.stringify(payload.appliedContext));
    return parseResponse(await fetch(`${apiBase}/v1/transcribe`, { method: "POST", body: form }));
  }
  if (message.action === "save-material") {
    return parseResponse(
      await fetch(`${apiBase}/v1/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "save-selection") {
    return parseResponse(
      await fetch(`${apiBase}/v1/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  if (message.action === "delete-capture") {
    return parseResponse(
      await fetch(`${apiBase}/v1/captures/${encodeURIComponent(String(payload.id ?? ""))}`, {
        method: "DELETE",
      }),
    );
  }
  throw new Error("未知的 Logue API 操作");
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: selectionMenuId,
      title: "保存到 Logue",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== selectionMenuId || !tab?.id || !info.selectionText) return;
  void chrome.tabs.sendMessage(tab.id, {
    type: "logue:open-selection",
    selectionText: info.selectionText,
  }).catch(() => undefined);
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  void chrome.tabs.sendMessage(tab.id, { type: "logue:open-input" }).catch(() => undefined);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== voiceInputCommand || !tab?.id) return;
  void chrome.tabs.sendMessage(tab.id, { type: "logue:open-input" }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ApiMessage, _sender, sendResponse) => {
  if (message?.type !== "logue:api") return false;
  void handleApiMessage(message)
    .then((value) => sendResponse({ ok: true, value }))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "本机服务请求失败",
        captureId:
          error instanceof Error && "captureId" in error
            ? String((error as Error & { captureId?: string }).captureId ?? "")
            : undefined,
      }),
    );
  return true;
});
