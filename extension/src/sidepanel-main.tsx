/**
 * The extension page's entry, and nothing else.
 *
 * `createRoot` used to live at the bottom of sidepanel.tsx, which made the
 * whole panel unimportable: anything that touched any component in that file —
 * a story, a test — mounted the entire panel into whatever document it was in.
 * The component is the export; mounting is this file's job.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Panel } from "./sidepanel";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
