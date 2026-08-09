import { useCallback, useRef, useState } from "react";
import { host, HostError, type Material } from "./api";
import { send } from "./messages";
import { keep, LIMIT } from "./pending";
import type { VoiceOverrides } from "./overrides";

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
  const session = useRef(0);

  const start = useCallback(async () => {
    const id = (session.current += 1);
    setError(undefined);
    setPhase("starting");
    const result = await send<{ ok: boolean; message?: string }>({
      type: "logue:record-start",
      sessionId: String(id),
    });
    if (session.current !== id) return;
    if (!result?.ok) {
      setPhase("error");
      setError(result?.message ?? "Could not reach the microphone.");
      return;
    }
    setPhase("recording");
  }, []);

  const cancel = useCallback(() => {
    session.current += 1;
    void send({ type: "logue:record-cancel", sessionId: String(session.current) });
    setPhase("idle");
    setError(undefined);
  }, []);

  /** Stops, transcribes, and saves. Returns the Material, or undefined on failure. */
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
      setPhase("working");
      const recorded = await send<{ ok: boolean; audio?: string; mediaType?: string; message?: string }>({
        type: "logue:record-stop",
        sessionId: String(id),
      });
      if (session.current !== id) return undefined;
      if (!recorded?.ok || !recorded.audio) {
        setPhase("error");
        setError(recorded?.message ?? "Nothing was recorded.");
        return undefined;
      }

      try {
        const { capture_id, text, applied_context } = await host.transcribe({
          audio: recorded.audio,
          media_type: recorded.mediaType ?? "audio/webm",
          project: options.project,
          overrides: options.overrides,
          nearby: options.nearby,
        });
        if (!text.trim()) {
          // The Host kept the audio; only the words are missing. Say which,
          // rather than letting an empty Source fail on the way in.
          setPhase("error");
          setError("Nothing was heard in that recording. The audio was kept.");
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
        if (session.current !== id) return undefined;
        setPhase("idle");
        return { text, material };
      } catch (cause) {
        if (session.current !== id) return undefined;
        // The Host is not answering, so nothing has the audio but this page —
        // and this page is about to forget it. Keep it, and say it is kept.
        // A model that refused is different: the Host already has the audio.
        if (cause instanceof HostError && cause.status === 0) {
          const kept = await keep({
            audio: recorded.audio,
            mediaType: recorded.mediaType ?? "audio/webm",
            project: options.project,
            overrides: options.overrides,
            source: options.source,
            parentIds: options.parentIds,
            nearby: options.nearby,
          });
          setPhase("error");
          setError(
            kept
              ? "Logue is not running. The recording is kept and will be saved when it starts."
              : `Logue is not running, and ${LIMIT} recordings are already waiting. Start Logue to save them.`,
          );
          return undefined;
        }
        setPhase("error");
        setError(describe(cause));
        return undefined;
      }
    },
    [],
  );

  return { phase, error, start, stop, cancel, setError, setPhase };
}
