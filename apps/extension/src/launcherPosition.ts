export interface LauncherPosition {
  left: number;
  top: number;
}

export interface LauncherViewport {
  height: number;
  width: number;
}

interface LauncherAnchor {
  bottom: number;
  right: number;
}

const LAUNCHER_INSET = 8;
const DEFAULT_CONTROL_WIDTH = 46;
const DEFAULT_CONTROL_HEIGHT = 46;

export const inlineVoiceControlMetrics = {
  idle: { width: 46, height: 46 },
  error: { width: 46, height: 46 },
  starting: { width: 86, height: 46 },
  processing: { width: 86, height: 46 },
  recording: { width: 126, height: 46 },
} as const;

const ERROR_ESTIMATED_HEIGHT = 84;
const ERROR_MAX_WIDTH = 220;

export function launcherErrorPlacement(position: LauncherPosition, controlWidth: number) {
  return {
    vertical: position.top >= ERROR_ESTIMATED_HEIGHT + LAUNCHER_INSET ? "above" : "below",
    horizontal: position.left + controlWidth < LAUNCHER_INSET + ERROR_MAX_WIDTH ? "left" : "right",
  } as const;
}

export function clampLauncherPosition(
  position: LauncherPosition,
  viewport: LauncherViewport,
  controlWidth = DEFAULT_CONTROL_WIDTH,
  controlHeight = DEFAULT_CONTROL_HEIGHT,
): LauncherPosition {
  return {
    left: Math.min(Math.max(LAUNCHER_INSET, viewport.width - controlWidth), Math.max(LAUNCHER_INSET, position.left)),
    top: Math.min(Math.max(LAUNCHER_INSET, viewport.height - controlHeight), Math.max(LAUNCHER_INSET, position.top)),
  };
}

export function defaultLauncherPosition(
  anchor: LauncherAnchor,
  viewport: LauncherViewport,
  controlWidth = DEFAULT_CONTROL_WIDTH,
  controlHeight = DEFAULT_CONTROL_HEIGHT,
): LauncherPosition {
  return clampLauncherPosition(
    {
      left: anchor.right - controlWidth + 4,
      top: anchor.bottom - controlHeight + 4,
    },
    viewport,
    controlWidth,
    controlHeight,
  );
}
