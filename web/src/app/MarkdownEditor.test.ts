import { describe, expect, it } from "vitest";
import { spliced } from "./MarkdownEditor";
import { firstLine, renamed, words } from "./DocumentsRoute";

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

describe("renaming a page from the list", () => {
  it("writes the first line and keeps its markup", () => {
    expect(renamed("# Notes\n\nBody.", "Plans")).toBe("# Plans\n\nBody.");
    expect(renamed("- one\n- two", "first")).toBe("- first\n- two");
  });

  it("skips the empty lines above the first one", () => {
    expect(renamed("\n\n  \nOld name\nrest", "New name")).toBe("\n\n  \nNew name\nrest");
  });

  it("gives an empty document the name as its whole content", () => {
    expect(renamed("   \n\n", "First page")).toBe("First page");
  });
});

describe("how much has been written", () => {
  it("counts words, not markup", () => {
    expect(words("# A heading\n\nTwo words here.")).toBe("5 words");
    expect(words("one")).toBe("1 word");
    expect(words("")).toBe("0 words");
  });

  it("counts Chinese by character, because it has no spaces to count between", () => {
    expect(words("今天写了三行")).toBe("6 words");
    expect(words("今天 wrote three")).toBe("4 words");
  });

  it("does not count what is inside a fenced block", () => {
    expect(words("Real words here\n\n```\nnot counted at all\n```")).toBe("3 words");
  });
});
