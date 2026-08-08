"""Documents: generated results the user keeps editing.

Autosave writes a revision only when the text actually changed, so the history
records edits rather than keystrokes.
"""

from __future__ import annotations

import re
from typing import Any

from ..errors import BadRequest, Conflict
from ..ids import new_id, now
from ..store import Record, Store


def create(store: Store, *, title: str = "", content: str = "", source_ids: list[str] | None = None) -> Record:
    timestamp = now()
    return store.documents.put(
        {
            "id": new_id("document"),
            "title": title.strip() or "Untitled",
            "content": content,
            "source_ids": source_ids or [],
            "revision": 1,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )


def update(
    store: Store, document_id: str, changes: dict[str, Any], *, expected_revision: int | None = None
) -> Record:
    """Apply an edit, refusing one written against a version that has moved on.

    Two editors on the same document — two tabs, or a tab and a generation
    writing into it — used to end in whoever saved last, silently. The revision
    was counted and never checked. A caller that passes what it last saw gets
    told instead.
    """
    document = store.documents.get(document_id)
    allowed = {"title", "content", "source_ids"}
    unknown = set(changes) - allowed
    if unknown:
        raise BadRequest(f"cannot change {', '.join(sorted(unknown))}")

    current = int(document.get("revision", 1))
    if expected_revision is not None and expected_revision != current:
        raise Conflict(
            f"This document has moved on to revision {current}; your edit was written against "
            f"revision {expected_revision}."
        )

    changed = any(changes.get(key) != document.get(key) for key in changes)
    if changed and "content" in changes:
        store.doc_revisions.put(
            {
                "id": new_id("revision"),
                "doc_id": document_id,
                "revision": document.get("revision", 1),
                "content": document.get("content"),
                "created_at": now(),
            }
        )
        document["revision"] = document.get("revision", 1) + 1

    document.update(changes)
    if "title" in changes:
        document["title"] = str(changes["title"]).strip() or "Untitled"
    document["updated_at"] = now()
    return store.documents.put(document)


def append(store: Store, document_id: str, text: str, source_ids: list[str] | None = None) -> Record:
    """Add to the end of a document, bringing the Sources with it.

    A read-modify-write from a caller that cannot see the document — the Side
    Panel, say — would overwrite whatever else was typed meanwhile. Appending
    is the operation that is actually meant, so it is the one offered.
    """
    if not text.strip():
        raise BadRequest("there is nothing to add")
    document = store.documents.get(document_id)
    body = str(document.get("content") or "")
    document["content"] = f"{body}\n\n{text.strip()}" if body.strip() else text.strip()
    document["source_ids"] = list(dict.fromkeys([*(document.get("source_ids") or []), *(source_ids or [])]))
    store.doc_revisions.put(
        {
            "id": new_id("revision"),
            "doc_id": document_id,
            "revision": document.get("revision", 1),
            "content": body,
            "created_at": now(),
        }
    )
    document["revision"] = int(document.get("revision", 1)) + 1
    document["updated_at"] = now()
    return store.documents.put(document)


def sources_of(store: Store, document_id: str) -> list[Record]:
    document = store.documents.get(document_id)
    found = [store.materials.find(source_id) for source_id in document.get("source_ids") or []]
    return [source for source in found if source]


def to_markdown(store: Store, document_id: str) -> str:
    """Export with a Sources appendix, so the file stands on its own."""
    document = store.documents.get(document_id)
    body = re.sub(r"<br\s*/?>", "\n", str(document.get("content") or ""))
    body = re.sub(r"</(p|div|li|h[1-6])>", "\n\n", body)
    body = re.sub(r"<li>", "- ", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    lines = [f"# {document.get('title') or 'Untitled'}", "", body]
    sources = sources_of(store, document_id)
    if sources:
        lines += ["", "## Sources", ""]
        for index, source in enumerate(sources, start=1):
            origin = (source.get("source") or {}).get("url") or "This Mac"
            title = (source.get("source") or {}).get("title") or str(source.get("content") or "")[:60]
            lines.append(f"{index}. {title} — {origin}")
    return "\n".join(lines) + "\n"
