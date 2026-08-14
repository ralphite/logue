/**
 * A piece of text, and everything Skills have made from it.
 *
 * Lifted out of the dictation hook when the panel became one list: a typed
 * note, a kept passage and a saved page all carry one of these now, because
 * they are all things a Skill can be run on. Nothing here is numbered and
 * nothing is a version "of" anything — the first text is shaped exactly like
 * the ones that follow it.
 */

import type { Skill } from "./api";

/** One piece of text, and everything made from it. */
export interface Take {
  id: string;
  /** The Skill that produced this text. Absent on a transcript. */
  from?: string;
  text: string;
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

/** The Skills offered on one text: those meant for dictation, minus the used. */
export function offered(skills: Skill[] | undefined, take: Take): Skill[] {
  return (skills ?? []).filter(
    (skill) => skill.enabled && skill.contexts.includes("dictation") && !take.used.includes(skill.id),
  );
}
