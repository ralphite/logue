/**
 * The readable text of a page, captured at the moment it is saved.
 *
 * A Source that stores only a URL stops being evidence the first time the page
 * changes or 404s. Keeping the text is what makes "frozen Source" true rather
 * than aspirational.
 *
 * This function is injected into the page, so it must be self-contained — it
 * cannot close over anything from the extension.
 */
export function readablePageText(): string {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOISCRIPT", "NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "SVG"]);
  const article = document.querySelector("article, main, [role='main']") ?? document.body;
  if (!article) return "";

  const parts: string[] = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof Element)) return NodeFilter.FILTER_SKIP;
      if (SKIP.has(node.tagName)) return NodeFilter.FILTER_REJECT;
      if (node.closest("#logue-host")) return NodeFilter.FILTER_REJECT;
      return /^(P|H1|H2|H3|H4|LI|BLOCKQUOTE|PRE|TD|DT|DD)$/.test(node.tagName)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof HTMLElement)) continue;
    const text = node.innerText?.replace(/\s+/g, " ").trim();
    // Single words are navigation, not prose.
    if (text && text.length > 2 && text.includes(" ")) parts.push(text);
    if (parts.length > 800) break;
  }

  const seen = new Set<string>();
  const unique = parts.filter((part) => !seen.has(part) && seen.add(part));
  return unique.join("\n\n").slice(0, 60000);
}
