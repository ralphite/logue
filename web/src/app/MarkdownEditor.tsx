import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { Annotation, EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cn } from "@logue/ui";
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
}

/**
 * The marks that are hidden away from the caret.
 *
 * `ListMark` is deliberately not here: a bullet is how a list looks, and
 * hiding it leaves an indented line with nothing to say it is an item.
 */
const MARKS = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "QuoteMark", "LinkMark", "URL"]);

/** `[Source 3]`, as it is written in every document a generation produced. */
const CITATION = /\[Source (\d+)\]/g;

/**
 * A citation, drawn the way it is drawn everywhere else in the product.
 *
 * The literal `[Source 3]` was not only ugly: at 44rem it wrapped, and a
 * citation split across two lines is two pieces of punctuation rather than
 * one chip you can follow. Same pill as `Citation` in the answer, built by
 * hand because CodeMirror widgets are DOM, not React.
 */
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
        if (!MARKS.has(node.name)) return undefined;
        // A URL is only noise inside a written link; a bare one is the text.
        if (node.name === "URL" && node.node.parent?.name !== "Link") return undefined;
        if (editing.has(view.state.doc.lineAt(node.from).number)) return undefined;
        if (node.to > node.from) found.push({ from: node.from, to: node.to, with: hidden });
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

function livePreview(cite?: (n: number) => void) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(readonly view: EditorView) {
        this.decorations = marks(view, cite, this.toggle);
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
        if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
          this.decorations = marks(update.view, cite, this.toggle);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** Everything the type system already decides, said in the type system's terms. */
const written = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.5em", fontWeight: "650", lineHeight: "1.3" },
  { tag: tags.heading2, fontSize: "1.2em", fontWeight: "650", lineHeight: "1.35" },
  { tag: tags.heading3, fontSize: "1.05em", fontWeight: "650" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "650" },
  { tag: tags.strong, fontWeight: "650", color: "var(--color-ink)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-muted)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em", color: "var(--color-ink-soft)" },
  { tag: tags.quote, color: "var(--color-ink-soft)" },
  { tag: tags.link, color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "2px" },
  { tag: tags.url, color: "var(--color-muted)" },
  { tag: [tags.processingInstruction, tags.punctuation, tags.meta], color: "var(--color-faint)" },
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
});

/** The block shapes that are drawn around whole lines, not inside them. */
function blocks(view: EditorView): DecorationSet {
  const built = new RangeSetBuilder<Decoration>();
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
          built.add(view.state.doc.line(at).from, view.state.doc.line(at).from, line);
        }
        return undefined;
      },
    });
  }
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
const BLOCKS: { key: string; label: string; hint: string; insert: string; caret?: number }[] = [
  { key: "h1", label: "Heading 1", hint: "#", insert: "# " },
  { key: "h2", label: "Heading 2", hint: "##", insert: "## " },
  { key: "h3", label: "Heading 3", hint: "###", insert: "### " },
  { key: "list", label: "Bulleted list", hint: "-", insert: "- " },
  { key: "numbers", label: "Numbered list", hint: "1.", insert: "1. " },
  { key: "task", label: "To-do", hint: "[ ]", insert: "- [ ] " },
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
];

/** Where the slash menu sits, and what it is filtering on. */
interface Slash {
  /** Where the `/` is, so the menu can replace it with the block. */
  at: number;
  query: string;
  left: number;
  top: number;
}

export function MarkdownEditor({
  value,
  onChange,
  onSelection,
  handle,
  onCite,
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
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  /** The slash menu, when there is one. */
  const [slash, setSlash] = useState<Slash>();
  const [at, setAt] = useState(0);
  /**
   * The menu, as the keymap sees it.
   *
   * The editor is built once; the menu is state. A keymap closed over the
   * first render would answer for a menu that had long since changed.
   */
  const slashOpen = useRef(false);
  const chosen = useRef<() => void>(undefined);
  // Read inside CodeMirror's own callbacks, which outlive the render that made them.
  const latest = useRef({ onChange, onSelection, onCite });
  latest.current = { onChange, onSelection, onCite };

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
    const opened = /^\/(\w*)$/.exec(before);
    if (!opened) return setSlash(undefined);
    const box = made.coordsAtPos(line.from);
    const frame = made.dom.getBoundingClientRect();
    if (!box) return setSlash(undefined);
    setAt(0);
    return setSlash({
      at: line.from,
      query: opened[1] ?? "",
      left: box.left - frame.left,
      top: box.bottom - frame.top + 4,
    });
  };

  /** Write the block, replacing the `/…` that asked for it. */
  const put = (block: (typeof BLOCKS)[number]) => {
    const made = view.current;
    if (!made || !slash) return;
    const to = made.state.selection.main.head;
    made.dispatch({
      changes: { from: slash.at, to, insert: block.insert },
      selection: { anchor: slash.at + (block.caret ?? block.insert.length) },
    });
    setSlash(undefined);
    made.focus();
  };

  const shown = slash
    ? BLOCKS.filter((one) => !slash.query || one.label.toLowerCase().includes(slash.query.toLowerCase()))
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
            setAt((was) => was + 1);
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
      keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap]),
      // GitHub's Markdown, because that is the Markdown people write:
      // tables, task lists, strikethrough, bare links.
      markdown({ base: markdownLanguage, extensions: [GFM], addKeymap: false }),
      syntaxHighlighting(written),
      livePreview((n) => latest.current.onCite?.(n)),
      shapes,
      page,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label }),
      placeholder("Start writing. The first line is the title."),
      EditorView.updateListener.of((update) => {
        const mine = !update.transactions.some((one) => one.annotation(fromTheHost));
        if (update.docChanged && mine) latest.current.onChange(update.state.doc.toString());
        if (update.selectionSet || update.docChanged) {
          latest.current.onSelection?.(!update.state.selection.main.empty);
          readSlash(update.view);
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

  // The document being replaced under the editor — a restore from the history,
  // another tab's version being taken. Never a keystroke's own round trip.
  useEffect(() => {
    const made = view.current;
    if (!made || made.state.doc.toString() === value) return;
    made.dispatch({
      changes: { from: 0, to: made.state.doc.length, insert: value },
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
    }),
    [],
  );

  slashOpen.current = Boolean(slash) && shown.length > 0;
  chosen.current = () => {
    const block = shown[Math.min(at, shown.length - 1)];
    if (block) put(block);
  };

  return (
    <div className="relative">
      <div ref={host} className="min-h-72" />
      {slash && shown.length > 0 && (
        <div
          role="listbox"
          aria-label="Insert a block"
          style={{ left: slash.left, top: slash.top }}
          className="logue-float absolute z-popover w-56 overflow-hidden py-1"
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
      )}
    </div>
  );
}
