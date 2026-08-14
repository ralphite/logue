import { useCallback, useState } from "react";
import { host, type Material, type Skill } from "./api";
import type { Entry } from "./entries";
import { edit, find, type Take } from "./takes";
import type { useVoice } from "./useVoice";

/**
 * Everything that happens on a page, as one list.
 *
 * The panel had four of these — dictation, the conversation, what was kept
 * from this page, and the queue — each with its own shape and its own rules
 * about what could be done to it. Only one of the four offered Skills, which
 * meant "run this on those words" depended on how the words had arrived.
 *
 * Now: one list, one shape, and the same row of Skills under every entry.
 * Sending is keeping — his ruling of 2026-08-13, option A — and asking is a
 * Skill you run on something you have kept.
 */

/** What every submission needs to know, whatever it was made of. */
export interface Sending {
  project?: string;
  page?: { url?: string; title?: string };
  /** The passage this is about, when one was quoted. */
  quote?: { text: string; anchor?: unknown };
  /** Where the words are added as well as kept. */
  into?: { id: string; title: string };
  /** What the page said around the caret, for spelling. */
  nearby?: string;
}

let counter = 0;
const nextId = () => `e${(counter += 1)}`;

export function useEntries(voice: ReturnType<typeof useVoice>) {
  const [items, setItems] = useState<Entry[]>([]);

  const change = useCallback((id: string, how: (was: Entry) => Entry) => {
    setItems((was) => was.map((item) => (item.id === id ? how(item) : item)));
  }, []);

  /** Put the words somewhere they can be found again, and land them if asked. */
  const landed = useCallback(
    async (id: string, material: Material, text: string, options: Sending) => {
      if (!options.into) return;
      try {
        await host.appendToDocument(options.into.id, text, [material.id]);
        change(id, (was) => ({ ...was, landed: options.into }));
      } catch (cause) {
        // The words are safe either way — they are a Source already. Only the
        // last step failed, and the entry says which one.
        change(id, (was) => ({
          ...was,
          message: cause instanceof Error ? cause.message : "Could not add it to that Document.",
        }));
      }
    },
    [change],
  );

  /**
   * Stop a recording and hand back the words, keeping nothing yet.
   *
   * Voice fills the box; it does not send. So this transcribes and returns —
   * the audio stays on the Host, and the Source is written when the person
   * sends, with whatever they edited the words into.
   *
   * What it *does* put in the list is trouble: a model that is busy, and a
   * model that gave up. Those are things that happened to a recording, and a
   * recording nobody can see is a recording nobody can retry.
   */
  const hear = useCallback(
    async (options: Sending): Promise<{ text: string; captureId?: string } | undefined> => {
      const id = nextId();
      const at = new Date().toISOString();
      const seconds = voice.seconds;
      let shown = false;
      const show = (patch: Partial<Entry>) => {
        if (shown) {
          change(id, (was) => ({ ...was, ...patch }));
          return;
        }
        shown = true;
        setItems((was) => [{ id, at, kind: "voiced", state: "working", seconds, ...patch }, ...was]);
      };

      const settled = await voice.stop({
        project: options.project,
        source: { kind: "dictation", url: options.page?.url, title: options.page?.title },
        nearby: options.nearby,
        keep: false,
        quiet: true,
        onRetrying: (captureId, message) => show({ captureId, message, state: "working" }),
      });
      if (!settled) return undefined;
      if (!settled.ok) {
        show({ state: "failed", message: settled.message, captureId: settled.captureId });
        return undefined;
      }
      // It came back after a wobble: the entry that was showing the wobble is
      // the words now, and nothing else has to be told.
      if (shown) {
        change(id, (was) => ({
          ...was,
          state: "ready",
          message: undefined,
          take: { id: `${id}t`, text: settled.text, used: [], made: [] },
        }));
      }
      return { text: settled.text, captureId: settled.captureId };
    },
    [voice, change],
  );

  /**
   * A recording, from the microphone to a Source.
   *
   * The entry exists before the words do: the microphone is free the moment
   * the audio is captured, and everything after that — transcribe, save,
   * append — belongs to this one entry and says so in its own row.
   */
  const speak = useCallback(
    async (options: Sending) => {
      const id = nextId();
      const seconds = voice.seconds;
      const at = new Date().toISOString();
      setItems((was) => [
        { id, at, kind: options.quote ? "comment" : "voiced", state: "working", seconds, quote: options.quote?.text },
        ...was,
      ]);
      const settled = await voice.stop({
        project: options.project,
        source: { kind: "dictation", url: options.page?.url, title: options.page?.title },
        nearby: options.nearby,
        // One entry per recording: a shared error could not say which one it
        // belonged to.
        quiet: true,
        onRetrying: (captureId, message) => change(id, (was) => ({ ...was, captureId, message })),
      });
      if (!settled) {
        // Cancelled while it was being captured; the entry never had anything.
        setItems((was) => was.filter((item) => item.id !== id));
        return;
      }
      if (!settled.ok) {
        change(id, (was) => ({ ...was, state: "failed", message: settled.message, captureId: settled.captureId }));
        return;
      }
      if (!settled.material) return;
      const material = settled.material;
      change(id, (was) => ({
        ...was,
        state: "ready",
        message: undefined,
        material,
        seconds: material.capture_seconds ?? was.seconds,
        take: { id: `${id}t`, text: settled.text, used: [], made: [] },
      }));
      await landed(id, material, settled.text, options);
    },
    [voice, change, landed],
  );

  /**
   * Typed words, a quoted passage, a recording, or all three. Sending keeps.
   *
   * One send, one Source — the whole point of ruling A. When the words came
   * out of the microphone the Source is a voice one, carrying the recording,
   * so what was said can be played back beside what it became.
   */
  const submit = useCallback(
    async (text: string, options: Sending & { captureId?: string }): Promise<boolean> => {
      const words = text.trim();
      const quote = options.quote?.text.trim();
      if (!words && !quote) return false;
      const id = nextId();
      const at = new Date().toISOString();
      // A passage with nothing said about it is a passage kept; words that came
      // out of the microphone are dictation — or a comment, when they are about
      // a passage; anything else is a typed note. The act vocabulary calls a
      // spoken comment "Voice comment", and a typed note wearing that label is
      // the list lying about how it was made.
      const spoken = Boolean(options.captureId);
      const kind = !words ? "kept" : spoken ? (quote ? "comment" : "voiced") : "typed";
      setItems((was) => [{ id, at, kind, state: "working", quote }, ...was]);
      const source = {
        kind: "panel",
        url: options.page?.url,
        title: options.page?.title,
      };
      try {
        let about: Material | undefined;
        if (quote) {
          const kept = await host.saveMaterial({
            kind: "selection",
            content: quote,
            source: { url: options.page?.url, title: options.page?.title },
            projects: options.project ? [options.project] : [],
            anchor: options.quote?.anchor,
          });
          about = kept.material;
        }
        const { material } = !words
          ? { material: about! }
          : options.captureId
            ? // Said out loud: one voice Source, carrying the recording, with
              // the words as they were sent rather than as they came back.
              await host.saveVoice({
                capture_id: options.captureId,
                text: words,
                source,
                project: options.project,
                parent_ids: about ? [about.id] : undefined,
                context: options.nearby,
              })
            : await host.saveMaterial({
                kind: "text",
                content: words,
                source,
                projects: options.project ? [options.project] : [],
                parent_ids: about ? [about.id] : undefined,
              });
        change(id, (was) => ({
          ...was,
          state: "ready",
          material,
          take: { id: `${id}t`, materialId: material.id, text: material.content, used: [], made: [] },
        }));
        await landed(id, material, words || quote || "", options);
      } catch (cause) {
        // The words go onto the entry even though nothing was kept: a failed
        // send that shows only its error is a failed send that ate a
        // paragraph. From here they can be read, copied, and sent again.
        change(id, (was) => ({
          ...was,
          state: "failed",
          message: cause instanceof Error ? cause.message : "Could not keep that.",
          take: words ? { id: `${id}t`, text: words, used: [], made: [] } : was.take,
        }));
        return false;
      }
      return true;
    },
    [change, landed],
  );

  /** The whole page, kept as it reads today. */
  const keepPage = useCallback(
    async (text: string, options: Sending) => {
      const id = nextId();
      const at = new Date().toISOString();
      setItems((was) => [{ id, at, kind: "saved", state: "working" }, ...was]);
      try {
        const { material } = await host.saveMaterial({
          kind: "page",
          content: text || options.page?.title || options.page?.url || "",
          source: { url: options.page?.url, title: options.page?.title },
          projects: options.project ? [options.project] : [],
        });
        change(id, (was) => ({
          ...was,
          state: "ready",
          material,
          take: { id: `${id}t`, materialId: material.id, text: material.content, used: [], made: [] },
        }));
      } catch (cause) {
        change(id, (was) => ({
          ...was,
          state: "failed",
          message: cause instanceof Error ? cause.message : "Could not save this page.",
        }));
      }
    },
    [change],
  );

  /**
   * Try the model again on a recording the Host kept.
   *
   * The words go where they would have gone the first time: into the box, for
   * the person to send or not. Trying again used to file them as a Source
   * instead — the same recording behaving one way when it worked and the
   * opposite way when it had failed once.
   */
  const again = useCallback(
    async (id: string, options: Sending): Promise<string | undefined> => {
      const captureId = items.find((one) => one.id === id)?.captureId;
      change(id, (was) => ({ ...was, state: "working", message: undefined }));
      const settled = await voice.retry({
        captureId,
        project: options.project,
        source: { kind: "dictation", url: options.page?.url, title: options.page?.title },
        quiet: true,
        keep: false,
        onRetrying: (kept, message) => change(id, (was) => ({ ...was, captureId: kept, message })),
      });
      if (!settled) return undefined;
      if (!settled.ok) {
        change(id, (was) => ({ ...was, state: "failed", message: settled.message }));
        return undefined;
      }
      // Heard at last. The entry becomes the words, and the words are also in
      // the box: what is kept is still the person's decision.
      change(id, (was) => ({
        ...was,
        state: "ready",
        message: undefined,
        material: settled.material,
        take: { id: `${id}t`, materialId: settled.material?.id, text: settled.text, used: [], made: [] },
      }));
      return settled.text;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voice, change, items],
  );

  /**
   * Keep what a Skill wrote, as a Source hanging off the text it was made from.
   *
   * Until 2026-08-14 nothing did this: an answer and every rewrite lived in
   * React state alone, so closing the side panel — the ordinary way a side
   * panel ends — threw them away. The panel rebuilds its list from the Host,
   * and what the Host never heard about cannot come back.
   *
   * A text with no Source behind it (a send that failed) has nothing to hang
   * off, and the rewrite stays local rather than floating free of its
   * evidence. That is the rule in `domain/materials.py`, kept here too.
   */
  const keepDerived = useCallback(
    async (parentId: string | undefined, made: string, text: string, options: Sending) => {
      if (!parentId) return undefined;
      try {
        const { material } = await host.saveMaterial({
          kind: "derived",
          content: text,
          // The page it happened on as well as the Skill that made it: the
          // panel finds this page's work by searching for the address, and a
          // rewrite filed without one came back nowhere — it was on the Host
          // and off the list, which is the same as gone.
          source: { kind: "skill", made_by: made, url: options.page?.url, title: options.page?.title },
          projects: options.project ? [options.project] : [],
          parent_ids: [parentId],
        });
        return material.id;
      } catch {
        // The words are on screen either way. A rewrite that could not be
        // kept is not worth an error over the answer it is showing.
        return undefined;
      }
    },
    [],
  );

  /**
   * Run a Skill over one text, and hang the result under it.
   *
   * The one thing that used to be dictation's alone. A kept passage and a
   * saved page are texts too, and "ask about this" is a Skill like any other —
   * which is what makes sending mean *keep* rather than *ask*.
   */
  const apply = useCallback(
    async (id: string, takeId: string, skill: Skill, options: Sending) => {
      const item = items.find((one) => one.id === id);
      const target = item?.take && find(item.take, takeId);
      if (!item || !target || target.running) return;

      // Whatever went wrong last time is not what is happening now.
      change(id, (was) => ({
        ...was,
        message: undefined,
        take: was.take && edit(was.take, takeId, (found) => ({ ...found, running: skill.name })),
      }));
      try {
        const { run } = await host.run({
          skill_id: skill.id,
          // The text to work on, not a request — the Skill's own prompt is the
          // request, and there is nothing else being asked for.
          input: target.text,
          project: options.project,
          source_ids: [],
          origin_id: item.material?.id,
        });
        const text = (run.original_output ?? "").trim();
        if (!text) throw new Error(run.error || "That Skill returned nothing.");
        const materialId = await keepDerived(target.materialId, skill.name, text, options);
        change(id, (was) => ({
          ...was,
          take:
            was.take &&
            edit(was.take, takeId, (found) => ({
              ...found,
              running: undefined,
              used: [...found.used, skill.id],
              made: [
                ...found.made,
                { id: materialId ?? `${found.id}-${skill.id}`, materialId, from: skill.name, text, used: [], made: [] },
              ],
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
    [items, change, keepDerived],
  );

  /**
   * Ask about one entry, and hang the answer under it.
   *
   * The Ask box is gone: asking is something you do *to* something you have
   * kept, which is his ruling A. The agent gets the entry's own words as the
   * question and this page as context, and anything it would like to change
   * comes back as a proposal on the entry — never as a change.
   */
  const ask = useCallback(
    async (id: string, options: Sending & { pageText?: string }) => {
      const item = items.find((one) => one.id === id);
      const take = item?.take;
      if (!item || !take || take.running) return;
      change(id, (was) => ({
        ...was,
        message: undefined,
        take: was.take && edit(was.take, take.id, (found) => ({ ...found, running: "Answering" })),
      }));
      try {
        const turn = await host.agentMessage({
          message: take.text,
          project: options.project,
          page: options.page?.url
            ? { url: options.page.url, title: options.page.title, text: options.pageText }
            : undefined,
        });
        const materialId = await keepDerived(take.materialId, "Answered", turn.answer, options);
        change(id, (was) => ({
          ...was,
          proposal: turn.proposal,
          sources: turn.sources,
          take:
            was.take &&
            edit(was.take, take.id, (found) => ({
              ...found,
              running: undefined,
              made: [
                ...found.made,
                {
                  id: materialId ?? `${found.id}-ask-${found.made.length}`,
                  materialId,
                  from: "Answered",
                  text: turn.answer,
                  // What the answer stood on, kept on the answer rather than
                  // on the entry: a second question would otherwise renumber
                  // the citations under the first one's answer.
                  sources: turn.sources,
                  used: [],
                  made: [],
                },
              ],
            })),
        }));
      } catch (cause) {
        change(id, (was) => ({
          ...was,
          take: was.take && edit(was.take, take.id, (found) => ({ ...found, running: undefined })),
          message: cause instanceof Error ? cause.message : "Could not reach Logue.",
        }));
      }
    },
    [items, change, keepDerived],
  );

  /** A person said yes. This is the only path a change can arrive by. */
  const carryOut = useCallback(
    async (id: string, page?: { url?: string; title?: string }) => {
      const item = items.find((one) => one.id === id);
      if (!item?.proposal) return;
      try {
        await host.agentAccept({
          proposal: item.proposal,
          page: page?.url ? { url: page.url, title: page.title } : undefined,
        });
        change(id, (was) => ({ ...was, proposal: null, landed: was.landed }));
      } catch (cause) {
        change(id, (was) => ({
          ...was,
          message: cause instanceof Error ? cause.message : "Could not do that.",
        }));
      }
    },
    [items, change],
  );

  const leaveIt = useCallback((id: string) => change(id, (was) => ({ ...was, proposal: null })), [change]);

  return { items, setItems, hear, speak, submit, keepPage, again, apply, ask, carryOut, leaveIt };
}

export type { Take };
