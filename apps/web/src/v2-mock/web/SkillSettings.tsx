import { Archive, Copy, Eye, EyeOff, Pin, PinOff, Plus, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/ui";
import { getActiveSkills, getBindableSkills, globalSkillBindingId, resolveSkill } from "../model/selectors";
import { skillPolicyDefaults, skillScopeLabels, skillTriggerLabels } from "../model/skillContract";
import type { Skill, SkillCategory, SkillInputScope, SkillOutputFormat, SkillProjectContext, SkillResultBehavior } from "../model/types";
import { useMockSession } from "../runtime/MockSessionProvider";

export type SkillSettingsView = "Built-ins" | "My Skills" | "Global defaults";

const categoryRows: Array<{ category: SkillCategory; label: string; detail: string }> = [
  { category: "transcription", label: "Voice transcription", detail: "Turns speech into accurate text." },
  { category: "transformation", label: "Voice cleanup", detail: "Shapes a transcript after recognition." },
  { category: "page-selection", label: "Page and selection", detail: "Default for the Selection Skill shortcut." },
  { category: "organization", label: "Organization", detail: "Suggests where saved Sources belong." },
  { category: "generation", label: "Ask and draft", detail: "Creates answers and drafts from actual Sources." },
];

function SkillEditor({ skillId, onClose, onCreated }: { skillId: string | null; onClose: () => void; onCreated: (skillId: string) => void }) {
  const { state, dispatch } = useMockSession();
  const skill = skillId ? state.domain.skills[skillId] : undefined;
  const revision = skill ? state.domain.skillRevisions[skill.currentRevisionId] : undefined;
  const builtIn = skill?.origin === "built-in";
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [instruction, setInstruction] = useState(revision?.instruction ?? "");
  const [category, setCategory] = useState<SkillCategory>(skill?.category ?? "page-selection");
  const policy = skillPolicyDefaults[category];
  const [allowedInputScopes, setAllowedInputScopes] = useState<SkillInputScope[]>(skill?.allowedInputScopes ?? policy.allowedInputScopes);
  const [outputFormat, setOutputFormat] = useState<SkillOutputFormat>(revision?.outputFormat ?? policy.outputFormat);
  const [languageTone, setLanguageTone] = useState(revision?.languageTone ?? policy.languageTone);
  const [projectContext, setProjectContext] = useState<SkillProjectContext>(revision?.projectContext ?? policy.projectContext);
  const [resultBehavior, setResultBehavior] = useState<SkillResultBehavior>(revision?.resultBehavior ?? policy.resultBehavior);

  useEffect(() => {
    setName(skill?.name ?? "");
    setDescription(skill?.description ?? "");
    setInstruction(revision?.instruction ?? "");
    setCategory(skill?.category ?? "page-selection");
    const nextCategory = skill?.category ?? "page-selection";
    const nextPolicy = skillPolicyDefaults[nextCategory];
    setAllowedInputScopes(skill?.allowedInputScopes ?? nextPolicy.allowedInputScopes);
    setOutputFormat(revision?.outputFormat ?? nextPolicy.outputFormat);
    setLanguageTone(revision?.languageTone ?? nextPolicy.languageTone);
    setProjectContext(revision?.projectContext ?? nextPolicy.projectContext);
    setResultBehavior(revision?.resultBehavior ?? nextPolicy.resultBehavior);
  }, [revision?.id, skill?.category, skill?.description, skill?.id, skill?.name]);

  const commitRevision = () => {
    if (!skill || builtIn) return;
    dispatch({ type: "revise-my-skill", skillId: skill.id, name, description, instruction, allowedInputScopes, outputFormat, languageTone, projectContext, resultBehavior });
  };

  const createSkill = () => {
    if (!name.trim() || !instruction.trim()) return;
    const nextSkillId = `skill-${state.domain.nextId}`;
    dispatch({ type: "create-my-skill", name, description, category, instruction, allowedInputScopes, outputFormat, languageTone, projectContext, resultBehavior });
    onCreated(nextSkillId);
  };

  const changeCategory = (nextCategory: SkillCategory) => {
    const nextPolicy = skillPolicyDefaults[nextCategory];
    setCategory(nextCategory);
    setAllowedInputScopes(nextPolicy.allowedInputScopes);
    setOutputFormat(nextPolicy.outputFormat);
    setLanguageTone(nextPolicy.languageTone);
    setProjectContext(nextPolicy.projectContext);
    setResultBehavior(nextPolicy.resultBehavior);
  };

  const toggleScope = (scope: SkillInputScope) => {
    setAllowedInputScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  };

  return <aside className="v2-skill-editor" aria-label={skill ? `${skill.name} Skill` : "New Skill"}>
    <div className="v2-skill-editor-heading"><div><strong>{skill ? skill.name : "New Skill"}</strong>{skill ? <span>{builtIn ? "Built-in · read only" : `My Skill · revision ${revision?.version ?? 1}`}</span> : <span>My Skill</span>}</div><IconButton label="Close Skill" variant="ghost" onClick={onClose}><X aria-hidden="true" size={16} /></IconButton></div>
    <label>Name<input value={name} disabled={builtIn} onChange={(event) => setName(event.target.value)} onBlur={commitRevision} /></label>
    <label>Purpose<input value={description} disabled={builtIn} onChange={(event) => setDescription(event.target.value)} onBlur={commitRevision} /></label>
    <label>Type<select value={category} disabled={Boolean(skill)} onChange={(event) => changeCategory(event.target.value as SkillCategory)}>{categoryRows.map((row) => <option key={row.category} value={row.category}>{row.label}</option>)}</select></label>
    <label>Instructions<textarea value={instruction} disabled={builtIn} onChange={(event) => setInstruction(event.target.value)} onBlur={commitRevision} /></label>
    <details className="v2-skill-advanced">
      <summary>Advanced</summary>
      <div className="v2-skill-advanced-fields">
        <div className="v2-skill-readonly-field"><span>Trigger</span><strong>{skillTriggerLabels[skill?.trigger ?? policy.trigger]}</strong></div>
        <fieldset disabled={builtIn}><legend>Applies in</legend><div className="v2-skill-scope-options">{policy.allowedInputScopes.map((scope) => <label key={scope}><input type="checkbox" checked={allowedInputScopes.includes(scope)} onChange={() => toggleScope(scope)} onBlur={commitRevision} />{skillScopeLabels[scope]}</label>)}</div></fieldset>
        <label>Output<select value={outputFormat} disabled={builtIn} onChange={(event) => setOutputFormat(event.target.value as SkillOutputFormat)} onBlur={commitRevision}><option value="plain-text">Plain text</option><option value="markdown">Markdown</option><option value="project-suggestion">Project suggestion</option></select></label>
        <label>Language and tone<input value={languageTone} disabled={builtIn} onChange={(event) => setLanguageTone(event.target.value)} onBlur={commitRevision} /></label>
        <label>Project Context<select value={projectContext} disabled={builtIn} onChange={(event) => setProjectContext(event.target.value as SkillProjectContext)} onBlur={commitRevision}><option value="never">Never</option><option value="optional">When available</option><option value="required">Required</option></select></label>
        <label>Result<select value={resultBehavior} disabled={builtIn} onChange={(event) => setResultBehavior(event.target.value as SkillResultBehavior)} onBlur={commitRevision}><option value="transcript-revision">Transcript revision</option><option value="replace-or-copy">Replace or copy</option><option value="membership-suggestion">Project suggestion</option><option value="insert-copy-or-document">Insert, copy, or document</option></select></label>
      </div>
    </details>
    {!skill ? <Button variant="primary" onClick={createSkill} disabled={!name.trim() || !instruction.trim() || !allowedInputScopes.length}><Plus aria-hidden="true" size={15} />Create Skill</Button> : builtIn ? <Button onClick={() => {
      const nextSkillId = `skill-${state.domain.nextId}`;
      dispatch({ type: "duplicate-skill", skillId: skill.id });
      onCreated(nextSkillId);
    }}><Copy aria-hidden="true" size={15} />Duplicate to My Skills</Button> : null}
  </aside>;
}

function SkillRow({ skill, children, onOpen }: { skill: Skill; children: ReactNode; onOpen?: () => void }) {
  const { state } = useMockSession();
  const revision = state.domain.skillRevisions[skill.currentRevisionId];
  return <div className="v2-skill-row">
    <button type="button" className="v2-skill-row-main" onClick={onOpen}><strong>{skill.name}</strong><span>{skill.description}</span><small>{skill.category.replace("-", " / ")} · revision {revision?.version ?? "—"}</small></button>
    <div className="v2-inline-actions">{children}</div>
  </div>;
}

export function SkillSettings({ initialView = "Built-ins" }: { initialView?: SkillSettingsView }) {
  const { state, dispatch } = useMockSession();
  const [view, setView] = useState<SkillSettingsView>(initialView);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchesSearch = (skill: Skill) => !normalizedSearch || `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(normalizedSearch);
  const builtIns = useMemo(() => Object.values(state.domain.skills).filter((skill) => skill.origin === "built-in"), [state.domain.skills]);
  const mySkills = useMemo(() => Object.values(state.domain.skills).filter((skill) => skill.origin === "user" && (showArchived || !skill.archived)), [showArchived, state.domain.skills]);
  const pageSkills = getActiveSkills(state.domain, "page-selection");

  const openCreated = (skillId: string) => {
    setView("My Skills");
    setCreating(false);
    setSelectedSkillId(skillId);
  };

  return <div className="v2-skill-settings">
    <div className="v2-skill-tabs" role="tablist" aria-label="Skill settings">{(["Built-ins", "My Skills", "Global defaults"] as SkillSettingsView[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={view === tab} className={view === tab ? "is-active" : ""} onClick={() => { setView(tab); setCreating(false); setSelectedSkillId(null); }}>{tab}</button>)}</div>

    {view === "Built-ins" ? <><label className="v2-skill-search"><Search aria-hidden="true" size={15} /><input aria-label="Search Built-in Skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Skills" /></label><div className="v2-skill-workbench">
      <section className="v2-skill-list" aria-label="Built-in Skills">{builtIns.filter(matchesSearch).map((skill) => {
        const hidden = state.domain.hiddenBuiltInSkillIds.includes(skill.id);
        const pinned = state.domain.pinnedSkillIds.includes(skill.id);
        return <SkillRow key={skill.id} skill={skill} onOpen={() => { setCreating(false); setSelectedSkillId(skill.id); }}>
          {skill.category === "page-selection" && !hidden ? <Button size="sm" onClick={() => dispatch({ type: "set-skill-pinned", skillId: skill.id, pinned: !pinned })}>{pinned ? <PinOff aria-hidden="true" size={14} /> : <Pin aria-hidden="true" size={14} />}{pinned ? "Unpin" : "Pin"}</Button> : null}
          <Button size="sm" onClick={() => {
            const nextSkillId = `skill-${state.domain.nextId}`;
            dispatch({ type: "duplicate-skill", skillId: skill.id });
            openCreated(nextSkillId);
          }}><Copy aria-hidden="true" size={14} />Duplicate</Button>
          <Button size="sm" onClick={() => dispatch({ type: "set-built-in-hidden", skillId: skill.id, hidden: !hidden })}>{hidden ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}{hidden ? "Show" : "Hide"}</Button>
        </SkillRow>;
      })}</section>
      {selectedSkillId ? <SkillEditor skillId={selectedSkillId} onClose={() => setSelectedSkillId(null)} onCreated={openCreated} /> : null}
    </div></> : null}

    {view === "My Skills" ? <div>
      <div className="v2-skill-toolbar"><Button variant="primary" onClick={() => { setSelectedSkillId(null); setCreating(true); }}><Plus aria-hidden="true" size={15} />New Skill</Button><label className="v2-skill-search"><Search aria-hidden="true" size={15} /><input aria-label="Search My Skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Skills" /></label><button type="button" onClick={() => setShowArchived((shown) => !shown)}>{showArchived ? "Hide archived" : "Show archived"}</button></div>
      <div className="v2-skill-workbench">
        <section className="v2-skill-list" aria-label="My Skills">{mySkills.filter(matchesSearch).map((skill) => <SkillRow key={skill.id} skill={skill} onOpen={() => { setCreating(false); setSelectedSkillId(skill.id); }}>
          {skill.archived ? <Button size="sm" onClick={() => dispatch({ type: "set-skill-archived", skillId: skill.id, archived: false })}><RotateCcw aria-hidden="true" size={14} />Restore</Button> : <>
            {skill.category === "page-selection" ? <Button size="sm" onClick={() => dispatch({ type: "set-skill-pinned", skillId: skill.id, pinned: !state.domain.pinnedSkillIds.includes(skill.id) })}>{state.domain.pinnedSkillIds.includes(skill.id) ? <PinOff aria-hidden="true" size={14} /> : <Pin aria-hidden="true" size={14} />}{state.domain.pinnedSkillIds.includes(skill.id) ? "Unpin" : "Pin"}</Button> : null}
            <Button size="sm" onClick={() => {
              const nextSkillId = `skill-${state.domain.nextId}`;
              dispatch({ type: "duplicate-skill", skillId: skill.id });
              openCreated(nextSkillId);
            }}><Copy aria-hidden="true" size={14} />Duplicate</Button>
            <Button size="sm" onClick={() => { dispatch({ type: "set-skill-archived", skillId: skill.id, archived: true }); setSelectedSkillId(null); }}><Archive aria-hidden="true" size={14} />Archive</Button>
          </>}
        </SkillRow>)}</section>
        {creating ? <SkillEditor skillId={null} onClose={() => setCreating(false)} onCreated={openCreated} /> : selectedSkillId ? <SkillEditor skillId={selectedSkillId} onClose={() => setSelectedSkillId(null)} onCreated={openCreated} /> : null}
      </div>
    </div> : null}

    {view === "Global defaults" ? <div className="v2-global-skill-settings">
      <section>
        <h2>Default Skills</h2>
        {categoryRows.map((row) => {
          const binding = state.domain.skillBindings[globalSkillBindingId(row.category)];
          const resolved = resolveSkill(state.domain, row.category);
          const choices = getBindableSkills(state.domain, row.category);
          return <div className="v2-default-skill-row" key={row.category}><div><div className="v2-skill-row-title"><strong>{row.label}</strong><span className="v2-quiet-pill">{binding ? "Global" : "System"} · revision {resolved?.revision.version ?? "—"}</span></div><p>{row.detail}</p></div><select aria-label={`Default for ${row.label}`} value={resolved?.skill.id ?? ""} onChange={(event) => dispatch({ type: "set-global-skill-binding", category: row.category, skillId: event.target.value })}>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></div>;
        })}
      </section>
      <section>
        <h2>Pinned selection actions</h2>
        <div className="v2-skill-list">{pageSkills.map((skill) => <div className="v2-default-skill-row" key={skill.id}><div><strong>{skill.name}</strong><p>{skill.description}</p></div><Button size="sm" onClick={() => dispatch({ type: "set-skill-pinned", skillId: skill.id, pinned: !state.domain.pinnedSkillIds.includes(skill.id) })}>{state.domain.pinnedSkillIds.includes(skill.id) ? <PinOff aria-hidden="true" size={14} /> : <Pin aria-hidden="true" size={14} />}{state.domain.pinnedSkillIds.includes(skill.id) ? "Unpin" : "Pin"}</Button></div>)}</div>
      </section>
    </div> : null}
  </div>;
}
