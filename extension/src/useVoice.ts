import { useCallback, useEffect, useRef, useState } from "react";
import { host, HostError, type Material } from "./api";
import { send } from "./messages";
import { ask as askForMicrophone, blockedMessage, canAsk, MICROPHONE_BLOCKED, reading } from "./microphone";
import { keep, LIMIT } from "./pending";
import type { VoiceOverrides } from "./overrides";

/** Ten minutes, matching the ceiling the recorder itself enforces. */
const MAX_MS = 10 * 60 * 1000;
/** Past a minute this is a long recording, and the bar starts saying so. */
const LONG_MS = 60 * 1000;

/**
 * How long to wait before each further attempt on a busy model.
 *
 * The Host has already asked four times over about seven seconds by the time
 * one of these failures gets here, so these waits are longer: a spike that
 * outlives them is not a spike. Two attempts, then it waits for the person —
 * giving up automatically and giving up are different things.
 */
const AUTOMATIC_WAITS_MS = [5000, 15000];

/** Said while a busy model is being asked again, in place of "Transcribing…". */
export const BUSY = "The model was busy. Trying again…";

const pause = (ms: number) => new Promise((wake) => setTimeout(wake, ms));

export type VoicePhase = "idle" | "starting" | "recording" | "working" | "error";

/**
 * What became of one recording.
 *
 * A failure used to be reported only by leaving `phase` at "error" — which
 * works for a bar showing one recording and not at all for a list showing
 * four: the caller could not tell whose failure it was reading. The outcome
 * comes back to whoever asked for it.
 */
export type Settled =
  /** Kept: the words and the Source they became. */
  | { ok: true; text: string; material: Material; captureId?: string }
  /** Heard, not kept: the words, and the recording they came from. */
  | { ok: true; text: string; material?: undefined; captureId: string }
  | { ok: false; message: string; captureId?: string };

/** What settling a recording needs to know, whichever attempt it is. */
export interface Settling {
  project?: string;
  overrides?: VoiceOverrides;
  source?: unknown;
  parentIds?: string[];
  /** What the person is writing into, so names match the page. */
  nearby?: string;
  /**
   * Keep failures out of the shared phase and error.
   *
   * A caller that shows one recording wants them there — it is the only
   * place it has to say so. A caller showing a list of recordings has a
   * row per recording, and a shared error there would blame whichever one
   * happens to be on top.
   */
  quiet?: boolean;
  /**
   * A busy model is being asked again, and this is the recording it is about.
   *
   * A surface with a row per recording is the only place that fact can be
   * told truthfully; without this the row would sit on "Transcribing…" for
   * twenty seconds and say nothing about why.
   */
  onRetrying?: (captureId: string, message: string) => void;
  /**
   * Whether the words become a Source here, or later.
   *
   * The panel's composer says them into a box first — voice fills the box, it
   * does not send (N13) — so the Source is written when the person sends,
   * with whatever they edited it into. The audio is on the Host either way:
   * it is written before the model is asked, and a transcribed recording
   * nobody kept is not "unfinished", it is a draft.
   */
  keep?: boolean;
}

function describe(cause: unknown): string {
  if (cause instanceof HostError) return cause.message;
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

/**
 * One recording, start to transcript.
 *
 * The audio is saved by the Host before transcription is attempted, so a model
 * failure never costs someone the thing they said.
 */
export function useVoice() {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string>();
  const [seconds, setSeconds] = useState(0);
  /**
   * The recording a failed transcription left behind, so Try again has
   * something to try. Without it the audio is on disk and unreachable.
   */
  const [kept, setKept] = useState<string>();
  /**
   * Recordings handed off and not yet settled.
   *
   * The microphone is free the moment the audio is captured; what remains —
   * transcribe, save, land at the frozen caret — takes seconds for a note and
   * minutes for a ten-minute recording, and holding the bar hostage for it
   * meant one thought at a time. This is the count the bar shows instead.
   */
  const [pending, setPending] = useState(0);
  /**
   * Chrome is holding the microphone back, and only its settings can undo it.
   *
   * A separate fact from `error` because it is the difference between a message
   * and a message with somewhere to go.
   */
  const [needsMicrophone, setNeedsMicrophone] = useState(false);
  const session = useRef(0);
  const startedAt = useRef(0);

  // A clock while recording, because a long one has to look long. Every
  // second, and only while it is running.
  useEffect(() => {
    if (phase !== "recording") {
      setSeconds(0);
      return;
    }
    startedAt.current = Date.now();
    setSeconds(0);
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  /**
   * Transcribe the audio the Host is holding, and save what comes back.
   *
   * The one body shared by every attempt after the first — the automatic ones
   * and the one behind Try again. It throws what the Host said; a recording
   * with nothing in it is not a failure of the request, so it comes back as an
   * answer rather than an exception.
   */
  const settleKept = useCallback(async (captureId: string, options: Settling): Promise<Settled> => {
    const { text, applied_context } = await host.transcribeKept(captureId, {
      project: options.project,
      overrides: options.overrides,
      nearby: options.nearby,
    });
    if (!text.trim()) {
      return { ok: false, message: "Nothing was heard in that recording. The audio is still kept.", captureId };
    }
    const { material } = await host.saveVoice({
      capture_id: captureId,
      text,
      source: options.source,
      project: options.project,
      parent_ids: options.parentIds,
      applied_context,
      // As on `stop`: the page travels with the words it spelled.
      context: options.nearby,
    });
    return { ok: true, text, material };
  }, []);

  /**
   * Ask again on a recording the model was too busy to take, without being asked to.
   *
   * A 503 is the service saying "not this second", and handing that to the
   * person as a red box with a button makes them do the waiting by hand. The
   * audio is already on the Host, so nothing is at stake but time — and the
   * time is bounded: two attempts, then the button, which is still there.
   */
  // oxlint-disable no-await-in-loop -- attempts are a sequence: each waits
  // longer than the last, and the next only happens if this one failed.
  const automatic = useCallback(
    async (captureId: string, options: Settling, first: string): Promise<Settled> => {
      let last = first;
      for (const wait of AUTOMATIC_WAITS_MS) {
        options.onRetrying?.(captureId, BUSY);
        await pause(wait);
        try {
          const settled = await settleKept(captureId, options);
          // Heard, or heard nothing — either way the model answered, and an
          // answer is not something to ask again about.
          if (settled.ok) setKept(undefined);
          return settled;
        } catch (cause) {
          last = describe(cause);
          // Something else is wrong now. Say that, rather than the busy line.
          if (!(cause instanceof HostError && cause.retryable)) break;
        }
      }
      return { ok: false, message: `${last} The recording was kept — you can try again.`, captureId };
    },
    [settleKept],
  );
  // oxlint-enable no-await-in-loop

  /** Whether the microphone actually came up — callers place their own bar on it. */
  const start = useCallback(async (): Promise<boolean> => {
    const id = (session.current += 1);
    setError(undefined);
    setNeedsMicrophone(false);
    setPhase("starting");

    // Ask before the recorder does, because the recorder cannot.
    //
    // It runs in the offscreen document, which has no window for Chrome to draw
    // a prompt in, so an ungranted microphone comes back as a flat refusal. Here
    // there is a window. Once granted the grant belongs to the extension, so
    // this runs at most once per browser — and never on the recording path,
    // which must not open the device the recorder is about to want.
    if (canAsk() && (await reading()) !== "granted") {
      const outcome = await askForMicrophone();
      if (session.current !== id) return false;
      if (outcome === "denied") {
        setPhase("error");
        setError(blockedMessage());
        setNeedsMicrophone(true);
        return false;
      }
    }

    const result = await send<{ ok: boolean; message?: string; code?: string }>({
      type: "logue:record-start",
      sessionId: String(id),
    });
    if (session.current !== id) return false;
    if (!result?.ok) {
      const blocked = result?.code === MICROPHONE_BLOCKED;
      setPhase("error");
      setError(blocked ? blockedMessage() : (result?.message ?? "Could not reach the microphone."));
      setNeedsMicrophone(blocked);
      return false;
    }
    setPhase("recording");
    return true;
  }, []);

  const cancel = useCallback(() => {
    session.current += 1;
    void send({ type: "logue:record-cancel", sessionId: String(session.current) });
    setPhase("idle");
    setError(undefined);
    setNeedsMicrophone(false);
  }, []);

  /**
   * Stops, then settles in the background. Returns what became of it, or
   * undefined if the recording was cancelled or superseded meanwhile.
   *
   * The await falls in two halves on purpose. Capturing the audio is quick
   * and exclusive — the microphone is one. Settling it (transcribe, save) is
   * slow and is not: the bar goes back to idle the moment the audio is in
   * hand, a new recording may start at once, and each settlement lands at the
   * caret its own recording froze, however many are in flight.
   */
  const stop = useCallback(
    async (options: Settling): Promise<Settled | undefined> => {
      const id = session.current;
      // Read the clock before the phase change resets it: this is the only
      // record of how long the recording ran, and a queued one has to be able
      // to say so later.
      const ranFor = seconds;
      const failed = (message: string, captureId?: string): Settled => {
        if (!options.quiet) {
          setPhase("error");
          setError(message);
        }
        return { ok: false, message, captureId };
      };
      setPhase("working");
      const recorded = await send<{
        ok: boolean;
        audio?: string;
        mediaType?: string;
        message?: string;
        heard?: boolean;
      }>({
        type: "logue:record-stop",
        sessionId: String(id),
      });
      if (session.current !== id) return undefined;
      if (!recorded?.ok || !recorded.audio) {
        return failed(recorded?.message ?? "Nothing was recorded.");
      }

      // A silent recording never reaches the model.
      //
      // Not an optimisation. Given five seconds of silence and a page of
      // context, a real model returns a fluent sentence nobody said — and this
      // is the one product that would then type it at your caret. Whether the
      // microphone heard anything is measured while recording, so it is known
      // here for certain, and `false` is the only value that counts: an older
      // recorder that never reported leaves it undefined, and an unanswered
      // question must not become an accusation.
      if (recorded.heard === false) {
        return failed("Logue did not hear anything. Check the microphone and try again.");
      }

      // The microphone is free from here; everything below is one job among
      // possibly several. The session guard stops mattering for them — a
      // cancel cancels the *recording*, never a settlement already in flight.
      setPhase("idle");
      setPending((n) => n + 1);
      try {
        const { capture_id, text, applied_context } = await host.transcribe({
          // What the bar's clock said. Nothing downstream can work this out:
          // MediaRecorder never writes a duration into the file.
          seconds: ranFor,
          audio: recorded.audio,
          media_type: recorded.mediaType ?? "audio/webm",
          project: options.project,
          overrides: options.overrides,
          nearby: options.nearby,
        });
        if (!text.trim()) {
          // The Host kept the audio; only the words are missing. Saying so was
          // half the job — the recording sat there with nothing offering a
          // second attempt, which reads as "kept, and no use to you".
          setKept(capture_id);
          return failed(
            "Nothing was heard in that recording. The audio was kept — you can try again.",
            capture_id,
          );
        }
        // The words, without a Source, when the caller keeps it themselves.
        if (options.keep === false) return { ok: true, text, captureId: capture_id };
        const { material } = await host.saveVoice({
          capture_id,
          text,
          source: options.source,
          project: options.project,
          parent_ids: options.parentIds,
          applied_context,
          // The same page text that spelled the transcript. Saved with the
          // Source, because filing reads what the speaker was reading — a
          // transcript alone says "voice, from: Chat" and nothing else.
          context: options.nearby,
        });
        return { ok: true, text, material };
      } catch (cause) {
        // The Host is not answering, so nothing has the audio but this page —
        // and this page is about to forget it. Keep it, and say it is kept.
        // A model that refused is different: the Host already has the audio.
        if (cause instanceof HostError && cause.status === 0) {
          const queued = await keep({
            audio: recorded.audio,
            mediaType: recorded.mediaType ?? "audio/webm",
            // How long it ran, taken from the clock the bar was showing:
            // a queued recording has to describe itself later, and audio
            // bytes do not say how long they are.
            seconds: ranFor,
            project: options.project,
            overrides: options.overrides,
            source: options.source,
            parentIds: options.parentIds,
            nearby: options.nearby,
          });
          return failed(
            queued
              ? "Logue is not running. The recording is kept and will be saved when it starts."
              : `Logue is not running, and ${LIMIT} recordings are already waiting. Start Logue to save them.`,
          );
        }
        // A model that refused, or a Host that answered with a failure: the
        // audio is already on disk there, and the id came back with the error.
        // Remembering it is the whole difference between "try again" and
        // "say it all over again".
        const onDisk = cause instanceof HostError ? cause.captureId : undefined;
        if (onDisk) setKept(onDisk);
        // A busy model is a moment, not a decision. The waiting is ours to do.
        if (onDisk && cause instanceof HostError && cause.retryable) {
          const settled = await automatic(onDisk, options, describe(cause));
          return settled.ok ? settled : failed(settled.message, onDisk);
        }
        return failed(
          onDisk ? `${describe(cause)} The recording was kept — you can try again.` : describe(cause),
          onDisk,
        );
      } finally {
        setPending((n) => n - 1);
      }
    },
    [seconds, automatic],
  );

  /**
   * Try the model again on a recording the Host still has.
   *
   * The recording is named by the caller wherever it can name one. A surface
   * with four failed rows has four recordings kept, and retrying "the last
   * one" from the third row's button transcribed somebody else's audio.
   */
  const retry = useCallback(
    async (options: Settling & { captureId?: string }): Promise<Settled | undefined> => {
      const captureId = options.captureId ?? kept;
      if (!captureId) return undefined;
      const id = (session.current += 1);
      const failed = (message: string): Settled => {
        if (!options.quiet) {
          setPhase("error");
          setError(message);
        }
        return { ok: false, message, captureId };
      };
      setPhase("working");
      setError(undefined);
      try {
        const settled = await settleKept(captureId, options);
        if (session.current !== id) return undefined;
        if (!settled.ok) return failed(settled.message);
        setKept(undefined);
        setPhase("idle");
        return settled;
      } catch (cause) {
        if (session.current !== id) return undefined;
        // The audio has not gone anywhere; it stays offered. A busy model is
        // asked again here too — the person pressed the button, which is not
        // a reason to make them press it four more times.
        if (cause instanceof HostError && cause.retryable) {
          const again = await automatic(captureId, options, describe(cause));
          if (session.current !== id) return undefined;
          if (again.ok) {
            setPhase("idle");
            return again;
          }
          return failed(again.message);
        }
        return failed(`${describe(cause)} The recording is still kept.`);
      }
    },
    [kept, settleKept, automatic],
  );

  const forget = useCallback(() => setKept(undefined), []);

  return {
    phase,
    error,
    /** How long the current recording has run, in seconds. */
    seconds,
    /** Past a minute — the bar says so rather than letting it run silently. */
    long: seconds * 1000 >= LONG_MS,
    /** The ceiling, so the bar can say what happens at it. */
    maxSeconds: MAX_MS / 1000,
    /** A recording the Host kept when the words failed, waiting for another try. */
    keptCapture: kept,
    /** Recordings captured and not yet settled — transcribing or saving. */
    pending,
    /** Chrome is refusing the microphone; the surface should offer the setting. */
    needsMicrophone,
    start,
    stop,
    cancel,
    retry,
    forget,
    setError,
    setPhase,
  };
}
