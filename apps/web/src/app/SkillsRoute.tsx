import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  EyeOff,
  History,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { saveWorkspaceSettings, type WorkspaceSettings } from "../lib/api";
import {
  archiveSkill,
  createSkill,
  getSkillArchiveImpact,
  getSkillRevisions,
  getSkills,
  restoreSkillRevision,
  unarchiveSkill,
  updateBuiltInSkillPreferences,
  updateSkill,
  type LogueSkill,
  type SkillContext,
  type SkillArchiveImpact,
  type SkillOutput,
  type SkillRevision,
  type SkillSurface,
  type SkillTask,
} from "../lib/skillApi";
import { Button } from "../ui/Button";
import {
  PanelResizer,
  usePersistentPanelSize,
} from "../ui/PanelResizer";
import { OriginLabel } from "../ui/OriginLabel";
import { AppShell, type PrimaryRoute } from "./AppShell";
import { axisClass, cardClass, fieldLabelClass, formGridClass, headingCopyClass, inlineActionsClass, inputClass, leadClass, metaClass, readyBarClass, scrollClass, settingRowClass, textareaClass, warningBarClass } from "./layout";

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
  };
}

const globalBindingLabels: Record<
  SkillArchiveImpact["global_bindings"][number],
  string
> = {
  default_transcription_skill: "Transcription",
  default_organization_skill: "Organization",
  default_extension_skill: "Voice Command",
  default_qa_skill: "Ask",
  default_document_skill: "Draft",
};

function toggleValue<T extends string>(items: T[], value: T) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function supportsPin(skill: LogueSkill) {
  return (
    skill.task === "generate" &&
    skill.surfaces.includes("extension") &&
    skill.contexts.some(
      (context) => context === "page" || context === "selection",
    )
  );
}

function skillSurfaceSummary(skill: LogueSkill) {
  const labels = skill.surfaces.map(
    (surface) => surfaces.find((item) => item.value === surface)?.label,
  ).filter(Boolean);
  return `${labels.join(" + ")} · Revision ${skill.revision}`;
}

function revisionDate(value: SkillRevision) {
  return new Date(value.updated_at || value.created_at).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function archiveImpactCopy(impact: SkillArchiveImpact) {
  return [
    impact.global_bindings.length
      ? `Global: ${impact.global_bindings.map((key) => globalBindingLabels[key]).join(", ")}`
      : "",
    impact.pinned_action ? "1 pinned action" : "",
    impact.project_bindings.length
      ? `${impact.project_bindings.length} Project ${impact.project_bindings.length === 1 ? "override" : "overrides"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SkillsRoute({
  skills,
  settings,
  onRoute,
  onRefresh,
}: {
  skills: LogueSkill[];
  settings?: WorkspaceSettings;
  onRoute: (route: PrimaryRoute) => void;
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
  const [allSkills, setAllSkills] = useState(skills);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState<SkillArchiveImpact>();
  const { size: skillEditorWidth, setSize: setSkillEditorWidth } =
    usePersistentPanelSize({
      storageKey: "logue.skills.editor.width",
      defaultSize: 420,
      min: 340,
      max: 540,
    });
  const selected = allSkills.find((skill) => skill.id === selectedId);
  const skillEditorOpen = Boolean(selected && (selected.archived_at || draft));
  const archivedSkills = allSkills.filter(
    (skill) => !skill.system && Boolean(skill.archived_at),
  );
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
    return allSkills.filter(
      (skill) =>
        !skill.system && Boolean(skill.archived_at) === showArchived,
    );
  }, [allSkills, showArchived, skills, tab]);

  useEffect(() => {
    setAllSkills((current) => [
      ...skills,
      ...current.filter(
        (skill) =>
          Boolean(skill.archived_at) &&
          !skills.some((active) => active.id === skill.id),
      ),
    ]);
  }, [skills]);

  useEffect(() => {
    let current = true;
    void getSkills(true)
      .then((next) => {
        if (current) setAllSkills(next);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    setDraft(
      selected && !selected.archived_at ? skillDraft(selected) : undefined,
    );
  }, [selected?.archived_at, selected?.id, selected?.revision]);

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

  async function refreshSkillIndex() {
    const [, nextSkills] = await Promise.all([onRefresh(), getSkills(true)]);
    setAllSkills(nextSkills);
  }

  async function duplicate(skill: LogueSkill) {
    setBusy(true);
    setError("");
    try {
      const created = await createSkill({
        ...skillDraft(skill),
        name: `${skill.name} copy`,
        enabled: true,
      });
      await refreshSkillIndex();
      setTab("mine");
      setShowArchived(false);
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
      await refreshSkillIndex();
      setTab("mine");
      setShowArchived(false);
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
      await refreshSkillIndex();
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

  async function finishArchive() {
    if (!selected || selected.system) return;
    setBusy(true);
    setError("");
    try {
      const result = await archiveSkill(selected.id);
      await refreshSkillIndex();
      setShowArchived(true);
      setArchiveImpact(undefined);
      setNotice(
        result.impact.has_references
          ? "Skill archived. Defaults and Project overrides now use their fallback."
          : "Skill archived.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not archive this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestArchive() {
    if (!selected || selected.system) return;
    setBusy(true);
    setError("");
    try {
      const impact = await getSkillArchiveImpact(selected.id);
      if (impact.has_references) {
        setArchiveImpact(impact);
        return;
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not review this archive.",
      );
      return;
    } finally {
      setBusy(false);
    }
    await finishArchive();
  }

  async function restoreArchived() {
    if (!selected?.archived_at) return;
    setBusy(true);
    setError("");
    try {
      await unarchiveSkill(selected.id);
      await refreshSkillIndex();
      setShowArchived(false);
      setNotice(
        "Skill restored. Defaults, pinned actions, and Project overrides were not changed.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not restore this Skill.",
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
      await refreshSkillIndex();
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

  async function updateSkillPreference(
    skill: LogueSkill,
    changes: { pinned?: boolean; hidden?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      await updateBuiltInSkillPreferences(skill.id, changes);
      await refreshSkillIndex();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this Skill.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateDefault(
    key: NonNullable<WorkspaceSettings["explicit_skill_bindings"]>[number],
    value: string,
  ) {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      await saveWorkspaceSettings({
        ...settings,
        [key]: value || undefined,
        explicit_skill_bindings: Array.from(
          new Set([...(settings.explicit_skill_bindings ?? []), key]),
        ),
      });
      await refreshSkillIndex();
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
  ] as Array<[
    NonNullable<WorkspaceSettings["explicit_skill_bindings"]>[number],
    string,
    (skill: LogueSkill) => boolean,
  ]>;

  return (
    <AppShell
      route="skills"
      onRouteChange={onRoute}
      topbarActions={
        <Button size="sm" onClick={() => void createNew()} disabled={busy}>
          <Plus size={15} />
          New Skill
        </Button>
      }
    >
      <div className={scrollClass}>
        <div className={axisClass("list")}>
          <div className={headingCopyClass}>
            <h1>Skills</h1>
            <p>
              Reusable instructions. Built-ins are safe defaults; My Skills are
              yours to change.
            </p>
          </div>
          <div
            className="flex gap-5 border-b border-line"
            role="tablist"
            aria-label="Skill settings"
          >
            {(["built-in", "mine", "defaults"] as SkillTab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={`relative px-px pt-[9px] pb-[11px] text-[13px] ${tab === item ? "font-[620] text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink after:content-['']" : "text-muted"}`}
                onClick={() => {
                  setTab(item);
                  setSelectedId(undefined);
                  setShowArchived(false);
                  setArchiveImpact(undefined);
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
            <div className={readyBarClass} role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className={warningBarClass} role="alert">
              {error}
            </div>
          ) : null}

          {tab === "defaults" ? (
            <div>
              <section className="mt-8">
                <h2 className="mb-1.5 text-base font-[650]">Default Skills</h2>
                <p className={leadClass}>
                  Projects inherit these unless they define an override.
                </p>
                {bindings.map(([key, label, accepts]) => (
                  <div className={settingRowClass} key={key}>
                    <div>
                      <strong>{label}</strong>
                      <p>
                        Resolved at the moment an action runs; the exact
                        revision is frozen in Activity.
                      </p>
                    </div>
                    <select
                      className={inputClass}
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
            <div className="mt-3 flex gap-7 max-[900px]:flex-col">
              <section
                className="min-w-0 flex-1"
                aria-label={
                  tab === "built-in" ? "Built-in Skills" : "My Skills"
                }
              >
                {tab === "mine" ? (
                  <div className={inlineActionsClass}>
                    <Button
                      size="sm"
                      variant={showArchived ? "secondary" : "primary"}
                      onClick={() => {
                        setShowArchived(false);
                        setSelectedId(undefined);
                        setArchiveImpact(undefined);
                      }}
                    >
                      Active
                    </Button>
                    <Button
                      size="sm"
                      variant={showArchived ? "primary" : "secondary"}
                      onClick={() => {
                        setShowArchived(true);
                        setSelectedId(undefined);
                        setArchiveImpact(undefined);
                      }}
                    >
                      Archived ({archivedSkills.length})
                    </Button>
                  </div>
                ) : null}
                {visible.map((skill) => (
                  <button
                    type="button"
                    className={`block w-full rounded-md border-b border-line px-2.5 py-[13px] text-left hover:bg-surface-muted [&>strong]:block [&>strong]:text-sm [&>strong]:font-[620] [&>strong]:text-ink [&>span]:mt-[3px] [&>span]:block [&>span]:truncate [&>span]:text-xs [&>span]:text-muted [&>small]:mt-[5px] [&>small]:block [&>small]:text-[11px] [&>small]:text-faint ${selectedId === skill.id ? "bg-surface-muted" : ""}`}
                    key={skill.id}
                    onClick={() => setSelectedId(skill.id)}
                  >
                    <OriginLabel
                      origin={skill.system ? "ai" : "you"}
                      detail={
                        skill.archived_at
                          ? "Archived"
                          : skill.hidden
                          ? "Hidden"
                          : skill.pinned
                            ? `${skill.system ? "Built-in" : "My Skill"} · Pinned`
                            : skill.enabled
                              ? skill.system
                                ? "Built-in"
                                : "My Skill"
                              : "Disabled"
                      }
                    />
                    <strong>{skill.name}</strong>
                    <span>{skill.purpose}</span>
                    <small>{skillSurfaceSummary(skill)}</small>
                  </button>
                ))}
                {!visible.length ? (
                  <div className={cardClass}>
                    <p>
                      {showArchived
                        ? "No archived Skills."
                        : "No My Skills yet."}
                    </p>
                    {!showArchived ? (
                      <Button onClick={() => void createNew()}>
                        Create a Skill
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {skillEditorOpen ? (
                <PanelResizer
                  edge="left"
                  label="Resize Skill editor"
                  value={skillEditorWidth}
                  min={340}
                  max={540}
                  defaultValue={420}
                  onChange={setSkillEditorWidth}
                  className="max-[900px]:hidden"
                />
              ) : null}

              {selected && (selected.archived_at || draft) ? (
                <aside
                  className="shrink-0 self-start border-line max-[900px]:w-full max-[900px]:border-t max-[900px]:pt-6 min-[900px]:sticky min-[900px]:top-6 min-[900px]:border-l min-[900px]:pl-6"
                  style={{ width: skillEditorWidth }}
                >
                  <div className="mb-4.5 flex items-start justify-between gap-3 [&>div>strong]:block [&>div>strong]:text-[15px] [&>div>span]:mt-[3px] [&>div>span]:block [&>div>span]:text-[11px] [&>div>span]:text-muted">
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
                            : selected.archived_at
                              ? `Archived · revision ${selected.revision}`
                              : `My Skill · revision ${selected.revision}${selected.pinned ? " · Pinned" : ""}`
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

                  {selected.archived_at ? (
                    <div className={cardClass}>
                      <p>{selected.purpose}</p>
                      <p>{selected.instructions}</p>
                      <div className={metaClass}>
                        {selected.task} · {selected.output} · revision {selected.revision}
                      </div>
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() => void restoreArchived()}
                      >
                        <ArchiveRestore size={14} />
                        Restore Skill
                      </Button>
                    </div>
                  ) : selected.system ? (
                    <>
                      <p>{selected.instructions}</p>
                      <div className={metaClass}>
                        Surfaces: {selected.surfaces.join(", ")} · Context:{" "}
                        {selected.contexts.join(", ")}
                      </div>
                      <div
                        className={inlineActionsClass}
                        style={{ marginTop: 18 }}
                      >
                        {supportsPin(selected) && !selected.hidden ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void updateSkillPreference(selected, {
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
                            void updateSkillPreference(selected, {
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
                  ) : draft ? (
                    <>
                      <label className={fieldLabelClass}>
                        Name
                        <input
                          className={inputClass}
                          value={draft.name}
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        Purpose
                        <input
                          className={inputClass}
                          value={draft.purpose}
                          onChange={(event) =>
                            setDraft({ ...draft, purpose: event.target.value })
                          }
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        Instructions
                        <textarea
                          className={textareaClass}
                          value={draft.instructions}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              instructions: event.target.value,
                            })
                          }
                        />
                      </label>
                      <details className="mt-1 mb-4.5 border-t border-line pt-[11px] [&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-[620] [&>summary]:text-ink-soft">
                        <summary>Advanced</summary>
                        <div className="mt-3.5 grid gap-[13px]">
                      <div className={formGridClass}>
                        <label>
                          Task
                          <select
                            className={inputClass}
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
                            className={inputClass}
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
                      <fieldset className="mt-4 grid grid-cols-2 gap-x-4 gap-y-[9px] [&>legend]:mb-1 [&>legend]:w-full [&>legend]:text-[13px] [&>legend]:font-[610] [&>legend]:text-ink-soft [&_label]:inline-flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-xs [&_label]:whitespace-nowrap [&_label]:text-muted">
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
                      <fieldset className="mt-4 grid grid-cols-2 gap-x-4 gap-y-[9px] [&>legend]:mb-1 [&>legend]:w-full [&>legend]:text-[13px] [&>legend]:font-[610] [&>legend]:text-ink-soft [&_label]:inline-flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-xs [&_label]:whitespace-nowrap [&_label]:text-muted">
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
                        </div>
                      </details>
                      <div className={settingRowClass}>
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
                          <div className={inlineActionsClass}>
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
                              className={cardClass}
                              style={{ marginTop: 12 }}
                            >
                              <strong>{previewRevision.name}</strong>
                              <p>{previewRevision.purpose}</p>
                              <p>{previewRevision.instructions}</p>
                              <div className={metaClass}>
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

                      {archiveImpact ? (
                        <div className={cardClass} role="alert">
                          <strong>Archive and update these choices?</strong>
                          <p>{archiveImpactCopy(archiveImpact)}</p>
                          <p>
                            These places will use their fallback. Restoring the
                            Skill later will not reapply them.
                          </p>
                          <div className={inlineActionsClass}>
                            <Button
                              disabled={busy}
                              onClick={() => setArchiveImpact(undefined)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              disabled={busy}
                              onClick={() => void finishArchive()}
                            >
                              <Archive size={14} />
                              Archive Skill
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-2">
                        <div className={inlineActionsClass}>
                          {supportsPin(selected) ? (
                            <Button
                              onClick={() =>
                                void updateSkillPreference(selected, {
                                  pinned: !selected.pinned,
                                })
                              }
                              disabled={busy}
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
                            onClick={() => void requestArchive()}
                            disabled={busy}
                          >
                            <Archive size={14} />
                            Archive
                          </Button>
                        </div>
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
                  ) : null}
                </aside>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
