import { describe, expect, it } from "vitest";
import { createCanonicalScenario } from "../v2-mock/fixtures/canonicalScenario";
import { createStorySeed } from "../v2-mock/fixtures/storySeeds";
import { reduceMockSession } from "../v2-mock/model/reducer";
import { getCandidateCitations, getCommentBundle, getProjectMembership, getProjectSources, resolveSkill } from "../v2-mock/model/selectors";

describe("V2 mock model", () => {
  it("keeps a stopped voice comment as a saved-only You source before linking", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "select-article", tabId: "research-tab", pageId: "article-a" });
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    state = reduceMockSession(state, { type: "stop-voice-comment", transcript: "This matters for field work." });

    const comment = state.domain.sources["you-comment-100"];
    expect(comment).toMatchObject({ origin: "you", status: "saved", pageId: "article-a" });
    expect(comment.audio).toBeDefined();
    expect(comment.commentsOnSourceId).toBeUndefined();
    expect(getProjectMembership(state.domain, "project-a", comment.id)).toBeUndefined();
  });

  it("creates a Web/You comment bundle, reuses page evidence, and applies tab membership to both", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "set-tab-project", tabId: "research-tab", projectId: "project-a" });
    state = reduceMockSession(state, { type: "select-article", tabId: "research-tab", pageId: "article-a" });
    state = reduceMockSession(state, { type: "start-voice-comment", tabId: "research-tab" });
    state = reduceMockSession(state, { type: "stop-voice-comment", transcript: "Keep this evidence close to the reply." });
    state = reduceMockSession(state, { type: "edit-voice-comment", sourceId: "you-comment-100", content: "Keep this evidence close to the product decision." });
    state = reduceMockSession(state, { type: "save-comment-bundle", tabId: "research-tab", commentSourceId: "you-comment-100" });

    const bundle = getCommentBundle(state.domain, "you-comment-100");
    expect(bundle?.web?.id).toBe("web-a");
    expect(bundle?.comment.commentsOnSourceId).toBe("web-a");
    expect(bundle?.comment.revisions.at(-1)?.content).toBe("Keep this evidence close to the product decision.");
    expect(getProjectMembership(state.domain, "project-a", "web-a")?.state).toBe("added");
    expect(getProjectMembership(state.domain, "project-a", "you-comment-100")).toMatchObject({ state: "added", reason: "tab-authorized" });
  });

  it("keeps tab Project when navigating and adds a text comment bundle to that Project", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "select-article", tabId: "research-tab", pageId: "article-b" });
    state = reduceMockSession(state, { type: "save-text-comment", tabId: "research-tab", text: "This gives the email its decision framing." });

    expect(state.domain.tabs["research-tab"].activeProjectId).toBe("project-a");
    expect(state.domain.sources["you-comment-100"].commentsOnSourceId).toBe("web-b");
    expect(getProjectMembership(state.domain, "project-a", "you-comment-100")?.state).toBe("added");
    expect(getProjectSources(state.domain, "project-a").map((source) => source.id)).toContain("you-comment-100");
  });

  it("records actual draft inputs and resolves citations to the specific sources", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "open-email-target", targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "parse-command", transcript: "Using Mobile research, draft a reply", projectId: "project-a", targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "execute-command", activityId: "activity-record-101", contextSourceIds: ["web-a", "you-b", "missing-source"] });
    state = reduceMockSession(state, {
      type: "generate-sourced-draft", runId: "run-102",
      citations: [
        { sourceId: "web-a", label: "Article A", excerpt: "offline capture" },
        { sourceId: "you-b", label: "Your thought", excerpt: "decision framing" },
        { sourceId: "web-b", label: "Not used", excerpt: "not included" },
      ],
    });

    expect(state.domain.runs["run-102"]).toMatchObject({ actualContextSourceIds: ["web-a", "you-b"], skillId: "skill-draft-reply", skillRevisionId: "skill-draft-reply-r2", skillResolution: "global", inputScope: "project-sources" });
    expect(state.domain.candidates["candidate-103"].content).toContain("offline capture");
    expect(getCandidateCitations(state.domain, "candidate-103").map((citation) => citation.source.id)).toEqual(["web-a", "you-b"]);
  });

  it("materializes AI only on Insert and Undo changes only the host target", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "edit-candidate", candidateId: "candidate-existing", content: "Edited sourced reply." });
    state = reduceMockSession(state, { type: "insert-candidate", candidateId: "candidate-existing", targetSessionId: "email-target" });
    const afterInsert = state;
    state = reduceMockSession(state, { type: "undo-target", targetSessionId: "email-target" });

    expect(afterInsert.domain.sources["ai-candidate-existing"]).toMatchObject({ origin: "ai", parentSourceIds: ["web-a", "you-a", "web-b", "you-b"] });
    expect(state.domain.candidates["candidate-existing"].status).toBe("adopted");
    expect(state.domain.targetSessions["email-target"].value).toBe("Hi Maya,");
    expect(state.domain.sources["ai-candidate-existing"]).toEqual(afterInsert.domain.sources["ai-candidate-existing"]);
  });

  it("persists Voice Write on Stop and keeps the adopted revision after target Undo", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "start-voice-write", tabId: "research-tab", targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "stop-voice-write", transcript: "Keep the field evidence in the reply.", transcriptionProfileId: "global" });
    state = reduceMockSession(state, { type: "retranscribe-voice-write", sourceId: "you-write-100", transcript: "Keep field evidence connected to the reply.", transcriptionProfileId: "project-a" });
    state = reduceMockSession(state, { type: "edit-voice-write", sourceId: "you-write-100", content: "Keep field evidence in the reply." });
    state = reduceMockSession(state, { type: "insert-voice-write", sourceId: "you-write-100", targetSessionId: "email-target" });
    const afterInsert = state;
    state = reduceMockSession(state, { type: "undo-target", targetSessionId: "email-target" });

    expect(afterInsert.domain.sources["you-write-100"]).toMatchObject({ origin: "you", status: "saved", title: "Voice write" });
    expect(afterInsert.domain.sources["you-write-100"].revisions.map((revision) => revision.kind)).toEqual(["raw", "normalized", "candidate", "candidate", "adopted"]);
    expect(afterInsert.domain.sources["you-write-100"].revisions.filter((revision) => revision.kind === "candidate").at(-1)).toMatchObject({ content: "Keep field evidence in the reply.", transcriptionProfileId: "project-a" });
    expect(getProjectMembership(afterInsert.domain, "project-a", "you-write-100")?.state).toBe("suggested");
    expect(state.domain.targetSessions["email-target"].value).toBe("Hi Maya,");
    expect(state.domain.sources["you-write-100"].revisions.at(-1)?.kind).toBe("adopted");
  });

  it("cancels an unfinished Voice Write without creating a Source", () => {
    let state = createCanonicalScenario();
    const sourceCount = Object.keys(state.domain.sources).length;
    state = reduceMockSession(state, { type: "start-voice-write", tabId: "research-tab", targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "cancel-recording" });

    expect(state.surface.recording).toBeNull();
    expect(Object.keys(state.domain.sources)).toHaveLength(sourceCount);
  });

  it("persists classification corrections and never treats a suggestion as Project Context", () => {
    let state = createCanonicalScenario();
    expect(getProjectMembership(state.domain, "project-a", "you-suggested")?.state).toBe("suggested");
    expect(getProjectSources(state.domain, "project-a").map((source) => source.id)).not.toContain("you-suggested");

    state = reduceMockSession(state, { type: "set-source-membership", sourceId: "you-suggested", projectId: "project-a", state: "added" });
    expect(getProjectSources(state.domain, "project-a").map((source) => source.id)).toContain("you-suggested");
    state = reduceMockSession(state, { type: "set-source-membership", sourceId: "you-suggested", projectId: "project-a", state: "excluded" });
    expect(getProjectMembership(state.domain, "project-a", "you-suggested")).toMatchObject({ state: "excluded", reason: "user-selected" });
    expect(getProjectSources(state.domain, "project-a").map((source) => source.id)).not.toContain("you-suggested");
  });

  it("restores, retries, and deletes an unadopted Run without deleting its Activity", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "retry-run", runId: "run-cancelled" });
    const retryRun = state.domain.runs["run-100"];
    const retryCandidate = state.domain.candidates["candidate-101"];
    expect(retryRun).toMatchObject({ activityId: "activity-cancelled", status: "succeeded", candidateId: "candidate-101" });
    expect(retryCandidate.status).toBe("ready");

    state = reduceMockSession(state, { type: "restore-run", runId: retryRun.id });
    expect(state.surface.activeCandidateId).toBe(retryCandidate.id);
    state = reduceMockSession(state, { type: "delete-run", runId: retryRun.id });
    expect(state.domain.runs[retryRun.id]).toBeUndefined();
    expect(state.domain.candidates[retryCandidate.id]).toBeUndefined();
    expect(state.domain.activities["activity-cancelled"]).toBeDefined();
    expect(state.domain.sources["activity-cancelled-source"]).toBeDefined();
  });

  it("resolves one Skill revision through explicit, Project, Global, then system priority", () => {
    const state = createCanonicalScenario();

    expect(resolveSkill(state.domain, "page-selection", { explicitSkillId: "skill-translate-zh", projectId: "project-a", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-translate-zh" }, revision: { id: "skill-translate-zh-r1" }, source: "explicit" });
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-a", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-decision-signal" }, revision: { id: "skill-decision-signal-r2" }, source: "project" });
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-shorten" }, revision: { id: "skill-shorten-r2" }, source: "global" });

    delete state.domain.skillBindings["global:page-selection"];
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-explain" }, revision: { id: "skill-explain-r1" }, source: "system" });
  });

  it("runs a pinned Skill in one event and keeps its exact revision on the Run", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, {
      type: "run-skill",
      category: "page-selection",
      inputScope: "selection",
      input: "Participants returned to notes when preparing decisions, not while browsing.",
      explicitSkillId: "skill-translate-zh",
      projectId: "project-a",
      contextSourceIds: ["web-b", "missing-source"],
    });

    expect(state.domain.runs["run-100"]).toMatchObject({
      activityId: null,
      projectId: "project-a",
      status: "succeeded",
      actualContextSourceIds: ["web-b"],
      candidateId: "candidate-101",
      skillId: "skill-translate-zh",
      skillRevisionId: "skill-translate-zh-r1",
      skillResolution: "explicit",
      inputScope: "selection",
    });
    expect(state.domain.candidates["candidate-101"]).toMatchObject({ status: "ready", content: "参与者会在准备做出决定时重新查看笔记，而不是在浏览时。" });
    expect(state.surface.activeCandidateId).toBe("candidate-101");

    state = reduceMockSession(state, { type: "dismiss-skill-candidate", candidateId: "candidate-101" });
    expect(state.domain.candidates["candidate-101"].status).toBe("dismissed");
    expect(state.surface.activeCandidateId).toBeNull();
    expect(state.domain.sources["ai-candidate-101"]).toBeUndefined();
  });

  it("adopts and undoes an editable Selection Skill result without creating a Source", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "run-skill", category: "page-selection", inputScope: "editable-selection", input: "Participants returned to notes when preparing decisions, not while browsing.", explicitSkillId: "skill-rewrite", projectId: "project-a" });
    state = reduceMockSession(state, { type: "adopt-skill-candidate", candidateId: "candidate-101", adoption: "replace", selectionTargetId: "article-b-selection" });
    expect(state.domain.candidates["candidate-101"]).toMatchObject({ status: "adopted", adoption: "replace" });
    expect(state.domain.selectionTargets["article-b-selection"].value).toBe("People return to their notes when a decision is due—not while they browse.");
    expect(state.domain.selectionTargets["article-b-selection"].revisions.at(-1)).toMatchObject({ kind: "replacement", runId: "run-100" });
    expect(state.domain.sources["ai-candidate-101"]).toBeUndefined();

    state = reduceMockSession(state, { type: "undo-skill-adoption", candidateId: "candidate-101", selectionTargetId: "article-b-selection" });
    expect(state.domain.candidates["candidate-101"]).toMatchObject({ status: "ready" });
    expect(state.domain.candidates["candidate-101"].adoption).toBeUndefined();
    expect(state.domain.selectionTargets["article-b-selection"].value).toBe("Participants returned to notes when preparing decisions, not while browsing.");
    expect(state.domain.selectionTargets["article-b-selection"].revisions.at(-1)?.kind).toBe("restored");
  });

  it("creates and revises a My Skill without rewriting prior revisions", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "create-my-skill", name: "Board summary", description: "Summarize a decision for leadership.", category: "generation", instruction: "Write three concise bullets with citations.", allowedInputScopes: ["project-sources"], outputFormat: "markdown", languageTone: "Concise and grounded.", projectContext: "required", resultBehavior: "insert-copy-or-document" });

    expect(state.domain.skills["skill-100"]).toMatchObject({ origin: "user", name: "Board summary", currentRevisionId: "skill-revision-101", archived: false });
    expect(state.domain.skillRevisions["skill-revision-101"]).toMatchObject({ version: 1, instruction: "Write three concise bullets with citations." });

    state = reduceMockSession(state, { type: "revise-my-skill", skillId: "skill-100", name: "Board summary", description: "Summarize a decision for leadership.", instruction: "Write five concise bullets with citations.", allowedInputScopes: ["project-sources"], outputFormat: "markdown", languageTone: "Concise and grounded.", projectContext: "required", resultBehavior: "insert-copy-or-document" });
    expect(state.domain.skills["skill-100"]).toMatchObject({ currentRevisionId: "skill-revision-102", revisionIds: ["skill-revision-101", "skill-revision-102"] });
    expect(state.domain.skillRevisions["skill-revision-101"].instruction).toBe("Write three concise bullets with citations.");
    expect(state.domain.skillRevisions["skill-revision-102"]).toMatchObject({ version: 2, instruction: "Write five concise bullets with citations." });
  });

  it("duplicates, hides, pins, archives, and restores Skills in shared state", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "set-built-in-hidden", skillId: "skill-translate-zh", hidden: true });
    expect(state.domain.hiddenBuiltInSkillIds).toContain("skill-translate-zh");
    expect(state.domain.pinnedSkillIds).not.toContain("skill-translate-zh");

    state = reduceMockSession(state, { type: "set-built-in-hidden", skillId: "skill-translate-zh", hidden: false });
    state = reduceMockSession(state, { type: "set-skill-pinned", skillId: "skill-translate-zh", pinned: true });
    expect(state.domain.pinnedSkillIds).toContain("skill-translate-zh");

    state = reduceMockSession(state, { type: "duplicate-skill", skillId: "skill-translate-zh", name: "Translate for research" });
    expect(state.domain.skills["skill-100"]).toMatchObject({ origin: "user", name: "Translate for research", systemDefault: false, archived: false });
    expect(state.domain.skillRevisions["skill-revision-101"].instruction).toBe(state.domain.skillRevisions["skill-translate-zh-r1"].instruction);

    state = reduceMockSession(state, { type: "set-skill-archived", skillId: "skill-100", archived: true });
    expect(state.domain.skills["skill-100"].archived).toBe(true);
    state = reduceMockSession(state, { type: "set-skill-archived", skillId: "skill-100", archived: false });
    expect(state.domain.skills["skill-100"].archived).toBe(false);
  });

  it("applies Global and Project Skill bindings immediately and resets to inheritance", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "set-global-skill-binding", category: "page-selection", skillId: "skill-translate-zh" });
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-translate-zh" }, source: "global" });

    state = reduceMockSession(state, { type: "set-project-skill-binding", projectId: "project-b", category: "page-selection", skillId: "skill-explain" });
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-explain" }, source: "project" });

    state = reduceMockSession(state, { type: "reset-project-skill-binding", projectId: "project-b", category: "page-selection" });
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "selection" })).toMatchObject({ skill: { id: "skill-translate-zh" }, source: "global" });
  });

  it("uses an edited My Skill revision to change actual output", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "create-my-skill", name: "Recommendations", description: "Turn evidence into recommendations.", category: "generation", instruction: "Write three recommendations.", allowedInputScopes: ["project-sources"], outputFormat: "markdown", languageTone: "Concise and grounded.", projectContext: "required", resultBehavior: "insert-copy-or-document" });
    state = reduceMockSession(state, { type: "set-global-skill-binding", category: "generation", skillId: "skill-100" });
    state = reduceMockSession(state, { type: "run-skill", category: "generation", inputScope: "project-sources", input: "Draft recommendations", projectId: "project-b", contextSourceIds: ["web-a"] });

    expect(state.domain.runs["run-102"]).toMatchObject({ skillId: "skill-100", skillRevisionId: "skill-revision-101", skillResolution: "global", actualContextSourceIds: ["web-a"] });
    expect(state.domain.candidates["candidate-103"].content.split("\n")).toHaveLength(3);

    state = reduceMockSession(state, { type: "revise-my-skill", skillId: "skill-100", name: "Recommendations", description: "Turn evidence into recommendations.", instruction: "Write five recommendations.", allowedInputScopes: ["project-sources"], outputFormat: "markdown", languageTone: "Concise and grounded.", projectContext: "required", resultBehavior: "insert-copy-or-document" });
    state = reduceMockSession(state, { type: "run-skill", category: "generation", inputScope: "project-sources", input: "Draft recommendations", projectId: "project-b", contextSourceIds: ["web-a"] });

    expect(state.domain.runs["run-105"]).toMatchObject({ skillRevisionId: "skill-revision-104", skillResolution: "global" });
    expect(state.domain.candidates["candidate-106"].content.split("\n")).toHaveLength(5);
  });

  it("resolves Voice and Organization Skills into durable Runs", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "start-voice-write", tabId: "research-tab", targetSessionId: "email-target" });
    state = reduceMockSession(state, { type: "stop-voice-write", transcript: "Um, keep offline capture connected to the decision.", transcriptionProfileId: "project-a" });

    expect(state.domain.runs["run-101"]).toMatchObject({ skillId: "skill-field-voice", skillRevisionId: "skill-field-voice-r1", skillResolution: "project", inputScope: "voice-write" });
    expect(state.domain.runs["run-103"]).toMatchObject({ skillId: "skill-clean-voice", skillResolution: "global", inputScope: "voice-write" });
    expect(state.domain.runs["run-105"]).toMatchObject({ skillId: "skill-organize", skillResolution: "global", inputScope: "project-sources", actualContextSourceIds: ["you-write-100"] });
    expect(state.domain.memberships["project-a:you-write-100"]).toMatchObject({ state: "suggested", runId: "run-105" });
    expect(state.domain.sources["you-write-100"].revisions.at(-1)).toMatchObject({ kind: "candidate", runId: "run-103" });
  });

  it("removes bindings when a Skill is archived or hidden and rejects incompatible defaults", () => {
    let state = createCanonicalScenario();
    state = reduceMockSession(state, { type: "set-skill-archived", skillId: "skill-decision-signal", archived: true });
    expect(state.domain.skillBindings["project:project-a:page-selection"]).toBeUndefined();
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-a", inputScope: "selection" })?.source).toBe("global");

    state = reduceMockSession(state, { type: "set-built-in-hidden", skillId: "skill-shorten", hidden: true });
    expect(state.domain.skillBindings["global:page-selection"]).toBeUndefined();
    expect(resolveSkill(state.domain, "page-selection", { projectId: "project-b", inputScope: "page" })).toMatchObject({ skill: { id: "skill-explain" }, source: "system" });

    state = reduceMockSession(state, { type: "create-my-skill", name: "Selection only", description: "Only selected text.", category: "page-selection", instruction: "Explain the selection.", allowedInputScopes: ["selection"], outputFormat: "plain-text", languageTone: "Clear.", projectContext: "optional", resultBehavior: "replace-or-copy" });
    state = reduceMockSession(state, { type: "set-global-skill-binding", category: "page-selection", skillId: "skill-100" });
    expect(state.domain.skillBindings["global:page-selection"]).toBeUndefined();
  });

  it("returns isolated deep copies for every story seed", () => {
    const first = createStorySeed();
    const second = createStorySeed();
    first.domain.projects["project-a"].name = "Changed only here";
    first.domain.sources["you-a"].revisions[0].content = "Changed source";

    expect(second.domain.projects["project-a"].name).toBe("Mobile research");
    expect(second.domain.sources["you-a"].revisions[0].content).toContain("Offline capture");
  });
});
