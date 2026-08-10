import { beforeEach, describe, expect, it } from "vitest";
import { anchorFor, locate } from "./anchor";

/**
 * The point of an anchor is that it survives the page being rebuilt around it.
 * These pin that: the same words, in different markup, still findable — and
 * words that are genuinely gone reported as gone rather than guessed at.
 */
function page(html: string): void {
  document.body.innerHTML = html;
}

function rangeOver(text: string): Range {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text)) continue;
    const at = (node.nodeValue ?? "").indexOf(text);
    if (at === -1) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + text.length);
    return range;
  }
  throw new Error(`no text node holds ${JSON.stringify(text)}`);
}

describe("anchoring a passage", () => {
  beforeEach(() => {
    page(`
      <article>
        <p>The first paragraph sets the scene and says nothing useful.</p>
        <p>Sources are frozen because a page you cannot check is a page you cannot trust.</p>
        <p>The last paragraph wanders off.</p>
      </article>
    `);
  });

  it("remembers the words and what sits either side of them", () => {
    const anchor = anchorFor(rangeOver("frozen because a page"));
    expect(anchor?.exact).toBe("frozen because a page");
    expect(anchor?.before).toContain("Sources are");
    expect(anchor?.after).toContain("you cannot check");
  });

  it("finds it again after the markup around it is rebuilt", () => {
    const anchor = anchorFor(rangeOver("frozen because a page"));
    // Same words, different structure: extra wrappers, different tags, a
    // sidebar that was not there before. This is what a redesign looks like.
    page(`
      <div><nav><span>Home</span></nav>
        <section><div><span>The first paragraph sets the scene and says nothing useful.</span></div>
          <div><em>Sources are </em><b>frozen because a page</b><em> you cannot check is a page you cannot trust.</em></div>
        </section>
      </div>
    `);
    const found = locate(anchor!);
    expect(found?.range.toString()).toBe("frozen because a page");
  });

  it("survives the page being re-wrapped onto different lines", () => {
    const anchor = anchorFor(rangeOver("frozen because a page"));
    page(`<p>Sources are\n  frozen because a\n  page you cannot check is a page you cannot trust.</p>`);
    expect(locate(anchor!)?.range.toString().replace(/\s+/g, " ")).toBe("frozen because a page");
  });

  it("says nothing rather than guessing when the passage is gone", () => {
    const anchor = anchorFor(rangeOver("frozen because a page"));
    page(`<p>The whole article was rewritten and says something else entirely now.</p>`);
    expect(locate(anchor!)).toBeUndefined();
  });

  it("picks the copy with the remembered neighbours when the quote repeats", () => {
    page(`
      <p>In the first section: the rule is simple. Keep the source.</p>
      <p>In the second section: the rule is simple. Throw it away.</p>
    `);
    const anchor = anchorFor(rangeOver("the rule is simple"));
    expect(anchor?.after).toContain("Keep the source");

    const found = locate(anchor!);
    expect(found?.exactly).toBe(false);
    // The right one is the one followed by "Keep the source".
    const after = found!.range.endContainer.nodeValue?.slice(found!.range.endOffset, found!.range.endOffset + 20);
    expect(after).toContain("Keep");
  });

  it("ignores Logue's own surfaces when reading the page", () => {
    page(`
      <p>Sources are frozen because a page you cannot check is a page you cannot trust.</p>
      <div id="logue-host"><p>Sources are frozen because a page you cannot check.</p></div>
    `);
    const anchor = anchorFor(rangeOver("frozen because a page"));
    expect(anchor?.before).toContain("Sources are");
    expect(locate(anchor!)?.exactly).toBe(true);
  });
});
