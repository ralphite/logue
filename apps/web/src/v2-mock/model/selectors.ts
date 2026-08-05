import type { Candidate, DomainState, Id, MockSessionState, Source, SourceMembership } from "./types";

export const membershipId = (projectId: Id, sourceId: Id) => `${projectId}:${sourceId}`;

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

export function getCandidateCitations(domain: DomainState, candidateId: Id): Array<{ source: Source; excerpt: string; label: string }> {
  const candidate = domain.candidates[candidateId];
  if (!candidate) return [];
  return candidate.citations.flatMap((citation) => {
    const source = domain.sources[citation.sourceId];
    return source ? [{ source, excerpt: citation.excerpt, label: citation.label }] : [];
  });
}

export function getRunCandidate(domain: DomainState, runId: Id): Candidate | undefined {
  const candidateId = domain.runs[runId]?.candidateId;
  return candidateId ? domain.candidates[candidateId] : undefined;
}
