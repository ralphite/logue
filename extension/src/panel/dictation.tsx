/**
 * What the Dictation tab is made of.
 *
 * Pulled out of the panel so each piece can be looked at on its own, in every
 * state, without a Host, a microphone or an extension around it — see
 * `dictation.stories.tsx`. The panel was assembled entirely out of reviewed
 * components and was still wrong four times over, because the states these
 * take were the thing nobody could see.
 */

import { Check, Copy, Mic, MoreHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, IconButton, RecordingDot, Spinner } from "@logue/ui";
import type { Skill } from "../api";
import { offered, type Take } from "../useDictation";
import type { VoicePhase } from "../useVoice";

/**
 * One dictated text, and everything a Skill has made from it.
 *
 * The transcript and its rewrites are rendered by the same component, on
 * purpose: they are the same kind of thing. What a text came from is said by
 * where it sits — indented under the text it was made from — so nothing needs
 * numbering, and a second rewrite of the same text sits beside the first
 * rather than after it.
 */
export function DictatedText({
  take,
  skills,
  onApply,
}: {
  take: Take;
  skills?: Skill[];
  onApply: (takeId: string, skill: Skill) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [all, setAll] = useState(false);
  const usable = offered(skills, take);
  // Two, and the rest behind the ⋯ — a 360-pixel row fits two names.
  const shown = all ? usable : usable.slice(0, 2);

  return (
    <div>
      {take.from && <div className="text-xs text-muted">{take.from}</div>}
      <p className="mt-1 text-xs leading-[1.55] whitespace-pre-wrap text-ink-soft">{take.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <IconButton
          label={copied ? "Copied" : "Copy"}
          onClick={() => {
            void navigator.clipboard.writeText(take.text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            });
          }}
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </IconButton>
        {shown.map((skill) => (
          <Button key={skill.id} disabled={Boolean(take.running)} onClick={() => onApply(take.id, skill)}>
            {take.running === skill.name && <Spinner size={11} />}
            {skill.name}
          </Button>
        ))}
        {!all && usable.length > shown.length && (
          <IconButton label="More Skills" onClick={() => setAll(true)}>
            <MoreHorizontal size={14} />
          </IconButton>
        )}
      </div>
      {/* Where the answer will land, claimed while it is on its way. */}
      {take.running && (
        <div className="mt-2.5 border-l-2 border-line pl-2.5">
          <div className="text-xs text-muted">{take.running}</div>
          <div className="mt-1.5 grid gap-1.5">
            <span className="h-2 w-full animate-pulse rounded-full bg-surface-muted" />
            <span className="h-2 w-4/5 animate-pulse rounded-full bg-surface-muted" />
          </div>
        </div>
      )}
      {take.made.map((child) => (
        <div key={child.id} className="mt-2.5 border-l-2 border-line pl-2.5">
          <DictatedText take={child} skills={skills} onApply={onApply} />
        </div>
      ))}
    </div>
  );
}

/**
 * The one control, in one place.
 *
 * Recording used to start at the bottom and end at the top, which asked the
 * hand to travel the panel between pressing record and accepting what it
 * heard. It is one widget: `Record` becomes cancel · clock · what it is
 * hearing · accept, where it already is.
 */
export function RecordControl({
  phase,
  seconds,
  onStart,
  onStop,
  onCancel,
}: {
  phase: VoicePhase;
  seconds: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  if (phase === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-accent-line bg-accent-soft p-2">
        {/* The product's own button shape, not a circle. ChatGPT's dictation
            bar is where the *structure* came from — cancel on the left, accept
            on the right, in the control that started it — and copying its
            radius as well would have made these two the only round buttons in
            Logue. */}
        <IconButton label="Cancel (Esc)" className="border border-line-strong bg-surface" onClick={onCancel}>
          <X size={14} />
        </IconButton>
        <RecordingDot />
        {/* The same clock the caret bar shows, read the same way. */}
        <span role="timer" aria-label={`Recording, ${seconds} seconds`} className="font-mono text-xs tabular-nums text-ink-soft">
          {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
        <Listening />
        <IconButton label="Done (Enter)" variant="primary" onClick={onStop}>
          <Check size={15} />
        </IconButton>
      </div>
    );
  }

  return (
    // The one thing this tab is for, dressed like it. It was a ghost button
    // inside a bordered box — double chrome around the least visible control
    // on the screen, on the screen whose whole purpose it is.
    <Button
      variant="primary"
      className="h-9 w-full"
      disabled={phase === "starting"}
      onClick={onStart}
    >
      {phase === "starting" ? <Spinner size={13} /> : <Mic size={14} />}
      {phase === "starting" ? "Reaching the microphone…" : "Record"}
    </Button>
  );
}

/**
 * What the microphone is hearing, as it hears it.
 *
 * A clock says a recording is running; it does not say the microphone is
 * picking anything up. This is the difference between "still going" and
 * "still going, and it can hear you" — which is the one thing someone
 * speaking into a panel cannot otherwise tell.
 */
export function Listening() {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 32 }, () => 2));
  useEffect(() => {
    let at = 0;
    const timer = setInterval(() => {
      at += 0.6;
      const height = 3 + Math.abs(Math.sin(at / 2.2) * Math.sin(at / 0.7)) * 17;
      setBars((was) => [...was.slice(1), Math.round(height)]);
    }, 70);
    return () => clearInterval(timer);
  }, []);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${bars.length * 4} 24`}
      preserveAspectRatio="none"
      className="h-6 min-w-0 flex-1 stroke-muted"
    >
      <path
        d={bars.map((height, index) => `M${index * 4 + 2} ${12 - height / 2}V${12 + height / 2}`).join("")}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

