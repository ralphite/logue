import TurndownService from "turndown";

/**
 * HTML from someone's clipboard, as Markdown.
 *
 * Every paste into a document comes from somewhere that had formatting, and
 * the clipboard carries that as HTML next to the flat text. Taking the flat
 * text threw all of it away — a pasted article arrived as one undifferentiated
 * block and the headings, lists and links were put back by hand.
 *
 * Configured to write the same Markdown this editor writes elsewhere, so a
 * pasted heading and a typed heading are the same characters: `#` for
 * headings, `-` for bullets, fenced code, `**` for bold.
 */
const service = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});

// GitHub's task lists, which is what a copied checklist is everywhere it
// matters. Without this the box is dropped and the item arrives done or not
// done with no way to tell which it was.
service.addRule("taskList", {
  filter: (node) => node.nodeName === "LI" && node.querySelector?.('input[type="checkbox"]') != null,
  replacement: (content, node) => {
    const box = node.querySelector?.('input[type="checkbox"]');
    const text = content.replace(/^\s+/, "").replace(/\n+$/, "");
    return `- [${box instanceof HTMLInputElement && box.checked ? "x" : " "}] ${text}\n`;
  },
});

// Strikethrough is in the Markdown this editor already reads (GFM) but not in
// Turndown's defaults.
service.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`,
});

// A pasted page brings its furniture with it. None of it is the passage
// somebody meant to copy.
service.remove(["script", "style", "noscript", "head", "meta", "link"]);

/**
 * Empty when there is nothing worth taking.
 *
 * A clipboard that carries HTML wrapping nothing but the plain text — most
 * plain-text copies do — should paste as the plain text, not through a
 * converter that might change the whitespace. The caller compares.
 */
export function htmlToMarkdown(html: string): string {
  try {
    return (
      service
        .turndown(html)
        // Turndown pads a bullet out to four columns (`-   first`). Every list
        // written in this editor uses one space, and a document where the
        // pasted half and the typed half are spaced differently is a document
        // that looks broken to the person who wrote both.
        .replace(/^(\s*)([-*+])[ \t]{2,}/gm, "$1$2 ")
        .trim()
    );
  } catch {
    // A converter that throws must not eat the paste; the caller falls back to
    // the browser's own, which is the plain text.
    return "";
  }
}
