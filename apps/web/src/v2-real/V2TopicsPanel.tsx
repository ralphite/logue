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
} from "../api";
import { Button } from "../components/ui";
import { OriginLabel } from "../v2-mock/primitives/OriginLabel";

function sourceTitle(source: Material | undefined) {
  return (
    source?.source?.title ||
    source?.source?.domain ||
    source?.content.slice(0, 72) ||
    "Saved Source"
  );
}

type VocabularyDestination = "topic" | "global" | `project:${string}`;

export function V2TopicsPanel({
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
    <div className="v2-topic-workbench">
      <aside className="v2-topic-list">
        <div className="v2-document-list-heading">
          <strong>Topics</strong>
          <span>{topics.filter((topic) => !topic.hidden).length}</span>
        </div>
        {topics.map((topic) => (
          <button
            type="button"
            key={topic.id}
            className={`${topic.id === selected?.id ? "is-active" : ""}${topic.hidden ? " is-muted" : ""}`}
            onClick={() => setSelectedId(topic.id)}
          >
            <strong>{topic.name}</strong>
            <span>{topic.source_ids.length} Sources</span>
            <small>{topic.hidden ? "Hidden" : topic.reason}</small>
          </button>
        ))}
        {!topics.length ? (
          <div className="v2-recovery-card">
            <p>
              Topics appear when at least two saved Sources share a confirmed
              tag or site.
            </p>
          </div>
        ) : null}
      </aside>

      {selected ? (
        <main className="v2-topic-editor">
          <div className="v2-page-heading-copy">
            <OriginLabel
              origin="ai"
              detail={selected.automatic ? "Discovered Topic" : "Your Topic"}
            />
            <input
              className="v2-document-title-input"
              aria-label="Topic name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p>
              {selected.reason}. Topics help discovery; they never grant
              Project Context or change voice vocabulary without your action.
            </p>
          </div>

          <div className="v2-inline-actions">
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
          </div>

          {(selected.project_suggestions ?? []).length ? (
            <section className="v2-settings-section">
              <div className="v2-panel-section-heading">
                <div>
                  <h2>Related Projects</h2>
                  <p>Suggestions only. Sources move into Context when you add them.</p>
                </div>
              </div>
              <div className="v2-review-list">
                {selected.project_suggestions.map((suggestion) => (
                  <article
                    className="v2-review-row"
                    key={suggestion.project_id}
                  >
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
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {(selected.vocabulary_suggestions ?? []).length ? (
            <section className="v2-settings-section">
              <div className="v2-panel-section-heading">
                <div>
                  <h2>Vocabulary suggestions</h2>
                  <p>Choose exactly where each confirmed term should apply.</p>
                </div>
              </div>
              <div className="v2-review-list">
                {selected.vocabulary_suggestions.map((suggestion) => (
                  <article className="v2-review-row" key={suggestion.term}>
                    <div>
                      <OriginLabel origin="ai" detail="Not remembered yet" />
                      <h3>{suggestion.term}</h3>
                      <p>{suggestion.reason}</p>
                    </div>
                    <div className="v2-inline-actions">
                      <select
                        className="v2-input"
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
                      </select>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => rememberVocabulary(suggestion.term)}
                      >
                        Remember
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="v2-settings-section">
            <div className="v2-panel-section-heading">
              <div>
                <h2>Source relationships</h2>
                <p>Duplicate links are exact. Conflict and supplement labels are suggestions to review.</p>
              </div>
            </div>
            <div className="v2-review-list">
              {(selected.relationships ?? []).map((relationship) => {
                const [leftId, rightId] = relationship.source_ids;
                const left = materials.find((item) => item.id === leftId);
                const right = materials.find((item) => item.id === rightId);
                return (
                  <article
                    className="v2-review-row"
                    key={`${relationship.type}:${relationship.source_ids.join(":")}`}
                  >
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
                    <div className="v2-inline-actions">
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
                    </div>
                  </article>
                );
              })}
              {!selected.relationships?.length ? (
                <div className="v2-recovery-card">
                  <p>Add another distinct Source to compare relationships.</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="v2-settings-section">
            <h2>Related Sources</h2>
            <div className="v2-review-list">
              {sources.map((source) => (
                <article className="v2-review-row" key={source.id}>
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
                      <p>{source.content}</p>
                    </span>
                  </label>
                  <Button size="sm" onClick={() => onOpenSource(source.id)}>
                    Open
                  </Button>
                </article>
              ))}
            </div>
          </section>

          <section className="v2-settings-section">
            <h2>Merge or split</h2>
            <div className="v2-filter-row">
              <select
                className="v2-input"
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
              </select>
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
            <div className="v2-filter-row">
              <input
                className="v2-input"
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
          </section>

          {error ? (
            <div className="v2-warning-bar" role="alert">
              {error}
            </div>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}
