"""Topics: automatic grouping so the Stream stays navigable.

Grouping is derived from what a Material already carries — its domain and its
Projects — rather than a model call, so it is instant, explainable, and free.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..store import Record, Store


def _seeds_of(material: Record) -> list[tuple[str, str]]:
    """Every grouping this Material belongs to: its tags, Project, and domain."""
    seeds: list[tuple[str, str]] = []
    for tag in material.get("tags") or []:
        if str(tag).strip():
            seeds.append((f"tag:{tag}", str(tag)))
    for project in material.get("projects") or []:
        seeds.append((f"project:{project}", str(project)))
    domain = (material.get("source") or {}).get("domain")
    if domain:
        seeds.append((f"domain:{domain}", str(domain)))
    return seeds


def regroup(store: Store) -> list[Record]:
    """Refresh automatic Topics in place.

    Updates a Topic rather than replacing it, and only removes one whose seed no
    longer produces a group. Rebuilding from scratch would throw away every
    Topic whose seed this function does not currently know how to recreate —
    and a renamed or hidden Topic is the user's work, not ours to discard.
    """
    buckets: dict[str, dict[str, Any]] = {}
    for material in store.materials.list():
        for key, label in _seeds_of(material):
            bucket = buckets.setdefault(key, {"name": label, "source_ids": []})
            bucket["source_ids"].append(material["id"])

    grouped = {key: bucket for key, bucket in buckets.items() if len(bucket["source_ids"]) >= 2}
    existing = {str(topic.get("seed_key")): topic for topic in store.topics.all() if topic.get("automatic")}

    result: list[Record] = []
    for key, bucket in grouped.items():
        timestamp = now()
        topic = existing.get(key)
        if topic:
            topic["source_ids"] = bucket["source_ids"]
            topic["updated_at"] = timestamp
            result.append(store.topics.put(topic))
            continue
        result.append(
            store.topics.put(
                {
                    "id": new_id("topic"),
                    "name": bucket["name"],
                    "seed_key": key,
                    "automatic": True,
                    "hidden": False,
                    "source_ids": bucket["source_ids"],
                    "reason": f"Related Sources from {bucket['name']}",
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            )
        )

    for key, topic in existing.items():
        if key not in grouped:
            store.topics.delete(topic["id"])

    manual = [topic for topic in store.topics.all() if not topic.get("automatic")]
    return result + manual


def rename(store: Store, topic_id: str, name: str) -> Record:
    topic = store.topics.get(topic_id)
    if not name.strip():
        raise BadRequest("name is required")
    topic["name"] = name.strip()
    topic["automatic"] = False
    topic["updated_at"] = now()
    return store.topics.put(topic)


def add_to_project(store: Store, topic_id: str, project_name: str) -> dict[str, Any]:
    topic = store.topics.get(topic_id)
    added = 0
    for material_id in topic.get("source_ids") or []:
        material = store.materials.find(material_id)
        if not material:
            continue
        names = material.get("projects") or []
        if project_name not in names:
            material["projects"] = [*names, project_name]
            material["updated_at"] = now()
            store.materials.put(material)
            added += 1
    return {"added": added}


def save_vocabulary(store: Store, topic_id: str, terms: list[str]) -> Record:
    """Terms a Topic keeps getting wrong, fed back into transcription."""
    topic = store.topics.get(topic_id)
    existing = next((v for v in store.vocabularies.all() if v.get("topic_id") == topic_id), None)
    cleaned = [term.strip() for term in terms if term.strip()]
    if existing:
        existing["terms"] = cleaned
        existing["updated_at"] = now()
        return store.vocabularies.put(existing)
    timestamp = now()
    return store.vocabularies.put(
        {
            "id": new_id("vocabulary"),
            "topic_id": topic_id,
            "name": topic.get("name"),
            "terms": cleaned,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )
