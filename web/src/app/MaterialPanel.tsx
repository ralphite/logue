import { ExternalLink, X } from "lucide-react";
import { Button, ErrorNote, IconButton, OriginMark, Spinner } from "@logue/ui";
import { api, type Material, type Project } from "../api";
import { timeAgo, useAction, useHost } from "./useHost";

const ORIGIN = { voice: "you", selection: "web", page: "web", text: "you", derived: "ai" } as const;

/**
 * One Source, and the chain it belongs to. This panel is where the product's
 * promise is inspectable: what the page said, what you added, and what came out.
 */
export function MaterialPanel({
  materialId,
  onClose,
  onChanged,
  projects,
}: {
  materialId: string;
  onClose: () => void;
  onChanged: () => void;
  projects: Project[];
}) {
  const lineage = useHost(() => api.lineage(materialId), [materialId]);
  const action = useAction();
  const material = lineage.data?.material;

  return (
    <aside className="fixed inset-y-0 right-0 z-popover flex w-[380px] flex-col border-l border-line bg-panel shadow-[-9px_0_24px_rgb(15_15_15/6%)]">
      <header className="flex h-row shrink-0 items-center justify-between gap-2 border-b border-line px-2">
        <span className="truncate text-xs text-muted">{material ? material.kind : "Source"}</span>
        <IconButton label="Close" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>

      <div className="logue-scroll flex-1 p-3">
        {lineage.error && <ErrorNote>{lineage.error}</ErrorNote>}
        {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}
        {!material ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner /> Loading
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <OriginMark origin={ORIGIN[material.kind]} detail={timeAgo(material.created_at)} />
              <p className="text-[13px] leading-[1.55] whitespace-pre-wrap text-ink">{material.content}</p>
            </div>

            {material.source?.url && (
              <a
                href={material.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <ExternalLink size={12} />
                <span className="truncate">{material.source.title || material.source.url}</span>
              </a>
            )}

            {material.capture_id && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={api.audioUrl(material.capture_id)} className="h-8 w-full" />
            )}

            <Lineage title="Came from" items={lineage.data?.parents ?? []} />
            <Lineage title="Led to" items={lineage.data?.children ?? []} />

            <div className="grid gap-1.5 border-t border-line pt-3">
              <span className="text-xs text-muted">Projects</span>
              <div className="flex flex-wrap gap-1">
                {projects.map((project) => {
                  const member = material.projects.includes(project.name);
                  return (
                    <Button
                      key={project.id}
                      variant={member ? "primary" : "default"}
                      disabled={action.busy}
                      onClick={() =>
                        void action
                          .run(() => api.setMembership(material.id, project.name, !member))
                          .then((ok) => ok && (lineage.refresh(), onChanged()))
                      }
                    >
                      {project.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Lineage({ title, items }: { title: string; items: Material[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-1 border-t border-line pt-3">
      <span className="text-xs text-muted">{title}</span>
      {items.map((item) => (
        <div key={item.id} className="rounded-md bg-surface-muted px-2 py-1.5">
          <OriginMark origin={ORIGIN[item.kind]} />
          <p className="mt-0.5 line-clamp-2 text-xs leading-[1.45] text-ink-soft">{item.content}</p>
        </div>
      ))}
    </div>
  );
}
