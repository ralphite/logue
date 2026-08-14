/**
 * A piece of text, and everything Skills have made from it.
 *
 * Lifted out of the dictation hook when the panel became one list: a typed
 * note, a kept passage and a saved page all carry one of these now, because
 * they are all things a Skill can be run on. Nothing here is numbered and
 * nothing is a version "of" anything — the first text is shaped exactly like
 * the ones that follow it.
 */

import type { Material, Skill } from "./api";

/** One piece of text, and everything made from it. */
export interface Take {
  id: string;
  /**
   * The Source this text *is*, once the Host holds it.
   *
   * Absent while a send is still in flight, and on words that were never
   * kept. Anything made from this text hangs off this id — without it a
   * rewrite has nothing to point back at, and would be gone the next time
   * the panel opened.
   */
  materialId?: string;
  /** The Skill that produced this text. Absent on a transcript. */
  from?: string;
  text: string;
  /** What an answer stood on, so `[Source n]` can be followed. */
  sources?: Material[];
  /** Skill ids already run on *this* text, so none is offered on it twice. */
  used: string[];
  /** A Skill running on this text right now — its name, for the row to show. */
  running?: string;
  made: Take[];
}


/** Replace one Take inside the tree, leaving the rest untouched. */
export function edit(take: Take, id: string, change: (found: Take) => Take): Take {
  if (take.id === id) return change(take);
  return { ...take, made: take.made.map((child) => edit(child, id, change)) };
}

/** The Take with this id, anywhere in the tree. */
export function find(take: Take, id: string): Take | undefined {
  if (take.id === id) return take;
  for (const child of take.made) {
    const found = find(child, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Where in the product this panel is, as a Skill's contexts name it.
 *
 * `dictation` alone was the filter until 2026-08-14, which meant what you
 * could do to a sentence still depended on how it had arrived: a saved page
 * and a kept passage were offered nothing, because nobody had said the word
 * "dictation" over them. The panel is the browser, so it offers every Skill
 * the browser can reach.
 */
const IN_THE_BROWSER = new Set(["dictation", "selection", "page"]);

/** The Skills offered on one text: those the panel can run, minus the used. */
export function offered(skills: Skill[] | undefined, take: Take): Skill[] {
  return (skills ?? []).filter(
    (skill) =>
      skill.enabled &&
      skill.contexts.some((where) => IN_THE_BROWSER.has(where)) &&
      !take.used.includes(skill.id),
  );
}
