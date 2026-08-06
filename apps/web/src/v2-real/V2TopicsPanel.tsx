import type { Material } from "@logue/ui";
import { ArrowRight, EyeOff, GitMerge, Scissors } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { convertTopicToProject, getTopics, mergeTopics, splitTopic, updateTopic, type DiscoveredTopic } from "../api";
import { Button } from "../components/ui";
import { OriginLabel } from "../v2-mock/primitives/OriginLabel";

function sourceTitle(source: Material) {
  return source.source?.title || source.source?.domain || source.content.slice(0, 72) || "Saved Source";
}

export function V2TopicsPanel({ materials, onRefresh, onOpenSource }: { materials: Material[]; onRefresh: () => Promise<void>; onOpenSource: (id: string) => void }) {
  const [topics, setTopics] = useState<DiscoveredTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [name, setName] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [mergeId, setMergeId] = useState("");
  const [splitName, setSplitName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = topics.find((topic) => topic.id === selectedId) ?? topics.find((topic) => !topic.hidden) ?? topics[0];
  const sources = useMemo(() => (selected?.source_ids ?? []).flatMap((id) => { const source = materials.find((item) => item.id === id); return source && !source.tombstone ? [source] : []; }), [materials, selected?.source_ids.join("|")]);

  async function refresh() {
    try { const values = await getTopics(); setTopics(values); if (!selectedId && values[0]) setSelectedId(values[0].id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not discover Topics."); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setName(selected?.name ?? ""); setSourceIds(selected?.source_ids ?? []); setSplitName(""); }, [selected?.id, selected?.updated_at]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); await onRefresh(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this Topic."); }
    finally { setBusy(false); }
  }

  return <div className="v2-topic-workbench"><aside className="v2-topic-list"><div className="v2-document-list-heading"><strong>Topics</strong><span>{topics.filter((topic) => !topic.hidden).length}</span></div>{topics.map((topic) => <button type="button" key={topic.id} className={`${topic.id === selected?.id ? "is-active" : ""}${topic.hidden ? " is-muted" : ""}`} onClick={() => setSelectedId(topic.id)}><strong>{topic.name}</strong><span>{topic.source_ids.length} Sources</span><small>{topic.hidden ? "Hidden" : topic.reason}</small></button>)}{!topics.length ? <div className="v2-recovery-card"><p>Topics appear when at least two saved Sources share a confirmed tag or site.</p></div> : null}</aside>{selected ? <main className="v2-topic-editor"><div className="v2-page-heading-copy"><OriginLabel origin="ai" detail={selected.automatic ? "Discovered Topic" : "Your Topic"} /><input className="v2-document-title-input" value={name} onChange={(event) => setName(event.target.value)} /><p>{selected.reason}. Topics help discovery; they never grant Project Context.</p></div><div className="v2-inline-actions"><Button disabled={busy || !name.trim()} onClick={() => void run(() => updateTopic(selected.id, { name: name.trim(), sourceIds }))}>Save changes</Button><Button disabled={busy} onClick={() => void run(() => updateTopic(selected.id, { hidden: !selected.hidden }))}><EyeOff size={14} />{selected.hidden ? "Show Topic" : "Hide Topic"}</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={() => void run(() => convertTopicToProject(selected.id, name.trim()))}><ArrowRight size={14} />Convert to Project</Button></div><section className="v2-settings-section"><h2>Related Sources</h2><div className="v2-review-list">{sources.map((source) => <article className="v2-review-row" key={source.id}><label><input type="checkbox" checked={sourceIds.includes(source.id)} onChange={(event) => setSourceIds(event.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id))} /><span><strong>{sourceTitle(source)}</strong><p>{source.content}</p></span></label><Button size="sm" onClick={() => onOpenSource(source.id)}>Open</Button></article>)}</div></section><section className="v2-settings-section"><h2>Merge or split</h2><div className="v2-filter-row"><select className="v2-input" value={mergeId} onChange={(event) => setMergeId(event.target.value)}><option value="">Merge with…</option>{topics.filter((topic) => topic.id !== selected.id).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select><Button disabled={busy || !mergeId || !name.trim()} onClick={() => void run(() => mergeTopics([selected.id, mergeId], name.trim()))}><GitMerge size={14} />Merge</Button></div><div className="v2-filter-row"><input className="v2-input" value={splitName} onChange={(event) => setSplitName(event.target.value)} placeholder="New Topic name" /><Button disabled={busy || !splitName.trim() || sourceIds.length === 0 || sourceIds.length === selected.source_ids.length} onClick={() => void run(() => splitTopic(selected.id, sourceIds, splitName.trim()))}><Scissors size={14} />Split selected</Button></div></section>{error ? <div className="v2-warning-bar" role="alert">{error}</div> : null}</main> : null}</div>;
}
