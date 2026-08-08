import { captureStableEditableSelection, type EditableSelectionSnapshot } from "@logue/ui";

const editorTags = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL", "LI", "BR", "BLOCKQUOTE", "STRONG", "EM", "CODE", "PRE", "A", "S", "MARK"]);

function citationPattern(flags = "g") {
  return new RegExp("\\[Source (\\d+)\\]", flags);
}

function escapeHTML(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inlineMarkdown(value: string) {
  return escapeHTML(value)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/gi, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(citationPattern(), "<mark>[Source $1]</mark>");
}

export function markdownToEditorHTML(value: string, title: string) {
  const lines = value.split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | undefined;
  let firstContentSeen = false;
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = undefined;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const text = line.trimEnd();
    if (!text) {
      closeList();
      if (html.length && html[html.length - 1] !== "<p><br></p>") html.push("<p><br></p>");
      continue;
    }
    if (!firstContentSeen) {
      firstContentSeen = true;
      if (text.startsWith("# ") && text.slice(2).trim() === title.trim()) continue;
    }
    if (text.startsWith("```")) {
      closeList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      html.push(`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`);
    } else if (text.startsWith("### ")) {
      closeList(); html.push(`<h3>${inlineMarkdown(text.slice(4))}</h3>`);
    } else if (text.startsWith("## ")) {
      closeList(); html.push(`<h2>${inlineMarkdown(text.slice(3))}</h2>`);
    } else if (text.startsWith("# ")) {
      closeList(); html.push(`<h1>${inlineMarkdown(text.slice(2))}</h1>`);
    } else if (/^[-*] /.test(text)) {
      if (list !== "ul") { closeList(); list = "ul"; html.push("<ul>"); }
      html.push(`<li>${inlineMarkdown(text.slice(2))}</li>`);
    } else if (/^\d+\. /.test(text)) {
      if (list !== "ol") { closeList(); list = "ol"; html.push("<ol>"); }
      html.push(`<li>${inlineMarkdown(text.replace(/^\d+\. /, ""))}</li>`);
    } else if (text.startsWith("> ")) {
      closeList(); html.push(`<blockquote>${inlineMarkdown(text.slice(2))}</blockquote>`);
    } else {
      closeList();
      html.push(`<p>${inlineMarkdown(text)}</p>`);
    }
  }
  closeList();
  return html.join("") || "<p><br></p>";
}

export function sanitizeEditorHTML(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof HTMLElement) {
        if (!editorTags.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent ?? ""));
          continue;
        }
        if (child.tagName === "MARK" && !/^\[Source \d+\]$/.test(child.textContent?.trim() ?? "")) {
          child.replaceWith(...Array.from(child.childNodes));
          continue;
        }
        const link = child.tagName === "A";
        const href = link ? child.getAttribute("href") : undefined;
        for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name);
        if (link && href && /^(https?:\/\/|mailto:)/i.test(href)) {
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noreferrer");
        }
      }
      clean(child);
    }
  };
  clean(template.content);
  return template.innerHTML;
}

type MarkdownBlockShortcut =
  | { command: "formatBlock"; value: "H1" | "H2" | "H3" | "BLOCKQUOTE" | "PRE" }
  | { command: "insertOrderedList" | "insertUnorderedList" };

export function markdownShortcutForPrefix(prefix: string): MarkdownBlockShortcut | undefined {
  if (prefix === "#") return { command: "formatBlock", value: "H1" };
  if (prefix === "##") return { command: "formatBlock", value: "H2" };
  if (prefix === "###") return { command: "formatBlock", value: "H3" };
  if (prefix === ">") return { command: "formatBlock", value: "BLOCKQUOTE" };
  if (prefix === "```") return { command: "formatBlock", value: "PRE" };
  if (prefix === "-" || prefix === "*") return { command: "insertUnorderedList" };
  if (prefix === "1.") return { command: "insertOrderedList" };
  return undefined;
}

export function looksLikeMarkdown(value: string) {
  return value.includes("\n") || /(^|\s)(#{1,3}|>|[-*]|\d+\.)\s|```|\*\*[^*]+\*\*|~~[^~]+~~|\[[^\]]+\]\((?:https?:\/\/|mailto:)/m.test(value);
}

/** A Skill result may only replace the selection the user still has active. */
export function documentSelectionSkillIsCurrent(editor: HTMLElement, snapshot: EditableSelectionSnapshot) {
  return captureStableEditableSelection(editor, snapshot, editor) === snapshot;
}

function currentEditableBlock(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return undefined;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return undefined;
  const origin = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
  const block = origin?.closest("p,div,h1,h2,h3,blockquote,li,pre");
  if (!(block instanceof HTMLElement) || block === editor || !editor.contains(block)) return undefined;
  return { block, range, selection };
}

export function applyMarkdownBlockShortcut(editor: HTMLElement) {
  const editable = currentEditableBlock(editor);
  if (!editable) return false;
  const { block, range, selection } = editable;
  const before = range.cloneRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  const prefix = before.toString();
  if (prefix !== block.textContent) return false;
  const shortcut = markdownShortcutForPrefix(prefix);
  if (!shortcut) return false;

  let nextBlock: HTMLElement;
  if (shortcut.command === "formatBlock") {
    nextBlock = document.createElement(shortcut.value);
    nextBlock.appendChild(document.createElement("br"));
  } else {
    const list = document.createElement(shortcut.command === "insertOrderedList" ? "ol" : "ul");
    nextBlock = document.createElement("li");
    nextBlock.appendChild(document.createElement("br"));
    list.appendChild(nextBlock);
    block.replaceWith(list);
  }
  if (shortcut.command === "formatBlock") block.replaceWith(nextBlock);
  const caret = document.createRange();
  caret.selectNodeContents(nextBlock);
  caret.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caret);
  return true;
}


export function insertMarkdownAtSelection(editor: HTMLElement, value: string) {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!selection || !range || !editor.contains(range.commonAncestorContainer)) return false;
  const template = document.createElement("template");
  template.innerHTML = markdownToEditorHTML(value, "");
  const currentBlock = currentEditableBlock(editor)?.block;
  const blockPaste = value.includes("\n") || /^(#{1,3}|>|[-*]|\d+\.|```)/m.test(value);
  let lastNode = template.content.lastChild;
  if (blockPaste && currentBlock) {
    const fragment = template.content;
    if (!currentBlock.textContent?.trim()) currentBlock.replaceWith(fragment);
    else currentBlock.after(fragment);
  } else {
    const onlyParagraph = template.content.childElementCount === 1 && template.content.firstElementChild?.tagName === "P"
      ? template.content.firstElementChild
      : undefined;
    const fragment = document.createDocumentFragment();
    for (const child of Array.from((onlyParagraph ?? template.content).childNodes)) fragment.appendChild(child);
    lastNode = fragment.lastChild;
    range.deleteContents();
    range.insertNode(fragment);
  }
  if (lastNode?.isConnected) {
    const caret = document.createRange();
    caret.selectNodeContents(lastNode);
    caret.collapse(false);
    selection.removeAllRanges();
    selection.addRange(caret);
  }
  return true;
}

export function insertPlainTextAtSelection(editor: HTMLElement, value: string) {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!selection || !range || !editor.contains(range.commonAncestorContainer)) return false;
  const node = document.createTextNode(value);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function withoutDuplicateTitle(value: string, title: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const first = template.content.firstElementChild;
  if (first?.tagName === "H1" && first.textContent?.trim() === title.trim()) first.remove();
  return template.innerHTML;
}

export function toEditorHTML(value: string, title: string) {
  const html = value.trimStart().startsWith("<") ? sanitizeEditorHTML(value) : markdownToEditorHTML(value, title);
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const paragraph of Array.from(template.content.querySelectorAll("p"))) {
    const text = paragraph.textContent?.trim() ?? "";
    const heading = /^(#{1,3})\s+(.+)$/.exec(text);
    if (heading) {
      const replacement = document.createElement(`h${heading[1].length}`);
      replacement.textContent = heading[2];
      paragraph.replaceWith(replacement);
    }
  }
  for (const paragraph of Array.from(template.content.querySelectorAll("p"))) {
    const blank = !(paragraph.textContent?.trim());
    const previous = paragraph.previousElementSibling;
    const next = paragraph.nextElementSibling;
    if (
      blank &&
      ((previous?.tagName === "P" && !previous.textContent?.trim()) ||
        next?.matches("h1, h2, h3"))
    ) {
      paragraph.remove();
    }
  }
  return withoutDuplicateTitle(
    template.innerHTML.replace(citationPattern(), "[Source $1]"),
    title,
  );
}

export function hasCitationNumber(value: string, sourceNumber: number) {
  return new RegExp(`\\[Source ${sourceNumber}\\]`).test(value);
}

export function renumberCitationsAfterRemoval(value: string, removedSourceNumber: number) {
  return value.replace(citationPattern(), (match, rawNumber: string) => {
    const sourceNumber = Number(rawNumber);
    return sourceNumber > removedSourceNumber ? `[Source ${sourceNumber - 1}]` : match;
  });
}

export function reconcileDocumentCitations(value: string, sourceIds: string[]) {
  const cited = new Set<number>();
  for (const match of value.matchAll(citationPattern())) {
    const sourceNumber = Number(match[1]);
    if (sourceNumber >= 1 && sourceNumber <= sourceIds.length) cited.add(sourceNumber);
  }
  const nextSourceIds: string[] = [];
  const renumber = new Map<number, number>();
  sourceIds.forEach((id, index) => {
    const sourceNumber = index + 1;
    if (!cited.has(sourceNumber)) return;
    nextSourceIds.push(id);
    renumber.set(sourceNumber, nextSourceIds.length);
  });
  const content = value
    .replace(citationPattern(), (_match, rawNumber: string) => {
      const nextNumber = renumber.get(Number(rawNumber));
      return nextNumber ? `[Source ${nextNumber}]` : "";
    })
    .replace(/<mark>\s*<\/mark>/gi, "")
    .replace(/(?:[ \t]|&nbsp;)+([\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F,.!?;:])/g, "$1")
    .trim();
  return { content, sourceIds: nextSourceIds };
}

export function removeSourceCitation(value: string, sourceIds: string[], id: string) {
  const sourceIndex = sourceIds.indexOf(id);
  if (sourceIndex < 0) return { content: value, sourceIds };
  const sourceNumber = sourceIndex + 1;
  const content = value
    .replace(citationPattern(), (match, rawNumber: string) => {
      const number = Number(rawNumber);
      if (number === sourceNumber) return "";
      return number > sourceNumber ? `[Source ${number - 1}]` : match;
    })
    .replace(/<mark>\s*<\/mark>/gi, "")
    .replace(/(?:[ \t]|&nbsp;)+([\uFF0C\u3002\uFF1B\uFF1A\u3001\uFF01\uFF1F,.!?;:])/g, "$1")
    .trim();
  return { content, sourceIds: sourceIds.filter((sourceId) => sourceId !== id) };
}
