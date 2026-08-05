import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui";
import { getBindableSkills, projectSkillBindingId, resolveSkill } from "../model/selectors";
import type { SkillCategory } from "../model/types";
import { useMockSession } from "../runtime/MockSessionProvider";

const categoryRows: Array<{ category: SkillCategory; label: string; detail: string }> = [
  { category: "transcription", label: "Voice transcription", detail: "Recognize this Project’s terms and preferred spelling." },
  { category: "transformation", label: "Voice cleanup", detail: "Shape voice notes after transcription." },
  { category: "page-selection", label: "Page and selection", detail: "Default for the Selection Skill shortcut." },
  { category: "organization", label: "Organization", detail: "Suggest relevant Project membership." },
  { category: "generation", label: "Ask and draft", detail: "Answer and draft from this Project’s Sources." },
];

export function ProjectSkillSettings({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { state, dispatch } = useMockSession();
  const project = state.domain.projects[projectId];
  return <div className="v2-editor-scroll">
    <main className="v2-project-settings-axis">
      <button type="button" className="v2-back-link" onClick={onClose}><ArrowLeft aria-hidden="true" size={15} />Back to document</button>
      <div className="v2-page-heading-copy"><div className="v2-editor-eyebrow">Project settings</div><h1 className="v2-settings-title">Skills</h1><p className="v2-settings-lead">Choose where {project.name} should differ from Global defaults.</p></div>
      <section className="v2-project-skill-list" aria-label={`${project.name} Skills`}>
        {categoryRows.map((row) => {
          const bindingId = projectSkillBindingId(project.id, row.category);
          const binding = state.domain.skillBindings[bindingId];
          const resolved = resolveSkill(state.domain, row.category, { projectId: project.id });
          const choices = getBindableSkills(state.domain, row.category);
          return <div className="v2-project-skill-row" key={row.category}>
            <div><div className="v2-skill-row-title"><strong>{row.label}</strong><span className="v2-quiet-pill">{binding ? "Override" : `Inherited · ${resolved?.source === "global" ? "Global" : "System"}`} · revision {resolved?.revision.version ?? "—"}</span></div><p>{row.detail}</p></div>
            <div className="v2-project-skill-controls">
              <select aria-label={`${row.label} for ${project.name}`} value={resolved?.skill.id ?? ""} onChange={(event) => dispatch({ type: "set-project-skill-binding", projectId: project.id, category: row.category, skillId: event.target.value })}>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select>
              {binding ? <Button size="sm" onClick={() => dispatch({ type: "reset-project-skill-binding", projectId: project.id, category: row.category })}><RotateCcw aria-hidden="true" size={14} />Reset</Button> : null}
            </div>
          </div>;
        })}
      </section>
    </main>
  </div>;
}
