import { describe, expect, it } from "vitest";
import { insertAtCaret, isEditable, isOurs } from "./editable";

describe("recognising an editor", () => {
  it("accepts text inputs and rejects the rest", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const readOnly = document.createElement("textarea");
    readOnly.readOnly = true;

    expect(isEditable(text)).toBe(true);
    expect(isEditable(document.createElement("textarea"))).toBe(true);
    expect(isEditable(checkbox)).toBe(false);
    expect(isEditable(readOnly)).toBe(false);
    expect(isEditable(document.createElement("div"))).toBe(false);
  });

  /** Our own controls must never become the thing we type into. */
  it("never treats our own surface as a target", () => {
    const host = document.createElement("div");
    host.id = "logue-host";
    const inside = document.createElement("input");
    host.append(inside);
    document.body.append(host);
    expect(isOurs(inside)).toBe(true);
    host.remove();
  });
});

describe("inserting at the caret", () => {
  it("writes into an input and can put it back", () => {
    const input = document.createElement("input");
    input.value = "before after";
    document.body.append(input);
    input.setSelectionRange(7, 7);

    const done = insertAtCaret(input, "MIDDLE ");
    expect(input.value).toBe("before MIDDLE after");

    done?.undo();
    expect(input.value).toBe("before after");
    input.remove();
  });

  it("does nothing for empty text", () => {
    const input = document.createElement("input");
    expect(insertAtCaret(input, "")).toBeUndefined();
  });
});
