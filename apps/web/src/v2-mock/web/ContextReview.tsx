import { Bot, FileText, Globe2, MessageSquare, Mic, Plus, Search, Tag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "./ProjectShell";

export type ContextReviewTab = "context" | "topics" | "activity" | "lineage" | "voice";

const tabLabels: Record<ContextReviewTab, string> = { context: "Context", topics: "Topics", activity: "Activity", lineage: "Lineage", voice: "Voice profile" };

export function ContextReview({ initialTab = "context", onRouteChange = () => undefined }: { initialTab?: ContextReviewTab; onRouteChange?: (route: V2PrimaryRoute) => void }) {
  const { state } = useMockSession();
  const [tab, setTab] = useState(initialTab);
  const [hiddenTopic, setHiddenTopic] = useState(false);
  const [terms, setTerms] = useState(["offline capture", "field researcher", "evidence review", "Logue"]);
  const [termDraft, setTermDraft] = useState("");
  const project = state.domain.projects["project-a"];
  const sources = Object.values(state.domain.memberships).filter((membership) => membership.projectId === project.id).map((membership) => ({ membership, source: state.domain.sources[membership.sourceId] })).filter((row) => row.source);
  return (
    <ProjectShell route="projects" projectName={project.name} projects={Object.values(state.domain.projects)} activeProjectId={project.id} onRouteChange={onRouteChange}>
      <div className="v2-editor-scroll">
        <div className="v2-list-axis">
          <div className="v2-page-heading"><div className="v2-page-heading-copy"><h1>Project context</h1><p>Review what this project may use, why it is here, and what stays outside.</p></div></div>
          <div className="v2-segmented" role="tablist" aria-label="Project context views">{(Object.keys(tabLabels) as ContextReviewTab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{tabLabels[item]}</button>)}</div>
          {tab === "context" && <div className="v2-review-list">{sources.map(({ membership, source }) => <article className="v2-review-row" key={membership.id}><div><OriginLabel origin={source.origin} detail={membership.state} /><h3>{source.title}</h3><p>{source.revisions.at(-1)?.content}</p><div className="v2-library-meta">{membership.reason === "tab-authorized" ? "Added because Mobile research was active for this tab" : membership.reason === "duplicate" ? "Linked to an existing source; does not increase evidence weight" : "User selected"}</div></div><div className="v2-inline-actions"><Button size="sm">Pin</Button><Button size="sm">Exclude</Button></div></article>)}</div>}
          {tab === "topics" && <div className="v2-review-list">
            {!hiddenTopic ? <article className="v2-topic-card"><div><span className="v2-quiet-pill"><Tag aria-hidden="true" size={13} />Suggested topic</span><h2>Offline field research</h2><p>4 related Sources · 2 repeated terms · one complementary finding</p></div><div className="v2-inline-actions"><Button size="sm">Rename</Button><Button size="sm">Convert to project</Button><Button size="sm" onClick={() => setHiddenTopic(true)}>Hide</Button></div></article> : <div className="v2-recovery-card"><p>Topic hidden. Its Sources remain saved and searchable.</p><Button size="sm" onClick={() => setHiddenTopic(false)}>Undo</Button></div>}
            <article className="v2-topic-card"><div><span className="v2-quiet-pill"><Tag aria-hidden="true" size={13} />Topic</span><h2>Decision-ready evidence</h2><p>3 Sources · suggested vocabulary: evidence review</p></div><Button size="sm">Merge…</Button></article>
          </div>}
          {tab === "activity" && <div className="v2-review-list">
            {Object.values(state.domain.activities).map((activity) => { const source = state.domain.sources[activity.sourceId]; const run = Object.values(state.domain.runs).find((item) => item.activityId === activity.id); return <article className="v2-review-row" key={activity.id}><div><OriginLabel origin="you" detail="Activity" /><h3>{source?.title ?? "Project action"}</h3><p>{activity.transcript}</p><div className="v2-library-meta">Run {run?.status ?? "not started"} · {run?.actualContextSourceIds.length ?? 0} actual Sources</div></div><Button size="sm">Open run</Button></article>; })}
            <article className="v2-review-row"><div><OriginLabel origin="you" detail="Activity" /><h3>Compare field notes</h3><p>Compare offline capture signals with evidence review behavior.</p><div className="v2-library-meta">Run cancelled · prompt retained · not in Project Context</div></div><Button size="sm">Retry</Button></article>
          </div>}
          {tab === "lineage" && <div className="v2-lineage" aria-label="Adopted output lineage">
            <div className="v2-lineage-node"><Globe2 aria-hidden="true" size={18} /><div><strong>2 Web Sources</strong><p>Saved page snapshots and selected evidence.</p></div></div>
            <div className="v2-lineage-node"><UserRound aria-hidden="true" size={18} /><div><strong>2 Your comments</strong><p>One voice transcript and one text judgment.</p></div></div>
            <div className="v2-lineage-node"><MessageSquare aria-hidden="true" size={18} /><div><strong>Voice Command · revision 1</strong><p>Actual Context: 4 Sources · Draft reply Skill revision 2.</p></div></div>
            <div className="v2-lineage-node"><Bot aria-hidden="true" size={18} /><div><strong>AI Candidate → Adopted</strong><p>The candidate was edited, inserted into Reply to Maya, then the target insertion was undone. The adopted lineage remains.</p></div></div>
            <div className="v2-lineage-node"><FileText aria-hidden="true" size={18} /><div><strong>Document revision</strong><p>Mobile research reply · citations resolve to the original Web and You Sources.</p></div></div>
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
