import type { Candidate, DomainState, Id, MockSessionState, Skill, SkillCategory, SkillInputScope, SkillResolutionSource, SkillRevision, Source, SourceMembership } from "./types";
import { skillPolicyDefaults } from "./skillContract";

export const membershipId = (projectId: Id, sourceId: Id) => `${projectId}:${sourceId}`;
export const globalSkillBindingId = (category: SkillCategory) => `global:${category}`;
export const projectSkillBindingId = (projectId: Id, category: SkillCategory) => `project:${projectId}:${category}`;

export interface ResolvedSkill {
  skill: Skill;
  revision: SkillRevision;
  source: SkillResolutionSource;
}

function activeSkill(domain: DomainState, skillId: Id | undefined, category: SkillCategory, inputScope?: SkillInputScope) {
  const skill = skillId ? domain.skills[skillId] : undefined;
  if (!skill || skill.archived || (skill.origin === "built-in" && domain.hiddenBuiltInSkillIds.includes(skill.id)) || skill.category !== category) return undefined;
  if (inputScope && !skill.allowedInputScopes.includes(inputScope)) return undefined;
  return domain.skillRevisions[skill.currentRevisionId] ? skill : undefined;
}

export function getBindableSkills(domain: DomainState, category: SkillCategory): Skill[] {
  const requiredScopes = skillPolicyDefaults[category].allowedInputScopes;
  return getActiveSkills(domain, category).filter((skill) => requiredScopes.every((scope) => skill.allowedInputScopes.includes(scope)));
}

export function getActiveSkills(domain: DomainState, category?: SkillCategory, inputScope?: SkillInputScope): Skill[] {
  return Object.values(domain.skills).filter((skill) => {
    if (skill.archived || (skill.origin === "built-in" && domain.hiddenBuiltInSkillIds.includes(skill.id))) return false;
    if (category && skill.category !== category) return false;
    return !inputScope || skill.allowedInputScopes.includes(inputScope);
  });
}

export function resolveSkill(domain: DomainState, category: SkillCategory, options: { explicitSkillId?: Id; projectId?: Id | null; inputScope?: SkillInputScope } = {}): ResolvedSkill | undefined {
  const explicit = activeSkill(domain, options.explicitSkillId, category, options.inputScope);
  if (explicit) return { skill: explicit, revision: domain.skillRevisions[explicit.currentRevisionId], source: "explicit" };

  const projectBinding = options.projectId ? domain.skillBindings[projectSkillBindingId(options.projectId, category)] : undefined;
  const projectSkill = activeSkill(domain, projectBinding?.skillId, category, options.inputScope);
  if (projectSkill) return { skill: projectSkill, revision: domain.skillRevisions[projectSkill.currentRevisionId], source: "project" };

  const globalBinding = domain.skillBindings[globalSkillBindingId(category)];
  const globalSkill = activeSkill(domain, globalBinding?.skillId, category, options.inputScope);
  if (globalSkill) return { skill: globalSkill, revision: domain.skillRevisions[globalSkill.currentRevisionId], source: "global" };

  const systemSkill = Object.values(domain.skills).find((skill) => skill.systemDefault && Boolean(activeSkill(domain, skill.id, category, options.inputScope)));
  return systemSkill ? { skill: systemSkill, revision: domain.skillRevisions[systemSkill.currentRevisionId], source: "system" } : undefined;
}

export function getPinnedSkills(domain: DomainState, category: SkillCategory, inputScope: SkillInputScope): Skill[] {
  return domain.pinnedSkillIds
    .map((skillId) => activeSkill(domain, skillId, category, inputScope))
    .filter((skill): skill is Skill => skill !== undefined)
    .filter((skill) => !domain.hiddenBuiltInSkillIds.includes(skill.id));
}

export function getActiveTab(state: MockSessionState) {
  return state.domain.tabs[state.surface.activeTabId];
}

export function getProjectMembership(domain: DomainState, projectId: Id, sourceId: Id): SourceMembership | undefined {
  return domain.memberships[membershipId(projectId, sourceId)];
}

export function getProjectSources(domain: DomainState, projectId: Id): Source[] {
  return Object.values(domain.memberships)
    .filter((membership) => membership.projectId === projectId && membership.state === "added")
    .map((membership) => domain.sources[membership.sourceId])
    .filter((source): source is Source => Boolean(source));
}

export function getCommentBundle(domain: DomainState, commentSourceId: Id): { comment: Source; web: Source | undefined } | undefined {
  const comment = domain.sources[commentSourceId];
  if (!comment) return undefined;
  return { comment, web: comment.commentsOnSourceId ? domain.sources[comment.commentsOnSourceId] : undefined };
}

export function getCandidateCitations(domain: DomainState, candidateId: Id): Array<{ source: Source; revision: Source["revisions"][number]; excerpt: string; label: string }> {
  const candidate = domain.candidates[candidateId];
  if (!candidate) return [];
  return candidate.citations.flatMap((citation) => {
    const source = domain.sources[citation.sourceId];
    const revision = source?.revisions.find((item) => item.id === citation.revisionId);
    return source && revision ? [{ source, revision, excerpt: citation.excerpt, label: citation.label }] : [];
  });
}

export function getRunCandidate(domain: DomainState, runId: Id): Candidate | undefined {
  const candidateId = domain.runs[runId]?.candidateId;
  return candidateId ? domain.candidates[candidateId] : undefined;
}
