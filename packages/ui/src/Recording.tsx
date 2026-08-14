import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * A recording: play, a waveform to scrub, and one time.
 *
 * The browser's own `<audio controls>` was two problems. It is built for a
 * page, not a 360-pixel panel — it took the whole row and left no space for
 * anything beside it. And it insisted on printing a duration it did not have:
 * MediaRecorder streams as it records and never goes back to write the length
 * into the file, so the native control read `0:00` while the real length was
 * printed again next to it. Two clocks, one of them wrong.
 *
 * So: the length that travels with the Source is the only length shown, and
 * the readout says the total at rest and the position while playing — one
 * number, always. The bars are drawn from the recording's own id, so a
 * recording looks like itself every time it is shown; they are a scrubber and
 * a progress bar, not a rendering of the audio, which cannot be had without
 * downloading and decoding every recording in the list.
 */
export function Recording({
  src,
  seconds,
  className,
  /** Anything stable about this recording; the bars are drawn from it. */
  shape,
}: {
  src: string;
  seconds?: number;
  className?: string;
  shape?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);

  // The element is the truth about playback — it ends, it stalls, it is paused
  // from the keyboard — so the button follows it rather than the other way.
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const sync = () => {
      setPlaying(!element.paused && !element.ended);
      const length = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : (seconds ?? 0);
      setAt(length ? Math.min(1, element.currentTime / length) : 0);
    };
    const done = () => {
      setPlaying(false);
      setAt(0);
    };
    element.addEventListener("timeupdate", sync);
    element.addEventListener("play", sync);
    element.addEventListener("pause", sync);
    element.addEventListener("ended", done);
    return () => {
      element.removeEventListener("timeupdate", sync);
      element.removeEventListener("play", sync);
      element.removeEventListener("pause", sync);
      element.removeEventListener("ended", done);
    };
  }, [seconds]);

  const bars = heights(shape ?? src, seconds);
  const played = Math.round(at * bars.length);
  const length = seconds ?? 0;
  const showing = playing && length ? Math.round(at * length) : length;

  const seek = (fraction: number) => {
    const element = audio.current;
    if (!element) return;
    const known = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : length;
    if (!known) return;
    element.currentTime = Math.max(0, Math.min(known, fraction * known));
    setAt(fraction);
  };

  return (
    <span className={cn("flex h-control min-w-0 items-center gap-2", className)}>
      <audio ref={audio} preload="metadata" src={src} className="hidden" />
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          const element = audio.current;
          if (!element) return;
          if (element.paused) void element.play();
          else element.pause();
        }}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft hover:bg-surface-muted hover:text-ink"
      >
        {playing ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
      </button>
      {/*
        A scrubber, so it is a slider rather than a picture. Clicking anywhere
        on it plays from there, which is the one thing a bar like this is for.
      */}
      <span
        role="slider"
        tabIndex={0}
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(at * 100)}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          seek((event.clientX - box.left) / box.width);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") seek(Math.min(1, at + 0.05));
          if (event.key === "ArrowLeft") seek(Math.max(0, at - 0.05));
        }}
        className="flex h-5 min-w-0 flex-1 cursor-pointer items-center"
      >
        {/*
          One path per state rather than one element per bar: forty spans in
          every row of a list is a lot of DOM for a progress bar, and their
          only identity is where they sit.
        */}
        <svg viewBox={`0 0 ${bars.length * 4} 20`} preserveAspectRatio="none" className="h-5 w-full">
          {/* `non-scaling-stroke`: the viewBox is stretched to whatever width
              the row happens to be, and without this the bars stretch with it —
              at panel width they are bars, on a wide screen they were blocks. */}
          <path
            d={strokes(bars, 0, played)}
            className="stroke-accent"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={strokes(bars, played, bars.length)}
            className="stroke-faint"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      {length ? (
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{clock(showing)}</span>
      ) : null}
    </span>
  );
}

/** A run of bars as one path: each is a vertical stroke, centred on the line. */
function strokes(bars: number[], from: number, to: number): string {
  return bars
    .slice(from, to)
    .map((height, index) => {
      const x = (from + index) * 4 + 2;
      return `M${x} ${10 - height / 2}V${10 + height / 2}`;
    })
    .join("");
}

/** Seconds as a clock, the way a duration is read. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Bar heights, the same every time for the same recording.
 *
 * Drawn from the id rather than from the audio: reading the samples means
 * fetching and decoding every recording a list shows, which is a download per
 * row for a decoration. What this has to be is stable — a recording that
 * looked different each time it was rendered would read as a different
 * recording.
 */
/**
 * The bars, and how many of them.
 *
 * The count follows the length, so a thought and a ten-minute meeting do not
 * draw the same picture: forty bars either way said the two were the same
 * size. Logarithmic, because the difference between 5 seconds and a minute
 * matters more than between eight minutes and nine — and bounded, because a
 * scrubber needs something to aim at either way.
 */
function heights(seed: string, seconds = 0): number[] {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  }
  const next = () => {
    value = (Math.imul(value, 1103515245) + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
  const count = Math.min(64, Math.max(16, Math.round(16 + 12 * Math.log10(1 + Math.max(0, seconds)))));
  return Array.from({ length: count }, () => 4 + Math.round(next() * 14));
}
