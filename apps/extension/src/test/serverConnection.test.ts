import { afterEach, describe, expect, it, vi } from "vitest";
import { connectServer } from "../api";
import {
  assertLogueServerStatus,
  defaultServerURL,
  getServerURL,
  normalizeServerURL,
  serverPermissionOrigin,
  serverURLStorageKey,
} from "../serverConnection";

const compatibleStatus = {
  ok: true,
  api_version: 1,
  provider_configured: true,
  generation_ready: true,
  voice_ready: true,
  overall_ready: true,
  provider_needs_attention: false,
  provider_errors: { generation: null, voice: null },
  model: "gemini-test",
  version: "test",
};

function chromeMock({
  stored,
  permission = true,
  response = { ok: true, value: compatibleStatus },
}: {
  stored?: string;
  permission?: boolean;
  response?: { ok: boolean; value?: unknown; error?: string };
} = {}) {
  const get = vi.fn(async () => stored === undefined ? {} : { [serverURLStorageKey]: stored });
  const set = vi.fn(async () => undefined);
  const request = vi.fn(async () => permission);
  const remove = vi.fn(async () => true);
  const sendMessage = vi.fn(async () => response);
  vi.stubGlobal("chrome", {
    storage: { local: { get, set } },
    permissions: { request, remove },
    runtime: { sendMessage },
  });
  return { get, set, request, remove, sendMessage };
}

describe("remote Logue server connection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes only complete HTTP origins", () => {
    expect(normalizeServerURL(" https://logue.example.com:9443/ ")).toBe("https://logue.example.com:9443");
    expect(serverPermissionOrigin("https://logue.example.com:9443")).toBe("https://logue.example.com:9443/*");
    expect(() => normalizeServerURL("logue.example.com")).toThrow("complete http:// or https://");
    expect(() => normalizeServerURL("file:///tmp/logue")).toThrow("complete http:// or https://");
    expect(() => normalizeServerURL("https://user:secret@logue.example.com")).toThrow("without a path");
    expect(() => normalizeServerURL("https://logue.example.com/base")).toThrow("without a path");
    expect(() => normalizeServerURL("https://logue.example.com?token=secret")).toThrow("without a path");
  });

  it("restores the saved server and falls back safely when it is missing or invalid", async () => {
    chromeMock({ stored: "https://logue.example.com/" });
    await expect(getServerURL()).resolves.toBe("https://logue.example.com");

    vi.unstubAllGlobals();
    chromeMock({ stored: "javascript:alert(1)" });
    await expect(getServerURL()).resolves.toBe(defaultServerURL);
  });

  it("requests only the selected origin, validates Logue, then saves atomically", async () => {
    const chrome = chromeMock({ stored: "https://old-logue.example.com" });

    await expect(connectServer("https://new-logue.example.com/")).resolves.toEqual({
      url: "https://new-logue.example.com",
      status: compatibleStatus,
    });

    expect(chrome.request).toHaveBeenCalledWith({ origins: ["https://new-logue.example.com/*"] });
    expect(chrome.sendMessage).toHaveBeenCalledWith({
      type: "logue:api",
      action: "test-server",
      payload: { serverURL: "https://new-logue.example.com" },
    });
    expect(chrome.set).toHaveBeenCalledWith({ [serverURLStorageKey]: "https://new-logue.example.com" });
    expect(chrome.remove).toHaveBeenCalledWith({ origins: ["https://old-logue.example.com/*"] });
  });

  it("keeps the previous server when Chrome denies the exact origin permission", async () => {
    const chrome = chromeMock({ stored: "https://old-logue.example.com", permission: false });

    await expect(connectServer("https://new-logue.example.com")).rejects.toThrow("Chrome did not allow access");
    expect(chrome.sendMessage).not.toHaveBeenCalled();
    expect(chrome.set).not.toHaveBeenCalled();
  });

  it("keeps the previous server and removes the unused permission when validation fails", async () => {
    const chrome = chromeMock({
      stored: "https://old-logue.example.com",
      response: { ok: true, value: { ...compatibleStatus, api_version: 99 } },
    });

    await expect(connectServer("https://new-logue.example.com")).rejects.toThrow("not compatible");
    expect(chrome.set).not.toHaveBeenCalled();
    expect(chrome.remove).toHaveBeenCalledWith({ origins: ["https://new-logue.example.com/*"] });
  });

  it("rejects status payloads from an unrelated service", () => {
    expect(() => assertLogueServerStatus({ ok: true })).toThrow("not a Logue server");
  });
});
