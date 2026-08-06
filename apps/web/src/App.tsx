export { RealLogueV2App as App } from "./v2-real/RealLogueV2App";

// Shared sizing primitives retained for the V2 resizable inspector.
export function availableMaterialDetailWidth(viewportWidth: number, navigationFootprint: number) {
  return Math.max(440, Math.floor(viewportWidth - navigationFootprint - 560));
}

export function defaultMaterialDetailWidth(viewportWidth: number, navigationFootprint: number, maxWidth: number) {
  const workspaceWidth = Math.max(0, viewportWidth - navigationFootprint);
  return Math.min(maxWidth, Math.max(440, Math.round(workspaceWidth * 0.5)));
}
