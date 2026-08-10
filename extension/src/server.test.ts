import { describe, expect, it } from "vitest";
import { isLoopback, readAddress } from "./server";

describe("the address Logue is reached at", () => {
  it("keeps a full address as it was typed", () => {
    expect(readAddress("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(readAddress("https://example-8787.usw2.devtunnels.ms")).toBe("https://example-8787.usw2.devtunnels.ms");
  });

  /** A tunnel address is handed over as a bare name, and pasted as one. The
   * host here is made up on purpose: a real one in a public repository is a
   * Logue with no password, named. */
  it("reads a published name as https", () => {
    expect(readAddress("example-8787.usw2.devtunnels.ms")).toBe("https://example-8787.usw2.devtunnels.ms");
  });

  /** …but a machine on this network is not published, and has no certificate. */
  it("reads an address on this network as http", () => {
    expect(readAddress("127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(readAddress("192.168.1.20:8787")).toBe("http://192.168.1.20:8787");
    expect(readAddress("localhost:8787")).toBe("http://localhost:8787");
  });

  it("ignores space either side of a pasted address", () => {
    expect(readAddress("  https://logue.example  ")).toBe("https://logue.example");
  });

  /** Every call appends `/v1/…`, so a path kept here builds nothing that exists. */
  it("keeps only the origin", () => {
    expect(readAddress("https://logue.example/documents/new")).toBe("https://logue.example");
    expect(readAddress("http://127.0.0.1:8787/")).toBe("http://127.0.0.1:8787");
  });

  it("refuses what it cannot call", () => {
    expect(() => readAddress("")).toThrow();
    expect(() => readAddress("   ")).toThrow();
    expect(() => readAddress("ftp://logue.example")).toThrow();
    expect(() => readAddress("http://")).toThrow();
  });

  it("knows the Host on this computer from one somewhere else", () => {
    expect(isLoopback("http://127.0.0.1:8787")).toBe(true);
    expect(isLoopback("http://localhost:8787")).toBe(true);
    expect(isLoopback("https://example-8787.usw2.devtunnels.ms")).toBe(false);
    expect(isLoopback("not an address")).toBe(false);
  });
});
