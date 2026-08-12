import { useState } from "react";
import { api } from "../api";
import { InboxPage } from "./InboxPage";
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

  // Nothing open means the Inbox itself: the queue to file, then everything.
  // There used to be a second rail carrying the list and a pane whose whole
  // message was "pick from the list" — two columns to say nothing.
  if (!openId) return <InboxPage onOpen={onOpen} />;

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
