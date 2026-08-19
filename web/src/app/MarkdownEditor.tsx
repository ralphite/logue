import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { languages as codeLanguages } from "./codeLanguages";
import { htmlToMarkdown } from "./htmlToMarkdown";
import { GFM } from "@lezer/markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { EMOJI } from "./emoji";
import { Annotation, EditorSelection, EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  type Command,
  crosshairCursor,
  Decoration,
  type DecorationSet,
  drawSelection,
  dropCursor,
  EditorView,
  hoverTooltip,
  keymap,
  placeholder,
  rectangularSelection,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cn, floatingStyle, usePlacement } from "@logue/ui";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";

/**
 * The editor a document is written in: Markdown, shown as it will read.
 *
 * Written after his instruction of 2026-08-13 — *"我们需要真的支持 Markdown…
 * 为什么我们并没有所见即所得的 Markdown 编辑？"* The editor before this was a
 * `contenteditable` holding HTML, so what was stored was not what a document
 * exports as and not what a model wrote. Now there is one text, in one format.
 *
 * The approach is `~/dev2/prototypes/vibedoc`'s — CodeMirror with the Markdown
 * grammar, styled in place — with one thing added: **the markup hides itself**
 * on every line the caret is not in. `## Tuesday` reads as Tuesday until you
 * put the caret in it, and then the hashes are there to edit. That is the
 * difference between reading Markdown and looking at Markdown.
 */

/**
 * This change came from the Host, not from a person typing.
 *
 * Without it, loading a document counted as an edit: the text arrived, the
 * editor dispatched it, the update listener called it a keystroke and the
 * autosave wrote it straight back. Opening twenty documents to read them
 * moved every one of them to the top of the list, as if they had been edited.
 */
const fromTheHost = Annotation.define<boolean>();

/**
 * A rewritten passage put back where the old one was.
 *
 * The words change; the space around them does not. A selected line carries
 * its own newline, and a rewrite that came back without one welded the next
 * line onto the end of this one — the first thing that went wrong when the
 * editor stopped being a `contenteditable`.
 */
export function spliced(text: string, passage: string, next: string): { from: number; to: number; insert: string } {
  const at = text.indexOf(passage);
  if (at < 0) return { from: text.length, to: text.length, insert: `\n\n${next.trim()}` };
  const before = passage.match(/^\s*/)?.[0] ?? "";
  const after = passage.match(/\s*$/)?.[0] ?? "";
  return { from: at, to: at + passage.length, insert: `${before}${next.trim()}${after}` };
}

/** What the surrounding editor can do to the text after it is mounted. */
export interface MarkdownHandle {
  /** Replace the first occurrence of a passage, as the rewrite dialog does. */
  replace: (passage: string, next: string) => void;
  /** What is selected right now, empty when nothing is. */
  selection: () => string;
  /** Put the caret on a line and bring it into view — what the outline does. */
  goto: (offset: number) => void;
}

/**
 * The marks that are hidden away from the caret.
 *
 * `ListMark` is deliberately not here: a bullet is how a list looks, and
 * hiding it leaves an indented line with nothing to say it is an item.
 */
const MARKS = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "QuoteMark", "LinkMark", "URL"]);

/** What a list line starts with: nesting, marker, and a task's box. */
const ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

/** A line whose marker is a checkbox rather than a bullet. */
const TASK = /^\s*([-*+]|\d+[.)])\s+\[[ xX]\]/;

/** `[Source 3]`, as it is written in every document a generation produced. */
const CITATION = /\[Source (\d+)\]/g;

/**
 * A citation, drawn the way it is drawn everywhere else in the product.
 *
 * The literal `[Source 3]` was not only ugly: in a 720px column it wrapped, and a
 * citation split across two lines is two pieces of punctuation rather than
 * one chip you can follow. Same pill as `Citation` in the answer, built by
 * hand because CodeMirror widgets are DOM, not React.
 */
/** The one shape drawn as a page block — any host's address, or none. */
const PAGE_LINK = /^\[([^\]]*)\]\((?:https?:\/\/[^/)]+)?\/documents\/(doc_[0-9a-zA-Z_-]+)\)$/;

/** What a page link says, when a run of text is exactly one. */
function pageLinkOf(written: string): { name: string; id: string } | undefined {
  const parts = PAGE_LINK.exec(written.trim());
  return parts?.[2] ? { name: parts[1] || "Untitled", id: parts[2] } : undefined;
}

/**
 * A link to another page, drawn as Notion draws a subpage.
 *
 * The stored text stays a plain Markdown link — `[name](/documents/doc_…)` —
 * so the export stands alone; this is only how it reads on the lines the
 * caret is not in. The name is looked up so a renamed child shows through
 * without this document being edited.
 */
class Subpage extends WidgetType {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly follow?: (id: string) => void,
  ) {
    super();
  }

  override eq(other: Subpage): boolean {
    return other.id === this.id && other.name === this.name;
  }

  toDOM(): HTMLElement {
    const page = document.createElement("button");
    page.type = "button";
    page.className =
      "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left " +
      "align-baseline font-[500] text-ink hover:bg-hover";
    page.setAttribute("aria-label", `Page ${this.name}`);
    const glyph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    glyph.setAttribute("viewBox", "0 0 24 24");
    glyph.setAttribute("fill", "none");
    glyph.setAttribute("stroke", "currentColor");
    glyph.setAttribute("stroke-width", "1.8");
    glyph.setAttribute("stroke-linejoin", "round");
    glyph.setAttribute("class", "h-[16px] w-[16px] shrink-0 text-muted");
    glyph.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>';
    const name = document.createElement("span");
    name.className = "truncate underline decoration-line underline-offset-2";
    name.textContent = this.name;
    page.append(glyph, name);
    if (this.follow) {
      // The press must not move the caret into the line and unmask the raw
      // link, so the mousedown's default goes; the open rides the click,
      // which is also what Enter fires on a button.
      page.addEventListener("mousedown", (event) => event.preventDefault());
      page.addEventListener("click", () => this.follow?.(this.id));
    }
    return page;
  }

  /** The editor keeps its hands off the page block, like the citation chip. */
  override ignoreEvent(): boolean {
    return true;
  }
}

class Cite extends WidgetType {
  constructor(
    readonly n: number,
    readonly follow?: (n: number) => void,
  ) {
    super();
  }

  override eq(other: Cite): boolean {
    return other.n === this.n;
  }

  toDOM(): HTMLElement {
    const chip = document.createElement("span");
    chip.className =
      "inline-flex h-5 translate-y-[2px] cursor-pointer items-center rounded-full border border-accent-line " +
      "bg-accent-soft px-1.5 text-xs font-[650] text-accent-ink hover:bg-accent-hover-soft";
    chip.textContent = String(this.n);
    chip.title = `Source ${this.n}`;
    chip.setAttribute("aria-label", `Source ${this.n}`);
    if (this.follow) {
      chip.addEventListener("mousedown", (event) => {
        event.preventDefault();
        this.follow?.(this.n);
      });
    }
    return chip;
  }

  /**
   * The editor keeps its hands off the chip.
   *
   * With this false, CodeMirror treated a press on the pill as a press on the
   * text under it: the caret moved, the line opened for editing, and the
   * Source never opened. A citation you cannot follow is the one thing this
   * product must not draw.
   */
  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * A task box, as a box you can press.
 *
 * `- [ ] buy milk` is a checkbox to everyone who has ever written Markdown,
 * and it was two brackets and a space. Pressing it writes the other state
 * into the text, which is the only place the state lives.
 */
class Task extends WidgetType {
  constructor(
    readonly done: boolean,
    readonly at: number,
    readonly toggle: (at: number, done: boolean) => void,
  ) {
    super();
  }

  override eq(other: Task): boolean {
    return other.done === this.done && other.at === this.at;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("span");
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.done));
    box.tabIndex = 0;
    box.className =
      "mr-1 inline-flex size-[14px] translate-y-[2px] cursor-pointer items-center justify-center rounded-[4px] border " +
      (this.done ? "border-accent bg-accent text-white" : "border-control-line bg-surface");
    if (this.done) {
      box.innerHTML =
        '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l5 5L19 7"/></svg>';
    }
    const flip = (event: Event) => {
      event.preventDefault();
      this.toggle(this.at, this.done);
    };
    box.addEventListener("mousedown", flip);
    box.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") flip(event);
    });
    return box;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * An image, shown rather than described.
 *
 * `![a chart](https://…)` is the one piece of Markdown whose whole purpose is
 * to be looked at, and it was a line of punctuation. Shown only away from the
 * caret, like every other mark here, so the address stays editable.
 */
class Picture extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }

  override eq(other: Picture): boolean {
    return other.url === this.url && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const frame = document.createElement("span");
    frame.className = "my-1 block";
    const image = document.createElement("img");
    image.src = this.url;
    image.alt = this.alt;
    image.className = "max-h-80 max-w-full rounded-md border border-line";
    // A picture that will not load must not leave a broken glyph in a
    // sentence: the text comes back, which is what it was written as.
    image.addEventListener("error", () => {
      frame.textContent = `${this.alt || "Image"} — ${this.url}`;
      frame.className = "my-1 block text-xs text-muted";
    });
    frame.append(image);
    return frame;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * The lines the caret or a selection touches, which keep their markup.
 *
 * Only while the editor has focus. A document nobody is typing in has its
 * caret at position 0 all the same, and that made the first line — the one
 * that is the document's name — the single line that showed its hashes.
 */
function open(view: EditorView): Set<number> {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  for (const range of view.state.selection.ranges) {
    const from = view.state.doc.lineAt(range.from).number;
    const end = view.state.doc.lineAt(range.to);
    // Selecting a line takes the newline after it with it, which lands on the
    // start of the next one. That line is not being edited, and flashing its
    // markup open reads as a glitch.
    const to = !range.empty && range.to === end.from && end.number > from ? end.number - 1 : end.number;
    for (let line = from; line <= to; line += 1) lines.add(line);
  }
  return lines;
}

function marks(
  view: EditorView,
  cite?: (n: number) => void,
  toggle: (at: number, done: boolean) => void = () => undefined,
  page?: { open?: (id: string) => void; name?: (id: string) => string | undefined },
): DecorationSet {
  const editing = open(view);
  const hidden = Decoration.replace({});
  /** Collected first, sorted after: a RangeSetBuilder wants them in order. */
  const found: { from: number; to: number; with: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        // A link to another page draws as a subpage block away from the
        // caret: a page glyph and the page's name, pressed to open. Whole,
        // and without descending — the link's own marks must not also hide
        // themselves inside a range this replaces.
        if (node.name === "Link" && !editing.has(view.state.doc.lineAt(node.from).number)) {
          const line = view.state.doc.lineAt(node.from);
          // Alone on its line, or it is prose: `see [the plan](…) first`
          // keeps the words it was written with.
          const written = view.state.doc.sliceString(node.from, node.to);
          const sub = line.text.trim() === written.trim() ? pageLinkOf(written) : undefined;
          if (sub) {
            const shown = page?.name?.(sub.id) ?? sub.name;
            found.push({
              from: node.from,
              to: node.to,
              with: Decoration.replace({ widget: new Subpage(sub.id, shown, page?.open) }),
            });
            return false;
          }
        }
        // A task box is a box wherever the caret is: a checkbox you cannot
        // press while you happen to be on its line is not a checkbox.
        if (node.name === "TaskMarker") {
          const done = /[xX]/.test(view.state.doc.sliceString(node.from, node.to));
          found.push({
            from: node.from,
            to: node.to,
            with: Decoration.replace({ widget: new Task(done, node.from, toggle) }),
          });
          return undefined;
        }
        // A picture is shown where it is written, away from the caret.
        if (node.name === "Image" && !editing.has(view.state.doc.lineAt(node.from).number)) {
          const written = view.state.doc.sliceString(node.from, node.to);
          const parts = /^!\[([^\]]*)\]\(([^)\s]+)/.exec(written);
          if (parts?.[2]) {
            found.push({
              from: node.from,
              to: node.to,
              with: Decoration.replace({ widget: new Picture(parts[2], parts[1] ?? "") }),
            });
            return false;
          }
          return undefined;
        }
        // The bullet on a task line, where the box is already the marker.
        // Everywhere else `ListMark` stays (see MARKS): a bullet is how a list
        // looks. On `- [ ] milk` the checkbox says "item" on its own, and the
        // dash in front of it read as a stray character.
        if (node.name === "ListMark" && TASK.test(view.state.doc.lineAt(node.from).text)) {
          found.push({ from: node.from, to: Math.min(node.to + 1, view.state.doc.lineAt(node.from).to), with: hidden });
          return undefined;
        }
        if (!MARKS.has(node.name)) return undefined;
        // A URL is only noise inside a written link; a bare one is the text.
        if (node.name === "URL" && node.node.parent?.name !== "Link") return undefined;
        if (editing.has(view.state.doc.lineAt(node.from).number)) return undefined;
        // The space after `#` or `>` is part of how the mark is typed, not of
        // the words: `# A` rendered with the hash alone hidden began with a
        // space, so every heading sat one space deep.
        let until = node.to;
        if (node.name === "HeaderMark" || node.name === "QuoteMark") {
          const line = view.state.doc.lineAt(node.from);
          while (until < line.to && /[ \t]/.test(view.state.doc.sliceString(until, until + 1))) until += 1;
        }
        if (until > node.from) found.push({ from: node.from, to: until, with: hidden });
        return undefined;
      },
    });
    // Citations are not part of the Markdown grammar — they are ours — so
    // they are found in the text rather than in the tree.
    const text = view.state.doc.sliceString(from, to);
    for (const match of text.matchAll(CITATION)) {
      const at = from + (match.index ?? 0);
      if (editing.has(view.state.doc.lineAt(at).number)) continue;
      found.push({
        from: at,
        to: at + match[0].length,
        with: Decoration.replace({ widget: new Cite(Number(match[1]), cite) }),
      });
    }
  }
  const built = new RangeSetBuilder<Decoration>();
  for (const one of found.toSorted((a, b) => a.from - b.from || a.to - b.to)) {
    built.add(one.from, one.to, one.with);
  }
  return built.finish();
}

/** Something outside the text moved — a page in it was renamed — redraw. */
const refreshMarks = Annotation.define<boolean>();

function livePreview(
  cite?: (n: number) => void,
  page?: { open?: (id: string) => void; name?: (id: string) => string | undefined },
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(readonly view: EditorView) {
        this.decorations = marks(view, cite, this.toggle, page);
      }

      /** Pressing a task box writes the other state where the state lives. */
      toggle = (at: number, done: boolean) => {
        const marker = this.view.state.doc.sliceString(at, at + 3);
        const next = done ? marker.replace(/[xX]/, " ") : marker.replace(/\s(?=\])/, "x");
        this.view.dispatch({ changes: { from: at, to: at + 3, insert: next } });
      };

      update(update: ViewUpdate) {
        // The caret moving is the whole point: it is what puts the markup of
        // one line back and takes the last one's away. Focus counts as a move
        // — clicking in and clicking away change which lines are being edited.
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.transactions.some((one) => one.annotation(refreshMarks))
        ) {
          this.decorations = marks(update.view, cite, this.toggle, page);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** Everything the type system already decides, said in the type system's terms. */
const written = HighlightStyle.define([
  // Notion's scale, measured on app.notion.com on 2026-08-19: 30 / 24 / 20 at
  // 1.3 and 600, over a 16px body. `em` rather than px because the title line
  // raises its own font size and every heading on it has to follow.
  { tag: tags.heading1, fontSize: "1.875em", fontWeight: "600", lineHeight: "1.3" },
  { tag: tags.heading2, fontSize: "1.5em", fontWeight: "600", lineHeight: "1.3" },
  { tag: tags.heading3, fontSize: "1.25em", fontWeight: "600", lineHeight: "1.3" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600", color: "var(--color-ink)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-muted)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--color-ink-soft)" },
  { tag: tags.quote, color: "var(--color-ink-soft)" },
  { tag: tags.link, color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "2px" },
  { tag: tags.url, color: "var(--color-muted)" },
  { tag: [tags.processingInstruction, tags.punctuation, tags.meta], color: "var(--color-faint)" },
  // Inside a fence. Naming a language and then rendering it in one flat grey
  // is the editor not reading its own document: the grammar was being parsed
  // and then thrown away, because a custom highlight style answers for every
  // tag and this one only knew about Markdown's.
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: "var(--color-accent)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--color-act-saved)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--color-act-kept)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--color-muted)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--color-act-generated)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--color-act-dictated)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--color-ink-soft)" },
  { tag: [tags.operator, tags.derefOperator, tags.separator], color: "var(--color-muted-strong)" },
  { tag: tags.definition(tags.variableName), color: "var(--color-ink)" },
]);

/**
 * The page it is written on.
 *
 * Every value here is a token from `theme.css`; nothing is a colour or a size
 * of its own. CodeMirror wants a style object rather than classes, which is
 * why this is written in JavaScript at all.
 */
const page = EditorView.theme({
  "&": { fontSize: "15px", color: "var(--color-ink)", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    padding: "0",
    fontFamily: "var(--font-sans)",
    lineHeight: "1.65",
    caretColor: "var(--color-ink)",
    maxWidth: "44rem",
  },
  ".cm-line": { padding: "0" },
  ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.65" },
  ".cm-cursor": { borderLeftColor: "var(--color-ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-accent-soft)",
  },
  ".cm-placeholder": { color: "var(--color-line-strong)" },
  // The same weight as the whole-document placeholder: a hint, not a line of
  // the document.
  ".cm-hint": { color: "var(--color-line-strong)", pointerEvents: "none", userSelect: "none" },
  // A quote and a fenced block are the two shapes that need more than type.
  ".cm-quote-line": {
    borderLeft: "2px solid var(--color-line-strong)",
    paddingLeft: "0.8em",
  },
  ".cm-code-line": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-surface-muted)",
    paddingLeft: "0.6em",
    paddingRight: "0.6em",
  },
  ".cm-table-line": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.88em",
    backgroundColor: "var(--color-surface-muted)",
    paddingLeft: "0.6em",
    paddingRight: "0.6em",
  },
  // ⌘-click follows a link, the way it does in an editor. A plain click is
  // still a caret: this is a document, not a page.
  ".cm-link-live": { cursor: "pointer" },
  // Find and replace. CodeMirror's panel is the right behaviour and the wrong
  // clothes — a grey strip with system inputs sitting above a page typeset in
  // the product's own hand. Only the surfaces are restated here; nothing about
  // how it works is touched.
  ".cm-panels": {
    backgroundColor: "var(--color-panel)",
    color: "var(--color-ink)",
    border: "0",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--color-line)" },
  ".cm-panel.cm-search": { padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" },
  ".cm-panel.cm-search label": { display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--color-muted)" },
  ".cm-panel.cm-search .cm-textfield, .cm-panel.cm-search button": {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    margin: "0",
  },
  ".cm-panel.cm-search .cm-textfield": {
    height: "26px",
    minWidth: "8rem",
    padding: "0 7px",
    borderRadius: "7px",
    border: "1px solid var(--color-control-line)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    outline: "none",
  },
  ".cm-panel.cm-search .cm-textfield:focus": { borderColor: "var(--color-accent-line)" },
  ".cm-panel.cm-search button:not([name=close])": {
    height: "26px",
    padding: "0 8px",
    borderRadius: "6px",
    border: "1px solid var(--color-control-line)",
    backgroundColor: "var(--color-surface)",
    backgroundImage: "none",
    color: "var(--color-ink-soft)",
    fontWeight: "560",
  },
  ".cm-panel.cm-search button[name=close]": {
    color: "var(--color-muted)",
    padding: "0 6px",
    fontSize: "16px",
    lineHeight: "1",
  },
  ".cm-searchMatch": { backgroundColor: "var(--color-accent-soft)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--color-accent-pressed)" },
  ".cm-selectionMatch": { backgroundColor: "var(--color-surface-muted)" },
});

/**
 * The block shapes that are drawn around whole lines, not inside them.
 *
 * Two kinds: the shells a quote, a fence and a table sit in, which come from
 * the syntax tree; and the hanging indent every list item needs, which comes
 * from the line itself. Collected together and sorted once, because a
 * `RangeSetBuilder` takes them in order and the tree does not walk in line
 * order.
 */
function blocks(view: EditorView): DecorationSet {
  const found: { at: number; with: Decoration }[] = [];
  const of: Record<string, Decoration> = {
    Blockquote: Decoration.line({ class: "cm-quote-line" }),
    FencedCode: Decoration.line({ class: "cm-code-line" }),
    // A pipe table lines up in a monospace column and nowhere else. The rule
    // above it and the shading behind it are what make it read as a table
    // while every cell stays a piece of text you can edit.
    Table: Decoration.line({ class: "cm-table-line" }),
  };
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const line = of[node.name];
        if (!line) return undefined;
        const first = view.state.doc.lineAt(node.from).number;
        const last = view.state.doc.lineAt(node.to).number;
        for (let at = first; at <= last; at += 1) {
          found.push({ at: view.state.doc.line(at).from, with: line });
        }
        return undefined;
      },
    });

    // A list item that wrapped began the next line under its own bullet, so a
    // long item and a new item were the same shape. The text hangs: the marker
    // sits in the margin the indent creates, and every wrapped line lines up
    // with the first word. Nesting comes free — the spaces are still in the
    // text, so a sub-item's margin is simply wider.
    for (let row = view.state.doc.lineAt(from).number; row <= view.state.doc.lineAt(to).number; row += 1) {
      const line = view.state.doc.line(row);
      const item = ITEM.exec(line.text);
      if (!item) continue;
      // The box that replaces `- [ ] ` is narrower than the six characters it
      // is written as; the rest is measured in `ch`, which is what the markers
      // are made of.
      const width = item[4] ? (item[1]?.length ?? 0) + 2.4 : item[0].length;
      found.push({
        at: line.from,
        with: Decoration.line({ attributes: { style: `padding-left:${width}ch;text-indent:-${width}ch` } }),
      });
    }
  }
  const built = new RangeSetBuilder<Decoration>();
  for (const one of found.toSorted((a, b) => a.at - b.at)) built.add(one.at, one.at, one.with);
  return built.finish();
}

const shapes = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = blocks(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = blocks(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * The blocks the slash menu inserts.
 *
 * Typing `/` on an empty line is how a page is built in Notion, and it is the
 * one Notion habit that transfers to a Markdown editor without pretending to
 * be something else: the menu writes Markdown, and what it wrote stays
 * editable as text.
 */
const BLOCKS: { key: string; label: string; hint: string; insert?: string; caret?: number }[] = [
  { key: "h1", label: "Heading 1", hint: "#", insert: "# " },
  { key: "h2", label: "Heading 2", hint: "##", insert: "## " },
  { key: "h3", label: "Heading 3", hint: "###", insert: "### " },
  { key: "list", label: "Bulleted list", hint: "-", insert: "- " },
  { key: "numbers", label: "Numbered list", hint: "1.", insert: "1. " },
  { key: "task", label: "To-do", hint: "[ ]", insert: "- [ ] " },
  // Notion's Page: a child of this document, linked where the caret is. The
  // insert is written by `put` once the page exists, so it has no template.
  { key: "page", label: "Page", hint: "[]()" },
  { key: "quote", label: "Quote", hint: ">", insert: "> " },
  { key: "code", label: "Code block", hint: "```", insert: "```\n\n```", caret: 4 },
  {
    key: "table",
    label: "Table",
    hint: "|",
    insert: "| Column | Column |\n| --- | --- |\n|  |  |",
    caret: 2,
  },
  { key: "rule", label: "Divider", hint: "---", insert: "---\n" },
  { key: "h4", label: "Heading 4", hint: "####", insert: "#### " },
  // Notion's callout, written as the one thing Markdown already has for an
  // aside. It reads as a quote everywhere else, which is the point: nothing
  // here invents a syntax that only this editor can open.
  { key: "callout", label: "Callout", hint: "> 💡", insert: "> 💡 " },
  { key: "equation", label: "Equation", hint: "$$", insert: "$$\n\n$$", caret: 3 },
  { key: "mermaid", label: "Diagram", hint: "mermaid", insert: "```mermaid\n\n```", caret: 11 },
  // The caret lands between the brackets of the address, which is the only
  // part anyone types: `![](…)`.
  { key: "image", label: "Image", hint: "![]", insert: "![](  )", caret: 4 },
];

/**
 * Put a mark around what is selected, or take it off again.
 *
 * ⌘B on bold text un-bolds it — a formatting key that only ever adds is a key
 * you can press once. The marks are Markdown's own, because Markdown is what
 * is stored: `**` is bold in the file as well as on the screen.
 */
export function wrap(mark: string): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const { from, to } = range;
        const before = view.state.sliceDoc(Math.max(0, from - mark.length), from);
        const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + mark.length));
        if (before === mark && after === mark) {
          return {
            changes: [
              { from: from - mark.length, to: from },
              { from: to, to: to + mark.length },
            ],
            range: EditorSelection.range(from - mark.length, to - mark.length),
          };
        }
        return {
          changes: [
            { from, insert: mark },
            { from: to, insert: mark },
          ],
          range: EditorSelection.range(from + mark.length, to + mark.length),
        };
      }),
    );
    view.focus();
    return true;
  };
}

/** Whether a piece of text is an address rather than words. */
const isUrl = (text: string) => /^(https?:\/\/|www\.)\S+$/i.test(text.trim());

/**
 * ⌘K: make what is selected a link, and put the caret where the missing half
 * goes.
 *
 * Selected an address, and the words are missing; selected words, and the
 * address is. Either way the caret lands in the empty half, so the next thing
 * typed is the thing that was not there.
 */
export const link: Command = (view) => {
  const { from, to } = view.state.selection.main;
  const chosen = view.state.sliceDoc(from, to);
  const [text, url] = isUrl(chosen) ? ["", chosen.trim()] : [chosen, ""];
  const made = `[${text}](${url})`;
  const caret = from + (url ? 1 : text.length + 3);
  view.dispatch({ changes: { from, to, insert: made }, selection: { anchor: caret } });
  view.focus();
  return true;
};

/**
 * Tab and ⇧Tab, on a list item.
 *
 * The first thing anyone who has written in Notion reaches for, and the one
 * key CodeMirror spends on focus by default. It moves the item and everything
 * nested under it, so indenting a parent does not orphan its children — two
 * spaces, which is what the Markdown parser reads back as a level.
 */
function shift(by: 1 | -1): Command {
  return (view) => {
    const { state } = view;
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.to).number;
      for (let at = first; at <= last; at += 1) lines.add(at);
    }
    // Only lists take Tab. In a paragraph it still belongs to the browser, so
    // the keyboard can leave the editor.
    if (![...lines].some((at) => ITEM.test(state.doc.line(at).text))) return false;

    // Whatever is nested under the last selected item travels with it: a
    // sub-list left behind becomes a list of its own at the old depth.
    const last = Math.max(...lines);
    const depth = (at: number) => /^\s*/.exec(state.doc.line(at).text)?.[0].length ?? 0;
    for (let at = last + 1; at <= state.doc.lines; at += 1) {
      const text = state.doc.line(at).text;
      if (!text.trim()) break;
      if (depth(at) <= depth(last)) break;
      lines.add(at);
    }

    const changes = [];
    for (const at of [...lines].toSorted((a, b) => a - b)) {
      const line = state.doc.line(at);
      if (by === 1) {
        changes.push({ from: line.from, insert: "  " });
      } else {
        const room = /^ {1,2}/.exec(line.text)?.[0];
        if (room) changes.push({ from: line.from, to: line.from + room.length });
      }
    }
    if (changes.length === 0) return true;
    view.dispatch(state.update({ changes, userEvent: "input.indent" }));
    return true;
  };
}

/**
 * Tab inside a table: the next cell, and a new row past the last one.
 *
 * A pipe table is text, so nothing stops the caret walking into the middle of
 * a border. This moves it cell to cell the way every table in every editor
 * does, and adds the row when you tab off the end — the alternative being to
 * type six pipes by hand.
 */
const tableTab: Command = (view) => {
  const { state } = view;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  if (!/^\s*\|/.test(line.text)) return false;

  const stops = [...line.text.matchAll(/\|/g)].map((m) => line.from + (m.index ?? 0));
  const next = stops.find((at) => at >= head);
  if (next !== undefined && next !== stops.at(-1)) {
    // Just past the pipe, and past the space that follows it.
    const after = state.doc.sliceString(next + 1, next + 2) === " " ? next + 2 : next + 1;
    view.dispatch({ selection: { anchor: after } });
    return true;
  }

  // Off the end of the last cell: the next row, made if it is not there.
  const below = line.number < state.doc.lines ? state.doc.line(line.number + 1) : undefined;
  if (below && /^\s*\|/.test(below.text)) {
    const first = below.text.indexOf("|");
    view.dispatch({ selection: { anchor: below.from + first + (below.text[first + 1] === " " ? 2 : 1) } });
    return true;
  }
  const cells = Math.max(1, (line.text.match(/\|/g)?.length ?? 2) - 1);
  const row = `\n|${Array.from({ length: cells }, () => "  ").join("|")}|`;
  view.dispatch({
    changes: { from: line.to, insert: row },
    selection: { anchor: line.to + 3 },
  });
  return true;
};

/**
 * Turn this block into that one.
 *
 * The same list Notion opens on ⌘⌥1-7 and in its block menu, done the only way
 * that keeps the file honest: rewrite the line's first characters. A heading
 * becomes a quote by losing `## ` and gaining `> `, and nothing else about the
 * line moves.
 */
export const TURNS: { key: string; label: string; mark: string; shortcut?: string }[] = [
  { key: "text", label: "Text", mark: "", shortcut: "Mod-Alt-0" },
  { key: "h1", label: "Heading 1", mark: "# ", shortcut: "Mod-Alt-1" },
  { key: "h2", label: "Heading 2", mark: "## ", shortcut: "Mod-Alt-2" },
  { key: "h3", label: "Heading 3", mark: "### ", shortcut: "Mod-Alt-3" },
  { key: "list", label: "Bulleted list", mark: "- ", shortcut: "Mod-Alt-4" },
  { key: "numbers", label: "Numbered list", mark: "1. ", shortcut: "Mod-Alt-5" },
  { key: "task", label: "To-do", mark: "- [ ] ", shortcut: "Mod-Alt-6" },
  { key: "quote", label: "Quote", mark: "> ", shortcut: "Mod-Alt-7" },
];

/** Everything a line can begin with, so turning one into another can undo it. */
const ANY_MARK = /^(\s*)(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|#{1,6}\s+|>\s+)?/;

export function turn(mark: string): Command {
  return (view) => {
    const { state } = view;
    const changes = [];
    const seen = new Set<number>();
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.to).number;
      for (let at = first; at <= last; at += 1) {
        if (seen.has(at)) continue;
        seen.add(at);
        const line = state.doc.line(at);
        const had = ANY_MARK.exec(line.text)?.[0] ?? "";
        const keep = /^\s*/.exec(line.text)?.[0] ?? "";
        changes.push({ from: line.from, to: line.from + had.length, insert: keep + mark });
      }
    }
    if (changes.length === 0) return false;
    view.dispatch(state.update({ changes, userEvent: "input.turn" }));
    view.focus();
    return true;
  };
}

/**
 * An address pasted over a passage makes that passage a link.
 *
 * The one paste everybody has muscle memory for, from every editor that has
 * it. Any other paste is left to the editor.
 */
const pasteAsLink = EditorView.domEventHandlers({
  paste(event, view) {
    const pasted = event.clipboardData?.getData("text/plain") ?? "";
    const { from, to } = view.state.selection.main;
    if (!isUrl(pasted) || from === to) return false;
    const chosen = view.state.sliceDoc(from, to);
    if (isUrl(chosen)) return false;
    event.preventDefault();
    view.dispatch({
      changes: { from, to, insert: `[${chosen}](${pasted.trim()})` },
      selection: { anchor: from + chosen.length + pasted.trim().length + 4 },
    });
    return true;
  },
});

/**
 * Copied from a page, pasted as Markdown.
 *
 * Everything anyone pastes into a document comes from somewhere that had
 * formatting — a Notion page, a wiki, an article — and the clipboard carries
 * it as HTML alongside the flat text. Taking the flat text threw away every
 * heading, list and link on the way in, so the first minute with a pasted
 * document was spent putting the structure back by hand.
 */
const pasteAsMarkdown = EditorView.domEventHandlers({
  paste(event, view) {
    const html = event.clipboardData?.getData("text/html") ?? "";
    if (!html.trim()) return false;
    const { from, to } = view.state.selection.main;
    const plain = event.clipboardData?.getData("text/plain") ?? "";
    // An address over a passage is the other paste, and it goes first.
    if (isUrl(plain) && from !== to) return false;
    const made = htmlToMarkdown(html);
    if (!made || made === plain.trim()) return false;
    event.preventDefault();
    view.dispatch({ changes: { from, to, insert: made }, selection: { anchor: from + made.length } });
    return true;
  },
});

/**
 * `:smile:` becomes a face.
 *
 * Typed the same way it is typed in every chat window; what lands in the file
 * is the character itself, so the document stays plain text and a reader that
 * has never heard of this editor still sees the emoji.
 */
function emoji(context: CompletionContext) {
  const typed = context.matchBefore(/:[a-z0-9_+-]{2,}/);
  if (!typed) return null;
  const query = typed.text.slice(1).toLowerCase();
  const found = EMOJI.filter(([name]) => name.includes(query)).slice(0, 12);
  if (found.length === 0) return null;
  return {
    from: typed.from,
    options: found.map(([name, char]) => ({ label: `:${name}:`, detail: char, apply: char, type: "text" })),
  };
}

/** A written link, and where in the text its two halves are. */
function linkAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  for (const match of line.text.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)|(?<!\()(https?:\/\/\S+)/g)) {
    const from = line.from + (match.index ?? 0);
    const to = from + match[0].length;
    if (pos < from || pos > to) continue;
    return { from, to, text: match[1] ?? "", url: match[2] ?? match[3] ?? "", written: Boolean(match[2]) };
  }
  return undefined;
}

/**
 * What a link is, and what can be done to it, without opening the line.
 *
 * ⌘-click already followed one, but changing an address meant putting the
 * caret in the line to make the markup appear and editing inside brackets.
 * The three things anyone wants from a link are here instead: go to it,
 * change it, take it off and keep the words.
 */
const linkCard = hoverTooltip((made, pos) => {
  const found = linkAt(made, pos);
  if (!found) return null;
  // A link drawn as a page block has its own press; the card would only
  // show the address the block exists to hide. The caret's line shows raw
  // markup, and there the card earns its place again.
  const row = made.state.doc.lineAt(found.from);
  if (pageLinkOf(row.text) && !open(made).has(row.number)) return null;
  return {
    pos: found.from,
    end: found.to,
    above: true,
    create: () => {
      const card = document.createElement("div");
      card.className =
        "logue-float flex max-w-80 items-center gap-1 p-1 text-[12px] text-ink-soft";
      const address = document.createElement("a");
      address.href = found.url;
      address.target = "_blank";
      address.rel = "noreferrer";
      address.textContent = found.url;
      address.className = "min-w-0 flex-1 truncate px-1 text-accent hover:underline";
      card.append(address);
      const act = (label: string, run: () => void) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = "shrink-0 rounded-[5px] px-1.5 py-0.5 hover:bg-hover hover:text-ink";
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          run();
        });
        card.append(button);
      };
      act("Edit", () => {
        // Inside the address, where the change is made. The markup is there
        // because the caret is — the editor's one rule.
        const into = found.written ? found.from + found.text.length + 3 : found.from;
        made.dispatch({ selection: { anchor: into, head: into + found.url.length } });
        made.focus();
      });
      if (found.written) {
        act("Unlink", () => {
          made.dispatch({ changes: { from: found.from, to: found.to, insert: found.text } });
          made.focus();
        });
      }
      return { dom: card };
    },
  };
}, { hoverTime: 400 });

/** The hint on the empty line the caret is in — Notion's, and it is true here. */
class Hint extends WidgetType {
  toDOM(): HTMLElement {
    const said = document.createElement("span");
    said.className = "cm-hint";
    said.textContent = "Type / for commands";
    return said;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * The block menu, offered where it can be used.
 *
 * The whole-document placeholder says what to do on an empty page and then is
 * never seen again, so the one habit this editor borrowed from Notion was
 * findable only by someone who already knew it.
 */
const hint = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.read(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.focusChanged) this.decorations = this.read(update.view);
    }
    read(view: EditorView): DecorationSet {
      const cursor = view.state.selection.main;
      if (!view.hasFocus || !cursor.empty || view.state.doc.length === 0) return Decoration.none;
      const line = view.state.doc.lineAt(cursor.head);
      if (line.text.trim()) return Decoration.none;
      return Decoration.set([Decoration.widget({ widget: new Hint(), side: 1 }).range(line.from)]);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * A box in the window, which a floating thing hangs off.
 *
 * The caret is not an element, and `usePlacement` measures elements — so the
 * coordinates CodeMirror reports are given to a zero-width span and that is
 * what gets measured. Viewport coordinates, because everything that floats in
 * this product is `fixed`: an editor inside a scrolling pane clipped its own
 * menu when these were relative.
 */
interface Spot {
  left: number;
  top: number;
  bottom: number;
}

/** Where the slash menu sits, and what it is filtering on. */
interface Slash {
  /** Where the `/` is, so the menu can replace it with the block. */
  at: number;
  query: string;
  spot: Spot;
}

export function MarkdownEditor({
  value,
  onChange,
  onSelection,
  handle,
  onCite,
  onRewrite,
  onSave,
  autoFocus,
  onSubpage,
  onOpenPage,
  pageTitle,
  label = "Document",
}: {
  /** The text as it stands on the Host. Sent in again only when it really changed. */
  value: string;
  onChange: (text: string) => void;
  /** Whether there is a passage to act on, so Rewrite can say it is unavailable. */
  onSelection?: (has: boolean) => void;
  handle?: RefObject<MarkdownHandle | null>;
  /** A citation was pressed. `n` is the number as written in the text. */
  onCite?: (n: number) => void;
  /** Rewrite this passage — the toolbar's one act that is not formatting. */
  onRewrite?: (passage: string) => void;
  /** ⌘S: save the working copy as a version. The browser's own save is eaten either way. */
  onSave?: () => void;
  /** Put the caret in the page on arrival — a page just made is typed into. */
  autoFocus?: boolean;
  /** `/page`: make a child of this document and answer with it. */
  onSubpage?: () => Promise<{ id: string; title: string } | undefined>;
  /** A drawn page link was pressed, or `/page` finished making one. */
  onOpenPage?: (id: string) => void;
  /** What a page is called right now, for the block that draws it. */
  pageTitle?: (id: string) => string | undefined;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  /** The toolbar over a selected passage, when something is selected. */
  const [bar, setBar] = useState<Spot>();
  /** The slash menu, when there is one. */
  const [slash, setSlash] = useState<Slash>();
  const [at, setAt] = useState(0);
  /**
   * The menu, as the keymap sees it.
   *
   * The editor is built once; the menu is state. A keymap closed over the
   * first render would answer for a menu that had long since changed.
   */
  /**
   * Both popovers are placed by the same hook as every other floating thing.
   *
   * They were `absolute` with hand-arithmetic — the menu ran off the bottom of
   * the window on a long document, and the toolbar's `top - 38` went negative
   * and clipped whenever the passage was in the first two lines. That is the
   * third and fourth place the bug X4 fixed had been written out by hand.
   */
  // The ＋/⠿ rail that used to follow the pointer down the margin is gone —
  // 2026-08-19, his word: "we dont need the hover btns for add and drag".
  // Blocks are added with `/` and moved the way text moves.
  const slashAnchor = useRef<HTMLSpanElement>(null);
  const slashPanel = useRef<HTMLDivElement>(null);
  const barAnchor = useRef<HTMLSpanElement>(null);
  const barPanel = useRef<HTMLDivElement>(null);
  const slashOpen = useRef(false);
  /** One `/page` round trip at a time. */
  const makingPage = useRef(false);
  /** How many rows the menu is showing, so ArrowDown knows where the end is. */
  const shownCount = useRef(0);
  const chosen = useRef<() => void>(undefined);
  // The names the subpage blocks draw live outside the text. When the caller
  // hands a new lookup — the workspace list moved — the decorations are asked
  // to draw again, or a rename shows only after the next keystroke.
  useEffect(() => {
    view.current?.dispatch({ annotations: refreshMarks.of(true) });
  }, [pageTitle]);

  // Read inside CodeMirror's own callbacks, which outlive the render that made them.
  const latest = useRef({ onChange, onSelection, onCite, onRewrite, onSave, onSubpage, onOpenPage, pageTitle });
  latest.current = { onChange, onSelection, onCite, onRewrite, onSave, onSubpage, onOpenPage, pageTitle };

  /**
   * Watch for `/` at the start of an empty line, and for what is typed after it.
   *
   * Read from the document rather than from keystrokes, so it survives paste,
   * undo and the caret being moved by anything at all.
   */
  const readSlash = (made: EditorView) => {
    const cursor = made.state.selection.main;
    if (!cursor.empty) return setSlash(undefined);
    const line = made.state.doc.lineAt(cursor.head);
    const before = made.state.doc.sliceString(line.from, cursor.head);
    // A `/` anywhere a word could start, not only on an empty line. Notion
    // opens it mid-sentence and so does everything that copied Notion; the
    // old rule meant reaching for a table halfway down a paragraph was a
    // thing you had to know was impossible. Preceded by a space or nothing,
    // so a date and a path never open a menu.
    const opened = /(?:^|\s)\/(\w*)$/.exec(before);
    if (!opened) return setSlash(undefined);
    const start = cursor.head - (opened[1]?.length ?? 0) - 1;
    const box = made.coordsAtPos(start);
    if (!box) return setSlash(undefined);
    setAt(0);
    return setSlash({
      at: start,
      query: opened[1] ?? "",
      spot: { left: box.left, top: box.top, bottom: box.bottom },
    });
  };

  /**
   * Where the toolbar over a selection goes, when there is one.
   *
   * Above the passage and starting at it, which is where every editor with one
   * puts it. It is hidden while the block menu is open — two popovers arguing
   * over one caret is not a thing to solve, it is a thing to not do.
   */
  const readBar = (made: EditorView) => {
    const passage = made.state.selection.main;
    if (passage.empty || !made.hasFocus) return setBar(undefined);
    const box = made.coordsAtPos(passage.from);
    if (!box) return setBar(undefined);
    return setBar({ left: box.left, top: box.top, bottom: box.bottom });
  };

  /** Write the block, replacing the `/…` that asked for it. */
  const put = (block: (typeof BLOCKS)[number]) => {
    const made = view.current;
    if (!made || !slash) return;
    if (block.key === "page") {
      // The page has to exist before there is anything to link to, so the
      // link is written after its round trip. One at a time: a double press
      // must not mint two pages.
      if (makingPage.current) return;
      makingPage.current = true;
      const asked = slash.at;
      const typed = made.state.doc.sliceString(asked, made.state.selection.main.head) || "/";
      setSlash(undefined);
      void (async () => {
        try {
          const created = await latest.current.onSubpage?.();
          const now = view.current;
          if (!created || !now) return;
          // The document may have moved under the round trip. Replace the
          // exact `/…` that asked, wherever it sits now — never a window of
          // stale offsets that could have drifted onto a sentence.
          const whole = now.state.doc.toString();
          let from = whole.startsWith(typed, asked) ? asked : whole.indexOf(typed);
          let to = from >= 0 ? from + typed.length : -1;
          if (from < 0) {
            // The ask was edited away meanwhile; the page exists, so the
            // link lands at the caret rather than nowhere.
            from = to = now.state.selection.main.head;
          }
          const line = now.state.doc.lineAt(from);
          const ahead = now.state.doc.sliceString(line.from, from).trim() ? "\n" : "";
          const insert = `${ahead}[${created.title}](/documents/${created.id})\n`;
          now.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
          latest.current.onOpenPage?.(created.id);
        } finally {
          makingPage.current = false;
        }
      })();
      made.focus();
      return;
    }
    const to = made.state.selection.main.head;
    // A block starts its own line. The menu opens mid-sentence now, and a
    // table dropped where the caret was made `- one | Column | Column |` —
    // one line that is half a list item and half a table, and neither.
    const line = made.state.doc.lineAt(slash.at);
    const ahead = made.state.doc.sliceString(line.from, slash.at).trim() ? "\n" : "";
    const body = block.insert ?? "";
    const insert = ahead + body;
    made.dispatch({
      changes: { from: slash.at, to, insert },
      selection: { anchor: slash.at + ahead.length + (block.caret ?? body.length) },
    });
    setSlash(undefined);
    made.focus();
  };

  const shown = slash
    ? BLOCKS.filter(
        (one) =>
          // Page needs a document to be the child of; a draft is not one
          // yet, and a menu item that silently does nothing is worse than
          // its absence.
          (one.key !== "page" || Boolean(latest.current.onSubpage)) &&
          (!slash.query || one.label.toLowerCase().includes(slash.query.toLowerCase())),
      )
    : [];

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      history(),
      // The menu owns these while it is open, and nothing else changes.
      keymap.of([
        {
          key: "ArrowDown",
          run: () => {
            if (!slashOpen.current) return false;
            // Stops at the last one. It used to count past the end and get
            // clamped only when drawing, so ten presses down took ten presses
            // back up before the highlight moved at all.
            setAt((was) => Math.min(shownCount.current - 1, was + 1));
            return true;
          },
        },
        {
          key: "ArrowUp",
          run: () => {
            if (!slashOpen.current) return false;
            setAt((was) => Math.max(0, was - 1));
            return true;
          },
        },
        {
          key: "Enter",
          run: () => {
            if (!slashOpen.current) return false;
            chosen.current?.();
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (!slashOpen.current) return false;
            setSlash(undefined);
            return true;
          },
        },
      ]),
      // The formatting keys every editor has. They write Markdown, because
      // Markdown is what is stored — ⌘B puts `**` around the words.
      keymap.of([
        { key: "Mod-b", run: wrap("**") },
        { key: "Mod-i", run: wrap("*") },
        { key: "Mod-e", run: wrap("`") },
        { key: "Mod-Shift-x", run: wrap("~~") },
        { key: "Mod-k", run: link },
      ]),
      // ⌘S saves the working copy as a version. Claimed even with no handler,
      // so the browser's own save dialog never answers a writing surface.
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            latest.current.onSave?.();
            return true;
          },
        },
      ]),
      // Tab belongs to a list before it belongs to focus, and to a table
      // before either. Both hand it back when the caret is in neither.
      keymap.of([
        { key: "Tab", run: (made) => tableTab(made) || shift(1)(made) },
        { key: "Shift-Tab", run: shift(-1) },
      ]),
      keymap.of(TURNS.filter((one) => one.shortcut).map((one) => ({ key: one.shortcut!, run: turn(one.mark) }))),
      // Markdown's own keys, ahead of the defaults.
      //
      // These were spread into the same array as `defaultKeymap`, after it —
      // so `defaultKeymap`'s plain Enter answered first and `Enter` at the end
      // of `- one` made an empty line instead of `- `. The whole of Markdown's
      // list, quote and table continuation was unreachable code, and so was
      // its Backspace, which takes a list marker off in one press. A keymap
      // that is shadowed does not fail; it does nothing, which is why this
      // survived review twice.
      keymap.of(markdownKeymap),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      // Find and replace, ⌘F. The panel is CodeMirror's own — a document
      // people write in for an hour needs one, and writing a second one would
      // only be a worse version of this.
      autocompletion({ override: [emoji], icons: false, activateOnTyping: true }),
      keymap.of(completionKeymap),
      search({ top: true }),
      highlightSelectionMatches(),
      // More than one caret: ⌘D takes the next occurrence of what is selected,
      // ⌥-click adds one, ⌥-drag selects a rectangle. The same three moves
      // every editor has, and the reason renaming a word six times in a
      // document is one edit rather than six.
      EditorState.allowMultipleSelections.of(true),
      drawSelection(),
      rectangularSelection(),
      crosshairCursor(),
      // Where dragged text would land. Without it, dropping a paragraph is a
      // guess.
      dropCursor(),
      // GitHub's Markdown, because that is the Markdown people write:
      // tables, task lists, strikethrough, bare links.
      // A fenced block is highlighted in whatever it says it is. ```ts is a
      // promise the editor was not keeping: the code sat in one flat grey.
      markdown({ base: markdownLanguage, extensions: [GFM], addKeymap: false, codeLanguages }),
      syntaxHighlighting(written),
      livePreview((n) => latest.current.onCite?.(n), {
        open: (id) => latest.current.onOpenPage?.(id),
        name: (id) => latest.current.pageTitle?.(id),
      }),
      shapes,
      page,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label }),
      placeholder("Start writing. The first line is the title."),
      hint,
      pasteAsLink,
      pasteAsMarkdown,
      linkCard,
      EditorView.updateListener.of((update) => {
        const mine = !update.transactions.some((one) => one.annotation(fromTheHost));
        if (update.docChanged && mine) latest.current.onChange(update.state.doc.toString());
        if (update.selectionSet || update.docChanged || update.focusChanged) {
          latest.current.onSelection?.(!update.state.selection.main.empty);
          readSlash(update.view);
          readBar(update.view);
        }
      }),
      // ⌘-click follows a link. A plain click is a caret: this is a document,
      // not a page, and the address stays editable.
      EditorView.domEventHandlers({
        mousedown(event, made) {
          if (!event.metaKey && !event.ctrlKey) return false;
          const pressed = made.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pressed === null) return false;
          const line = made.state.doc.lineAt(pressed);
          for (const match of line.text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)|(https?:\/\/\S+)/g)) {
            const from = line.from + (match.index ?? 0);
            if (pressed < from || pressed > from + match[0].length) continue;
            const url = match[1] ?? match[2];
            if (!url) continue;
            event.preventDefault();
            window.open(url, "_blank", "noreferrer");
            return true;
          }
          return false;
        },
      }),
    ];
    const made = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current,
    });
    view.current = made;
    return () => {
      made.destroy();
      view.current = null;
    };
    // Built once. The text arriving from the Host is applied below rather than
    // rebuilding the editor, which would take the caret and the undo history
    // with it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // A page arrived at empty is a page about to be typed into — the caret
  // goes in without a click, at the name line, the way Notion opens one.
  // Defined after the build on purpose: this editor mounts with the text
  // already loaded, so on the first run the view must already exist.
  useEffect(() => {
    if (autoFocus) view.current?.focus();
  }, [autoFocus]);

  // The document being replaced under the editor — a restore from the history,
  // another tab's version being taken. Never a keystroke's own round trip.
  useEffect(() => {
    const made = view.current;
    if (!made || made.state.doc.toString() === value) return;
    made.dispatch({
      changes: { from: 0, to: made.state.doc.length, insert: value },
      // The caret stays where the person left it, clamped to the new end.
      // A whole-document insert would otherwise carry it to the bottom of
      // the page — an automatic write must not take the caret with it.
      selection: { anchor: Math.min(made.state.selection.main.head, value.length) },
      annotations: fromTheHost.of(true),
    });
  }, [value]);

  useImperativeHandle(
    handle,
    () => ({
      replace: (passage: string, next: string) => {
        const made = view.current;
        if (!made) return;
        // Not annotated: applying a rewrite is an edit, and it is saved and
        // kept in the history like one.
        made.dispatch({ changes: spliced(made.state.doc.toString(), passage, next) });
      },
      selection: () => {
        const made = view.current;
        if (!made) return "";
        const { from, to } = made.state.selection.main;
        return made.state.sliceDoc(from, to);
      },
      goto: (offset: number) => {
        const made = view.current;
        if (!made) return;
        const target = Math.max(0, Math.min(offset, made.state.doc.length));
        made.dispatch({ selection: { anchor: target }, scrollIntoView: true });
        made.focus();
      },
    }),
    [],
  );

  const { at: slashAt } = usePlacement({
    open: Boolean(slash) && shown.length > 0,
    anchor: slashAnchor,
    panel: slashPanel,
  });
  const { at: barAt } = usePlacement({
    open: Boolean(bar) && !slash,
    anchor: barAnchor,
    panel: barPanel,
    prefer: "above",
  });

  slashOpen.current = Boolean(slash) && shown.length > 0;
  shownCount.current = shown.length;
  chosen.current = () => {
    const block = shown[Math.min(at, shown.length - 1)];
    if (block) put(block);
  };

  /** One of the toolbar's buttons, pressed. The caret never leaves the text. */
  const run = (command: Command) => (event: React.MouseEvent) => {
    event.preventDefault();
    const made = view.current;
    if (made) command(made);
  };

  return (
    <div className="relative">
      <div ref={host} className="min-h-72" />
      {/* What can be done to a passage, where the passage is. It used to be one
          button in the page header, disabled whenever nothing was selected and
          explaining its own disabled-ness in a tooltip — an action parked
          where the thing it acts on never is. */}
      {bar && !slash && (
        <>
          <span aria-hidden ref={barAnchor} style={spotStyle(bar)} />
        <div
          ref={barPanel}
          role="toolbar"
          aria-label="Format the selected passage"
          style={floatingStyle(barAt)}
          className="logue-float z-popover flex items-center gap-0.5 p-0.5"
        >
          <Key label="Bold" keys="⌘B" onMouseDown={run(wrap("**"))}>
            <span className="font-[750]">B</span>
          </Key>
          <Key label="Italic" keys="⌘I" onMouseDown={run(wrap("*"))}>
            <span className="font-serif italic">I</span>
          </Key>
          <Key label="Code" keys="⌘E" onMouseDown={run(wrap("`"))}>
            <span className="font-mono text-[11px]">{"</>"}</span>
          </Key>
          <Key label="Link" keys="⌘K" onMouseDown={run(link)}>
            <LinkMark />
          </Key>
          {onRewrite && (
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const made = view.current;
                  if (!made) return;
                  const { from, to } = made.state.selection.main;
                  const passage = made.state.sliceDoc(from, to);
                  if (passage.trim()) latest.current.onRewrite?.(passage);
                }}
                className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11.5px] font-[560] text-ai hover:bg-hover"
              >
                <Wand /> Rewrite
              </button>
            </>
          )}
        </div>
        </>
      )}
      {slash && shown.length > 0 && (
        <>
          <span aria-hidden ref={slashAnchor} style={spotStyle(slash.spot)} />
        <div
          ref={slashPanel}
          role="listbox"
          aria-label="Insert a block"
          style={floatingStyle(slashAt)}
          className="logue-float z-popover w-56 overflow-y-auto py-1"
        >
          {shown.map((block, index) => (
            <button
              key={block.key}
              type="button"
              role="option"
              aria-selected={index === Math.min(at, shown.length - 1)}
              // The caret must not leave the editor: the menu is a menu, not
              // a place the text goes.
              onMouseDown={(event) => {
                event.preventDefault();
                put(block);
              }}
              onMouseEnter={() => setAt(index)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12.5px]",
                index === Math.min(at, shown.length - 1) ? "bg-accent-soft text-ink" : "text-ink-soft hover:bg-hover",
              )}
            >
              <span className="flex-1">{block.label}</span>
              <span className="font-mono text-[10.5px] text-muted">{block.hint}</span>
            </button>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

/** The zero-width stand-in for a caret or a selection's first character. */
function spotStyle(spot: Spot): React.CSSProperties {
  return { position: "fixed", left: spot.left, top: spot.top, width: 1, height: spot.bottom - spot.top };
}

/** One key on the passage toolbar: a letter, and the shortcut it doubles. */
function Key({
  label,
  keys,
  onMouseDown,
  children,
}: {
  label: string;
  keys: string;
  onMouseDown: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label}  ${keys}`}
      onMouseDown={onMouseDown}
      className="flex h-6 w-6 items-center justify-center rounded-[5px] text-[12.5px] text-ink-soft hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  );
}

function LinkMark() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </svg>
  );
}

function Wand() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16l-1.8-4.2L5.5 10l4.7-1.3z" />
    </svg>
  );
}
