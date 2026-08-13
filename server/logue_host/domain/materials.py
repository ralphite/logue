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
    capture_seconds: float | None = None,
    transcript: str | None = None,
    context: str | None = None,
    anchor: dict[str, Any] | None = None,
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
    if anchor:
        # Where on the page this was, so it can be found again.
        #
        # Kept apart from `source` on purpose. The URL, the title and the
        # domain are where it came from and never change; an anchor is a
        # pointer into a page that other people keep editing, and repairing it
        # must not mean rewriting the origin.
        record["anchor"] = anchor
    if capture_id:
        record["capture_id"] = capture_id
        # Kept on the Source as well as beside the audio: a player asking how
        # long a recording is should not have to open a second file, and the
        # file itself has never known — MediaRecorder does not write it.
        if capture_seconds:
            record["capture_seconds"] = round(float(capture_seconds), 1)
    if extra:
        record.update(extra)
    return store.materials.put(record)


def update(store: Store, material_id: str, changes: dict[str, Any]) -> Record:
    record = store.materials.get(material_id)
    # `anchor` is here and `source` is not, and that is the whole distinction:
    # a pointer into someone else's page can be repaired, an origin cannot.
    allowed = {"content", "status", "projects", "tags", "organization", "topic_ids", "excluded", "anchor"}
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
    """The Materials a generation may read: in the Project, not excluded.

    Not what the person asked, either. A question typed into the ask box is
    written down as a Material so the day's activity is complete — 53 of them
    on this workspace — and an ask that retrieves its own wording is a model
    reading the question back as if it were evidence.
    """
    return [
        record
        for record in search(store, project=project)
        if not record.get("excluded")
        and not (record.get("organization") or {}).get("duplicate_of")
        and record.get("purpose") != "activity"
    ]


STOP = {"the", "and", "for", "what", "when", "where", "who", "why", "how", "was",
        "were", "did", "does", "with", "from", "about", "this", "that", "there",
        "have", "has", "any", "all", "into", "your", "you", "our"}


def relevant(store: Store, query: str, project: str = "", limit: int = 6) -> list[Record]:
    """The Materials most likely to answer this question, best first.

    The phrase is tried whole, then its words, ranked by how many of them a
    Source carries — a question is asked in sentences and no Source contains
    "when is the kickoff?" verbatim.

    Everything that reads a Project to answer with goes through here. Without
    it, a generation was handed the Project entire: one ask on this workspace
    took 192 Sources, cited one, and twice came back "the evidence is
    insufficient" with the answer sitting in the pile.
    """
    within = context_for(store, project) if project else []
    words = [w.strip("?.,!\"'“”") for w in query.casefold().split()]
    words = [w for w in words if len(w) > 2 and w not in STOP]
    if not words:
        # Nothing to rank by — the newest, which is at least a rule someone
        # can predict, rather than however the directory happened to list.
        # Judged before the phrase is tried: a query of "?" matched every
        # Source with a question mark in it and called that relevance.
        return sorted(within, key=lambda r: str(r.get("created_at") or ""), reverse=True)[:limit]

    ids = {record["id"] for record in within} if project else None
    phrase = [r for r in search(store, query=query, project=project) if ids is None or r["id"] in ids]
    if phrase:
        return phrase[:limit]

    pool = within if project else search(store)
    scored: list[tuple[int, Record]] = []
    for record in pool:
        haystack = f"{record.get('content') or ''} {record.get('context') or ''}".casefold()
        hits = sum(1 for word in words if word in haystack)
        if hits:
            scored.append((hits, record))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [record for _, record in scored[:limit]]
