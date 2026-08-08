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
      content_scripts?: Array<{
        all_frames?: boolean;
        match_about_blank?: boolean;
        match_origin_as_fallback?: boolean;
        run_at?: string;
      }>;
      commands?: Record<string, {
        suggested_key?: { default?: string; mac?: string };
        description?: string;
      }>;
    };

    expect(manifest.permissions).toEqual(expect.arrayContaining(["scripting", "sidePanel", "storage", "offscreen"]));
    expect(manifest.host_permissions).toEqual(["http://127.0.0.1:8787/*"]);
    expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
    // Google Docs keeps its writable document target in a same-origin
    // about:blank editor frame. The inline recorder must live in that frame
    // rather than merely seeing the outer, non-editable document shell.
    expect(manifest.content_scripts?.[0]).toMatchObject({
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
      run_at: "document_start",
    });
    expect(manifest.commands?.["toggle-side-panel"]).toEqual({
      suggested_key: {
        default: "Ctrl+Shift+L",
        mac: "Command+Shift+L",
      },
      description: "Open or close Logue",
    });
  });
});
