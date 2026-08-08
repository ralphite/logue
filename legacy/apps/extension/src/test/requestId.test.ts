import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestId } from "../requestId";

describe("createRequestId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses randomUUID when the page exposes it", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "native-id" });
    expect(createRequestId()).toBe("native-id");
  });

  it("creates a stable UUID-shaped id on non-secure HTTP pages", () => {
    let next = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_value, index) => { bytes[index] = next++ & 0xff; });
        return bytes;
      },
    });
    expect(createRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("still returns unique ids if Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createRequestId()).not.toBe(createRequestId());
  });
});
