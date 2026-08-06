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
const DEFAULT_CONTROL_WIDTH = 220;
const DEFAULT_CONTROL_HEIGHT = 44;

export const inlineVoiceControlMetrics = {
  idle: { width: 220, height: 44 },
  error: { width: 220, height: 44 },
  starting: { width: 214, height: 44 },
  processing: { width: 214, height: 44 },
  recording: { width: 286, height: 44 },
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
