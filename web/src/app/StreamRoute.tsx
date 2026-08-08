import { EyeOff, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Empty, ErrorNote, IconButton, Input, Menu, MenuItem, OriginMark, Spinner, originOf } from "@logue/ui";
import { api, type Material, type Project } from "../api";
import { Page, Row, RowActions, Rows } from "./AppShell";
import { timeAgo, useAction, useHost } from "./useHost";
import { MaterialPanel } from "./MaterialPanel";

function title(material: Material): string {
  const text = (material.content || "").trim().replace(/\s+/g, " ");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text || "Empty";
}

function where(material: Material): string {
  return material.source?.domain || material.source?.title || "This Mac";
}

/** Everything captured, newest first. The one page you can start from. */
export function StreamRoute() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string>();
  const materials = useHost(() => api.materials(), []);
  const projects = useHost(() => api.projects(), []);
  const action = useAction();

  const visible = useMemo(() => {
    const list = materials.data?.materials ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((m) =>
      `${m.content} ${m.transcript ?? ""} ${m.source?.title ?? ""} ${m.source?.url ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [materials.data, query]);

  const refresh = () => void materials.refresh();

  return (
    <Page
      title="Stream"
      actions={
        <span className="relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint" />
          <Input
            className="w-56 pl-6.5"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search everything you have captured"
          />
        </span>
      }
    >
      {materials.error && <ErrorNote className="mb-2">{materials.error}</ErrorNote>}
      {action.error && <ErrorNote className="mb-2">{action.error}</ErrorNote>}

      {materials.loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-muted">
          <Spinner /> Loading
        </div>
      ) : visible.length === 0 ? (
        <Empty>{query ? "Nothing matches that." : "Capture something from a page to see it here."}</Empty>
      ) : (
        <Rows>
          {visible.map((material) => (
            <Row key={material.id} onClick={() => setOpenId(material.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{title(material)}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <OriginMark origin={originOf(material.kind)} />
                  <span className="truncate">{where(material)}</span>
                  <span>{timeAgo(material.created_at)}</span>
                  {material.projects.map((name) => (
                    <span key={name} className="rounded-sm bg-surface-muted px-1 text-ink-soft">
                      {name}
                    </span>
                  ))}
                  {material.excluded && <span className="text-warning">excluded</span>}
                </span>
              </span>
              <RowActions>
                <Menu
                  label={`Actions for this ${material.kind}`}
                  trigger={(props) => (
                    <IconButton
                      label="More actions"
                      {...props}
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onClick();
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </IconButton>
                  )}
                >
                  {(projects.data?.projects ?? []).map((project: Project) => {
                    const member = material.projects.includes(project.name);
                    return (
                      <MenuItem
                        key={project.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void action.run(() => api.setMembership(material.id, project.name, !member)).then(refresh);
                        }}
                      >
                        {member ? `Remove from ${project.name}` : `Add to ${project.name}`}
                      </MenuItem>
                    );
                  })}
                  <MenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      void action
                        .run(() => api.updateMaterial(material.id, { excluded: !material.excluded }))
                        .then(refresh);
                    }}
                  >
                    <EyeOff size={13} />
                    {material.excluded ? "Include in context" : "Exclude from context"}
                  </MenuItem>
                  <MenuItem
                    tone="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      void action.run(() => api.deleteMaterial(material.id)).then(refresh);
                    }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </MenuItem>
                </Menu>
              </RowActions>
            </Row>
          ))}
        </Rows>
      )}

      {visible.length > 0 && (
        <p className="mt-3 text-[11px] text-faint">
          {visible.length} of {materials.data?.materials.length ?? 0}
        </p>
      )}

      {openId && (
        <MaterialPanel
          materialId={openId}
          onClose={() => setOpenId(undefined)}
          onChanged={refresh}
          projects={projects.data?.projects ?? []}
        />
      )}
    </Page>
  );
}

