import { Copy, ExternalLink, Mic, MessageSquarePlus, Send, Square, Undo2, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SourceBundleView } from "../primitives/SourceBundleView";
import { createStorySeed, type StorySeedName } from "../fixtures/storySeeds";
import { getCandidateCitations, getProjectSources } from "../model/selectors";
import { useMockSession, MockSessionProvider } from "../runtime/MockSessionProvider";
import type { Id, MockSessionState, Source } from "../model/types";
import { LogueWebApp } from "../web/LogueWebApp";

const frameStyle: CSSProperties = { width: "min(1180px, 100%)", margin: "0 auto", overflow: "hidden", border: "1px solid var(--v2-line)", borderRadius: 12, background: "var(--v2-canvas)", boxShadow: "0 18px 52px rgba(35, 36, 32, .10)" };
const pageStyle: CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column" };
const topbarStyle: CSSProperties = { minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 18px", borderBottom: "1px solid var(--v2-line)" };
const buttonStyle: CSSProperties = { border: 0, borderRadius: 6, background: "transparent", color: "var(--v2-ink-soft)", padding: "7px 9px", cursor: "pointer" };
const primaryStyle: CSSProperties = { ...buttonStyle, background: "var(--v2-ink)", color: "white" };
const mutedButtonStyle: CSSProperties = { ...buttonStyle, background: "var(--v2-surface-muted)", border: "1px solid var(--v2-line)" };
const iconTextStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7 };

function sourceContent(source: Source | undefined) {
  return source?.revisions.at(-1)?.content ?? "";
}

function ExtensionSurfaceContent() {
  const { state, dispatch } = useMockSession();
  const { domain, surface } = state;
  const tab = domain.tabs[surface.activeTabId];
  const page = domain.pages[tab.pageId];
  const target = surface.selectedTargetSessionId ? domain.targetSessions[surface.selectedTargetSessionId] : undefined;
  const project = tab.activeProjectId ? domain.projects[tab.activeProjectId] : undefined;
  const [hostView, setHostView] = useState<"article" | "email">("article");
  const initialSelectedSource = surface.selectedSourceId ? domain.sources[surface.selectedSourceId] : undefined;
  const [commentMode, setCommentMode] = useState<"none" | "text" | "voice">(initialSelectedSource?.origin === "you" && !initialSelectedSource.commentsOnSourceId ? "voice" : "none");
  const [textComment, setTextComment] = useState("");
  const [insertedVoiceWriteSourceId, setInsertedVoiceWriteSourceId] = useState<Id | null>(null);
  const [voiceWriteClosed, setVoiceWriteClosed] = useState(false);
  const [voiceProfileId, setVoiceProfileId] = useState<"project-a" | "global" | "one-shot">(tab.activeProjectId === "project-a" ? "project-a" : "global");
  const [emailValue, setEmailValue] = useState(target?.value ?? "Hi Maya,");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandText, setCommandText] = useState("Using Mobile research, draft a reply");
  const [runId, setRunId] = useState<Id | null>(null);
  const [copiedCandidateId, setCopiedCandidateId] = useState<Id | null>(null);
  const [logueRoute, setLogueRoute] = useState<"projects" | "library" | "activity" | null>(null);

  useEffect(() => setEmailValue(target?.value ?? ""), [target?.value]);

  const commentSource = surface.selectedSourceId ? domain.sources[surface.selectedSourceId] : undefined;
  const pendingVoiceComment = commentSource?.origin === "you" && !commentSource.commentsOnSourceId ? commentSource : undefined;
  const voiceWriteSource = commentSource?.origin === "you" && commentSource.title === "Voice write" ? commentSource : undefined;
  const voiceWriteCandidate = voiceWriteSource?.revisions.filter((revision) => revision.kind === "candidate").at(-1);
  const voiceWriteMembership = voiceWriteSource && project ? domain.memberships[`${project.id}:${voiceWriteSource.id}`] : undefined;
  const commentBundles = useMemo(() => Object.values(domain.sources).filter((source) => source.origin === "you" && source.commentsOnSourceId && source.pageId === page.id), [domain.sources, page.id]);
  const candidateId = surface.activeCandidateId;
  const candidate = candidateId ? domain.candidates[candidateId] : undefined;
  const citationRows = candidateId ? getCandidateCitations(domain, candidateId) : [];
  const citationSource = surface.openCitationSourceId ? domain.sources[surface.openCitationSourceId] : undefined;

  function startVoiceComment() {
    dispatch({ type: "start-voice-comment", tabId: tab.id, pageId: page.id });
    setCommentMode("voice");
  }

  function stopVoiceComment() {
    dispatch({ type: "stop-voice-comment", transcript: "This is the evidence we should carry into the decision." });
  }

  function saveVoiceComment() {
    if (!pendingVoiceComment) return;
    dispatch({ type: "save-comment-bundle", commentSourceId: pendingVoiceComment.id, tabId: tab.id, pageId: page.id });
    setCommentMode("none");
  }

  function saveTextComment() {
    if (!textComment.trim()) return;
    dispatch({ type: "save-text-comment", tabId: tab.id, pageId: page.id, text: textComment });
    setTextComment("");
    setCommentMode("none");
  }

  function parseCommand() {
    if (!project || !target?.isValid) return;
    dispatch({ type: "parse-command", transcript: commandText, projectId: project.id, targetSessionId: target.id });
  }

  function runCommand() {
    const activityId = surface.commandActivityId;
    if (!activityId || !project) return;
    const contextSourceIds = getProjectSources(domain, project.id).map((source) => source.id).slice(0, 4);
    const nextRunId = `run-${domain.nextId}`;
    dispatch({ type: "execute-command", activityId, contextSourceIds });
    dispatch({
      type: "generate-sourced-draft",
      runId: nextRunId,
      content: "The research points to one clear priority: keep offline capture connected to the moment a decision is made. That lets people return to the evidence and the judgment behind it without recreating context.",
      citations: contextSourceIds.slice(0, 2).map((sourceId, index) => ({ sourceId, label: index === 0 ? "Article A" : "Your thought", excerpt: sourceContent(domain.sources[sourceId]) })),
    });
    setRunId(nextRunId);
    setCommandOpen(false);
  }

  const voiceProfileLabel = voiceProfileId === "project-a" ? "Mobile research profile" : voiceProfileId === "one-shot" ? "One-time topic vocabulary" : "Global voice profile";

  if (logueRoute) return (
    <div className="logue-v2" style={{ height: "100vh", overflow: "hidden" }}>
      <div className="v2-stepper"><button type="button" onClick={() => setLogueRoute(null)}>Back to browser</button><button type="button" className="is-active">{logueRoute === "projects" ? "Project evidence" : logueRoute === "activity" ? "Recovered draft" : "Saved voice write"}</button></div>
      <div style={{ height: "calc(100vh - 44px)" }}><LogueWebApp initialRoute={logueRoute === "projects" ? "projects" : "library"} initialLibraryView={logueRoute === "activity" ? "activity" : "saved"} initialLibrarySourceId={logueRoute === "library" ? voiceWriteSource?.id : undefined} initialLibraryCandidateId={logueRoute === "activity" ? candidate?.id : undefined} /></div>
    </div>
  );

  return (
    <div className="logue-v2" data-v2-extension-surface="true" style={{ width: "100%", padding: 20 }}>
      <div className="v2-extension-frame" style={frameStyle}>
        <section className="v2-extension-page" style={pageStyle} aria-label="Current browser page">
          <header style={topbarStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label="Host views">
              {(["article-a", "article-b"] as const).map((articleId) => (
                <button key={articleId} type="button" style={{ ...buttonStyle, background: hostView === "article" && page.id === articleId ? "var(--v2-surface-muted)" : "transparent", color: hostView === "article" && page.id === articleId ? "var(--v2-ink)" : undefined }} onClick={() => { dispatch({ type: "close-citation" }); dispatch({ type: "select-article", tabId: tab.id, pageId: articleId }); setHostView("article"); }}>
                  {articleId === "article-a" ? "Article A" : "Article B"}
                </button>
              ))}
              <button type="button" style={{ ...buttonStyle, background: hostView === "email" ? "var(--v2-surface-muted)" : "transparent", color: hostView === "email" ? "var(--v2-ink)" : undefined }} onClick={() => { dispatch({ type: "close-citation" }); if (target?.isValid) dispatch({ type: "open-email-target", targetSessionId: target.id }); setHostView("email"); }}><span style={iconTextStyle}><Send aria-hidden="true" size={14} />Email</span></button>
            </div>
            <span style={{ color: "var(--v2-muted)", fontSize: 13 }}>{hostView === "email" ? "Email" : new URL(page.url).hostname}</span>
          </header>

          <main style={{ minHeight: 0, flex: 1, overflow: "auto", padding: "54px clamp(28px, 7vw, 82px) 30px" }}>
            {hostView === "article" ? <>
            <p style={{ margin: "0 0 12px", color: "var(--v2-muted)", fontSize: 13 }}>{new URL(page.url).hostname}</p>
            <h1 style={{ maxWidth: 720, margin: "0 0 26px", color: "var(--v2-ink)", fontSize: 36, lineHeight: 1.14, letterSpacing: "-.045em" }}>{page.title}</h1>
            <div style={{ maxWidth: 680, color: "var(--v2-ink-soft)", fontSize: 17, lineHeight: 1.75 }}>
              <p>The page fixture is intentionally short so the selected passage stays central to the next decision.</p>
              <p style={{ margin: "26px 0", borderLeft: "3px solid var(--v2-accent)", background: "var(--v2-accent-soft)", padding: "14px 16px", color: "var(--v2-ink)", fontWeight: 570 }}>{page.selection}</p>
              <p>Logue keeps the original evidence and your judgment together, then lets you use both in the place where you write.</p>
            </div>

            {commentMode === "none" ? (
              <button type="button" style={{ ...mutedButtonStyle, marginTop: 18 }} onClick={() => setCommentMode("text")}><span style={iconTextStyle}><MessageSquarePlus aria-hidden="true" size={15} />Add comment</span></button>
            ) : null}
            {commentMode === "text" ? (
              <section style={{ maxWidth: 680, marginTop: 22, border: "1px solid var(--v2-line-strong)", borderRadius: 10, padding: 12, background: "var(--v2-surface)" }} aria-label="Comment on selected text">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, color: "var(--v2-muted)", fontSize: 13 }}><span>Comment on selected text</span><button type="button" style={buttonStyle} aria-label="Close comment" onClick={() => setCommentMode("none")}><X aria-hidden="true" size={15} /></button></div>
                <textarea value={textComment} onChange={(event) => setTextComment(event.target.value)} placeholder="Add your thought" style={{ width: "100%", minHeight: 82, resize: "vertical", border: 0, outline: 0, color: "var(--v2-ink)", background: "transparent", lineHeight: 1.55 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <button type="button" style={buttonStyle} onClick={startVoiceComment}><span style={iconTextStyle}><Mic aria-hidden="true" size={15} />Voice</span></button>
                  <button type="button" style={primaryStyle} onClick={saveTextComment} disabled={!textComment.trim()}>Save</button>
                </div>
              </section>
            ) : null}
            {commentMode === "voice" ? (
              <section style={{ maxWidth: 680, marginTop: 22, border: "1px solid var(--v2-line-strong)", borderRadius: 10, padding: 14, background: "var(--v2-surface)" }} aria-label="Voice comment">
                {!pendingVoiceComment ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><span style={{ color: "var(--v2-ink-soft)" }}><Mic aria-hidden="true" size={15} /> Recording comment</span><button type="button" style={primaryStyle} onClick={stopVoiceComment}><span style={iconTextStyle}><Square aria-hidden="true" size={13} />Stop</span></button></div> : <><textarea aria-label="Voice comment transcript" value={sourceContent(pendingVoiceComment)} onChange={(event) => dispatch({ type: "edit-voice-comment", sourceId: pendingVoiceComment.id, content: event.target.value })} style={{ width: "100%", minHeight: 72, resize: "vertical", border: 0, outline: 0, color: "var(--v2-ink)", background: "transparent", lineHeight: 1.55 }} /><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><button type="button" style={buttonStyle} onClick={() => setCommentMode("none")}>Close</button><button type="button" style={primaryStyle} onClick={saveVoiceComment}>Link comment</button></div></>}
              </section>
            ) : null}

            </> : null}
            {hostView === "email" ? <section style={{ maxWidth: 680, margin: "0 auto" }} aria-label="Email input target">
              <p style={{ margin: "0 0 12px", color: "var(--v2-muted)", fontSize: 13 }}>To: Maya</p>
              <h1 style={{ margin: "0 0 26px", color: "var(--v2-ink)", fontSize: 32, lineHeight: 1.16, letterSpacing: "-.04em" }}>Reply to Maya</h1>
              <textarea aria-label="Email reply" value={emailValue} disabled={!target?.isValid} onChange={(event) => setEmailValue(event.target.value)} placeholder={target?.isValid ? "Write a reply" : "Original input is no longer available"} style={{ width: "100%", minHeight: 104, resize: "vertical", border: "1px solid var(--v2-line-strong)", borderRadius: 10, outline: 0, background: target?.isValid ? "var(--v2-surface)" : "var(--v2-surface-muted)", color: "var(--v2-ink)", padding: 13, lineHeight: 1.55 }} />
              {target?.isValid ? <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
                {surface.recording?.kind !== "voice-write" ? <><select aria-label="Transcription profile" value={voiceProfileId} onChange={(event) => setVoiceProfileId(event.target.value as typeof voiceProfileId)} style={{ border: "1px solid var(--v2-line)", borderRadius: 6, background: "var(--v2-surface)", color: "var(--v2-ink)", padding: "7px 8px" }}><option value="project-a">Mobile research profile</option><option value="global">Global voice profile</option><option value="one-shot">One-time topic vocabulary</option></select><button type="button" style={mutedButtonStyle} onClick={() => { setVoiceWriteClosed(false); dispatch({ type: "start-voice-write", tabId: tab.id, targetSessionId: target.id, pageId: page.id }); }}><span style={iconTextStyle}><Mic aria-hidden="true" size={15} />Voice write</span></button></> : null}
                {surface.recording?.kind === "voice-write" ? <><span role="status" style={{ color: "var(--v2-ink-soft)", fontSize: 13 }}>Recording · {voiceProfileLabel}</span><button type="button" style={primaryStyle} onClick={() => dispatch({ type: "stop-voice-write", transcript: "Thanks — I’ll keep the evidence connected to the decision.", transcriptionProfileId: voiceProfileId })}><span style={iconTextStyle}><Square aria-hidden="true" size={13} />Stop and review</span></button><button type="button" style={buttonStyle} onClick={() => dispatch({ type: "cancel-recording" })}>Cancel</button></> : null}
                {surface.recording?.kind !== "voice-write" ? <button type="button" style={mutedButtonStyle} onClick={() => setCommandOpen((open) => !open)}><span style={iconTextStyle}><WandSparkles aria-hidden="true" size={15} />Command</span></button> : null}
              </div> : <p style={{ margin: "10px 0 0", color: "var(--v2-muted)", fontSize: 13 }}>This input is no longer available. Your draft can still be copied from the panel.</p>}
              {commandOpen ? <section style={{ position: "relative", marginTop: 12, border: "1px solid var(--v2-line-strong)", borderRadius: 10, background: "var(--v2-surface)", padding: 12 }} aria-label="Voice Command launcher">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}><strong style={{ fontSize: 14 }}>Voice Command</strong><button type="button" style={buttonStyle} onClick={() => setCommandOpen(false)} aria-label="Close command"><X aria-hidden="true" size={15} /></button></div>
                <textarea aria-label="Voice command" value={commandText} onChange={(event) => setCommandText(event.target.value)} style={{ width: "100%", minHeight: 62, resize: "vertical", border: "1px solid var(--v2-line-strong)", borderRadius: 8, padding: 9, outline: 0 }} />
                {surface.commandActivityId ? <div style={{ marginTop: 8, color: "var(--v2-ink-soft)", fontSize: 13 }}>Draft reply · {project?.name ?? "Choose a project"} · Email</div> : null}
                {!surface.commandActivityId ? <button type="button" style={{ ...primaryStyle, marginTop: 10 }} onClick={parseCommand} disabled={!project || !target?.isValid}>Parse command</button> : null}
                {surface.commandActivityId && !runId ? <button type="button" style={{ ...primaryStyle, marginTop: 10 }} onClick={runCommand}>Generate draft</button> : null}
              </section> : null}
              {voiceWriteSource && voiceWriteCandidate && target?.isValid && !voiceWriteClosed ? <section style={{ marginTop: 12, border: "1px solid var(--v2-accent-line)", borderRadius: 9, padding: 10, background: "var(--v2-surface)" }} aria-label="Saved voice write"><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, color: "var(--v2-muted)", fontSize: 12 }}><span>Saved to Library · {voiceWriteCandidate.transcriptionProfileId === "project-a" ? "Mobile research profile" : voiceWriteCandidate.transcriptionProfileId === "one-shot" ? "One-time vocabulary" : "Global voice profile"}</span><span>{voiceWriteSource.revisions.filter((revision) => revision.kind === "candidate").length} transcript version{voiceWriteSource.revisions.filter((revision) => revision.kind === "candidate").length === 1 ? "" : "s"}</span></div><textarea aria-label="Voice write candidate" value={voiceWriteCandidate.content} onChange={(event) => dispatch({ type: "edit-voice-write", sourceId: voiceWriteSource.id, content: event.target.value })} style={{ width: "100%", minHeight: 60, resize: "vertical", border: 0, outline: 0, background: "transparent", color: "var(--v2-ink)", lineHeight: 1.55 }} /><div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}><button type="button" style={buttonStyle} onClick={() => dispatch({ type: "retranscribe-voice-write", sourceId: voiceWriteSource.id, transcriptionProfileId: voiceProfileId, transcript: voiceProfileId === "project-a" ? "Thanks — keep the field evidence connected to the decision." : voiceProfileId === "one-shot" ? "Thanks — keep the field evidence connected to the decision memo." : "Thanks — I’ll keep the evidence connected to the decision." })}>Re-transcribe with {voiceProfileLabel}</button><button type="button" style={buttonStyle} onClick={() => setLogueRoute("library")}>Open in Library</button><button type="button" style={buttonStyle} onClick={() => setVoiceWriteClosed(true)}>Close</button></div><button type="button" style={primaryStyle} onClick={() => { dispatch({ type: "insert-voice-write", sourceId: voiceWriteSource.id, targetSessionId: target.id }); setInsertedVoiceWriteSourceId(voiceWriteSource.id); }}>Insert</button></div>{voiceWriteMembership?.state === "suggested" ? <div className="v2-recovery-card" style={{ marginTop: 10 }}><p style={{ margin: 0 }}>Suggested for {project?.name}. This voice write is saved, but not in Project Context.</p><div style={{ display: "flex", gap: 6, marginTop: 8 }}><button type="button" style={mutedButtonStyle} onClick={() => project && dispatch({ type: "set-source-membership", sourceId: voiceWriteSource.id, projectId: project.id, state: "added" })}>Add to project</button><button type="button" style={buttonStyle} onClick={() => project && dispatch({ type: "set-source-membership", sourceId: voiceWriteSource.id, projectId: project.id, state: "saved-only" })}>Keep saved only</button></div></div> : null}</section> : null}
              {voiceWriteSource && voiceWriteClosed ? <div className="v2-recovery-card" style={{ marginTop: 12 }}><p style={{ margin: 0 }}>Voice write saved. Closing the review did not remove it.</p><button type="button" style={{ ...buttonStyle, marginTop: 8 }} onClick={() => setLogueRoute("library")}>Find in Library</button></div> : null}
              {insertedVoiceWriteSourceId === voiceWriteSource?.id && target ? <button type="button" style={{ ...buttonStyle, marginTop: 8 }} onClick={() => { dispatch({ type: "undo-target", targetSessionId: target.id }); setInsertedVoiceWriteSourceId(null); }}><span style={iconTextStyle}><Undo2 aria-hidden="true" size={14} />Undo</span></button> : null}
            </section> : null}
          </main>
        </section>

        <aside className="v2-inspector" aria-label="Logue side panel" style={{ width: 392 }}>
          <header className="v2-inspector-header">
            <div><strong style={{ fontSize: 14 }}>Logue</strong><div style={{ marginTop: 2, color: "var(--v2-muted)", fontSize: 12 }}>This tab</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <select aria-label="Project for this tab" value={tab.activeProjectId ?? ""} onChange={(event) => dispatch({ type: "set-tab-project", tabId: tab.id, projectId: event.target.value || null })} style={{ maxWidth: 148, border: "1px solid var(--v2-line)", borderRadius: 6, background: "var(--v2-surface)", color: "var(--v2-ink)", padding: "6px 8px" }}>
                <option value="">No project</option>
                {Object.values(domain.projects).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {project ? <button type="button" style={buttonStyle} aria-label="Open project" onClick={() => setLogueRoute("projects")}><ExternalLink aria-hidden="true" size={15} /></button> : null}
            </div>
          </header>
          <div className="v2-inspector-scroll">
            {candidate ? <section style={{ marginBottom: 24 }} aria-label="Sourced draft preview">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 14 }}>Draft reply</strong><span style={{ color: "var(--v2-muted)", fontSize: 12 }}>{candidate.contextSourceIds.length} used · {citationRows.length} cited</span></div>
              <textarea aria-label="Draft reply" value={candidate.content} onChange={(event) => dispatch({ type: "edit-candidate", candidateId: candidate.id, content: event.target.value })} disabled={candidate.status !== "ready"} style={{ width: "100%", minHeight: 122, marginTop: 10, resize: "vertical", border: "1px solid var(--v2-line-strong)", borderRadius: 8, padding: 10, outline: 0, color: "var(--v2-ink)", lineHeight: 1.55 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>{citationRows.map((citation, index) => <button key={citation.source.id} type="button" className="v2-citation" aria-label={`Open citation ${index + 1}: ${citation.label}`} aria-pressed={surface.openCitationSourceId === citation.source.id} onClick={() => dispatch({ type: "open-citation", sourceId: citation.source.id })}>{index + 1}</button>)}</div>
              {target?.isValid && !target.lastInsertion && candidate.status !== "dismissed" ? <button type="button" style={{ ...primaryStyle, width: "100%", justifyContent: "center", marginTop: 12 }} onClick={() => dispatch({ type: "insert-candidate", candidateId: candidate.id, targetSessionId: target.id })}>{candidate.status === "adopted" ? "Insert again" : "Insert"}</button> : null}
              {!target?.isValid ? <><p style={{ margin: "10px 0 0", color: "var(--v2-muted)", fontSize: 12, lineHeight: 1.45 }}>The page changed. Your draft is saved—copy it anywhere or continue in Logue.</p><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" style={{ ...mutedButtonStyle, flex: 1, justifyContent: "center" }} onClick={() => { void navigator.clipboard?.writeText(candidate.content).catch(() => undefined); setCopiedCandidateId(candidate.id); }}><span style={iconTextStyle}><Copy aria-hidden="true" size={14} />{copiedCandidateId === candidate.id ? "Copied" : "Copy draft"}</span></button><button type="button" style={{ ...mutedButtonStyle, flex: 1, justifyContent: "center" }} onClick={() => setLogueRoute("activity")}>Open in Logue</button></div></> : null}
              {target?.lastInsertion?.candidateId === candidate.id ? <button type="button" style={{ ...buttonStyle, marginTop: 8 }} onClick={() => dispatch({ type: "undo-target", targetSessionId: target.id })}><span style={iconTextStyle}><Undo2 aria-hidden="true" size={14} />Undo</span></button> : null}
            </section> : null}

            {citationSource ? <section style={{ marginBottom: 22, borderTop: "1px solid var(--v2-line)", paddingTop: 16 }} aria-label="Citation source"><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 14 }}>{citationSource.title}</strong><button type="button" style={buttonStyle} aria-label="Close citation" onClick={() => dispatch({ type: "close-citation" })}><X aria-hidden="true" size={15} /></button></div><p style={{ margin: "9px 0", color: "var(--v2-ink-soft)", fontSize: 13, lineHeight: 1.55 }}>{sourceContent(citationSource)}</p><button type="button" style={buttonStyle} onClick={() => { if (citationSource.pageId) { dispatch({ type: "select-article", tabId: tab.id, pageId: citationSource.pageId }); setHostView("article"); } }}><span style={iconTextStyle}><ExternalLink aria-hidden="true" size={14} />Open snapshot</span></button></section> : null}

            <div className="v2-source-list" aria-label="Comments on this tab">
              {commentBundles.map((comment, index) => {
                const web = comment.commentsOnSourceId ? domain.sources[comment.commentsOnSourceId] : undefined;
                return <SourceBundleView key={comment.id} citation={index + 1} title={web?.title ?? "Saved page"} excerpt={sourceContent(web)} comment={sourceContent(comment)} active={surface.openCitationSourceId === comment.id || surface.openCitationSourceId === web?.id} onSelect={() => dispatch({ type: "open-citation", sourceId: comment.id })} onOpenSnapshot={() => web && dispatch({ type: "open-citation", sourceId: web.id })} />;
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export interface ExtensionSurfaceProps {
  seed?: StorySeedName;
  initialState?: MockSessionState;
}

/** V2 Extension fixture. New class/data hook: `data-v2-extension-surface` only; no new CSS class is required. */
export function ExtensionSurface({ seed = "canonical", initialState }: ExtensionSurfaceProps) {
  return <MockSessionProvider seed={seed} initialState={initialState ?? createStorySeed(seed)}><ExtensionSurfaceContent /></MockSessionProvider>;
}
