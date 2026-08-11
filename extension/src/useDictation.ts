import { useCallback, useState } from "react";
import { host, type Material, type Skill } from "./api";
import type { useVoice } from "./useVoice";

/**
 * Dictation: recordings, and whatever Skills have made from them.
 *
 * The list is the whole of it. A recording arrives as one text — the
 * transcript — and every Skill run on a text puts its result underneath the
 * text it was run on, which is the only record of where it came from: nothing
 * here is numbered, and nothing is a version "of" the recording. The
 * transcript is not privileged; it is the first text, and it is shaped exactly
 * like the ones that follow it.
 */

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

export interface Dictation {
  id: string;
  /** How long the recording ran. The audio file does not say. */
  seconds: number;
  state: "working" | "ready" | "failed";
  /** The Source the recording was saved as; the audio hangs off it. */
  material?: Material;
  /** The transcript, and the tree grown from it. */
  take?: Take;
  /** Why it failed, said in the row that failed. */
  message?: string;
  /** Audio the Host kept when the words failed, so a retry has something. */
  captureId?: string;
}

let counter = 0;
const nextId = () => `d${(counter += 1)}`;

/** Replace one Take inside the tree, leaving the rest untouched. */
function edit(take: Take, id: string, change: (found: Take) => Take): Take {
  if (take.id === id) return change(take);
  return { ...take, made: take.made.map((child) => edit(child, id, change)) };
}

/**
 * The microphone is handed in rather than opened here.
 *
 * There is one of it. A second `useVoice` in the same panel would keep its own
 * idea of whether a recording is running, and the two would disagree the first
 * time someone spoke from the other tab.
 */
export function useDictation(voice: ReturnType<typeof useVoice>) {
  const [items, setItems] = useState<Dictation[]>([]);

  const change = useCallback((id: string, how: (was: Dictation) => Dictation) => {
    setItems((was) => was.map((item) => (item.id === id ? how(item) : item)));
  }, []);

  /**
   * Stop recording and settle in the background.
   *
   * The row exists before the transcript does. Everything after the audio is
   * captured is slow and belongs to this one recording — so it says so in its
   * own row, and the microphone is free the whole time.
   */
  const finish = useCallback(
    async (options: { project?: string; page?: { url?: string; title?: string }; nearby?: string }) => {
      const id = nextId();
      const seconds = voice.seconds;
      setItems((was) => [{ id, seconds, state: "working" }, ...was]);
      const settled = await voice.stop({
        project: options.project,
        source: { kind: "dictation", url: options.page?.url, title: options.page?.title },
        nearby: options.nearby,
        // Four recordings, four rows: a shared error could not say which one
        // it belonged to.
        quiet: true,
      });
      if (!settled) {
        // Cancelled while it was being captured; the row never had anything.
        setItems((was) => was.filter((item) => item.id !== id));
        return;
      }
      if (!settled.ok) {
        change(id, (was) => ({ ...was, state: "failed", message: settled.message, captureId: settled.captureId }));
        return;
      }
      change(id, (was) => ({
        ...was,
        state: "ready",
        material: settled.material,
        seconds: settled.material.capture_seconds ?? was.seconds,
        take: { id: `${id}t`, text: settled.text, used: [], made: [] },
      }));
    },
    [voice, change],
  );

  /** Try the model again on a recording the Host kept. */
  const again = useCallback(
    async (id: string, options: { project?: string; page?: { url?: string; title?: string } }) => {
      change(id, (was) => ({ ...was, state: "working", message: undefined }));
      const settled = await voice.retry({
        project: options.project,
        source: { kind: "dictation", url: options.page?.url, title: options.page?.title },
        quiet: true,
      });
      if (!settled) return;
      if (!settled.ok) {
        change(id, (was) => ({ ...was, state: "failed", message: settled.message }));
        return;
      }
      change(id, (was) => ({
        ...was,
        state: "ready",
        material: settled.material,
        take: { id: `${id}t`, text: settled.text, used: [], made: [] },
      }));
    },
    [voice, change],
  );

  /**
   * Run a Skill over one text, and hang the result under it.
   *
   * The Run is told the origin is the recording's Source, so a rewrite does
   * not leave another copy of the words in the workspace — and the lineage
   * stays true: this came from that recording.
   */
  const apply = useCallback(
    async (id: string, takeId: string, skill: Skill, project?: string) => {
      const item = items.find((one) => one.id === id);
      const target = item?.take && find(item.take, takeId);
      if (!item || !target || target.running) return;

      change(id, (was) => ({
        ...was,
        take: was.take && edit(was.take, takeId, (found) => ({ ...found, running: skill.name })),
      }));
      try {
        const { run } = await host.run({
          skill_id: skill.id,
          // The text to work on, not a request — the Skill's own prompt is the
          // request, and there is nothing else being asked for.
          input: target.text,
          project,
          // No numbered Sources, so nothing asks this to cite anything.
          source_ids: [],
          origin_id: item.material?.id,
        });
        const text = (run.original_output ?? "").trim();
        if (!text) throw new Error(run.error || "That Skill returned nothing.");
        change(id, (was) => ({
          ...was,
          take:
            was.take &&
            edit(was.take, takeId, (found) => ({
              ...found,
              running: undefined,
              used: [...found.used, skill.id],
              made: [...found.made, { id: `${found.id}-${skill.id}`, from: skill.name, text, used: [], made: [] }],
            })),
        }));
      } catch (cause) {
        change(id, (was) => ({
          ...was,
          take: was.take && edit(was.take, takeId, (found) => ({ ...found, running: undefined })),
          message: cause instanceof Error ? cause.message : "That Skill could not run.",
        }));
      }
    },
    [items, change],
  );

  return { items, finish, again, apply };
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
