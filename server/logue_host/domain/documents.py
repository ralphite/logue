"""Documents: generated results the user keeps editing.

Autosave writes a revision only when the text actually changed, so the history
records edits rather than keystrokes.
"""

from __future__ import annotations

import difflib
import re
from typing import Any

from ..errors import BadRequest, Conflict, NotFound
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
                # The line saying what this changed is written afterwards, by
                # a model, so the save itself stays instant.
                "summary_state": "pending",
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
            "summary_state": "pending",
        }
    )
    document["revision"] = int(document.get("revision", 1)) + 1
    document["updated_at"] = now()
    return store.documents.put(document)


def sources_of(store: Store, document_id: str) -> list[Record]:
    document = store.documents.get(document_id)
    found = [store.materials.find(source_id) for source_id in document.get("source_ids") or []]
    return [source for source in found if source]


def as_text(content: str) -> str:
    """The document as the person sees it, with the markup taken out.

    Everything that reads a document for a human — the export, the diff, the
    summary a model writes — goes through here. Diffing the stored HTML would
    report a changed wrapper tag as a changed paragraph.
    """
    body = re.sub(r"<br\s*/?>", "\n", content or "")
    body = re.sub(r"</(p|div|li|h[1-6])>", "\n\n", body)
    body = re.sub(r"<li>", "- ", body)
    body = re.sub(r"<[^>]+>", "", body)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


# -- history --------------------------------------------------------------


def _kept(store: Store, document_id: str) -> list[Record]:
    """Every stored revision of one document, oldest first.

    A stored row holds the content *before* the edit that replaced it, filed
    under the revision number it was. The newest version is not in here — it is
    the document itself.
    """
    rows = [r for r in store.doc_revisions.list() if r.get("doc_id") == document_id]
    return sorted(rows, key=lambda r: int(r.get("revision") or 0))


def _lines(content: str) -> list[str]:
    """A document's paragraphs, which are the units a change is counted in.

    The blank line between two paragraphs is punctuation, not content: leaving
    it in reported every added paragraph as two added lines, one of them empty.
    """
    return [line for line in as_text(content).splitlines() if line.strip()]


def _counts(before: str, after: str) -> tuple[int, int]:
    diff = difflib.ndiff(_lines(before), _lines(after))
    added = removed = 0
    for line in diff:
        if line.startswith("+ "):
            added += 1
        elif line.startswith("- "):
            removed += 1
    return added, removed


def versions(store: Store, document_id: str) -> list[Record]:
    """The document's history, newest first, each saying what it changed.

    The current text is version one of these too. Leaving it out made the list
    read as "the old ones", with nothing saying where they end and now begins.
    """
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    timeline = [
        *[{"id": r["id"], "revision": int(r.get("revision") or 0), "content": str(r.get("content") or ""),
           "created_at": r.get("created_at"), "summary": r.get("summary"),
           "summary_state": r.get("summary_state")} for r in rows],
        {"id": "", "revision": int(document.get("revision") or 1), "content": str(document.get("content") or ""),
         "created_at": document.get("updated_at"), "current": True},
    ]
    out = []
    for index, version in enumerate(timeline):
        before = timeline[index - 1]["content"] if index else ""
        added, removed = _counts(before, version["content"])
        out.append({**{k: v for k, v in version.items() if k != "content"}, "added": added, "removed": removed})
    out.reverse()
    return out


def diff(store: Store, document_id: str, revision: int) -> list[Record]:
    """What one version changed, line by line, against the one before it."""
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    timeline = [*rows, {"revision": int(document.get("revision") or 1), "content": document.get("content")}]
    at = next((i for i, r in enumerate(timeline) if int(r.get("revision") or 0) == revision), None)
    if at is None:
        raise NotFound(f"This document has no version {revision}.")

    before = _lines(str(timeline[at - 1].get("content") or "")) if at else []
    after = _lines(str(timeline[at].get("content") or ""))

    lines: list[Record] = []
    old = new = 0
    for chunk in difflib.ndiff(before, after):
        mark, text = chunk[:2], chunk[2:]
        if mark == "  ":
            old, new = old + 1, new + 1
            lines.append({"kind": "same", "text": text, "old": old, "new": new})
        elif mark == "- ":
            old += 1
            lines.append({"kind": "removed", "text": text, "old": old, "new": None})
        elif mark == "+ ":
            new += 1
            lines.append({"kind": "added", "text": text, "old": None, "new": new})
        # "? " lines are ndiff's own hint markers, not content.
    return lines


def newest_unwritten(store: Store, document_id: str) -> str | None:
    """The most recent version still waiting for its line, if there is one."""
    waiting = [r for r in _kept(store, document_id) if r.get("summary_state") == "pending"]
    return str(waiting[-1]["id"]) if waiting else None


def restore(store: Store, document_id: str, revision: int) -> Record:
    """Bring an old version back as a new edit.

    Written forward rather than rolled back: the versions in between stay, and
    coming back from a restore is itself a restore. A history that loses its
    tail every time someone looks at it is not a history.
    """
    rows = _kept(store, document_id)
    found = next((r for r in rows if int(r.get("revision") or 0) == revision), None)
    if found is None:
        raise NotFound(f"This document has no version {revision} to go back to.")
    document = store.documents.get(document_id)
    return update(store, document_id, {"content": str(found.get("content") or "")},
                  expected_revision=int(document.get("revision") or 1))


def to_markdown(store: Store, document_id: str) -> str:
    """Export with a Sources appendix, so the file stands on its own."""
    document = store.documents.get(document_id)
    body = as_text(str(document.get("content") or ""))

    lines = [f"# {document.get('title') or 'Untitled'}", "", body]
    sources = sources_of(store, document_id)
    if sources:
        lines += ["", "## Sources", ""]
        for index, source in enumerate(sources, start=1):
            origin = (source.get("source") or {}).get("url") or "This Mac"
            title = (source.get("source") or {}).get("title") or str(source.get("content") or "")[:60]
            lines.append(f"{index}. {title} — {origin}")
    return "\n".join(lines) + "\n"
