import { Bot, FileText, Globe2, MessageSquare, Mic, Plus, Search, Tag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "./ProjectShell";

export type ContextReviewTab = "context" | "topics" | "activity" | "lineage" | "voice";

const tabLabels: Record<ContextReviewTab, string> = { context: "Context", topics: "Topics", activity: "Activity", lineage: "Lineage", voice: "Voice profile" };

export function ContextReview({ initialTab = "context", onRouteChange = () => undefined, onOpenSource, onBack }: { initialTab?: ContextReviewTab; onRouteChange?: (route: V2PrimaryRoute) => void; onOpenSource?: (sourceId: string) => void; onBack?: () => void }) {
  const { state, dispatch } = useMockSession();
  const [tab, setTab] = useState(initialTab);
  const [hiddenTopic, setHiddenTopic] = useState(false);
  const [terms, setTerms] = useState(["offline capture", "field researcher", "evidence review", "Logue"]);
  const [termDraft, setTermDraft] = useState("");
  const project = state.domain.projects["project-a"];
  const sources = Object.values(state.domain.memberships).filter((membership) => membership.projectId === project.id).map((membership) => ({ membership, source: state.domain.sources[membership.sourceId] })).filter((row) => row.source);
  const adoptedCandidate = Object.values(state.domain.candidates).filter((candidate) => candidate.status === "adopted" && state.domain.runs[candidate.runId]?.projectId === project.id).at(-1);
  const adoptedRun = adoptedCandidate ? state.domain.runs[adoptedCandidate.runId] : undefined;
  const adoptedActivity = adoptedRun?.activityId ? state.domain.activities[adoptedRun.activityId] : undefined;
  const adoptedActivitySource = adoptedActivity ? state.domain.sources[adoptedActivity.sourceId] : undefined;
  const adoptedTarget = adoptedCandidate?.adoptionTargetSessionId ? state.domain.targetSessions[adoptedCandidate.adoptionTargetSessionId] : undefined;
  const actualSources = adoptedRun?.actualContext.flatMap(({ sourceId }) => state.domain.sources[sourceId] ? [state.domain.sources[sourceId]] : []) ?? [];
  const webSourceCount = actualSources.filter((source) => source.origin === "web").length;
  const yourSourceCount = actualSources.filter((source) => source.origin === "you").length;
  const adoptedAiSource = adoptedCandidate ? state.domain.sources[`ai-${adoptedCandidate.id}`] : undefined;
  return (
    <ProjectShell route="projects" projectName={project.name} projects={Object.values(state.domain.projects)} activeProjectId={project.id} onRouteChange={onRouteChange}>
      <div className="v2-editor-scroll">
        <div className="v2-list-axis">
          <div className="v2-page-heading"><div className="v2-page-heading-copy"><h1>Project context</h1><p>Review what this project may use, why it is here, and what stays outside.</p></div>{onBack ? <Button size="sm" onClick={onBack}>Back to document</Button> : null}</div>
          <div className="v2-segmented" role="tablist" aria-label="Project context views">{(Object.keys(tabLabels) as ContextReviewTab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{tabLabels[item]}</button>)}</div>
          {tab === "context" && <div className="v2-review-list">{sources.map(({ membership, source }) => <article className="v2-review-row" key={membership.id}><div><OriginLabel origin={source.origin} detail={membership.state} /><h3>{source.title}</h3><p>{source.revisions.at(-1)?.content}</p><div className="v2-library-meta">{membership.reason === "tab-authorized" ? "Added because Mobile research was active for this tab" : membership.reason === "auto-classified" ? "Added automatically from a high-confidence match; your correction wins" : membership.reason === "suggested" ? "Suggested only; it is not in Project Context" : membership.reason === "duplicate" ? "Linked to an existing source; does not increase evidence weight" : "You set this membership"}</div></div><div className="v2-inline-actions">{onOpenSource ? <Button size="sm" onClick={() => onOpenSource(source.id)}>Open source</Button> : null}{membership.state === "suggested" || membership.state === "removed" || membership.state === "excluded" || membership.state === "saved-only" ? <Button size="sm" variant="primary" onClick={() => dispatch({ type: "set-source-membership", sourceId: source.id, projectId: project.id, state: "added" })}>Add</Button> : <Button size="sm" onClick={() => dispatch({ type: "set-source-membership", sourceId: source.id, projectId: project.id, state: "removed" })}>Remove</Button>}<Button size="sm" onClick={() => dispatch({ type: "set-source-membership", sourceId: source.id, projectId: project.id, state: "excluded" })}>Exclude</Button></div></article>)}</div>}
          {tab === "topics" && <div className="v2-review-list">
            {!hiddenTopic ? <article className="v2-topic-card"><div><span className="v2-quiet-pill"><Tag aria-hidden="true" size={13} />Suggested topic</span><h2>Offline field research</h2><p>4 related Sources · 2 repeated terms · one complementary finding</p></div><div className="v2-inline-actions"><Button size="sm">Rename</Button><Button size="sm">Convert to project</Button><Button size="sm" onClick={() => setHiddenTopic(true)}>Hide</Button></div></article> : <div className="v2-recovery-card"><p>Topic hidden. Its Sources remain saved and searchable.</p><Button size="sm" onClick={() => setHiddenTopic(false)}>Undo</Button></div>}
            <article className="v2-topic-card"><div><span className="v2-quiet-pill"><Tag aria-hidden="true" size={13} />Topic</span><h2>Decision-ready evidence</h2><p>3 Sources · suggested vocabulary: evidence review</p></div><Button size="sm">Merge…</Button></article>
          </div>}
          {tab === "activity" && <div className="v2-review-list">
            {Object.values(state.domain.activities).map((activity) => { const source = state.domain.sources[activity.sourceId]; const run = Object.values(state.domain.runs).filter((item) => item.activityId === activity.id).at(-1); return <article className="v2-review-row" key={activity.id}><div><OriginLabel origin="you" detail="Activity" /><h3>{source?.title ?? "Project action"}</h3><p>{activity.transcript}</p><div className="v2-library-meta">Run {run?.status ?? "not started"} · {run?.actualContext.length ?? 0} actual Sources · prompt not in Project Context</div></div><div className="v2-inline-actions">{run?.candidateId ? <Button size="sm" onClick={() => dispatch({ type: "restore-run", runId: run.id })}>Restore result</Button> : null}{run?.status === "cancelled" || run?.status === "failed" ? <Button size="sm" variant="primary" onClick={() => dispatch({ type: "retry-run", runId: run.id })}>Retry</Button> : null}{run && state.domain.candidates[run.candidateId ?? ""]?.status !== "adopted" ? <Button size="sm" onClick={() => dispatch({ type: "delete-run", runId: run.id })}>Delete run</Button> : null}</div></article>; })}
          </div>}
          {tab === "lineage" && <div className="v2-lineage" aria-label="Adopted output lineage">
            {!adoptedCandidate || !adoptedRun ? <div className="v2-recovery-card"><p>No adopted output yet. Insert, copy, or save a sourced result to create lineage.</p></div> : <>
              {webSourceCount ? <div className="v2-lineage-node"><Globe2 aria-hidden="true" size={18} /><div><strong>{webSourceCount} Web Source{webSourceCount === 1 ? "" : "s"}</strong><p>Frozen revisions used by this Run.</p></div></div> : null}
              {yourSourceCount ? <div className="v2-lineage-node"><UserRound aria-hidden="true" size={18} /><div><strong>{yourSourceCount} You Source{yourSourceCount === 1 ? "" : "s"}</strong><p>Comments or saved inputs used by this Run.</p></div></div> : null}
              {adoptedActivity ? <div className="v2-lineage-node"><MessageSquare aria-hidden="true" size={18} /><div><strong>{adoptedActivity.inputMode === "voice" ? "Voice Command" : "Command"} · revision {adoptedActivitySource?.revisions.length ?? 1}</strong><p>Actual Context: {adoptedRun.actualContext.length} Sources · Skill revision {adoptedRun.skillRevisionId ?? "recorded"}.</p></div></div> : null}
              <div className="v2-lineage-node"><Bot aria-hidden="true" size={18} /><div><strong>AI Candidate → Adopted</strong><p>{adoptedCandidate.adoption === "insert" ? `Inserted into ${adoptedTarget?.label ?? "the original target"}${adoptedCandidate.adoptionUndone ? ", then undone; the adopted lineage remains" : ""}.` : adoptedCandidate.adoption === "copy" ? "Copied successfully; the adopted lineage remains in Logue." : `Adopted through ${adoptedCandidate.adoption ?? "a saved action"}.`}</p></div></div>
              {adoptedAiSource ? <div className="v2-lineage-node"><FileText aria-hidden="true" size={18} /><div><strong>{adoptedAiSource.title}</strong><p>Adopted revision linked to Run {adoptedRun.id}; citations resolve to its frozen Sources.</p></div></div> : null}
            </>}
          </div>}
          {tab === "voice" && <div className="v2-voice-profile">
            <section><h2>Mobile research profile</h2><p>Used for transcription accuracy only. It does not add Sources to Project Context.</p><div className="v2-setting-row"><div><strong>Language</strong><p>English with automatic Chinese phrases</p></div><Button size="sm">Change</Button></div><div className="v2-setting-row"><div><strong>Formatting</strong><p>Clean conversational · preserve lists in structured targets</p></div><Button size="sm">Change</Button></div></section>
            <section><h2>Vocabulary</h2><p>Project terms have priority over Topic and Global vocabulary for this recording.</p><div className="v2-term-list">{terms.map((term) => <span className="v2-term" key={term}>{term}<button aria-label={`Remove ${term}`} onClick={() => setTerms((items) => items.filter((item) => item !== term))}><X aria-hidden="true" size={13} /></button></span>)}</div><form className="v2-filter-row" onSubmit={(event) => { event.preventDefault(); if (termDraft.trim()) { setTerms((items) => [...items, termDraft.trim()]); setTermDraft(""); } }}><label className="v2-search-field"><Search aria-hidden="true" size={16} /><span className="sr-only">Add vocabulary</span><input value={termDraft} onChange={(event) => setTermDraft(event.target.value)} placeholder="Add a name, acronym, or preferred spelling" /></label><Button type="submit" size="sm" disabled={!termDraft.trim()}><Plus aria-hidden="true" size={14} />Add</Button></form></section>
            <section><h2>Suggested from confirmed Sources</h2><div className="v2-setting-row"><div><strong>decision-ready</strong><p>Appears in two confirmed Sources. Suggestions are never added silently.</p></div><div className="v2-inline-actions"><Button size="sm">Add</Button><Button size="sm">Dismiss</Button></div></div></section>
          </div>}
        </div>
      </div>
    </ProjectShell>
  );
}
