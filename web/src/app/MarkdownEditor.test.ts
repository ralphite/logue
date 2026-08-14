import { describe, expect, it } from "vitest";
import { spliced } from "./MarkdownEditor";
import { firstLine } from "./DocumentsRoute";

describe("putting a rewritten passage back", () => {
  it("keeps the newline a selected line brought with it", () => {
    // Triple-clicking "- one" selects the line *and* its newline. The model
    // answers with a line and no newline, and without this the next line was
    // welded onto the end of it.
    const text = "# Tuesday\n\n- one\n- two\n";
    const { insert } = spliced(text, "- one\n", "- one thing only");
    expect(insert).toBe("- one thing only\n");
  });

  it("replaces a passage in the middle of a line without touching its neighbours", () => {
    const text = "A line with words in it.";
    const change = spliced(text, "words", "phrases");
    expect(text.slice(0, change.from) + change.insert + text.slice(change.to)).toBe("A line with phrases in it.");
  });

  it("adds the rewrite at the end when the passage is no longer there", () => {
    // The document moved on while the dialog was open. Losing the model's
    // answer entirely would be the worse of the two failures.
    const change = spliced("# Tuesday", "gone", "the rewritten passage");
    expect(change.insert).toBe("\n\nthe rewritten passage");
    expect(change.from).toBe("# Tuesday".length);
  });
});

describe("what a document is called", () => {
  it("is the first line, without its markup", () => {
    expect(firstLine("# Tuesday plans\n\nBody.")).toBe("Tuesday plans");
    expect(firstLine("- **Tuesday** plans")).toBe("Tuesday plans");
    expect(firstLine("> quoted opening")).toBe("quoted opening");
    expect(firstLine("1. first item")).toBe("first item");
  });

  it("skips the empty lines above it", () => {
    expect(firstLine("\n\n   \nThe real first line")).toBe("The real first line");
  });

  it("is empty when the document is", () => {
    expect(firstLine("   \n\n")).toBe("");
  });

  it("stops where the Host stops it", () => {
    expect(firstLine("x".repeat(80))).toHaveLength(50);
  });
});
