import { PanelRightClose } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "../../components/ui";
import { Tooltip, TooltipProvider } from "../../components/Tooltip";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";
import { ProjectComposer } from "../primitives/ProjectComposer";
import { SourceBundleView } from "../primitives/SourceBundleView";
import { ProjectShell, type V2PrimaryRoute } from "./ProjectShell";

function currentText(revisions: Array<{ content: string; kind: string }>) {
  return revisions.filter((revision) => revision.kind === "adopted").at(-1)?.content ?? revisions.at(-1)?.content ?? "";
}

function ProjectSources({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { state, dispatch } = useMockSession();
  const comments = Object.values(state.domain.sources).filter((source) => source.origin === "you" && source.commentsOnSourceId && state.domain.memberships[`${projectId}:${source.id}`]?.state === "added");
  return (
    <>
      <header className="v2-inspector-header">
        <h2>Sources used</h2>
        <TooltipProvider><Tooltip content="Close sources"><IconButton label="Close sources" variant="ghost" onClick={onClose}><PanelRightClose aria-hidden="true" size={17} /></IconButton></Tooltip></TooltipProvider>
      </header>
      <div className="v2-inspector-scroll">
        <div className="v2-source-list">
          {comments.map((comment, index) => {
            const web = comment.commentsOnSourceId ? state.domain.sources[comment.commentsOnSourceId] : undefined;
            if (!web) return null;
            const active = state.surface.openCitationSourceId === web.id || state.surface.openCitationSourceId === comment.id;
            return <SourceBundleView
              key={comment.id}
              citation={index + 1}
              title={web.title}
              excerpt={currentText(web.revisions)}
              comment={currentText(comment.revisions)}
              meta="Added from this project tab"
              active={active}
              onSelect={() => dispatch({ type: "open-citation", sourceId: web.id })}
              onOpenSnapshot={() => dispatch({ type: "open-citation", sourceId: web.id })}
            />;
          })}
        </div>
      </div>
    </>
  );
}

export function ProjectWorkspace({ onRouteChange, onProjectChange }: { onRouteChange: (route: V2PrimaryRoute) => void; onProjectChange: (projectId: string) => void }) {
  const { state, dispatch } = useMockSession();
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth >= 980);
  const [request, setRequest] = useState("");
  const projectId = state.domain.tabs[state.surface.activeTabId]?.activeProjectId ?? "project-a";
  const project = state.domain.projects[projectId];
  const document = Object.values(state.domain.documents).find((item) => item.projectId === projectId);
  const revision = document ? state.domain.documentRevisions[document.revisionIds.at(-1) ?? ""] : undefined;
  const adopted = Object.values(state.domain.sources).find((source) => source.origin === "ai" && state.domain.memberships[`${projectId}:${source.id}`]?.state === "added");
  const documentText = adopted ? currentText(adopted.revisions) : revision?.content ?? "";
  const projects = Object.values(state.domain.projects).map(({ id, name }) => ({ id, name }));
  const activeCandidate = state.surface.activeCandidateId ? state.domain.candidates[state.surface.activeCandidateId] : undefined;
  const citations = useMemo(() => {
    if (!documentText) return [];
    const ids = activeCandidate?.citations.map((citation) => citation.sourceId) ?? revision?.sourceIds ?? [];
    return ids.filter((id) => state.domain.sources[id]).slice(0, 2);
  }, [activeCandidate?.citations, documentText, revision?.sourceIds, state.domain.sources]);
  const projectSourceCount = Object.values(state.domain.memberships).filter((membership) => membership.projectId === projectId && membership.state === "added").length;

  return (
    <ProjectShell
      route="projects"
      projectName={project.name}
      projects={projects}
      activeProjectId={project.id}
      onRouteChange={onRouteChange}
      onProjectChange={onProjectChange}
      inspectorOpen={inspectorOpen}
      onInspectorOpenChange={setInspectorOpen}
      inspector={<ProjectSources projectId={projectId} onClose={() => setInspectorOpen(false)} />}
    >
      <div className="v2-editor-scroll">
        <article className="v2-editor-axis" aria-label="Project document">
          <div className="v2-page-heading-copy">
            <div className="v2-editor-eyebrow">Document</div>
            <h1 className="v2-editor-title">{document?.title ?? `${project.name} brief`}</h1>
          </div>
          <p className="v2-project-goal">{project.goal}</p>
          <div className="v2-editor-body" contentEditable suppressContentEditableWarning aria-label="Document content">
            {documentText ? <div className="v2-editor-block">
              <h2>Recommendation</h2>
              <p>
                {documentText}
                {citations.map((sourceId, index) => <button key={sourceId} className="v2-citation" aria-label={`Open source ${index + 1}`} aria-pressed={state.surface.openCitationSourceId === sourceId} onClick={() => dispatch({ type: "open-citation", sourceId })}>{index + 1}</button>)}
              </p>
            </div> : <p className="v2-document-placeholder">Start writing, or ask Logue to draft from this project's sources.</p>}
          </div>
          <div className="v2-context-summary">
            <span>{projectSourceCount} project sources · {citations.length ? `${citations.length} citations in this revision` : "no draft yet"}</span>
            <button className="v2-source-excerpt-toggle" type="button" onClick={() => setInspectorOpen(true)}>Review context</button>
          </div>
        </article>
      </div>
      <div className="v2-composer-wrap">
        <ProjectComposer value={request} onChange={setRequest} onSubmit={() => setRequest("")} placeholder="Ask or draft with Mobile research" />
      </div>
    </ProjectShell>
  );
}
