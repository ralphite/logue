import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const durationProbeTime = 1e101;

export function knownAudioDuration(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function formatAudioDuration(value: number) {
  const wholeSeconds = Math.max(1, Math.ceil(value));
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * MediaRecorder WebM files can expose Infinity or 0 until the browser seeks once.
 * Probing the end makes Chromium calculate the real seekable duration without
 * starting playback; a subsequent durationchange/timeupdate restores position 0.
 */
export function probeAudioDuration(audio: HTMLAudioElement) {
  if (knownAudioDuration(audio.duration)) return false;
  try {
    audio.currentTime = durationProbeTime;
    return true;
  } catch {
    return false;
  }
}

export function RecordingAudioPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const probingDurationRef = useRef(false);
  const [duration, setDuration] = useState<number>();
  const [durationUnavailable, setDurationUnavailable] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setDuration(undefined);
    setDurationUnavailable(false);
    setPlaying(false);
    probingDurationRef.current = false;
    const timer = window.setTimeout(() => setDurationUnavailable(true), 3000);
    return () => window.clearTimeout(timer);
  }, [src]);

  function acceptKnownDuration(audio: HTMLAudioElement) {
    if (!knownAudioDuration(audio.duration)) return false;
    setDuration(audio.duration);
    setDurationUnavailable(false);
    if (probingDurationRef.current || audio.currentTime >= audio.duration) {
      probingDurationRef.current = false;
      audio.currentTime = 0;
    }
    return true;
  }

  function handleMetadata(audio: HTMLAudioElement) {
    if (!acceptKnownDuration(audio)) {
      probingDurationRef.current = true;
      if (!probeAudioDuration(audio)) {
        probingDurationRef.current = false;
        setDurationUnavailable(true);
      }
    }
  }

  function toggleFallbackPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setDurationUnavailable(true));
    } else {
      audio.pause();
    }
  }

  const ready = duration !== undefined;

  return (
    <div className="mt-3" data-testid="recording-audio-player">
      <audio
        ref={audioRef}
        data-testid="recording-audio"
        controls={ready}
        preload="metadata"
        src={src}
        className={ready ? "h-9 w-full" : "sr-only"}
        aria-label={label}
        onLoadedMetadata={(event) => handleMetadata(event.currentTarget)}
        onDurationChange={(event) => acceptKnownDuration(event.currentTarget)}
        onTimeUpdate={(event) => acceptKnownDuration(event.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setDurationUnavailable(true)}
      />
      {ready ? (
        <p className="sr-only" aria-label={`录音时长 ${formatAudioDuration(duration)}`}>
          {formatAudioDuration(duration)}
        </p>
      ) : (
        <div className="flex h-11 items-center gap-3 rounded-full bg-[#f0f0f0] px-3 text-[#666762]">
          <button
            type="button"
            onClick={toggleFallbackPlayback}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#242522] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#5b64f4]"
            aria-label={playing ? "暂停录音" : "播放录音"}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <span className="text-[10.5px]" role="status">
            {durationUnavailable ? "录音时长暂不可用" : "正在读取录音时长…"}
          </span>
        </div>
      )}
    </div>
  );
}
