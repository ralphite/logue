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
  const { state } = useMockSession();
  const [view, setView] = useState<"saved" | "activity">(initialView);
  const [query, setQuery] = useState("");
  const [openSourceId, setOpenSourceId] = useState<string | null>(initialSourceId ?? null);
  const openSource = openSourceId ? state.domain.sources[openSourceId] : undefined;
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
            <button role="tab" aria-selected={view === "saved"} className={view === "saved" ? "is-active" : ""} onClick={() => setView("saved")}>Saved content</button>
            <button role="tab" aria-selected={view === "activity"} className={view === "activity" ? "is-active" : ""} onClick={() => setView("activity")}>All activity</button>
          </div>
          <div className="v2-filter-row" style={{ marginTop: 18 }}>
            <label className="v2-search-field"><Search aria-hidden="true" size={17} /><span className="sr-only">Find saved content</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by words, project, site, or topic" /></label>
            <IconButton label="Filter library" variant="secondary"><SlidersHorizontal aria-hidden="true" size={16} /></IconButton>
          </div>
          {openSource ? <section className="v2-recovery-card" aria-label="Source detail" style={{ marginTop: 18 }}>
            <div className="v2-panel-section-heading"><div><OriginLabel origin={openSource.origin} detail={openSource.title} /><h2 style={{ margin: "7px 0 0" }}>{openSource.title}</h2></div><Button size="sm" onClick={() => setOpenSourceId(null)}>Close</Button></div>
            {openSource.audio ? <p>Original audio · {openSource.audio.durationSeconds}s · kept on this Host</p> : null}
            <div className="v2-review-list">{openSource.revisions.map((revision, index) => <article className="v2-review-row" key={revision.id}><div><strong>{revision.kind === "raw" ? "Raw transcript" : revision.kind === "candidate" ? `Transcript version ${index}` : "Adopted text"}</strong><p>{revision.content}</p>{revision.transcriptionProfileId ? <div className="v2-library-meta">{revision.transcriptionProfileId === "project-a" ? "Mobile research profile" : revision.transcriptionProfileId === "one-shot" ? "One-time topic vocabulary" : "Global voice profile"}</div> : null}</div></article>)}</div>
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
