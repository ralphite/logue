import { useState } from "react";
import { api } from "../api";
import { Nothing } from "./AppShell";
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

  if (!openId) return <Nothing section="Stream" hint="Pick something from the list to see where it came from." />;

  return (
    <MaterialPanel
      key={`${openId}:${changed}`}
      materialId={openId}
      onClose={() => onOpen(undefined)}
      onChanged={() => setChanged((n) => n + 1)}
      projects={projects.data?.projects ?? []}
      onOpenDocument={onOpenDocument}
    />
  );
}
