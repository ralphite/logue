import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../../components/ui";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "./ProjectShell";

function latest(source: { revisions: Array<{ content: string }> }) {
  return source.revisions.at(-1)?.content ?? "";
}

export function LibraryView({ onRouteChange, initialView = "saved", initialSourceId, initialCandidateId }: { onRouteChange: (route: V2PrimaryRoute) => void; initialView?: "saved" | "activity"; initialSourceId?: string; initialCandidateId?: string }) {
  const { state, dispatch } = useMockSession();
  const [view, setView] = useState<"saved" | "activity">(initialView);
  const [query, setQuery] = useState("");
  const [openSourceId, setOpenSourceId] = useState<string | null>(initialSourceId ?? null);
  const openSource = openSourceId ? state.domain.sources[openSourceId] : undefined;
  const openMembership = openSource ? Object.values(state.domain.memberships).find((item) => item.sourceId === openSource.id && item.projectId === "project-a") : undefined;
  const openActivity = openSource ? Object.values(state.domain.activities).find((item) => item.sourceId === openSource.id) : undefined;
  const activityRuns = openActivity ? Object.values(state.domain.runs).filter((run) => run.activityId === openActivity.id) : [];
  const restoredCandidate = state.surface.activeCandidateId ? state.domain.candidates[state.surface.activeCandidateId] : undefined;
  const openCandidate = initialCandidateId ? state.domain.candidates[initialCandidateId] : undefined;
  const openRun = openCandidate ? state.domain.runs[openCandidate.runId] : undefined;
  const sources = Object.values(state.domain.sources)
    .filter((source) => source.status === view)
    .filter((source) => `${source.title} ${latest(source)}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <ProjectShell route="library" onRouteChange={onRouteChange}>
      <div className="v2-editor-scroll">
        <div className="v2-list-axis">
          <div className="v2-page-heading">
            <div className="v2-page-heading-copy"><h1>Library</h1><p>Every saved source stays private on this Host until you delete it.</p></div>
          </div>
          <div className="v2-segmented" role="tablist" aria-label="Library content">
            <button role="tab" aria-selected={view === "saved"} className={view === "saved" ? "is-active" : ""} onClick={() => { setView("saved"); setOpenSourceId(null); }}>Saved content</button>
            <button role="tab" aria-selected={view === "activity"} className={view === "activity" ? "is-active" : ""} onClick={() => { setView("activity"); setOpenSourceId(null); }}>All activity</button>
          </div>
          <div className="v2-filter-row" style={{ marginTop: 18 }}>
            <label className="v2-search-field"><Search aria-hidden="true" size={17} /><span className="sr-only">Find saved content</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by words, project, site, or topic" /></label>
            <IconButton label="Filter library" variant="secondary"><SlidersHorizontal aria-hidden="true" size={16} /></IconButton>
          </div>
          {openSource ? <section className="v2-recovery-card" aria-label="Source detail" style={{ marginTop: 18 }}>
            <div className="v2-panel-section-heading"><div><OriginLabel origin={openSource.origin} detail={openSource.title} /><h2 style={{ margin: "7px 0 0" }}>{openSource.title}</h2></div><Button size="sm" onClick={() => setOpenSourceId(null)}>Close</Button></div>
            {openSource.audio ? <p>Original audio · {openSource.audio.durationSeconds}s · kept on this Host</p> : null}
            <div className="v2-review-list">{openSource.revisions.map((revision, index) => <article className="v2-review-row" key={revision.id}><div><strong>{revision.kind === "raw" ? "Raw transcript" : revision.kind === "candidate" ? `Transcript version ${index}` : "Adopted text"}</strong><p>{revision.content}</p>{revision.transcriptionProfileId ? <div className="v2-library-meta">{revision.transcriptionProfileId === "project-a" ? "Mobile research profile" : revision.transcriptionProfileId === "one-shot" ? "One-time topic vocabulary" : "Global voice profile"}</div> : null}</div></article>)}</div>
            {openSource.status === "saved" ? <div className="v2-setting-row"><div><strong>Mobile research</strong><p>{openMembership?.state === "added" ? "Included in Project Context" : openMembership?.state === "suggested" ? "Suggested only; not in Project Context" : openMembership?.state === "excluded" ? "Excluded; automatic classification will not re-add it" : openMembership?.state === "removed" ? "Removed from Project Context" : "Saved only"}</p></div><div className="v2-inline-actions">{openMembership?.state === "added" ? <Button size="sm" onClick={() => dispatch({ type: "set-source-membership", sourceId: openSource.id, projectId: "project-a", state: "removed" })}>Remove</Button> : <Button size="sm" variant="primary" onClick={() => dispatch({ type: "set-source-membership", sourceId: openSource.id, projectId: "project-a", state: "added" })}>Add</Button>}<Button size="sm" onClick={() => dispatch({ type: "set-source-membership", sourceId: openSource.id, projectId: "project-a", state: "excluded" })}>Exclude</Button></div></div> : null}
            {openActivity ? <section aria-label="Activity runs"><h3>Runs</h3><div className="v2-review-list">{activityRuns.map((run) => { const runCandidate = run.candidateId ? state.domain.candidates[run.candidateId] : undefined; return <article className="v2-review-row" key={run.id}><div><strong>{run.status}</strong><p>{run.actualContextSourceIds.length} actual Sources{runCandidate ? ` · Candidate ${runCandidate.status}` : " · no Candidate"}</p></div><div className="v2-inline-actions">{runCandidate ? <Button size="sm" onClick={() => dispatch({ type: "restore-run", runId: run.id })}>Restore</Button> : null}{run.status === "cancelled" || run.status === "failed" ? <Button size="sm" variant="primary" onClick={() => dispatch({ type: "retry-run", runId: run.id })}>Retry</Button> : null}{runCandidate?.status !== "adopted" ? <Button size="sm" onClick={() => dispatch({ type: "delete-run", runId: run.id })}>Delete run</Button> : null}</div></article>; })}</div>{restoredCandidate && activityRuns.some((run) => run.id === restoredCandidate.runId) ? <div className="v2-context-card"><OriginLabel origin="ai" detail={`Candidate · ${restoredCandidate.status}`} /><p>{restoredCandidate.content}</p><div className="v2-library-meta">Restored from Activity; it is still outside Project Context until adopted.</div></div> : null}</section> : null}
          </section> : null}
          {openCandidate ? <section className="v2-recovery-card" aria-label="Recovered run" style={{ marginTop: 18 }}><OriginLabel origin="ai" detail={`Candidate · ${openCandidate.status}`} /><h2>Recovered draft</h2><p>{openCandidate.content}</p><div className="v2-library-meta">Run {openRun?.status ?? "saved"} · {openCandidate.contextSourceIds.length} actual Sources · not added to Project Context until adopted</div><div className="v2-citation-list" style={{ marginTop: 12 }}>{openCandidate.citations.map((citation, index) => <span className="v2-citation-chip" key={`${citation.sourceId}:${index}`}><span>{index + 1}</span>{citation.label}</span>)}</div></section> : null}
          <div className="v2-library-list">
            {sources.map((source) => {
              const membership = Object.values(state.domain.memberships).find((item) => item.sourceId === source.id);
              return <article className="v2-library-row" key={source.id}>
                <div>
                  <OriginLabel origin={source.origin} detail={source.activityKind ? "Activity" : source.title === "Voice write" ? "Voice write" : source.pageId ? "Page" : "Saved"} />
                  <h3>{source.title}</h3>
                  <p>{latest(source)}</p>
                  <div className="v2-library-meta">Aug 5 · {source.pageId ? state.domain.pages[source.pageId]?.url.replace("https://", "") : "Logue"}</div>
                </div>
                <div className="v2-inline-actions">{membership ? <span className={`v2-membership-pill${membership.state === "suggested" ? " is-suggested" : ""}`}>{membership.state === "suggested" ? `Suggested · ${state.domain.projects[membership.projectId]?.name}` : membership.state === "saved-only" ? "Saved only" : state.domain.projects[membership.projectId]?.name}</span> : <span className="v2-membership-pill">Saved only</span>}<Button size="sm" onClick={() => setOpenSourceId(source.id)}>Open</Button></div>
              </article>;
            })}
          </div>
        </div>
      </div>
    </ProjectShell>
  );
}
