import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { Annotation, EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, placeholder, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useImperativeHandle, useRef, type RefObject } from "react";

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

function marks(view: EditorView): DecorationSet {
  const built = new RangeSetBuilder<Decoration>();
  const editing = open(view);
  const hidden = Decoration.replace({});
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (!MARKS.has(node.name)) return;
        // A URL is only noise inside a written link; a bare one is the text.
        if (node.name === "URL" && node.node.parent?.name !== "Link") return;
        if (editing.has(view.state.doc.lineAt(node.from).number)) return;
        if (node.to > node.from) built.add(node.from, node.to, hidden);
      },
    });
  }
  return built.finish();
}

const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = marks(view);
    }

    update(update: ViewUpdate) {
      // The caret moving is the whole point: it is what puts the markup of one
      // line back and takes the last one's away. Focus counts as a move —
      // clicking in and clicking away change which lines are being edited.
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        this.decorations = marks(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

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
});

/** The two block shapes that are drawn around whole lines, not inside them. */
function blocks(view: EditorView): DecorationSet {
  const built = new RangeSetBuilder<Decoration>();
  const quote = Decoration.line({ class: "cm-quote-line" });
  const code = Decoration.line({ class: "cm-code-line" });
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "Blockquote" && node.name !== "FencedCode") return;
        const first = view.state.doc.lineAt(node.from).number;
        const last = view.state.doc.lineAt(node.to).number;
        for (let line = first; line <= last; line += 1) {
          built.add(view.state.doc.line(line).from, view.state.doc.line(line).from,
            node.name === "Blockquote" ? quote : code);
        }
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

export function MarkdownEditor({
  value,
  onChange,
  onSelection,
  handle,
  label = "Document",
}: {
  /** The text as it stands on the Host. Sent in again only when it really changed. */
  value: string;
  onChange: (text: string) => void;
  /** Whether there is a passage to act on, so Rewrite can say it is unavailable. */
  onSelection?: (has: boolean) => void;
  handle?: RefObject<MarkdownHandle | null>;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  // Read inside CodeMirror's own callbacks, which outlive the render that made them.
  const latest = useRef({ onChange, onSelection });
  latest.current = { onChange, onSelection };

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap]),
      markdown({ base: markdownLanguage, addKeymap: false }),
      syntaxHighlighting(written),
      livePreview,
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
        }
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

  return <div ref={host} className="min-h-72" />;
}
