import type { ActKind } from "@logue/ui";
import type { Material } from "./api";
import type { Take } from "./takes";

/**
 * One record shape for everything the panel shows.
 *
 * There were four lists in this panel — what was just dictated, the
 * conversation, what had been kept from this page, and what was queued — and
 * they were four shapes with four sets of rules. A person reading the panel
 * saw one page's worth of their own work split by which code path had made it.
 *
 * His instruction of 2026-08-13: one list, one composer. So everything that
 * happens on a page is an Entry: it has a time, a kind, the words, and
 * whatever a Skill has made from those words. Nothing is privileged.
 */
export interface Entry {
  id: string;
  /** When it happened. The list is sorted by this, newest first. */
  at: string;
  /** Which act it was, in the same vocabulary the app's Activities uses. */
  kind: ActKind;
  /**
   * `working` while the model has it, `failed` when it would not answer.
   * Everything the Host already holds is `ready`.
   */
  state: "working" | "ready" | "failed";
  /** The Source, once there is one. */
  material?: Material;
  /** Audio the Host is holding — before there is a Source, and after a failure. */
  captureId?: string;
  seconds?: number;
  /** Why it failed, or what it is waiting for. */
  message?: string;
  /** The words, and everything Skills have made from them. */
  take?: Take;
  /** The passage this was said about. */
  quote?: string;
  /** The Document the words were added to, when one was chosen beforehand. */
  landed?: { id: string; title: string };
  /**
   * A change the agent would like to make, waiting for a person.
   *
   * Kept on the entry it came out of rather than in a conversation of its
   * own: nothing this product does to a workspace happens without someone
   * saying yes, and the yes belongs beside the thing that asked for it.
   */
  proposal?: { id: string; tool: string; reason?: string; title?: string } | null;
  /** What an answer stood on, so a claim can be followed back. */
  sources?: Material[];
}

/**
 * What a saved Source was, as an act.
 *
 * The Host stores what a thing *is*; a list has to say what someone *did*.
 * The two are not the same: a voice Source hanging off a selection is a
 * comment on a passage, and a voice Source with a document behind it was
 * dictation into a page.
 */
export function actOf(material: Material, parents: Map<string, Material>): ActKind {
  if (material.kind === "page") return "saved";
  if (material.kind === "selection") return "kept";
  if (material.kind === "derived") return "generated";
  if (material.kind === "voice") {
    const about = (material.parent_ids ?? []).map((id) => parents.get(id)).find(Boolean);
    if (about?.kind === "selection") return "comment";
    return "voiced";
  }
  return "typed";
}

/**
 * The Host's record of this page, as entries — with what Skills made from a
 * thing hanging under the thing, rather than beside it.
 *
 * A derived Source whose parent is also on this page is not a separate act:
 * it is what happened to that act. Shown as its own row it would double the
 * list and lose the one fact that matters, which is what it came from.
 */
export function entriesOf(materials: Material[]): Entry[] {
  const byId = new Map(materials.map((one) => [one.id, one]));
  const children = new Map<string, Material[]>();
  const top: Material[] = [];

  for (const material of materials) {
    const parent = (material.parent_ids ?? []).find((id) => byId.has(id));
    // Only a derived Source hangs under its parent. A voice comment names the
    // passage it is about the same way, and it is its own act.
    if (parent && material.kind === "derived") {
      children.set(parent, [...(children.get(parent) ?? []), material]);
    } else {
      top.push(material);
    }
  }

  return top
    .map((material) => ({
      id: material.id,
      at: material.created_at,
      kind: actOf(material, byId),
      state: "ready" as const,
      material,
      captureId: material.capture_id,
      seconds: material.capture_seconds,
      quote: (material.parent_ids ?? [])
        .map((id) => byId.get(id))
        .find((one) => one?.kind === "selection")?.content,
      take: {
        id: material.id,
        text: material.content,
        used: [],
        made: (children.get(material.id) ?? []).map((child) => ({
          id: child.id,
          text: child.content,
          used: [],
          made: [],
        })),
      },
    }))
    .toSorted((a, b) => (a.at < b.at ? 1 : -1));
}

/**
 * This session's entries in front of the Host's, without showing either twice.
 *
 * The panel makes an entry the moment something is said, before the Host has
 * anything; when the Source comes back, the same act exists in both places.
 * The local one wins — it is the one holding the spinner, the failure and the
 * Try again.
 */
export function merge(mine: Entry[], theirs: Entry[]): Entry[] {
  const seen = new Set(mine.map((one) => one.material?.id).filter(Boolean));
  const captures = new Set(mine.map((one) => one.captureId ?? one.material?.capture_id).filter(Boolean));
  const rest = theirs.filter(
    (one) => !seen.has(one.material?.id) && !captures.has(one.material?.capture_id ?? one.captureId),
  );
  return [...mine, ...rest].toSorted((a, b) => (a.at < b.at ? 1 : -1));
}
