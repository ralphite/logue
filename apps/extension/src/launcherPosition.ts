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
const LAUNCHER_RIGHT_SPACE = 76;
const LAUNCHER_BOTTOM_SPACE = 38;

export function clampLauncherPosition(position: LauncherPosition, viewport: LauncherViewport): LauncherPosition {
  return {
    left: Math.min(Math.max(LAUNCHER_INSET, viewport.width - LAUNCHER_RIGHT_SPACE), Math.max(LAUNCHER_INSET, position.left)),
    top: Math.min(Math.max(LAUNCHER_INSET, viewport.height - LAUNCHER_BOTTOM_SPACE), Math.max(LAUNCHER_INSET, position.top)),
  };
}

export function defaultLauncherPosition(anchor: LauncherAnchor, viewport: LauncherViewport): LauncherPosition {
  return clampLauncherPosition(
    {
      left: anchor.right - 72,
      top: anchor.bottom - 34,
    },
    viewport,
  );
}
