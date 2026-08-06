import { LandingPage } from "./v2-mock/landing/LandingPage";
import { RealLogueV2App } from "./v2-real/RealLogueV2App";

function isPublicLanding() {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "logue.ai" ||
    hostname === "www.logue.ai" ||
    new URLSearchParams(window.location.search).get("view") === "landing"
  );
}

export function App() {
  return isPublicLanding() ? <LandingPage /> : <RealLogueV2App />;
}

// Shared sizing primitives retained for the V2 resizable inspector.
export function availableMaterialDetailWidth(viewportWidth: number, navigationFootprint: number) {
  return Math.max(440, Math.floor(viewportWidth - navigationFootprint - 560));
}

export function defaultMaterialDetailWidth(viewportWidth: number, navigationFootprint: number, maxWidth: number) {
  const workspaceWidth = Math.max(0, viewportWidth - navigationFootprint);
  return Math.min(maxWidth, Math.max(440, Math.round(workspaceWidth * 0.5)));
}
