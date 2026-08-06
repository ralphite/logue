import { ArrowLeft, ChevronDown, Ellipsis, Mic, Sparkles, Square } from "lucide-react";
import { OverlayMenu } from "@logue/ui";
import { useState, type Ref } from "react";
import type { CommandSourceSnapshot, ExtensionSkill, LocalError, PageMaterial, PanelCaptureState, PanelProject, PendingInsert } from "./sidePanelModels";
import { capturePhasePresentation, type CapturePhase } from "./sidePanelPresentation";
import { shouldShowPageHistory } from "./sidePanelPageHistory";
import type { CaptureContext, VoiceProfileOverrides } from "./voiceProfileModels";
import { VoiceProfilePicker } from "./VoiceProfilePicker";

function sourceTitle(state: PanelCaptureState) {
  if (state.source.title.trim()) return state.source.title;
  try {
    return new URL(state.source.url).hostname;
  } catch {
    return "";
  }
}

function serverCandidateLabel(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function commandSourceLabel(source: CommandSourceSnapshot, index: number) {
  return source.source?.title?.trim()
    || source.source?.domain?.trim()
    || (source.actor === "user" ? "Your note" : `Source ${index + 1}`);
}

export function SidePanelView({
  state,
  phase,
  draft,
  generatedText,
  commandSources = [],
  generatedUndoAvailable = false,
  insertingGenerated = false,
  skills,
  skillId,
  projects = [],
  pageMaterials,
  error,
  elapsed,
  pendingInsert,
  insertingPending,
  generating,
  canRetry,
  serverURLDraft,
  serverCandidateURL,
  serverSettingsOpen,
  serverConnecting,
  serverSettingsError,
  voiceProfileContext,
  voiceProfileOverrides = {},
  voiceProfilePickerOpen = false,
  panelRef,
  onDraftChange,
  onGeneratedTextChange,
  onCopyGenerated,
  onUndoGenerated,
  onSkillIdChange,
  onProjectChange = () => undefined,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onRetryTranscription,
  onSave,
  onRequestGeneration,
  onReturnToPage,
  onGenerate,
  onInsertGenerated,
  onRetryInsert,
  onCopyPendingInsert,
  onServerURLDraftChange,
  onOpenServerSettings,
  onCloseServerSettings,
  onConnectServer,
  onConnectCandidateServer,
  onRetryServer,
  onVoiceProfileOverridesChange = () => undefined,
  onVoiceProfilePickerOpenChange = () => undefined,
}: {
  state?: PanelCaptureState;
  phase: CapturePhase;
  draft: string;
  generatedText: string;
  commandSources?: CommandSourceSnapshot[];
  generatedUndoAvailable?: boolean;
  insertingGenerated?: boolean;
  skills: ExtensionSkill[];
  skillId: string;
  projects?: PanelProject[];
  pageMaterials: PageMaterial[];
  error?: LocalError;
  elapsed: number;
  pendingInsert?: PendingInsert;
  insertingPending: boolean;
  generating: boolean;
  canRetry: boolean;
  serverURLDraft: string;
  serverCandidateURL?: string;
  serverSettingsOpen: boolean;
  serverConnecting: boolean;
  serverSettingsError?: string;
  voiceProfileContext?: CaptureContext;
  voiceProfileOverrides?: VoiceProfileOverrides;
  voiceProfilePickerOpen?: boolean;
  panelRef?: Ref<HTMLElement>;
  onDraftChange: (value: string) => void;
  onGeneratedTextChange: (value: string) => void;
  onCopyGenerated?: () => void;
  onUndoGenerated?: () => void;
  onSkillIdChange: (value: string) => void;
  onProjectChange?: (value: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onRetryTranscription: () => void;
  onSave: () => void;
  onRequestGeneration: () => void;
  onReturnToPage: () => void;
  onGenerate: () => void;
  onInsertGenerated: () => void;
  onRetryInsert: () => void;
  onCopyPendingInsert: () => void;
  onServerURLDraftChange: (value: string) => void;
  onOpenServerSettings: () => void;
  onCloseServerSettings: () => void;
  onConnectServer: () => void;
  onConnectCandidateServer: () => void;
  onRetryServer: () => void;
  onVoiceProfileOverridesChange?: (value: VoiceProfileOverrides) => void;
  onVoiceProfilePickerOpenChange?: (value: boolean) => void;
}) {
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [openSourceId, setOpenSourceId] = useState<string>();

  if (!state) return <div className="empty" data-logue-extension="off">Open Logue from a page to begin.</div>;

  const sourceHref = /^https?:\/\//.test(state.source.url) ? state.source.url : undefined;
  const title = sourceTitle(state);
  const presentation = capturePhasePresentation(phase);
  const openedSource = commandSources.find((source) => source.id === openSourceId);

  return (
    <main ref={panelRef} className="panel" tabIndex={-1} data-logue-extension="off">
      <div className="panel-main">
        <div className="panel-topline">
          {serverSettingsOpen ? <p className="eyebrow">Server settings</p> : !presentation.captureActive && error?.kind !== "service" ? <select
            className="field"
            style={{
              width: "auto",
              minWidth: 0,
              maxWidth: "min(168px, calc(100vw - 88px))",
              minHeight: 32,
              padding: "5px 8px",
              fontSize: 13,
            }}
            value={state.projects?.[0] ?? ""}
            onChange={(event) => onProjectChange(event.target.value)}
            aria-label="Project for this tab"
            title={state.projects?.[0] || "Saved only"}
          >
            <option value="">Saved only</option>
            {projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}
          </select> : <span />}
          {!serverSettingsOpen && !presentation.captureActive && error?.kind !== "service" && <div className="panel-options">
            <OverlayMenu
              open={serverMenuOpen}
              onOpenChange={setServerMenuOpen}
              placement="bottom-end"
              ariaLabel="More options"
              menuClassName="panel-options-menu"
              trigger={(props) => <button
                {...props}
                type="button"
                className="icon-button panel-options-trigger"
                aria-label="More options"
                title="More options"
              ><Ellipsis size={17} /></button>}
            >
              <button type="button" role="menuitem" onClick={() => { setServerMenuOpen(false); onOpenServerSettings(); }}>Server settings…</button>
            </OverlayMenu>
          </div>}
        </div>

        {serverSettingsOpen ? <section className="server-settings" aria-label="Server settings">
          <label className="field-label" htmlFor="logue-server-url">Server URL</label>
          <input
            id="logue-server-url"
            className="field"
            type="url"
            value={serverURLDraft}
            onChange={(event) => onServerURLDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); onConnectServer(); }
              if (event.key === "Escape") { event.preventDefault(); onCloseServerSettings(); }
            }}
            placeholder="https://logue.example.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(serverSettingsError)}
            aria-describedby={serverSettingsError ? "logue-server-url-error" : undefined}
            autoFocus
          />
          {serverSettingsError && <p id="logue-server-url-error" className="server-settings-error" role="alert">{serverSettingsError}</p>}
          <div className="server-settings-actions">
            <button type="button" className="button secondary" onClick={onCloseServerSettings} disabled={serverConnecting}>Cancel</button>
            <button type="button" className="button" onClick={onConnectServer} disabled={serverConnecting || !serverURLDraft.trim()}>{serverConnecting ? "Connecting…" : "Connect"}</button>
          </div>
        </section> : <>
        {presentation.showSource && <>
          {title && <h1 className="page-title">
            {sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noreferrer" title={title}>{title}</a> : title}
          </h1>}
          {state.selectionText && <blockquote className="selection">{state.selectionText}</blockquote>}
        </>}

        {presentation.status && <div className="processing" role="status"><span className="spinner" />{presentation.status}</div>}

        {presentation.showEditor && (state.intent === "generate" && generatedText ? (
          <section className="command-result" aria-label="Draft reply">
            <div className="command-result-heading">
              <h2>Draft reply</h2>
              <span>{commandSources.length} source{commandSources.length === 1 ? "" : "s"}</span>
            </div>
            <textarea className="text-area command-result-editor" value={generatedText} onChange={(event) => onGeneratedTextChange(event.target.value)} aria-label="Draft reply" />
            {commandSources.length > 0 && <div className="command-citations" aria-label="Sources used">
              {commandSources.map((source, index) => <button
                key={source.id}
                type="button"
                className="command-citation"
                aria-label={`Open source ${index + 1}: ${commandSourceLabel(source, index)}`}
                aria-pressed={openSourceId === source.id}
                onClick={() => setOpenSourceId((current) => current === source.id ? undefined : source.id)}
              >{index + 1}</button>)}
            </div>}
            {openedSource && <section className="command-source" aria-label="Source evidence">
              <div className="command-source-heading">
                <strong>{commandSourceLabel(openedSource, commandSources.indexOf(openedSource))}</strong>
                {openedSource.source?.url && /^https?:\/\//.test(openedSource.source.url) && <a href={openedSource.source.url} target="_blank" rel="noreferrer">Open page</a>}
              </div>
              {openedSource.source?.selection && openedSource.source.selection.trim() !== openedSource.content.trim() && <blockquote>{openedSource.source.selection}</blockquote>}
              <p>{openedSource.content}</p>
            </section>}
          </section>
        ) : error?.kind !== "service" ? (
          <textarea
            className="text-area"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={state.intent === "generate" ? "What should Logue write?" : state.selectionText ? "Add a note…" : state.intent === "input" ? "Write or record…" : "Add a note to this page…"}
            aria-label={state.intent === "generate" ? "Generation instruction" : state.selectionText ? "Annotation" : "Note"}
          />
        ) : null)}

        {presentation.showEditor && error?.kind !== "service" && state.intent === "generate" && !generatedText && (
          <label className="field-label generation-skill">Skill
            <select className="field" value={skillId} onChange={(event) => onSkillIdChange(event.target.value)}>
              {skills.length ? skills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No extension skills</option>}
            </select>
          </label>
        )}

        {presentation.showErrors && error?.kind === "service" ? <div className="error connection-error" role="alert">
          <p>Can’t reach Logue</p>
          {serverSettingsError && <p className="candidate-server-error">{serverSettingsError}</p>}
          <div className="connection-error-actions">
            {serverCandidateURL ? <button type="button" className="button connection-primary" onClick={onConnectCandidateServer} disabled={serverConnecting}>
              {serverConnecting ? "Connecting…" : `Connect to ${serverCandidateLabel(serverCandidateURL)}`}
            </button> : <button type="button" className="connection-link" onClick={onRetryServer} disabled={serverConnecting}>{serverConnecting ? "Retrying…" : "Retry"}</button>}
            <button type="button" className="connection-link" onClick={onOpenServerSettings} disabled={serverConnecting}>Change server…</button>
          </div>
        </div> : presentation.showErrors && error ? <div className="error" role="alert">{error.message}</div> : null}

        {presentation.showActions && (error?.kind !== "service" || Boolean(generatedText)) && <div className="actions">
          {phase === "starting" ? (
            <button type="button" className="button secondary" onClick={onCancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
          ) : phase === "recording" ? (
            <>
              <button type="button" className="button secondary" onClick={onCancelRecording} aria-keyshortcuts="Escape" title="Cancel (Esc)">Cancel</button>
              <button type="button" className="record-button recording" onClick={onStopRecording} aria-keyshortcuts="Enter" title="Stop and save (Enter)"><Square size={14} fill="currentColor" /> Stop <span className="shortcut">{elapsed}s</span></button>
            </>
          ) : state.intent === "generate" ? (
            <button type="button" className="icon-button" onClick={onReturnToPage} aria-label="Back to page capture" title="Back to page capture"><ArrowLeft size={17} /></button>
          ) : pendingInsert ? null : (
            <>
              <span style={{ position: "relative", display: "inline-flex" }}><button type="button" className="logue-profile-trigger" aria-expanded={voiceProfilePickerOpen} onClick={() => onVoiceProfilePickerOpenChange(!voiceProfilePickerOpen)} title={voiceProfileContext?.resolved_voice_profile.label || "Default voice profile"}><span>{voiceProfileContext?.resolved_voice_profile.label || "Default"}</span><ChevronDown size={12} /></button>{voiceProfilePickerOpen && <VoiceProfilePicker context={voiceProfileContext} overrides={voiceProfileOverrides} onChange={onVoiceProfileOverridesChange} onClose={() => onVoiceProfilePickerOpenChange(false)} />}</span>
              <button type="button" className="record-button" onClick={onStartRecording} aria-keyshortcuts="R" title="Record — R when this sidebar is focused"><Mic size={17} /> Record</button>
              {state.targetAvailable && <button type="button" className="icon-button" onClick={onRequestGeneration} aria-label="Generate reply" title="Generate reply"><Sparkles size={17} /></button>}
            </>
          )}
          {!presentation.captureActive && <>
            <span className="spacer" />
            {state.intent !== "generate" && error && canRetry && !pendingInsert && <button type="button" className="button secondary" onClick={onRetryTranscription}>Retry</button>}
            {state.intent !== "generate" && pendingInsert && <>
              <button type="button" className="button secondary" onClick={onCopyPendingInsert}>Copy</button>
              {state.targetAvailable && state.source.url === pendingInsert.sourceURL && <button type="button" className="button" disabled={insertingPending} onClick={onRetryInsert}>{insertingPending ? "Inserting…" : "Insert again"}</button>}
            </>}
            {state.intent === "generate" && generatedText ? <>
              <button type="button" className="button secondary" onClick={onCopyGenerated}>Copy</button>
              {generatedUndoAvailable ? <button type="button" className="button" onClick={onUndoGenerated}>Undo</button> : <button
                type="button"
                className="button"
                disabled={insertingGenerated}
                onClick={onInsertGenerated}
              >{insertingGenerated ? "Inserting…" : error?.kind === "target" ? "Retry" : "Insert"}</button>}
            </> : state.intent === "generate" ? <button
              type="button"
              className="button"
              disabled={!draft.trim() || !skillId || generating}
              onClick={onGenerate}
            >{generating ? "Generating…" : "Generate"}</button> : draft.trim() && !pendingInsert ? <button type="button" className="button" onClick={onSave}>Save</button> : null}
          </>}
        </div>}

        {error?.kind !== "service" && shouldShowPageHistory(presentation.showSavedMaterials, state.intent, pageMaterials.length) && (
          <section className="page-materials" aria-label="Notes from this page">
            <h2 className="page-materials-heading">On this page</h2>
            <ol className="page-materials-list">
              {pageMaterials.map((material) => <li key={material.id} className="page-material"><p className="page-material-text">{material.annotation?.trim() || material.content}</p></li>)}
            </ol>
          </section>
        )}
        </>}
      </div>
    </main>
  );
}
