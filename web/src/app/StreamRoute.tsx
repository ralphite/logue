import { useState } from "react";
import { api } from "../api";
import { ActivitiesPage } from "./ActivitiesPage";
import { MaterialPanel } from "./MaterialPanel";
import { useHost } from "./useHost";

/**
 * One Source, full width.
 *
 * The list moved to the rail, so this is not a drawer squeezed beside a page
 * any more — it is the page.
 */
export function StreamRoute({
  openId,
  onOpen,
  onOpenDocument,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOpenDocument?: (id: string) => void;
}) {
  const projects = useHost(() => api.projects(), []);
  const [changed, setChanged] = useState(0);

  // Nothing open means the activity list itself. There used to be a second
  // rail carrying the same list beside a pane whose whole message was "pick
  // from the list" — two columns to say nothing.
  if (!openId) return <ActivitiesPage onOpen={onOpen} />;

  return (
    <MaterialPanel
      key={`${openId}:${changed}`}
      materialId={openId}
      onClose={() => onOpen(undefined)}
      onChanged={() => setChanged((n) => n + 1)}
      projects={projects.data?.projects ?? []}
      onOpenDocument={onOpenDocument}
      onOpenMaterial={(id) => onOpen(id)}
    />
  );
}
