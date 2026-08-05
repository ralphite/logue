import { X } from "lucide-react";
import { IconButton } from "../../components/ui";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";

export function SidePanelSourceInspector() {
  const { state, dispatch } = useMockSession();
  const sourceId = state.surface.openCitationSourceId;
  const source = sourceId ? state.domain.sources[sourceId] : undefined;
  const revision = source && state.surface.openCitationRevisionId
    ? source.revisions.find((item) => item.id === state.surface.openCitationRevisionId)
    : source?.revisions.at(-1);
  if (!source || !revision) return null;
  const page = source.pageId ? state.domain.pages[source.pageId] : undefined;
  return (
    <section className="v2-context-card" aria-label="Citation source" style={{ marginBottom: 16 }}>
      <div className="v2-panel-section-heading">
        <OriginLabel origin={source.origin} detail="Source used" />
        <IconButton label="Close citation" variant="ghost" onClick={() => dispatch({ type: "close-citation" })}><X aria-hidden="true" size={15} /></IconButton>
      </div>
      <strong>{source.title}</strong>
      <p>{revision.content}</p>
      {page ? <div className="v2-library-meta">{page.url.replace("https://", "")} · saved snapshot</div> : null}
    </section>
  );
}
