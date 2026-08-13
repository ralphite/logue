import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ActivitiesList } from "./ActivitiesPage";
import { MaterialPanel } from "./MaterialPanel";
import { useHost } from "./useHost";

/**
 * Three panes, one screen: the list of everything done, and the one thing
 * being looked at, side by side.
 *
 * There is no second page to click into and no overlay to dismiss — the
 * owner's ruling after two rounds of mockups: "三栏结构更简洁". Opening a
 * row only changes the right-hand pane; the list never loses its place.
 */
export function StreamRoute({
  openId,
  onOpen,
  onOpenDocument,
  onVisibleOrder,
}: {
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onOpenDocument?: (id: string) => void;
  /** The rows on screen, for ⌥⌘↑/↓ to step through. */
  onVisibleOrder?: (ids: string[]) => void;
}) {
  const [changed, setChanged] = useState(0);
  const materials = useHost(() => api.materials(), [changed]);
  const projects = useHost(() => api.projects(), []);

  const items = useMemo(() => materials.data?.materials ?? [], [materials.data]);
  useEffect(() => {
    onVisibleOrder?.(items.map((one) => one.id));
  }, [items, onVisibleOrder]);
  // Nothing chosen means the newest thing: a detail pane that opens empty
  // beside a full list is a pane whose whole message is "pick from the list".
  const selectedId = openId && items.some((one) => one.id === openId) ? openId : items[0]?.id;

  return (
    <div className="flex min-h-0 flex-1">
      <ActivitiesList
        items={items}
        loading={materials.loading}
        error={materials.error}
        selectedId={selectedId}
        onSelect={(id) => onOpen(id)}
      />
      {selectedId ? (
        <MaterialPanel
          key={`${selectedId}:${changed}`}
          materialId={selectedId}
          onChanged={() => setChanged((n) => n + 1)}
          projects={projects.data?.projects ?? []}
          onOpenDocument={onOpenDocument}
          onOpenMaterial={(id) => onOpen(id)}
        />
      ) : (
        <section className="flex min-w-0 flex-1 items-center justify-center bg-surface">
          {!materials.loading && (
            <p className="text-[12.5px] text-muted">Nothing captured yet — speak into the side panel to start.</p>
          )}
        </section>
      )}
    </div>
  );
}
