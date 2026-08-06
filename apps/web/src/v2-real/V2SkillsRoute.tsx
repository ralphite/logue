import {
  Copy,
  Eye,
  EyeOff,
  History,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { saveWorkspaceSettings, type WorkspaceSettings } from "../api";
import {
  createSkill,
  deleteSkill,
  getSkillRevisions,
  restoreSkillRevision,
  updateBuiltInSkillPreferences,
  updateSkill,
  type LogueSkill,
  type SkillContext,
  type SkillOutput,
  type SkillRevision,
  type SkillSurface,
  type SkillTask,
} from "../skillApi";
import { Button } from "../components/ui";
import { OriginLabel } from "../v2-mock/primitives/OriginLabel";
import { ProjectShell, type V2PrimaryRoute } from "../v2-mock/web/ProjectShell";

type SkillTab = "built-in" | "mine" | "defaults";
type SkillDraft = Pick<
  LogueSkill,
  | "name"
  | "purpose"
  | "instructions"
  | "task"
  | "output"
  | "surfaces"
  | "contexts"
  | "enabled"
>;

const surfaces: Array<{ value: SkillSurface; label: string }> = [
  { value: "web", label: "Web App" },
  { value: "extension", label: "Extension" },
  { value: "background", label: "Automatic organization" },
];

const contexts: Array<{ value: SkillContext; label: string }> = [
  { value: "page", label: "Page" },
  { value: "selection", label: "Selection" },
  { value: "target", label: "Input target" },
  { value: "project", label: "Project" },
  { value: "materials", label: "Saved Sources" },
  { value: "personal", label: "Personal context" },
];

function skillDraft(skill: LogueSkill): SkillDraft {
  return {
    name: skill.name,
    purpose: skill.purpose,
    instructions: skill.instructions,
    task: skill.task,
    output: skill.output,
    surfaces: skill.surfaces,
    contexts: skill.contexts,
    enabled: skill.enabled,
  };
}

function toggleValue<T extends string>(items: T[], value: T) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function supportsPin(skill: LogueSkill) {
  return (
    skill.system &&
    skill.task === "generate" &&
    skill.surfaces.includes("extension") &&
    skill.contexts.some(
      (context) => context === "page" || context === "selection",
    )
  );
}

function revisionDate(value: SkillRevision) {
  return new Date(value.updated_at || value.created_at).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function V2SkillsRoute({
  skills,
  settings,
  onRoute,
  onRefresh,
}: {
  skills: LogueSkill[];
  settings?: WorkspaceSettings;
  onRoute: (route: V2PrimaryRoute) => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<SkillTab>("built-in");
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<SkillDraft>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<SkillRevision[]>([]);
  const [previewRevision, setPreviewRevision] = useState<SkillRevision>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = skills.find((skill) => skill.id === selectedId);
  const visible = useMemo(() => {
    if (tab === "built-in") {
      return skills
        .filter((skill) => skill.system)
        .sort(
          (left, right) =>
            Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
            Number(Boolean(left.hidden)) - Number(Boolean(right.hidden)),
        );
    }
    return skills.filter((skill) => !skill.system);
  }, [skills, tab]);

  useEffect(() => {
    setDraft(selected ? skillDraft(selected) : undefined);
  }, [selected?.id, selected?.revision]);

  useEffect(() => {
    setHistoryOpen(false);
    setRevisions([]);
    setPreviewRevision(undefined);
  }, [selected?.id]);

  useEffect(() => {
    if (tab !== "defaults" && !selectedId && visible[0]) {
      setSelectedId(visible[0].id);
    }
  }, [selectedId, tab, visible]);

  async function duplicate(skill: LogueSkill) {
    setBusy(true);
    setError("");
    try {
      const created = await createSkill({
        ...skillDraft(skill),
        name: `${skill.name} copy`,
        enabled: true,
      });
      await onRefresh();
      setTab("mine");
      setSelectedId(created.id);
      setNotice("My Skill created.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not duplicate this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    setBusy(true);
    setError("");
    try {
      const created = await createSkill({
        name: "Untitled Skill",
        purpose: "Create a useful result from the selected context.",
        instructions:
          "Use the supplied context to produce a clear, concise result.",
        task: "generate",
        output: "insert",
        surfaces: ["extension", "web"],
        contexts: ["selection", "project"],
        enabled: true,
      });
      await onRefresh();
      setTab("mine");
      setSelectedId(created.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrent() {
    if (
      !selected ||
      selected.system ||
      !draft ||
      !draft.name.trim() ||
      !draft.instructions.trim() ||
      !draft.surfaces.length
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateSkill(selected.id, {
        ...draft,
        name: draft.name.trim(),
        purpose: draft.purpose.trim(),
        instructions: draft.instructions.trim(),
        expected_revision: selected.revision,
      });
      await onRefresh();
      setHistoryOpen(false);
      setRevisions([]);
      setPreviewRevision(undefined);
      setNotice("Skill updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (!selected || selected.system) return;
    setBusy(true);
    setError("");
    try {
      await deleteSkill(selected.id);
      setSelectedId(undefined);
      setDraft(undefined);
      await onRefresh();
      setNotice("My Skill deleted. Any binding now falls back to its default.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openHistory() {
    if (!selected || selected.system) return;
    if (historyOpen) {
      setHistoryOpen(false);
      setPreviewRevision(undefined);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setRevisions(await getSkillRevisions(selected.id));
      setPreviewRevision(undefined);
      setHistoryOpen(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load revision history.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision() {
    if (!selected || selected.system || !previewRevision) return;
    setBusy(true);
    setError("");
    try {
      const restored = await restoreSkillRevision(
        selected.id,
        previewRevision.revision,
      );
      await onRefresh();
      setRevisions(await getSkillRevisions(selected.id));
      setPreviewRevision(undefined);
      setNotice(`Restored as revision ${restored.revision}.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this revision.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateBuiltIn(
    skill: LogueSkill,
    changes: { pinned?: boolean; hidden?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      await updateBuiltInSkillPreferences(skill.id, changes);
      await onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this Built-in Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateDefault(key: keyof WorkspaceSettings, value: string) {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      await saveWorkspaceSettings({
        ...settings,
        [key]: value || undefined,
      });
      await onRefresh();
      setNotice("Global default updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this default.",
      );
    } finally {
      setBusy(false);
    }
  }

  const bindings = [
    [
      "default_transcription_skill",
      "Transcription",
      (skill: LogueSkill) => skill.task === "transcribe",
    ],
    [
      "default_organization_skill",
      "Organization",
      (skill: LogueSkill) => skill.task === "organize",
    ],
    [
      "default_extension_skill",
      "Voice Command",
      (skill: LogueSkill) =>
        skill.task === "generate" &&
        skill.output === "insert" &&
        skill.surfaces.includes("extension"),
    ],
    [
      "default_qa_skill",
      "Ask",
      (skill: LogueSkill) => skill.task === "generate" && skill.output === "qa",
    ],
    [
      "default_document_skill",
      "Draft",
      (skill: LogueSkill) =>
        skill.task === "generate" && skill.output === "document",
    ],
  ] as Array<[keyof WorkspaceSettings, string, (skill: LogueSkill) => boolean]>;

  return (
    <ProjectShell
      route="skills"
      onRouteChange={onRoute}
      topbarActions={
        <Button size="sm" onClick={() => void createNew()} disabled={busy}>
          <Plus size={15} />
          New Skill
        </Button>
      }
    >
      <div className="v2-editor-scroll">
        <div className="v2-list-axis">
          <div className="v2-page-heading-copy">
            <h1>Skills</h1>
            <p>
              Reusable instructions. Built-ins are safe defaults; My Skills are
              yours to change.
            </p>
          </div>
          <div
            className="v2-skill-tabs"
            role="tablist"
            aria-label="Skill settings"
          >
            {(["built-in", "mine", "defaults"] as SkillTab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={tab === item ? "is-active" : ""}
                onClick={() => {
                  setTab(item);
                  setSelectedId(undefined);
                  setError("");
                  setNotice("");
                }}
              >
                {item === "built-in"
                  ? "Built-in"
                  : item === "mine"
                    ? "My Skills"
                    : "Global defaults"}
              </button>
            ))}
          </div>
          {notice ? (
            <div className="v2-ready-bar" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="v2-warning-bar" role="alert">
              {error}
            </div>
          ) : null}

          {tab === "defaults" ? (
            <div className="v2-global-skill-settings">
              <section>
                <h2>Default Skills</h2>
                <p className="v2-settings-lead">
                  Projects inherit these unless they define an override.
                </p>
                {bindings.map(([key, label, accepts]) => (
                  <div className="v2-setting-row" key={key}>
                    <div>
                      <strong>{label}</strong>
                      <p>
                        Resolved at the moment an action runs; the exact
                        revision is frozen in Activity.
                      </p>
                    </div>
                    <select
                      className="v2-input"
                      value={String(settings?.[key] ?? "")}
                      disabled={busy}
                      onChange={(event) =>
                        void updateDefault(key, event.target.value)
                      }
                    >
                      {skills
                        .filter(
                          (skill) =>
                            skill.enabled &&
                            accepts(skill) &&
                            (!skill.hidden || settings?.[key] === skill.id),
                        )
                        .map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                            {skill.system ? " · Built-in" : " · My Skill"}
                            {skill.hidden ? " · Hidden" : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </section>
            </div>
          ) : (
            <div className="v2-skill-workbench">
              <section
                className="v2-skill-list"
                aria-label={
                  tab === "built-in" ? "Built-in Skills" : "My Skills"
                }
              >
                {visible.map((skill) => (
                  <button
                    type="button"
                    className={`v2-skill-row-main${
                      selectedId === skill.id ? " is-active" : ""
                    }`}
                    key={skill.id}
                    onClick={() => setSelectedId(skill.id)}
                  >
                    <OriginLabel
                      origin={skill.system ? "ai" : "you"}
                      detail={
                        skill.hidden
                          ? "Hidden"
                          : skill.pinned
                            ? "Built-in · Pinned"
                            : skill.enabled
                              ? skill.system
                                ? "Built-in"
                                : "My Skill"
                              : "Disabled"
                      }
                    />
                    <strong>{skill.name}</strong>
                    <span>{skill.purpose}</span>
                    <small>
                      {skill.task} · {skill.output} · revision {skill.revision}
                    </small>
                  </button>
                ))}
                {!visible.length ? (
                  <div className="v2-recovery-card">
                    <p>No My Skills yet.</p>
                    <Button onClick={() => void createNew()}>
                      Create a Skill
                    </Button>
                  </div>
                ) : null}
              </section>

              {selected && draft ? (
                <aside className="v2-skill-editor">
                  <div className="v2-skill-editor-heading">
                    <div>
                      <OriginLabel
                        origin={selected.system ? "ai" : "you"}
                        detail={
                          selected.system
                            ? selected.hidden
                              ? "Built-in · Hidden"
                              : selected.pinned
                                ? "Built-in · Pinned"
                                : "Built-in"
                            : `My Skill · revision ${selected.revision}`
                        }
                      />
                      <h2>{selected.name}</h2>
                    </div>
                    {selected.system ? (
                      <Button
                        size="sm"
                        onClick={() => void duplicate(selected)}
                        disabled={busy}
                      >
                        <Copy size={14} />
                        Duplicate
                      </Button>
                    ) : null}
                  </div>

                  {selected.system ? (
                    <>
                      <p>{selected.instructions}</p>
                      <div className="v2-library-meta">
                        Surfaces: {selected.surfaces.join(", ")} · Context:{" "}
                        {selected.contexts.join(", ")}
                      </div>
                      <div
                        className="v2-inline-actions"
                        style={{ marginTop: 18 }}
                      >
                        {supportsPin(selected) && !selected.hidden ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void updateBuiltIn(selected, {
                                pinned: !selected.pinned,
                              })
                            }
                          >
                            {selected.pinned ? (
                              <PinOff size={14} />
                            ) : (
                              <Pin size={14} />
                            )}
                            {selected.pinned ? "Unpin" : "Pin"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void updateBuiltIn(selected, {
                              hidden: !selected.hidden,
                            })
                          }
                        >
                          {selected.hidden ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          {selected.hidden ? "Show" : "Hide"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="v2-field-label">
                        Name
                        <input
                          className="v2-input"
                          value={draft.name}
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                        />
                      </label>
                      <label className="v2-field-label">
                        Purpose
                        <input
                          className="v2-input"
                          value={draft.purpose}
                          onChange={(event) =>
                            setDraft({ ...draft, purpose: event.target.value })
                          }
                        />
                      </label>
                      <label className="v2-field-label">
                        Instructions
                        <textarea
                          className="v2-textarea"
                          value={draft.instructions}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              instructions: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="v2-form-grid">
                        <label>
                          Task
                          <select
                            className="v2-input"
                            value={draft.task}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                task: event.target.value as SkillTask,
                              })
                            }
                          >
                            <option value="transcribe">Transcribe</option>
                            <option value="organize">Organize</option>
                            <option value="generate">Generate</option>
                          </select>
                        </label>
                        <label>
                          Output
                          <select
                            className="v2-input"
                            value={draft.output}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                output: event.target.value as SkillOutput,
                              })
                            }
                          >
                            <option value="insert">Insert candidate</option>
                            <option value="material">Saved material</option>
                            <option value="qa">Answer</option>
                            <option value="document">Document candidate</option>
                          </select>
                        </label>
                      </div>
                      <fieldset className="v2-choice-fieldset">
                        <legend>Available surfaces</legend>
                        {surfaces.map((item) => (
                          <label key={item.value}>
                            <input
                              type="checkbox"
                              checked={draft.surfaces.includes(item.value)}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  surfaces: toggleValue(
                                    draft.surfaces,
                                    item.value,
                                  ),
                                })
                              }
                            />
                            {item.label}
                          </label>
                        ))}
                      </fieldset>
                      <fieldset className="v2-choice-fieldset">
                        <legend>Allowed context</legend>
                        {contexts.map((item) => (
                          <label key={item.value}>
                            <input
                              type="checkbox"
                              checked={draft.contexts.includes(item.value)}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  contexts: toggleValue(
                                    draft.contexts,
                                    item.value,
                                  ),
                                })
                              }
                            />
                            {item.label}
                          </label>
                        ))}
                      </fieldset>
                      <label className="v2-checkbox-row">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              enabled: event.target.checked,
                            })
                          }
                        />
                        Enabled
                      </label>

                      <div className="v2-setting-row">
                        <div>
                          <strong>Revision history</strong>
                          <p>
                            Restore an earlier version without deleting newer
                            revisions.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={busy}
                          aria-expanded={historyOpen}
                          onClick={() => void openHistory()}
                        >
                          <History size={14} />
                          {historyOpen ? "Close" : "History"}
                        </Button>
                      </div>

                      {historyOpen ? (
                        <section aria-label="Skill revision history">
                          <div className="v2-inline-actions">
                            {revisions.map((revision) => (
                              <Button
                                key={`${revision.skill_id}-${revision.revision}`}
                                size="sm"
                                variant={
                                  (revision.current && !previewRevision) ||
                                  previewRevision?.revision ===
                                    revision.revision
                                    ? "primary"
                                    : "secondary"
                                }
                                onClick={() =>
                                  setPreviewRevision(
                                    revision.current ? undefined : revision,
                                  )
                                }
                              >
                                {revision.current
                                  ? "Current"
                                  : `Revision ${revision.revision}`}
                              </Button>
                            ))}
                          </div>
                          {previewRevision ? (
                            <div
                              className="v2-recovery-card"
                              style={{ marginTop: 12 }}
                            >
                              <strong>{previewRevision.name}</strong>
                              <p>{previewRevision.purpose}</p>
                              <p>{previewRevision.instructions}</p>
                              <div className="v2-library-meta">
                                Revision {previewRevision.revision} ·{" "}
                                {revisionDate(previewRevision)}
                              </div>
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={busy}
                                onClick={() => void restoreRevision()}
                              >
                                <RotateCcw size={14} />
                                Restore as new revision
                              </Button>
                            </div>
                          ) : null}
                        </section>
                      ) : null}

                      <div className="v2-inline-actions v2-actions-between">
                        <Button
                          onClick={() => void removeCurrent()}
                          disabled={busy}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => void saveCurrent()}
                          disabled={
                            busy ||
                            !draft.name.trim() ||
                            !draft.instructions.trim() ||
                            !draft.surfaces.length
                          }
                        >
                          <Sparkles size={14} />
                          Save Skill
                        </Button>
                      </div>
                    </>
                  )}
                </aside>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  );
}
