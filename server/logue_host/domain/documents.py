"""Documents: generated results the user keeps editing.

Autosave writes a revision only when the text actually changed, so the history
records edits rather than keystrokes.
"""

from __future__ import annotations

import re
from typing import Any

from ..errors import BadRequest, Conflict, NotFound
from ..ids import new_id, now
from ..providers import Provider
from ..store import Record, Store
from . import history


# -- what a document is called ----------------------------------------------
#
# The first line of it, and nothing else. A document used to carry a title
# beside its text, with three states recording who had last claimed it; the
# owner's instruction on 2026-08-13 was that there should be no such field at
# all — "我们并没有专门的一个 title，它就是这个文档的第一行", the way a Google
# Doc is named by the heading you type into it.
#
# `title` is still written on the record, because a list of documents cannot
# open every one of them to find out what it is called. It is a copy of the
# first line, refreshed by every write, and never something a caller sets.

#: The name follows the first line only this far.
TITLE_LIMIT = 50


def first_line(content: str, limit: int = TITLE_LIMIT) -> str:
    """What a document is called: its first line, with the markup taken off.

    `# Tuesday` is called `Tuesday` — the hash is how a heading is written, not
    part of its name. Everything else a line can start with (a bullet, a quote,
    a number) goes the same way.
    """
    for line in str(content or "").replace("\r\n", "\n").split("\n"):
        bare = re.sub(r"^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)", "", line).strip()
        # Inline marks are markup too: **Tuesday** is called Tuesday.
        bare = re.sub(r"(\*\*|__|\*|_|`)", "", bare).strip()
        if bare:
            return bare[:limit]
    return ""


def named(content: str) -> str:
    """The name to store, including the one an empty document gets."""
    return first_line(content) or "Untitled"


def create(store: Store, *, title: str = "", content: str = "", source_ids: list[str] | None = None) -> Record:
    """A new document. A name handed in becomes its first line, not a field.

    Generations and the agent both arrive with a name they chose — and that
    name has to live in the text now, or it is exactly the separate title this
    change removed.
    """
    timestamp = now()
    body = str(content or "")
    if title.strip() and first_line(body) != first_line(title):
        body = f"# {title.strip()}\n\n{body}" if body.strip() else f"# {title.strip()}"
    return store.documents.put(
        {
            "id": new_id("document"),
            "title": named(body),
            "content": body,
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
    allowed = {"content", "source_ids"}
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
    # A save that writes the same text is not an edit, and must not look like
    # one: `updated_at` is what the list is ordered by, so bumping it moved a
    # document someone had merely opened to the top of their own list.
    if not changed:
        return document

    if "content" in changes:
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
    # The name is a copy of the first line, refreshed by the write that could
    # have changed it. Nothing else names a document.
    document["title"] = named(str(document.get("content") or ""))
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
    document["title"] = named(str(document.get("content") or ""))
    document["updated_at"] = now()
    return store.documents.put(document)


def sources_of(store: Store, document_id: str) -> list[Record]:
    document = store.documents.get(document_id)
    found = [store.materials.find(source_id) for source_id in document.get("source_ids") or []]
    return [source for source in found if source]


# -- the one format ---------------------------------------------------------
#
# Documents were stored as HTML, because the editor was a `contenteditable`
# and a model's Markdown had to be turned into something it could show. The
# editor is now a Markdown editor, so the round trip is gone: what the model
# writes, what is stored, what is exported and what the person edits are all
# the same text. What remains is reading the old shape back.


#: The tags the editor and the old converter ever wrote.
_TAG = re.compile(r"</?(p|div|h[1-6]|ul|ol|li|br|blockquote|strong|b|em|i|code|a|span|mark)\b[^>]*>", re.I)


def looks_like_html(content: str) -> bool:
    """Anywhere in the text, not only at the start.

    A `contenteditable` typed into produces `a<div>next line</div>` — the first
    line is bare text and everything after it is markup. Matching only the
    beginning left those documents half converted, which is worse than either.
    """
    return bool(_TAG.search(str(content or "")))


def as_markdown(content: str) -> str:
    """The stored HTML of an older document, read back as Markdown.

    Only the shapes that HTML was ever written in — the editor's own output and
    what `as_html` used to produce from a model's answer. Text that is already
    Markdown comes back untouched, which is what makes this safe to run over a
    whole workspace or on the way out of the store.
    """
    text = str(content or "")
    if not looks_like_html(text):
        return text.strip()

    body = re.sub(r"(?is)<(script|style)\b.*?</\1>", "", text)
    body = re.sub(r"(?i)<br\s*/?>", "\n", body)
    # Inline marks first: the block pass below strips whatever is left.
    body = re.sub(r"(?is)<(strong|b)\b[^>]*>(.*?)</\1>", r"**\2**", body)
    body = re.sub(r"(?is)<(em|i)\b[^>]*>(.*?)</\1>", r"*\2*", body)
    body = re.sub(r"(?is)<code\b[^>]*>(.*?)</code>", r"`\1`", body)
    body = re.sub(r"(?is)<a\b[^>]*href=\"([^\"]*)\"[^>]*>(.*?)</a>", r"[\2](\1)", body)
    for level in range(1, 7):
        body = re.sub(rf"(?is)<h{level}\b[^>]*>(.*?)</h{level}>", lambda m, n=level: f"\n\n{'#' * n} {m.group(1).strip()}\n\n", body)
    body = re.sub(r"(?is)<blockquote\b[^>]*>(.*?)</blockquote>", lambda m: "\n\n> " + m.group(1).strip() + "\n\n", body)
    # One item is one line. A `<li>` from an export holds its own `<p>`, and
    # letting the block pass below have it turned every bullet into a lone `-`
    # with its words in the paragraph underneath.
    def flat(item: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"(?is)</?(p|div|br)\b[^>]*>", " ", item)).strip()

    def numbered(match: re.Match[str]) -> str:
        items = re.findall(r"(?is)<li\b[^>]*>(.*?)</li>", match.group(1))
        return "\n\n" + "\n".join(f"{n}. {flat(item)}" for n, item in enumerate(items, start=1)) + "\n\n"

    body = re.sub(r"(?is)<ol\b[^>]*>(.*?)</ol>", numbered, body)
    body = re.sub(r"(?is)<li\b[^>]*>(.*?)</li>", lambda m: f"- {flat(m.group(1))}\n", body)
    # Both ends of a block, not only the closing one: a `contenteditable`
    # writes `## 需求<div>the next paragraph</div>`, and dropping the opening
    # tag alone glued the paragraph onto the end of the heading.
    body = re.sub(r"(?is)</?(p|div|ul|ol|h[1-6]|blockquote)\b[^>]*>", "\n\n", body)
    body = re.sub(r"(?s)<[^>]+>", "", body)
    body = body.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def as_text(content: str) -> str:
    """The document as the person sees it.

    Everything that reads a document for a human — the export, the diff, the
    summary a model writes — goes through here, and now it is the same text
    the editor holds. Older documents still on disk as HTML are read back
    first, so a diff never reports a changed wrapper tag as a changed
    paragraph.
    """
    return as_markdown(content)


def to_markdown_store(store: Store) -> int:
    """Convert a workspace written in HTML, once, and keep every name.

    A document whose stored name is not already its first line gets that name
    written in as a heading — the name was chosen by somebody and this change
    must not be how it disappears. Returns how many documents were touched, so
    the Host can say so at startup rather than doing it silently.
    """
    settings = store.settings()
    # Recorded rather than guessed from the text. A document can legitimately
    # contain the characters of a tag — `&lt;div&gt;` typed on purpose comes
    # back as one — and a workspace that decides by looking would convert
    # itself again at every start.
    if settings.get("documents_are_markdown"):
        return 0

    changed = 0
    for document in store.documents.all():
        content = str(document.get("content") or "")
        was = str(document.get("title") or "").strip()
        body = as_markdown(content) if looks_like_html(content) else content
        if was and was != "Untitled" and first_line(body) != first_line(was):
            body = f"# {was}\n\n{body}" if body.strip() else f"# {was}"
        if body == content and document.get("title") == named(body) and "title_state" not in document:
            continue
        document["content"] = body
        document["title"] = named(body)
        document.pop("title_state", None)
        store.documents.put(document)
        changed += 1
    for revision in store.doc_revisions.all():
        kept = str(revision.get("content") or "")
        if looks_like_html(kept):
            revision["content"] = as_markdown(kept)
            store.doc_revisions.put(revision)
    store.save_settings({**settings, "documents_are_markdown": True})
    return changed


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


def versions(store: Store, document_id: str) -> list[Record]:
    """The document's history, newest first, each saying what it changed.

    The current text is version one of these too. Leaving it out made the list
    read as "the old ones", with nothing saying where they end and now begins.
    """
    document = store.documents.get(document_id)
    return history.stack(
        [
            *[
                {
                    "id": r["id"],
                    "revision": int(r.get("revision") or 0),
                    "text": str(r.get("content") or ""),
                    "created_at": r.get("created_at"),
                    "summary": r.get("summary"),
                    "summary_state": r.get("summary_state"),
                }
                for r in _kept(store, document_id)
            ],
            {
                "id": "",
                "revision": int(document.get("revision") or 1),
                "text": str(document.get("content") or ""),
                "created_at": document.get("updated_at"),
                "current": True,
            },
        ],
        _lines,
    )


def diff(store: Store, document_id: str, revision: int) -> list[Record]:
    """What one version changed, line by line, against the one before it."""
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    timeline = [*rows, {"revision": int(document.get("revision") or 1), "content": document.get("content")}]
    at = next((i for i, r in enumerate(timeline) if int(r.get("revision") or 0) == revision), None)
    if at is None:
        raise NotFound(f"This document has no version {revision}.")
    return history.compare(
        _lines(str(timeline[at - 1].get("content") or "")) if at else [],
        _lines(str(timeline[at].get("content") or "")),
    )


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


REWRITE = (
    "Rewrite the passage below as instructed. Return only the rewritten passage — "
    "no preamble, no commentary, no quotation marks around it. Keep the meaning "
    "unless the instruction says otherwise, and keep the original language."
)


def rewrite(
    store: Store, provider: Provider, document_id: str, *, selection: str, instruction: str
) -> dict[str, Any]:
    """A model's rewrite of a selected passage, offered as decisions.

    The model proposes; nothing touches the document here. What returns is the
    rewritten text folded into hunks — stretches kept, changes offered — and
    the person applies what they accept in the editor, where the edit lands as
    an ordinary revision the history already records. The proposal itself is
    kept as a Run, so "why does it say this now" has an answer later.
    """
    store.documents.get(document_id)
    if not selection.strip():
        raise BadRequest("Select the passage to rewrite first.")
    if not instruction.strip():
        raise BadRequest("Say how it should change.")

    prompt = f"Instruction: {instruction.strip()}\n\nPassage:\n{selection}"
    rewritten = provider.generate(REWRITE, prompt).strip()

    run = store.runs.put(
        {
            "id": new_id("run"),
            "kind": "rewrite",
            "document_id": document_id,
            "instruction": instruction.strip(),
            "original_output": rewritten,
            "selection": selection,
            "status": "complete",
            "sources": [],
            "created_at": now(),
        }
    )
    before = [line for line in selection.splitlines() if line.strip()]
    after = [line for line in rewritten.splitlines() if line.strip()]
    return {"run_id": run["id"], "rewritten": rewritten, "hunks": history.hunks(before, after)}


def to_markdown(store: Store, document_id: str) -> str:
    """Export with a Sources appendix, so the file stands on its own.

    No title line is added: the document's first line is its name, and putting
    it in again gave every exported file its own heading twice.
    """
    document = store.documents.get(document_id)
    lines = [as_text(str(document.get("content") or ""))]
    sources = sources_of(store, document_id)
    if sources:
        lines += ["", "## Sources", ""]
        for index, source in enumerate(sources, start=1):
            origin = (source.get("source") or {}).get("url") or "This Mac"
            title = (source.get("source") or {}).get("title") or str(source.get("content") or "")[:60]
            lines.append(f"{index}. {title} — {origin}")
    return "\n".join(lines) + "\n"
