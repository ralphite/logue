import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  formatAudioDuration,
  knownAudioDuration,
  RecordingAudioPlayer,
} from "../components/RecordingAudioPlayer";

describe("RecordingAudioPlayer", () => {
  it("probes a WebM with unknown metadata and reveals native controls at the real duration", () => {
    render(<RecordingAudioPlayer src="/v1/captures/cap_one" label="播放原始录音" />);
    const audio = screen.getByTestId("recording-audio") as HTMLAudioElement;

    Object.defineProperty(audio, "duration", { configurable: true, value: 0 });
    expect(audio.controls).toBe(false);
    expect(screen.getByText("正在读取录音时长…")).toBeTruthy();

    fireEvent.loadedMetadata(audio);
    expect(audio.currentTime).toBe(1e101);

    Object.defineProperty(audio, "duration", { configurable: true, value: 4.2 });
    fireEvent.durationChange(audio);

    expect(audio.controls).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(screen.getByLabelText("录音时长 0:05")).toBeTruthy();
  });

  it("does not present an unknown duration as zero", () => {
    render(<RecordingAudioPlayer src="/v1/captures/cap_broken" label="播放原始录音" />);
    const audio = screen.getByTestId("recording-audio");

    fireEvent.error(audio);

    expect(screen.getByText("录音时长暂不可用")).toBeTruthy();
    expect(screen.queryByText("0:00")).toBeNull();
  });

  it("recovers an infinite WebM duration before the user starts playback", () => {
    render(<RecordingAudioPlayer src="/v1/captures/cap_infinite" label="播放原始录音" />);
    const audio = screen.getByTestId("recording-audio") as HTMLAudioElement;

    Object.defineProperty(audio, "duration", { configurable: true, value: Number.POSITIVE_INFINITY });
    expect(audio.paused).toBe(true);
    fireEvent.loadedMetadata(audio);
    expect(audio.currentTime).toBe(1e101);

    Object.defineProperty(audio, "duration", { configurable: true, value: 7 });
    fireEvent.timeUpdate(audio);

    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.controls).toBe(true);
    expect(screen.getByLabelText("录音时长 0:07")).toBeTruthy();
  });

  it("formats short and long durations without rounding positive audio to 0:00", () => {
    expect(knownAudioDuration(Number.POSITIVE_INFINITY)).toBe(false);
    expect(knownAudioDuration(0)).toBe(false);
    expect(knownAudioDuration(0.2)).toBe(true);
    expect(formatAudioDuration(0.2)).toBe("0:01");
    expect(formatAudioDuration(65.1)).toBe("1:06");
  });
});
