import { beforeEach, describe, expect, it } from "vitest";
import { hasLogueExtensionOptOut, hasNativeSelectionSkillOwner, isLogueExtensionDisabledDocument, logueServerCandidate } from "../eligibility";

describe("extension page eligibility", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it.each([
    "http://localhost:5173/",
    "http://127.0.0.1:5173/projects",
    "http://192.168.86.42:5173/settings",
  ])("does not claim local app origin %s without Logue's marker", (href) => {
    document.body.innerHTML = '<main id="root"><textarea></textarea></main>';
    expect(isLogueExtensionDisabledDocument(document, href)).toBe(false);
  });

  it("injects into the Logue Web App so its editors can use the extension", () => {
    const description = document.createElement("meta");
    description.name = "description";
    description.content = "Logue local-first capture and cross-page input workspace";
    document.head.append(description);
    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);

    expect(isLogueExtensionDisabledDocument(document, "http://192.168.1.99:5173/")).toBe(false);
  });

  it("supports an explicit document opt-out directive", () => {
    const directive = document.createElement("meta");
    directive.name = "logue-extension";
    directive.content = "disabled";
    document.head.append(directive);

    expect(isLogueExtensionDisabledDocument(document, "https://editor.example/")).toBe(true);
  });

  it("continues to inject on an ordinary page", () => {
    document.body.innerHTML = '<main id="root"><textarea></textarea></main>';
    expect(isLogueExtensionDisabledDocument(document, "https://editor.example/")).toBe(false);
  });

  it("supports an explicit editable-subtree opt-out", () => {
    document.body.innerHTML = `
      <main>
        <section data-logue-extension="disabled">
          <textarea id="disabled-editor"></textarea>
        </section>
        <textarea id="enabled-editor"></textarea>
      </main>
    `;

    expect(hasLogueExtensionOptOut(document.getElementById("disabled-editor"))).toBe(true);
    expect(hasLogueExtensionOptOut(document.getElementById("enabled-editor"))).toBe(false);
  });

  it("lets a native editor own Skills without suppressing extension voice input", () => {
    document.body.innerHTML = `
      <main>
        <div data-logue-selection-skills="native"><div id="native-editor" contenteditable="true"></div></div>
        <textarea id="ordinary-editor"></textarea>
      </main>
    `;

    const nativeEditor = document.getElementById("native-editor");
    expect(hasNativeSelectionSkillOwner(nativeEditor)).toBe(true);
    expect(hasLogueExtensionOptOut(nativeEditor)).toBe(false);
    expect(hasNativeSelectionSkillOwner(document.getElementById("ordinary-editor"))).toBe(false);
  });

  it("offers the current origin only when the page has Logue's server marker", () => {
    expect(logueServerCandidate(document, "https://notes.example.com/doc/1")).toBeUndefined();
    const marker = document.createElement("meta");
    marker.name = "logue-server";
    marker.content = "api-v1";
    document.head.append(marker);

    expect(logueServerCandidate(document, "https://notes.example.com:9443/doc/1?view=documents"))
      .toBe("https://notes.example.com:9443");
    expect(logueServerCandidate(document, "chrome://extensions")).toBeUndefined();
  });
});
