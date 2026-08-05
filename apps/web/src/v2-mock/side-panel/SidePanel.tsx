import { ExternalLink, Mic, MoreHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "../../components/ui";
import { getCandidateCitations } from "../model/selectors";
import { useMockSession } from "../runtime/MockSessionProvider";
import { OriginLabel } from "../primitives/OriginLabel";
import "../styles/surfaces.css";
import { CommentComposer } from "./CommentComposer";
import { DraftPreview } from "./DraftPreview";
import { SidePanelSourceInspector } from "./SourceInspector";

export type SidePanelMode = "page" | "draft" | "offline" | "target-lost" | "model-not-ready" | "classification";

function sourceText(source: { revisions: Array<{ content: string }> }) {
  return source.revisions.at(-1)?.content ?? "";
}

export function SidePanel({ mode = "page" }: { mode?: SidePanelMode }) {
  const { state, dispatch } = useMockSession();
  const [voiceRecording, setVoiceRecording] = useState(false);
  const tab = state.domain.tabs[state.surface.activeTabId];
  const page = state.domain.pages[tab.pageId];
  const project = tab.activeProjectId ? state.domain.projects[tab.activeProjectId] : undefined;
  const candidate = state.surface.activeCandidateId ? state.domain.candidates[state.surface.activeCandidateId] : undefined;
  const target = state.surface.selectedTargetSessionId ? state.domain.targetSessions[state.surface.selectedTargetSessionId] : undefined;
  const comments = useMemo(() => Object.values(state.domain.sources).filter((source) => source.origin === "you" && source.commentsOnSourceId && state.domain.sources[source.commentsOnSourceId]?.pageId === page.id), [page.id, state.domain.sources]);
  const showDraft = mode === "draft" || mode === "target-lost" || mode === "model-not-ready";
  const saveText = (text: string) => dispatch({ type: "save-text-comment", tabId: tab.id, pageId: page.id, projectId: tab.activeProjectId, text });
  const citationCount = candidate ? getCandidateCitations(state.domain, candidate.id).length : 0;

  return (
    <div className="logue-v2 v2-side-panel-frame">
      <aside className="v2-side-panel" aria-label="Logue side panel">
        <header className="v2-panel-header">
          <div className="v2-panel-title"><strong>{showDraft ? "Draft reply" : page.title}</strong><span>{project?.name ?? "No project"}</span></div>
          <IconButton label="More options" variant="ghost"><MoreHorizontal aria-hidden="true" size={18} /></IconButton>
        </header>
        {mode === "offline" && <div className="v2-offline-bar">Offline · new captures stay on this Mac until the Host reconnects.</div>}
        {mode === "target-lost" && <div className="v2-warning-bar">The original email input is no longer available. Your draft is saved; copy it or reopen the target.</div>}
        {mode === "model-not-ready" && <div className="v2-warning-bar">Generation needs attention. Saved sources remain available. Configure a provider in Logue Settings, then retry.</div>}
        <div className="v2-panel-scroll">
          <SidePanelSourceInspector />
          {showDraft ? <>
            <section className="v2-panel-section">
              <div className="v2-panel-section-heading"><h2>Using {project?.name}</h2><span className="v2-quiet-pill">{citationCount || 4} sources</span></div>
              <p style={{ margin: 0, color: "var(--v2-muted)", fontSize: 13 }}>Only the sources actually used by this run appear as citations.</p>
            </section>
            <section className="v2-panel-section">
              {candidate && mode !== "model-not-ready" ? <DraftPreview
                candidate={candidate}
                target={mode === "target-lost" ? { ...target!, isValid: false } : target}
                onChange={(content) => dispatch({ type: "edit-candidate", candidateId: candidate.id, content })}
                onCitation={(sourceId, revisionId) => dispatch({ type: "open-citation", sourceId, revisionId })}
                onInsert={() => target && dispatch({ type: "insert-candidate", candidateId: candidate.id, targetSessionId: target.id })}
                onUndo={() => target && dispatch({ type: "undo-target", targetSessionId: target.id })}
              /> : <div className="v2-recovery-card"><OriginLabel origin="ai" detail="Generation" /><p>No Candidate was created. Your command and actual context are still in Activity.</p><Button size="sm" style={{ marginTop: 12 }}>Open model settings</Button></div>}
            </section>
          </> : <>
            <section className="v2-panel-section">
              <div className="v2-panel-section-heading"><h2>On this page</h2><Button size="sm"><ExternalLink aria-hidden="true" size={14} />Open project</Button></div>
              <div className="v2-context-card"><OriginLabel origin="web" detail="Current page" /><p>{page.selection}</p><div className="v2-library-meta">Snapshot retained with the source</div></div>
            </section>
            <section className="v2-panel-section">
              <div className="v2-panel-section-heading"><h2>Comments</h2><span className="v2-quiet-pill">{comments.length}</span></div>
              {comments.map((comment) => {
                const web = comment.commentsOnSourceId ? state.domain.sources[comment.commentsOnSourceId] : undefined;
                return <article className="v2-comment-card" key={comment.id}><OriginLabel origin="you" detail={comment.audio ? "Voice comment" : "Text comment"} /><p>{sourceText(comment)}</p>{web ? <blockquote>{sourceText(web)}</blockquote> : null}</article>;
              })}
            </section>
            {mode === "classification" && <section className="v2-panel-section"><div className="v2-recovery-card"><strong>Suggested for Q3 pricing decision</strong><p>Related wording appears in two confirmed sources. This suggestion does not change Project Context until you accept it.</p><div className="v2-inline-actions" style={{ marginTop: 12 }}><Button size="sm" variant="primary">Add to project</Button><Button size="sm">Keep saved only</Button></div></div></section>}
          </>}
        </div>
        {!showDraft && <footer className="v2-panel-footer">
          {voiceRecording ? <div className="v2-panel-composer"><span className="v2-quiet-pill" aria-live="polite">Recording 0:08</span><div style={{ flex: 1 }} /><Button size="sm" variant="primary" onClick={() => { dispatch({ type: "accept-voice-comment", transcript: "This finding changes how quickly the project should surface evidence." }); setVoiceRecording(false); }}>Accept</Button><Button size="sm" onClick={() => { dispatch({ type: "cancel-recording" }); setVoiceRecording(false); }}>Cancel</Button></div> : <CommentComposer onSave={saveText} onVoice={() => { dispatch({ type: "start-voice-comment", tabId: tab.id, pageId: page.id }); setVoiceRecording(true); }} />}
          <div className="v2-inline-actions" style={{ marginTop: 8 }}><Button size="sm"><Sparkles aria-hidden="true" size={14} />Ask or draft</Button><Button size="sm" onClick={() => { dispatch({ type: "start-voice-comment", tabId: tab.id, pageId: page.id }); setVoiceRecording(true); }}><Mic aria-hidden="true" size={14} />Voice comment</Button></div>
        </footer>}
      </aside>
    </div>
  );
}
