"""Topics: automatic grouping so the Stream stays navigable.

Grouping is derived from what a Material already carries — its domain and its
Projects — rather than a model call, so it is instant, explainable, and free.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..store import Record, Store


def _seed_of(material: Record) -> tuple[str, str] | None:
    projects = material.get("projects") or []
    if projects:
        return f"project:{projects[0]}", str(projects[0])
    domain = (material.get("source") or {}).get("domain")
    if domain:
        return f"domain:{domain}", str(domain)
    return None


def regroup(store: Store) -> list[Record]:
    """Rebuild automatic Topics; manual ones are left untouched."""
    manual = [topic for topic in store.topics.all() if not topic.get("automatic")]
    buckets: dict[str, dict[str, Any]] = {}
    for material in store.materials.list():
        seed = _seed_of(material)
        if seed is None:
            continue
        key, label = seed
        bucket = buckets.setdefault(key, {"name": label, "source_ids": []})
        bucket["source_ids"].append(material["id"])

    for topic in store.topics.all():
        if topic.get("automatic"):
            store.topics.delete(topic["id"])

    created = []
    for key, bucket in buckets.items():
        if len(bucket["source_ids"]) < 2:
            continue
        timestamp = now()
        created.append(
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
    return created + manual


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
