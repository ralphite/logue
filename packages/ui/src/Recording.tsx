/**
 * A recording, with the length it really is.
 *
 * Browsers read a duration out of the file, and the files here do not carry
 * one: MediaRecorder streams as it records and never goes back to write it,
 * so every player showed `0:00` with an empty scrubber. The length is
 * measured when the recording is made and travels with the Source, so this
 * says it out loud beside the player rather than leaving the player lying.
 *
 * One component, both surfaces. The panel and the app had written their own
 * `<audio>` tags with different attributes, which is how one of them ended up
 * with `preload="none"` and the other without.
 */
export function Recording({ src, seconds, className }: { src: string; seconds?: number; className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <audio controls preload="metadata" src={src} className="h-7 min-w-0 flex-1" />
      {seconds ? (
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{clock(seconds)}</span>
      ) : null}
    </span>
  );
}

/** Seconds as a clock, the way a duration is read. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
