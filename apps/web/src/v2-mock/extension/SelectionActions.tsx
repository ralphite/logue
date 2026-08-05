import { Check, ChevronDown, Copy, Search, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui";
import { getPinnedSkills } from "../model/selectors";
import type { Skill, SkillInputScope } from "../model/types";
import { useMockSession } from "../runtime/MockSessionProvider";
import "../styles/surfaces.css";

export type SelectionActionScope = "selection" | "page" | "editable-selection";

const selected = "Participants returned to notes when preparing decisions, not while browsing.";

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

export function SelectionActions({ scope = "selection", initialMoreOpen = false }: { scope?: SelectionActionScope; initialMoreOpen?: boolean }) {
  const { state, dispatch } = useMockSession();
  const [moreOpen, setMoreOpen] = useState(initialMoreOpen);
  const [query, setQuery] = useState("");
  const inputScope = scope as SkillInputScope;
  const pageScope = scope === "page";
  const editable = scope === "editable-selection";
  const tab = state.domain.tabs[state.surface.activeTabId];
  const page = tab ? state.domain.pages[tab.pageId] : undefined;
  const projectId = tab?.activeProjectId ?? null;

  const activeCandidate = state.surface.activeCandidateId ? state.domain.candidates[state.surface.activeCandidateId] : undefined;
  const activeRun = activeCandidate ? state.domain.runs[activeCandidate.runId] : undefined;
  const candidate = activeRun?.skillId && activeRun.inputScope === inputScope ? activeCandidate : undefined;
  const skill = activeRun?.skillId ? state.domain.skills[activeRun.skillId] : undefined;

  const available = useMemo(() => Object.values(state.domain.skills).filter((item) => !item.archived && item.category === "page-selection" && item.allowedInputScopes.includes(inputScope)), [inputScope, state.domain.skills]);
  const pinned = getPinnedSkills(state.domain, "page-selection", inputScope);
  const recent = state.domain.recentSkillIds.map((id) => state.domain.skills[id]).filter((item): item is Skill => Boolean(item) && !item.archived && item.category === "page-selection" && item.allowedInputScopes.includes(inputScope));
  const direct = [...pinned, ...recent.filter((item) => !pinned.some((pinnedItem) => pinnedItem.id === item.id))].slice(0, 4);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (item: Skill) => !normalizedQuery || `${item.name} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery);
  const recentInPicker = recent.filter(matches);
  const remaining = available.filter((item) => !recentInPicker.some((recentItem) => recentItem.id === item.id) && matches(item));
  const mySkills = remaining.filter((item) => item.origin === "user");
  const builtIns = remaining.filter((item) => item.origin === "built-in");

  const runSkill = (nextSkill: Skill) => {
    dispatch({
      type: "run-skill",
      category: "page-selection",
      inputScope,
      input: pageScope ? `${selected} Researchers captured information in unstable network conditions.` : selected,
      explicitSkillId: nextSkill.id,
      projectId,
      contextSourceIds: page?.webSourceId ? [page.webSourceId] : [],
    });
    setMoreOpen(false);
    setQuery("");
  };

  const copyResult = () => {
    if (!candidate) return;
    void navigator.clipboard?.writeText(candidate.content).catch(() => undefined);
    dispatch({ type: "adopt-skill-candidate", candidateId: candidate.id, adoption: "copy" });
  };

  const visibleText = editable && candidate?.status === "adopted" && candidate.adoption === "replace" ? candidate.content : selected;

  return (
    <div className={`logue-v2 v2-action-stage${candidate ? " has-preview" : ""}`}>
      <article className="v2-action-page">
        <div className="v2-editor-eyebrow">research.example.com</div>
        <h1>{pageScope ? "Field research patterns" : "When notes become useful"}</h1>
        <p>Researchers captured information in unstable network conditions, but capture alone did not change the quality of the final decision.</p>
        <p className={pageScope ? undefined : "v2-action-selection"}>{visibleText}</p>
        <p>The return path mattered: evidence had to be available at the moment it could change a choice.</p>

        <div className="v2-action-menu-wrap">
          <div className="v2-action-menu" role="toolbar" aria-label={pageScope ? "Page Skills" : "Selection Skills"}>
            {direct.map((item) => <button key={item.id} type="button" onClick={() => runSkill(item)}>{item.name}</button>)}
            <button type="button" aria-expanded={moreOpen} aria-controls="v2-more-skills" onClick={() => setMoreOpen((open) => !open)}>More Skills <ChevronDown aria-hidden="true" size={14} /></button>
          </div>
          {moreOpen ? <div id="v2-more-skills" className="v2-skill-picker" role="dialog" aria-label="More Skills">
            <div className="v2-skill-picker-search"><Search aria-hidden="true" size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a Skill" aria-label="Find a Skill" /><button type="button" aria-label="Close Skills" onClick={() => setMoreOpen(false)}><X aria-hidden="true" size={15} /></button></div>
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
          {editable ? candidate.status === "adopted" ? <Button size="sm" onClick={() => dispatch({ type: "undo-skill-adoption", candidateId: candidate.id })}><Undo2 aria-hidden="true" size={14} />Undo replace</Button> : <Button size="sm" variant="primary" onClick={() => dispatch({ type: "adopt-skill-candidate", candidateId: candidate.id, adoption: "replace" })}>Replace</Button> : <Button size="sm" variant="primary" onClick={copyResult}><Copy aria-hidden="true" size={14} />Copy</Button>}
          {candidate.status === "ready" ? <Button size="sm" onClick={() => dispatch({ type: "dismiss-skill-candidate", candidateId: candidate.id })}>Cancel</Button> : <span className="v2-local-ready"><Check aria-hidden="true" size={14} />Applied</span>}
        </div>
      </aside> : null}
    </div>
  );
}
