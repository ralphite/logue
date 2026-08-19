import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";

/**
 * What a fenced block is highlighted as.
 *
 * ```` ```ts ```` is a claim about the text inside it, and the editor was not
 * reading it: every fence rendered as one flat grey, which is exactly the
 * thing a code block exists not to be. Loaded on demand, so a document with
 * no code pays nothing for the ones that do.
 *
 * The list is the languages this workspace's documents actually hold — the
 * product's own stack, plus the shells and config formats that turn up in
 * notes. A name that is not here still renders as a code block; it simply is
 * not coloured, which is the honest outcome rather than a wrong guess.
 */
export const languages: LanguageDescription[] = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "jsx", "mjs", "cjs", "node"],
    load: async () => javascript({ jsx: true }),
  }),
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts", "tsx"],
    load: async () => javascript({ jsx: true, typescript: true }),
  }),
  LanguageDescription.of({ name: "python", alias: ["py"], load: async () => python() }),
  LanguageDescription.of({ name: "json", load: async () => json() }),
  LanguageDescription.of({ name: "html", alias: ["htm"], load: async () => html() }),
  LanguageDescription.of({ name: "css", load: async () => css() }),
  LanguageDescription.of({
    name: "shell",
    alias: ["sh", "bash", "zsh", "console"],
    load: async () => {
      const { shell } = await import("@codemirror/legacy-modes/mode/shell");
      return new LanguageSupport(StreamLanguage.define(shell));
    },
  }),
  LanguageDescription.of({
    name: "yaml",
    alias: ["yml"],
    load: async () => {
      const { yaml } = await import("@codemirror/legacy-modes/mode/yaml");
      return new LanguageSupport(StreamLanguage.define(yaml));
    },
  }),
  LanguageDescription.of({
    name: "sql",
    load: async () => {
      const { standardSQL } = await import("@codemirror/legacy-modes/mode/sql");
      return new LanguageSupport(StreamLanguage.define(standardSQL));
    },
  }),
  LanguageDescription.of({
    name: "diff",
    alias: ["patch"],
    load: async () => {
      const { diff } = await import("@codemirror/legacy-modes/mode/diff");
      return new LanguageSupport(StreamLanguage.define(diff));
    },
  }),
];
