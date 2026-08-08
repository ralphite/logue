export const defaultServerURL = "http://127.0.0.1:8787";
export const logueApiVersion = 1;
export const serverURLStorageKey = "logue:server-url";

export interface LogueServerStatus {
  ok: boolean;
  api_version: number;
  provider_configured: boolean;
  generation_ready: boolean;
  voice_ready: boolean;
  overall_ready: boolean;
  provider_needs_attention: boolean;
  provider_errors: {
    generation?: { code: string; message: string; action: "open-model-settings" } | null;
    voice?: { code: string; message: string; action: "open-model-settings" } | null;
  };
  model: string;
  version: string;
}

export function normalizeServerURL(value: string) {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a complete http:// or https:// address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Enter a complete http:// or https:// address.");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Enter the server origin without a path, query, or credentials.");
  }
  return parsed.origin;
}

export function serverPermissionOrigin(value: string) {
  return `${normalizeServerURL(value)}/*`;
}

export function assertLogueServerStatus(value: unknown): asserts value is LogueServerStatus {
  const status = value as Partial<LogueServerStatus> | undefined;
  if (
    !status ||
    status.ok !== true ||
    typeof status.version !== "string" ||
    typeof status.provider_configured !== "boolean" ||
    typeof status.generation_ready !== "boolean" ||
    typeof status.voice_ready !== "boolean" ||
    typeof status.overall_ready !== "boolean" ||
    typeof status.provider_needs_attention !== "boolean" ||
    !status.provider_errors ||
    typeof status.provider_errors !== "object"
  ) {
    throw new Error("This address is not a Logue server.");
  }
  if (status.api_version !== logueApiVersion) {
    throw new Error("This Logue server is not compatible with this extension.");
  }
}

export async function getServerURL() {
  const stored = await chrome.storage.local.get(serverURLStorageKey);
  const value = stored[serverURLStorageKey];
  if (typeof value !== "string") return defaultServerURL;
  try {
    return normalizeServerURL(value);
  } catch {
    return defaultServerURL;
  }
}

export async function saveServerURL(value: string) {
  const normalized = normalizeServerURL(value);
  await chrome.storage.local.set({ [serverURLStorageKey]: normalized });
  return normalized;
}

export async function requestServerPermission(value: string) {
  const origin = serverPermissionOrigin(value);
  if (!await chrome.permissions.request({ origins: [origin] })) {
    throw new Error("Chrome did not allow access to this server.");
  }
}

export async function removeUnusedServerPermission(previousURL: string, nextURL: string) {
  const previousOrigin = serverPermissionOrigin(previousURL);
  const nextOrigin = serverPermissionOrigin(nextURL);
  if (previousOrigin === nextOrigin || previousURL === defaultServerURL) return;
  await chrome.permissions.remove({ origins: [previousOrigin] }).catch(() => false);
}

export async function removeServerPermission(value: string) {
  const normalized = normalizeServerURL(value);
  if (normalized === defaultServerURL) return;
  await chrome.permissions.remove({ origins: [serverPermissionOrigin(normalized)] }).catch(() => false);
}
