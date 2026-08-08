"""Materials: everything the user deliberately kept.

The product's one non-negotiable rule lives here — a derived Material always
points back at what it came from, so nothing generated can float free of its
evidence.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..store import Record, Store

KINDS = {"voice", "selection", "text", "page", "derived"}


def create(
    store: Store,
    *,
    kind: str,
    content: str,
    source: dict[str, Any] | None = None,
    projects: list[str] | None = None,
    parent_ids: list[str] | None = None,
    capture_id: str | None = None,
    transcript: str | None = None,
    context: str | None = None,
    actor: str = "user",
    extra: dict[str, Any] | None = None,
) -> Record:
    if kind not in KINDS:
        raise BadRequest(f"kind must be one of {', '.join(sorted(KINDS))}")
    if not content.strip():
        raise BadRequest("content is required")
    timestamp = now()
    record: Record = {
        "id": new_id("material"),
        "kind": kind,
        "status": "unfiled",
        "content": content,
        "source": source or {},
        "projects": projects or [],
        "parent_ids": parent_ids or [],
        "tags": [],
        "actor": actor,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    if transcript is not None:
        record["transcript"] = transcript
    if context:
        # The passage the quote came from, kept so a citation can be read in
        # context after the page it came from has changed.
        record["context"] = context
    if capture_id:
        record["capture_id"] = capture_id
    if extra:
        record.update(extra)
    return store.materials.put(record)


def update(store: Store, material_id: str, changes: dict[str, Any]) -> Record:
    record = store.materials.get(material_id)
    allowed = {"content", "status", "projects", "tags", "organization", "topic_ids", "excluded"}
    unknown = set(changes) - allowed
    if unknown:
        raise BadRequest(f"cannot change {', '.join(sorted(unknown))}")
    record.update(changes)
    record["updated_at"] = now()
    return store.materials.put(record)


def delete(store: Store, material_id: str) -> None:
    """Remove the Material and the derived work that would otherwise dangle."""
    store.materials.get(material_id)
    for child in store.materials.all():
        parents = child.get("parent_ids") or []
        if material_id in parents:
            remaining = [p for p in parents if p != material_id]
            child["parent_ids"] = remaining
            child["orphaned"] = not remaining
            store.materials.put(child)
    store.materials.delete(material_id)


def search(store: Store, query: str = "", project: str = "", kind: str = "") -> list[Record]:
    needle = query.strip().lower()
    results = []
    for record in store.materials.list():
        if project and project not in (record.get("projects") or []):
            continue
        if kind and record.get("kind") != kind:
            continue
        if needle:
            haystack = " ".join(
                [
                    str(record.get("content") or ""),
                    str(record.get("transcript") or ""),
                    str((record.get("source") or {}).get("title") or ""),
                    str((record.get("source") or {}).get("url") or ""),
                    # Tags are how a lot of this workspace is already labelled;
                    # leaving them out made searching for one find nothing.
                    " ".join(str(tag) for tag in record.get("tags") or []),
                ]
            ).lower()
            if needle not in haystack:
                continue
        results.append(record)
    return results


def context_for(store: Store, project: str) -> list[Record]:
    """The Materials a generation may read: in the Project, not excluded."""
    return [
        record
        for record in search(store, project=project)
        if not record.get("excluded") and not (record.get("organization") or {}).get("duplicate_of")
    ]
