import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("native side panel manifest", () => {
  it("keeps the Chrome manifest and extension package versions aligned", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"),
    ) as { version?: string };
    const packageManifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };

    expect(manifest.version).toBe(packageManifest.version);
  });

  it("registers the native panel, required permissions, and cross-platform toggle", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"),
    ) as {
      permissions?: string[];
      host_permissions?: string[];
      optional_host_permissions?: string[];
      side_panel?: { default_path?: string };
      commands?: Record<string, {
        suggested_key?: { default?: string; mac?: string };
        description?: string;
      }>;
    };

    expect(manifest.permissions).toEqual(expect.arrayContaining(["sidePanel", "storage"]));
    expect(manifest.host_permissions).toEqual(["http://127.0.0.1:8787/*"]);
    expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
    expect(manifest.commands?.["toggle-side-panel"]).toEqual({
      suggested_key: {
        default: "Ctrl+Shift+L",
        mac: "Command+Shift+L",
      },
      description: "Open or close Logue",
    });
  });
});
