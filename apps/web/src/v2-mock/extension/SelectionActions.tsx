import { Check, ChevronDown, Copy, Search, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui";
import { getActiveSkills, getPinnedSkills, resolveSkill } from "../model/selectors";
import type { Skill, SkillInputScope } from "../model/types";
import { useMockSession } from "../runtime/MockSessionProvider";
import "../styles/surfaces.css";

export type SelectionActionScope = "selection" | "page" | "editable-selection";

const selected = "Participants returned to notes when preparing decisions, not while browsing.";
const selectionTargetId = "article-b-selection";

function SkillGroup({ label, skills, onRun }: { label: string; skills: Skill[]; onRun: (skill: Skill) => void }) {
  if (!skills.length) return null;
  return <section className="v2-skill-picker-group">
    <div className="v2-skill-picker-label">{label}</div>
    {skills.map((skill) => <button key={skill.id} type="button" onClick={() => onRun(skill)}>
      <span>{skill.name}</span>
      <small>{skill.description}</small>
    </button>)}
  </section>;
}

export function SelectionActions({ scope = "selection", initialMoreOpen = false, copyMode = "browser" }: { scope?: SelectionActionScope; initialMoreOpen?: boolean; copyMode?: "browser" | "failure" }) {
  const { state, dispatch } = useMockSession();
  const [moreOpen, setMoreOpen] = useState(initialMoreOpen);
  const [query, setQuery] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const lastSkillTriggerRef = useRef<HTMLElement | null>(null);
  const inputScope = scope as SkillInputScope;
  const pageScope = scope === "page";
  const editable = scope === "editable-selection";
  const tab = state.domain.tabs[state.surface.activeTabId];
  const page = tab ? state.domain.pages[tab.pageId] : undefined;
  const projectId = tab?.activeProjectId ?? null;
  const selectionTarget = state.domain.selectionTargets[selectionTargetId];
  const currentSelection = editable ? selectionTarget?.value ?? selected : selected;

  const activeCandidate = state.surface.activeCandidateId ? state.domain.candidates[state.surface.activeCandidateId] : undefined;
  const activeRun = activeCandidate ? state.domain.runs[activeCandidate.runId] : undefined;
  const candidate = activeRun?.skillId && activeRun.inputScope === inputScope ? activeCandidate : undefined;
  const skill = activeRun?.skillId ? state.domain.skills[activeRun.skillId] : undefined;
  const revision = activeRun?.skillRevisionId ? state.domain.skillRevisions[activeRun.skillRevisionId] : undefined;

  const available = useMemo(() => getActiveSkills(state.domain, "page-selection", inputScope), [inputScope, state.domain]);
  const pinned = getPinnedSkills(state.domain, "page-selection", inputScope);
  const recent = state.domain.recentSkillIds.map((id) => state.domain.skills[id]).filter((item): item is Skill => Boolean(item) && available.some((availableItem) => availableItem.id === item.id));
  const resolvedDefault = resolveSkill(state.domain, "page-selection", { projectId, inputScope });
  const direct = [resolvedDefault?.skill, ...pinned, ...recent]
    .filter((item): item is Skill => Boolean(item))
    .filter((item, index, items) => items.findIndex((candidateItem) => candidateItem.id === item.id) === index)
    .slice(0, 4);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (item: Skill) => !normalizedQuery || `${item.name} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery);
  const recentInPicker = recent.filter(matches);
  const remaining = available.filter((item) => !recentInPicker.some((recentItem) => recentItem.id === item.id) && matches(item));
  const mySkills = remaining.filter((item) => item.origin === "user");
  const builtIns = remaining.filter((item) => item.origin === "built-in");

  const focusLastSkillTrigger = () => {
    window.requestAnimationFrame(() => {
      const trigger = lastSkillTriggerRef.current;
      if (trigger?.isConnected) trigger.focus();
      else moreButtonRef.current?.focus();
    });
  };

  const closeMore = () => {
    setMoreOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  };

  const runSkill = (nextSkill: Skill, explicit = true) => {
    lastSkillTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : moreButtonRef.current;
    dispatch({
      type: "run-skill",
      category: "page-selection",
      inputScope,
      input: pageScope ? `${selected} Researchers captured information in unstable network conditions.` : currentSelection,
      explicitSkillId: explicit ? nextSkill.id : undefined,
      projectId,
      contextSourceIds: page?.webSourceId ? [page.webSourceId] : [],
    });
    setMoreOpen(false);
    setQuery("");
    setCopyError(null);
  };

  useEffect(() => {
    if (!moreOpen && (!candidate || candidate.status !== "ready")) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (moreOpen) {
        closeMore();
        return;
      }
      if (!candidate || candidate.status !== "ready") return;
      dispatch({ type: "dismiss-skill-candidate", candidateId: candidate.id });
      focusLastSkillTrigger();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [candidate, dispatch, moreOpen]);

  const copyResult = async () => {
    if (!candidate) return;
    try {
      if (copyMode === "failure" || !navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(candidate.content);
      dispatch({ type: "adopt-skill-candidate", candidateId: candidate.id, adoption: "copy" });
    } catch {
      setCopyError("Couldn’t copy. Try again.");
    }
  };

  return (
    <div className={`logue-v2 v2-action-stage${candidate ? " has-preview" : ""}`}>
      <article className="v2-action-page">
        <div className="v2-editor-eyebrow">research.example.com</div>
        <h1>{pageScope ? "Field research patterns" : "When notes become useful"}</h1>
        <p>Researchers captured information in unstable network conditions, but capture alone did not change the quality of the final decision.</p>
        <p className={pageScope ? undefined : "v2-action-selection"}>{currentSelection}</p>
        <p>The return path mattered: evidence had to be available at the moment it could change a choice.</p>

        <div className="v2-action-menu-wrap">
          <div className="v2-action-menu" role="toolbar" aria-label={pageScope ? "Page Skills" : "Selection Skills"}>
            {direct.map((item) => <button key={item.id} type="button" title={item.id === resolvedDefault?.skill.id ? `${resolvedDefault.source === "project" ? "Project" : resolvedDefault.source === "global" ? "Global" : "System"} default` : undefined} onClick={() => runSkill(item, item.id !== resolvedDefault?.skill.id)}>{item.name}</button>)}
            <button ref={moreButtonRef} type="button" aria-expanded={moreOpen} aria-controls="v2-more-skills" onClick={() => moreOpen ? closeMore() : setMoreOpen(true)}>More Skills <ChevronDown aria-hidden="true" size={14} /></button>
          </div>
          {moreOpen ? <div id="v2-more-skills" className="v2-skill-picker" role="dialog" aria-label="More Skills">
            <div className="v2-skill-picker-search"><Search aria-hidden="true" size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a Skill" aria-label="Find a Skill" /><button type="button" aria-label="Close Skills" onClick={closeMore}><X aria-hidden="true" size={15} /></button></div>
            <div className="v2-skill-picker-scroll">
              <SkillGroup label="Recent" skills={recentInPicker} onRun={runSkill} />
              <SkillGroup label="My Skills" skills={mySkills} onRun={runSkill} />
              <SkillGroup label="Built-ins" skills={builtIns} onRun={runSkill} />
              {!recentInPicker.length && !mySkills.length && !builtIns.length ? <p className="v2-skill-picker-empty">No matching Skills</p> : null}
            </div>
          </div> : null}
        </div>
      </article>

      {candidate && skill ? <aside className="v2-action-preview" aria-label="Skill result">
        <div className="v2-panel-section-heading"><h2>{skill.name}</h2></div>
        <p>{candidate.content}</p>
        <div className="v2-inline-actions v2-action-result-actions">
          {editable ? candidate.status === "adopted" ? <Button size="sm" onClick={() => dispatch({ type: "undo-skill-adoption", candidateId: candidate.id, selectionTargetId })}><Undo2 aria-hidden="true" size={14} />Undo replace</Button> : <Button size="sm" variant="primary" onClick={() => dispatch({ type: "adopt-skill-candidate", candidateId: candidate.id, adoption: "replace", selectionTargetId })}>Replace</Button> : <Button size="sm" variant="primary" onClick={() => void copyResult()}><Copy aria-hidden="true" size={14} />Copy</Button>}
          {candidate.status === "ready" ? <Button size="sm" onClick={() => dispatch({ type: "dismiss-skill-candidate", candidateId: candidate.id })}>Cancel</Button> : <span className="v2-local-ready"><Check aria-hidden="true" size={14} />Applied</span>}
        </div>
        {copyError ? <p className="v2-local-error" role="alert">{copyError}</p> : null}
        <details className="v2-skill-run-details"><summary>Details</summary><p>{skill.name} · revision {revision?.version ?? "—"} · {activeRun?.skillResolution ?? "system"} · {activeRun?.actualContextSourceIds.length ?? 0} context source{activeRun?.actualContextSourceIds.length === 1 ? "" : "s"}</p></details>
      </aside> : null}
    </div>
  );
}
