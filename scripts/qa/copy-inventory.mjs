#!/usr/bin/env node
/**
 * Every word the product says, as one checked-in list.
 *
 * The defects that reached the owner were not logic — they were sentences
 * nobody read back: a filing receipt that argued its case, a status line
 * written in chat register, a history row saying nothing happened. Each was
 * typed once, in a file about something else, and never seen again.
 *
 * So the strings become a *list*, and the list is committed. A change to any
 * word on screen shows up in the diff of `docs/spec/copy.md`, where it can be
 * read against the standard rather than found by the owner.
 *
 *   node scripts/qa/copy-inventory.mjs          # write docs/spec/copy.md
 *   node scripts/qa/copy-inventory.mjs --check  # fail if it is out of date
 *
 * Deliberately dumb about extraction: it over-collects rather than guesses,
 * because a string it skips is exactly the one that goes unread.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const OUT = join(ROOT, "docs/spec/copy.md");

/** Where the product speaks. Tests, stories and QA scripts are not the product.
 *  `integrations` is: what `logue.py` prints is read by an agent and repeated
 *  to the person, and the versions review found its strings invisible here. */
const ROOTS = ["web/src", "extension/src", "packages/ui/src", "server/logue_host", "integrations/claude-code"];
const SKIP = /(\.test\.|\.stories\.|storybook-static|node_modules|__pycache__|\/dist\/)/;

/**
 * A string is copy if it reads like something a person could be shown.
 *
 * Widened on 2026-08-14, after the copy review found that most of the new
 * panel's words were invisible to this gate — which is the gate's whole job:
 *
 *  * **One-word labels.** `Send`, `Talk`, `Copy`, `Delete` were dropped by a
 *    lowercase-word rule meant for class names and ids. They are the most-read
 *    words in the product.
 *  * **Anything with brackets.** `Discard (Esc)` was dropped by a rule meant
 *    to catch code. A shortcut in a label is not code.
 *
 * And on 2026-08-19, after the versions review found the two sentences that
 * hold a semicolon — `Your words were kept; nothing was overwritten.` — were
 * invisible to it: a `;` followed by a space is prose, not a statement. The
 * same review found icon-labelled controls (`<X /> Discard`) and in-progress
 * words (`Summarizing…`) invisible; both are widened below.
 *
 * Known hole, left honestly: a Python string carrying an escape (`"…\n"`) or
 * split across concatenated lines never matches — reading those needs a real
 * parser, not a wider net. logue.py's multi-line reports are in that hole;
 * they are declared verbatim in docs/spec/features/document-versions.md.
 */
function looksLikeCopy(text) {
  if (text.length < 2 || text.length > 400) return false;
  if (!/[a-z]{2}/i.test(text)) return false;
  // Machinery: class lists, ids, urls, keys, formats, imports.
  if (/^[a-z][a-z0-9]*([-_][a-z0-9]+)+$/i.test(text)) return false;
  if (/[<>{}$#]|\.\.\/|https?:|^\/|^[a-z-]+:[a-z-]+$/.test(text)) return false;
  if (/(^|\s)(flex|grid|rounded|border|text-|bg-|px-|py-|min-w|max-w|shrink|gap-)/.test(text)) return false;
  if (/^[A-Z_]+$/.test(text)) return false;
  // Code caught in a string: signatures, operators, keyword soup. A sentence
  // shown to a person has none of these — but `(Esc)` and `+1 −1` are words.
  if (/[[\]=|&]|;(?!\s)|=>|\bconst\b|\bfunction\b|\breturn\b|\bawait\b/.test(text)) return false;
  if (/\(\s*\)|\(.*[.=:].*\)/.test(text)) return false;
  // A fragment, not a sentence: begins or ends on punctuation that only makes
  // sense glued to something else.
  if (/^[\s,.:;+*/-]|[,:;+*/\\-]\s*$/.test(text)) return false;
  // A phrase, or a word standing as a label. A label is capitalised or is one
  // of the few lowercase ones the product deliberately uses.
  // A trailing ellipsis is how a state in progress is written — `Summarizing…`,
  // `Autosaving…` — not a different shape of word.
  return (
    /\s/.test(text) || /^[A-Z][a-z]+…?$/.test(text) || /^(esc|kept|current|sources?|pages?|now|agent|review)$/.test(text)
  );
}

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (SKIP.test(path)) continue;
    if (statSync(path).isDirectory()) walk(path, found);
    else if (/\.(tsx?|py)$/.test(path)) found.push(path);
  }
  return found;
}

/** Strings a person could see, with the line they live on. */
function stringsIn(source, path) {
  const found = [];
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    // Comments are not shown to anyone. Block comments too: a quoted example
    // inside `/* … */` or `{/* … */}` reads exactly like a label in this list
    // — the review that caught it was handed `Accurate tr…` as if it were on
    // screen. Only whole comment lines are dropped; code before `/*` stays.
    const code = line.replace(/^\s*(\/\/|#|\*|\{?\/\*).*$/, "");
    for (const match of code.matchAll(/"([^"\\]{3,400})"|'([^'\\]{3,400})'|`([^`\\$]{3,400})`/g)) {
      const text = match[1] ?? match[2] ?? match[3];
      if (looksLikeCopy(text)) found.push({ at: index + 1, text });
    }
    // JSX text between tags: >Some words<
    for (const match of code.matchAll(/>([^<>{}\n]{2,200})</g)) {
      const text = match[1].trim();
      if (text && looksLikeCopy(text)) found.push({ at: index + 1, text });
    }
    // Text sharing its line with an element on one side only — `<X /> Discard`,
    // `<Spinner /> Reading`, `Go back to this` before a closing tag on the next
    // line. This is how every icon-labelled control is written, and the 2026-08-19
    // review found all of them invisible here.
    for (const match of code.matchAll(/[>}]\s*([^<>{}\n]{2,200}?)\s*$/g)) {
      const text = match[1].trim();
      if (text && looksLikeCopy(text)) found.push({ at: index + 1, text });
    }
    for (const match of code.matchAll(/^\s*([^<>{}\n]{2,200}?)\s*(?=<\/)/g)) {
      const text = match[1].trim();
      if (text && looksLikeCopy(text)) found.push({ at: index + 1, text });
    }
    // JSX text that runs onto its own line, which is how anything longer than
    // a few words is written:
    //
    //     <Empty>
    //       Nothing said about this page yet.
    //     </Empty>
    //
    // Matching only `>…<` on one line missed every sentence in the panel.
    if (!/[<>{}]/.test(code)) {
      const text = code.trim();
      const opensAbove = /[>}]\s*$/.test(lines[index - 1] ?? "");
      const closesBelow = /^\s*(<\/|\{)/.test(lines[index + 1] ?? "");
      if (text && opensAbove && closesBelow && looksLikeCopy(text)) found.push({ at: index + 1, text });
    }
  });
  return found.map((one) => ({ ...one, file: relative(ROOT, path) }));
}

const rows = [];
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    rows.push(...stringsIn(readFileSync(file, "utf8"), file));
  }
}
rows.sort((a, b) => (a.file === b.file ? a.at - b.at : a.file < b.file ? -1 : 1));

const byFile = new Map();
for (const row of rows) {
  const bucket = byFile.get(row.file) ?? [];
  bucket.push(row);
  byFile.set(row.file, bucket);
}

const out = [
  "# Every word the product says",
  "",
  "Generated by `scripts/qa/copy-inventory.mjs` — do not edit by hand.",
  "",
  "This file is committed so that changing a word on screen changes a diff.",
  "Read a new line against `docs/spec/review-process.md` before it ships:",
  "state the fact, no justification, no chat register, no filler.",
  "",
  `${rows.length} strings across ${byFile.size} files.`,
  "",
];
for (const [file, found] of byFile) {
  out.push(`## ${file}`, "");
  for (const one of found) out.push(`- ${one.at}: \`${one.text.replace(/`/g, "'")}\``);
  out.push("");
}
const body = out.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    // Never written; the diff below says so.
  }
  if (current !== body) {
    console.error("The copy inventory is out of date. Run: node scripts/qa/copy-inventory.mjs");
    process.exit(1);
  }
  console.log(`copy inventory current — ${rows.length} strings`);
} else {
  writeFileSync(OUT, body);
  console.log(`wrote ${relative(ROOT, OUT)} — ${rows.length} strings across ${byFile.size} files`);
}
