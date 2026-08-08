import type { Material } from "@logue/ui";
import { ArrowRight, EyeOff, GitMerge, Scissors } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addTopicSourcesToProject,
  convertTopicToProject,
  getTopics,
  mergeTopics,
  rememberTopicVocabularySuggestion,
  splitTopic,
  updateTopic,
  type DiscoveredTopic,
  type ProjectSummary,
} from "../lib/api";
import { Banner, Button, Card, InlineActions, Input, OriginLabel, Select } from "../ui";
import { contentSummary } from "./contentPresentation";
import { HeadingCopy, PanelSectionHeading, ReviewList, ReviewRow, SettingsSection } from "./layout";

function sourceTitle(source: Material | undefined) {
  return (
    source?.source?.title ||
    source?.source?.domain ||
    source?.content.slice(0, 72) ||
    "Saved Source"
  );
}

type VocabularyDestination = "topic" | "global" | `project:${string}`;

export function TopicsPanel({
  materials,
  projects,
  onRefresh,
  onOpenSource,
}: {
  materials: Material[];
  projects: ProjectSummary[];
  onRefresh: () => Promise<void>;
  onOpenSource: (id: string) => void;
}) {
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [name, setName] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [mergeId, setMergeId] = useState("");
  const [splitName, setSplitName] = useState("");
  const [vocabularyDestinations, setVocabularyDestinations] = useState<
    Record<string, VocabularyDestination>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected =
    topics.find((topic) => topic.id === selectedId) ??
    topics.find((topic) => !topic.hidden) ??
    topics[0];
  const sources = useMemo(
    () =>
      (selected?.source_ids ?? []).flatMap((id) => {
        const source = materials.find((item) => item.id === id);
        return source && !source.tombstone ? [source] : [];
      }),
    [materials, selected?.source_ids.join("|")],
  );

  async function refresh() {
    try {
      const values = await getTopics();
      setTopics(values);
      setSelectedId((current) =>
        values.some((topic) => topic.id === current)
          ? current
          : values.find((topic) => !topic.hidden)?.id ?? values[0]?.id,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not discover Topics.",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setName(selected?.name ?? "");
    setSourceIds(selected?.source_ids ?? []);
    setSplitName("");
    setVocabularyDestinations({});
  }, [selected?.id, selected?.updated_at]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onRefresh();
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this Topic.",
      );
    } finally {
      setBusy(false);
    }
  }

  function rememberVocabulary(term: string) {
    if (!selected) return;
    const destination = vocabularyDestinations[term] ?? "topic";
    const projectId = destination.startsWith("project:")
      ? destination.slice("project:".length)
      : undefined;
    void run(() =>
      rememberTopicVocabularySuggestion(selected.id, {
        term,
        destination: projectId
          ? "project"
          : destination === "global"
            ? "global"
            : "topic",
        projectId,
      }),
    );
  }

  return (
    <div className="mt-4.5 grid grid-cols-1 gap-6 min-[820px]:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-line pr-3.5 min-[820px]:border-r [&>button]:grid [&>button]:w-full [&>button]:gap-[3px] [&>button]:rounded-md [&>button]:p-2.5 [&>button]:text-left [&>button]:text-ink [&>button:hover]:bg-surface-muted [&>button>strong]:text-[13px] [&>button>span]:truncate [&>button>span]:text-xs [&>button>span]:text-muted [&>button>small]:truncate [&>button>small]:text-xs [&>button>small]:text-muted">
        <div className="flex items-center justify-between px-2.5 pt-2 pb-2.5 text-xs text-muted">
          <strong>Topics</strong>
          <span>{topics.filter((topic) => !topic.hidden).length}</span>
        </div>
        {topics.map((topic) => (
          <button
            type="button"
            key={topic.id}
            className={`${topic.id === selected?.id ? "bg-surface-muted" : ""}${topic.hidden ? " opacity-[0.58]" : ""}`}
            onClick={() => setSelectedId(topic.id)}
          >
            <strong>{topic.name}</strong>
            <span>{topic.source_ids.length} Sources</span>
            <small>{topic.hidden ? "Hidden" : topic.reason}</small>
          </button>
        ))}
        {!topics.length ? (
          <Card>
            <p>
              Topics appear when at least two saved Sources share a confirmed
              tag or site.
            </p>
          </Card>
        ) : null}
      </aside>

      {selected ? (
        <main className="min-w-0 [&_label]:flex [&_label]:min-w-0 [&_label]:gap-2.5 [&_label>input]:mt-1 [&_label>input]:accent-accent">
          <HeadingCopy>
            <OriginLabel
              origin="ai"
              detail={selected.automatic ? "Discovered Topic" : "Your Topic"}
            />
            <input
              className="mb-4.5 w-full border-0 bg-transparent text-[clamp(34px,3vw,42px)] leading-[1.12] font-[690] tracking-[-0.045em] text-ink outline-0"
              aria-label="Topic name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p>
              {selected.reason}. Topics help discovery; they never grant
              Project Context or change voice vocabulary without your action.
            </p>
          </HeadingCopy>

          <InlineActions>
            <Button
              disabled={busy || !name.trim()}
              onClick={() =>
                void run(() =>
                  updateTopic(selected.id, {
                    name: name.trim(),
                    sourceIds,
                  }),
                )
              }
            >
              Save changes
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(() =>
                  updateTopic(selected.id, { hidden: !selected.hidden }),
                )
              }
            >
              <EyeOff size={14} />
              {selected.hidden ? "Show Topic" : "Hide Topic"}
            </Button>
            <Button
              variant="primary"
              disabled={busy || !name.trim()}
              onClick={() =>
                void run(() => convertTopicToProject(selected.id, name.trim()))
              }
            >
              <ArrowRight size={14} />
              Convert to Project
            </Button>
          </InlineActions>

          {(selected.project_suggestions ?? []).length ? (
            <SettingsSection>
              <PanelSectionHeading>
                <div>
                  <h2>Related Projects</h2>
                  <p>Suggestions only. Sources move into Context when you add them.</p>
                </div>
              </PanelSectionHeading>
              <ReviewList>
                {selected.project_suggestions.map((suggestion) => (
                  <ReviewRow
                    
                    key={suggestion.project_id}>
                    <div>
                      <OriginLabel origin="ai" detail="Project suggestion" />
                      <h3>{suggestion.project_name}</h3>
                      <p>{suggestion.reason}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          addTopicSourcesToProject(
                            selected.id,
                            suggestion.project_id,
                          ),
                        )
                      }
                    >
                      Add {suggestion.source_ids.length}{" "}
                      {suggestion.source_ids.length === 1 ? "Source" : "Sources"}
                    </Button>
                  </ReviewRow>
                ))}
              </ReviewList>
            </SettingsSection>
          ) : null}

          {(selected.vocabulary_suggestions ?? []).length ? (
            <SettingsSection>
              <PanelSectionHeading>
                <div>
                  <h2>Vocabulary suggestions</h2>
                  <p>Choose exactly where each confirmed term should apply.</p>
                </div>
              </PanelSectionHeading>
              <ReviewList>
                {selected.vocabulary_suggestions.map((suggestion) => (
                  <ReviewRow  key={suggestion.term}>
                    <div>
                      <OriginLabel origin="ai" detail="Not remembered yet" />
                      <h3>{suggestion.term}</h3>
                      <p>{suggestion.reason}</p>
                    </div>
                    <InlineActions>
                      <Select
                        aria-label={`Where to remember ${suggestion.term}`}
                        value={vocabularyDestinations[suggestion.term] ?? "topic"}
                        onChange={(event) =>
                          setVocabularyDestinations((current) => ({
                            ...current,
                            [suggestion.term]: event.target
                              .value as VocabularyDestination,
                          }))
                        }
                      >
                        <option value="topic">This Topic vocabulary</option>
                        {projects
                          .filter((project) => project.id && !project.archived_at)
                          .map((project) => (
                            <option
                              key={project.id ?? project.name}
                              value={`project:${project.id}`}
                            >
                              {project.name} Project profile
                            </option>
                          ))}
                        <option value="global">Global voice settings</option>
                      </Select>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => rememberVocabulary(suggestion.term)}
                      >
                        Remember
                      </Button>
                    </InlineActions>
                  </ReviewRow>
                ))}
              </ReviewList>
            </SettingsSection>
          ) : null}

          <SettingsSection>
            <PanelSectionHeading>
              <div>
                <h2>Source relationships</h2>
                <p>Duplicate links are exact. Conflict and supplement labels are suggestions to review.</p>
              </div>
            </PanelSectionHeading>
            <ReviewList>
              {(selected.relationships ?? []).map((relationship) => {
                const [leftId, rightId] = relationship.source_ids;
                const left = materials.find((item) => item.id === leftId);
                const right = materials.find((item) => item.id === rightId);
                return (
                  <ReviewRow
                    
                    key={`${relationship.type}:${relationship.source_ids.join(":")}`}>
                    <div>
                      <OriginLabel
                        origin="ai"
                        detail={`${relationship.confidence === "exact" ? "Exact" : "Suggested"} ${relationship.type}`}
                      />
                      <h3>
                        {sourceTitle(left)} ↔ {sourceTitle(right)}
                      </h3>
                      <p>{relationship.reason}</p>
                    </div>
                    <InlineActions>
                      {left ? (
                        <Button size="sm" onClick={() => onOpenSource(left.id)}>
                          Open first
                        </Button>
                      ) : null}
                      {right ? (
                        <Button size="sm" onClick={() => onOpenSource(right.id)}>
                          Open second
                        </Button>
                      ) : null}
                    </InlineActions>
                  </ReviewRow>
                );
              })}
              {!selected.relationships?.length ? (
                <Card>
                  <p>Add another distinct Source to compare relationships.</p>
                </Card>
              ) : null}
            </ReviewList>
          </SettingsSection>

          <SettingsSection>
            <h2>Related Sources</h2>
            <ReviewList>
              {sources.map((source) => (
                <ReviewRow  key={source.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={sourceIds.includes(source.id)}
                      onChange={(event) =>
                        setSourceIds(
                          event.target.checked
                            ? [...sourceIds, source.id]
                            : sourceIds.filter((id) => id !== source.id),
                        )
                      }
                    />
                    <span>
                      <strong>{sourceTitle(source)}</strong>
                      <p>{contentSummary(source.content)}</p>
                    </span>
                  </label>
                  <Button size="sm" onClick={() => onOpenSource(source.id)}>
                    Open
                  </Button>
                </ReviewRow>
              ))}
            </ReviewList>
          </SettingsSection>

          <SettingsSection>
            <h2>Merge or split</h2>
            <div className="flex items-center gap-2">
              <Select
                value={mergeId}
                onChange={(event) => setMergeId(event.target.value)}
              >
                <option value="">Merge with…</option>
                {topics
                  .filter((topic) => topic.id !== selected.id)
                  .map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
              </Select>
              <Button
                disabled={busy || !mergeId || !name.trim()}
                onClick={() =>
                  void run(() =>
                    mergeTopics([selected.id, mergeId], name.trim()),
                  )
                }
              >
                <GitMerge size={14} />
                Merge
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={splitName}
                onChange={(event) => setSplitName(event.target.value)}
                placeholder="New Topic name"
              />
              <Button
                disabled={
                  busy ||
                  !splitName.trim() ||
                  sourceIds.length === 0 ||
                  sourceIds.length === selected.source_ids.length
                }
                onClick={() =>
                  void run(() =>
                    splitTopic(selected.id, sourceIds, splitName.trim()),
                  )
                }
              >
                <Scissors size={14} />
                Split selected
              </Button>
            </div>
          </SettingsSection>

          {error ? (
            <Banner tone="warning"  role="alert">
              {error}
            </Banner>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}
