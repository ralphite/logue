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

export type VoicePhase = "idle" | "starting" | "recording" | "working" | "error";

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
   * Stops, then settles in the background. Returns the Material, or undefined.
   *
   * The await falls in two halves on purpose. Capturing the audio is quick
   * and exclusive — the microphone is one. Settling it (transcribe, save) is
   * slow and is not: the bar goes back to idle the moment the audio is in
   * hand, a new recording may start at once, and each settlement lands at the
   * caret its own recording froze, however many are in flight.
   */
  const stop = useCallback(
    async (options: {
      project?: string;
      overrides?: VoiceOverrides;
      source?: unknown;
      parentIds?: string[];
      /** What the person is writing into, so names match the page. */
      nearby?: string;
    }): Promise<{ text: string; material: Material } | undefined> => {
      const id = session.current;
      // Read the clock before the phase change resets it: this is the only
      // record of how long the recording ran, and a queued one has to be able
      // to say so later.
      const ranFor = seconds;
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
        setPhase("error");
        setError(recorded?.message ?? "Nothing was recorded.");
        return undefined;
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
        setPhase("error");
        setError("Logue did not hear anything. Check the microphone and try again.");
        return undefined;
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
          setPhase("error");
          setError("Nothing was heard in that recording. The audio was kept — you can try again.");
          return undefined;
        }
        const { material } = await host.saveVoice({
          capture_id,
          text,
          source: options.source,
          project: options.project,
          parent_ids: options.parentIds,
          applied_context,
        });
        return { text, material };
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
          setPhase("error");
          setError(
            queued
              ? "Logue is not running. The recording is kept and will be saved when it starts."
              : `Logue is not running, and ${LIMIT} recordings are already waiting. Start Logue to save them.`,
          );
          return undefined;
        }
        // A model that refused, or a Host that answered with a failure: the
        // audio is already on disk there, and the id came back with the error.
        // Remembering it is the whole difference between "try again" and
        // "say it all over again".
        if (cause instanceof HostError && cause.captureId) setKept(cause.captureId);
        setPhase("error");
        setError(
          cause instanceof HostError && cause.captureId
            ? `${describe(cause)} The recording was kept — you can try again.`
            : describe(cause),
        );
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [seconds],
  );

  /** Try the model again on the recording the Host still has. */
  const retry = useCallback(
    async (options: {
      project?: string;
      overrides?: VoiceOverrides;
      source?: unknown;
      parentIds?: string[];
      nearby?: string;
    }): Promise<{ text: string; material: Material } | undefined> => {
      const captureId = kept;
      if (!captureId) return undefined;
      const id = (session.current += 1);
      setPhase("working");
      setError(undefined);
      try {
        const { text, applied_context } = await host.transcribeKept(captureId, {
          project: options.project,
          overrides: options.overrides,
          nearby: options.nearby,
        });
        if (session.current !== id) return undefined;
        if (!text.trim()) {
          setPhase("error");
          setError("Nothing was heard in that recording. The audio is still kept.");
          return undefined;
        }
        const { material } = await host.saveVoice({
          capture_id: captureId,
          text,
          source: options.source,
          project: options.project,
          parent_ids: options.parentIds,
          applied_context,
        });
        if (session.current !== id) return undefined;
        setKept(undefined);
        setPhase("idle");
        return { text, material };
      } catch (cause) {
        if (session.current !== id) return undefined;
        setPhase("error");
        // The audio has not gone anywhere; it stays offered.
        setError(`${describe(cause)} The recording is still kept.`);
        return undefined;
      }
    },
    [kept],
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
