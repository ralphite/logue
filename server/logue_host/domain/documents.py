"""Documents: generated results the user keeps editing.

Each document is one working copy over a set of immutable versions. Editing
writes the working copy and nothing else; a version exists because a save —
the person's, or an agent's — changed something.
"""

from __future__ import annotations

import hashlib
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


def create(
    store: Store,
    *,
    title: str = "",
    content: str = "",
    source_ids: list[str] | None = None,
    parent: str | None = None,
    author: str | None = None,
) -> Record:
    """A new document. A name handed in becomes its first line, not a field.

    Generations and the agent both arrive with a name they chose — and that
    name has to live in the text now, or it is exactly the separate title this
    change removed. A document born with an agent's words gets that state as
    its first version, so what was handed over can always be come back to.
    """
    timestamp = now()
    body = str(content or "")
    if title.strip() and first_line(body) != first_line(title):
        body = f"# {title.strip()}\n\n{body}" if body.strip() else f"# {title.strip()}"
    if parent:
        store.documents.get(parent)
    document = store.documents.put(
        {
            "id": new_id("document"),
            "title": named(body),
            "content": body,
            "source_ids": source_ids or [],
            # Where it sits. At the top of wherever it was made: a list read
            # newest-first would otherwise put the page you just made last.
            "parent_id": parent,
            "position": 0,
            "revision": 1,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )
    if author == AGENT and body.strip():
        save(store, str(document["id"]), author=AGENT)
    return document


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
        # Worded once, here and in agent_begin: two endings on one refusal
        # taught callers to match on the prefix and guess the rest.
        raise Conflict(
            f"This document has moved on to revision {current}; you read revision {expected_revision}. "
            "Read it again."
        )

    changed = any(changes.get(key) != document.get(key) for key in changes)
    # A save that writes the same text is not an edit, and must not look like
    # one: `updated_at` is what the list is ordered by, so bumping it moved a
    # document someone had merely opened to the top of their own list.
    if not changed:
        return document

    if "content" in changes:
        # The working copy and nothing else. A version is made by a save,
        # never by the fact of typing.
        document["revision"] = document.get("revision", 1) + 1

    document.update(changes)
    # The name is a copy of the first line, refreshed by the write that could
    # have changed it. Nothing else names a document.
    document["title"] = named(str(document.get("content") or ""))
    document["updated_at"] = now()
    return store.documents.put(document)


def append(
    store: Store, document_id: str, text: str, source_ids: list[str] | None = None, *, author: str | None = None
) -> Record:
    """Add to the end of a document, bringing the Sources with it.

    A read-modify-write from a caller that cannot see the document — the Side
    Panel, say — would overwrite whatever else was typed meanwhile. Appending
    is the operation that is actually meant, so it is the one offered.

    An agent's addition is still an agent change, and keeps both of that
    change's promises: the person's unsaved words become a user version
    first, and the addition lands as an agent version — so it stays visible
    in the history, and survives even a later "keep mine" over the working
    copy. Appending needs no base for this: it cannot overwrite anything.
    """
    if not text.strip():
        raise BadRequest("there is nothing to add")
    if author == AGENT:
        save(store, document_id, author=USER)
    document = store.documents.get(document_id)
    body = str(document.get("content") or "")
    document["content"] = f"{body}\n\n{text.strip()}" if body.strip() else text.strip()
    document["source_ids"] = list(dict.fromkeys([*(document.get("source_ids") or []), *(source_ids or [])]))
    document["revision"] = int(document.get("revision", 1)) + 1
    document["title"] = named(str(document.get("content") or ""))
    document["updated_at"] = now()
    appended = store.documents.put(document)
    if author == AGENT:
        save(store, document_id, author=AGENT)
    return appended


# -- a tree of documents ----------------------------------------------------
#
# His instruction of 2026-08-13: *"we should also allow nested docs. like
# vibedoc"*. Vibedoc's shape, because it is the one that survives contact with
# moving things around: each document holds its own `parent_id` and its
# `position` among its siblings, and the tree is assembled when it is read.
# The alternative — a list of child ids on the parent — has the same fact
# written in two places, and they disagree the first time a move half fails.


def _siblings(store: Store, parent: str | None) -> list[Record]:
    """The children of one parent, in the order they are shown.

    Nothing placed by hand yet means every position is 0, and the tie is
    broken by *newest first* — the order this list has always been read in.
    A workspace that suddenly showed its oldest page at the top would have
    been the price of nesting, and nobody asked for that.
    """
    rows = [one for one in store.documents.all() if str(one.get("parent_id") or "") == str(parent or "")]
    return sorted(rows, key=lambda one: (int(one.get("position") or 0), _newest_first(one)))


def _newest_first(one: Record) -> str:
    """A sort key that puts later timestamps first."""
    stamp = str(one.get("updated_at") or one.get("created_at") or "")
    return "".join(chr(0x10FFFD - ord(ch)) if ord(ch) < 0x10FFFD else ch for ch in stamp)


def _renumber(store: Store, parent: str | None, order: list[str] | None = None) -> None:
    """Give one parent's children positions 0…n, in `order` if one is given."""
    rows = _siblings(store, parent)
    if order:
        rows.sort(key=lambda one: order.index(str(one["id"])) if str(one["id"]) in order else len(order))
    for at, one in enumerate(rows):
        if int(one.get("position") or 0) != at:
            one["position"] = at
            store.documents.put(one)


def _descendants(store: Store, document_id: str) -> set[str]:
    """Everything under a document, so nothing can be moved inside itself."""
    below: set[str] = set()
    edge = [document_id]
    while edge:
        parent = edge.pop()
        for child in _siblings(store, parent):
            child_id = str(child["id"])
            if child_id in below:
                continue
            below.add(child_id)
            edge.append(child_id)
    return below


def tree(store: Store) -> list[Record]:
    """Every document, each carrying where it sits.

    Flat on the wire, with `parent_id` and `position` on every row: a client
    that wants a tree builds one, and a client that wants a list — the panel's
    "add to a Document", Find — is not made to walk one.
    """
    rows = list(store.documents.all())
    for one in rows:
        one.setdefault("parent_id", None)
        one.setdefault("position", 0)
    return sorted(
        rows,
        key=lambda one: (str(one.get("parent_id") or ""), int(one.get("position") or 0), _newest_first(one)),
    )


def move(store: Store, document_id: str, *, parent: str | None, before: str | None = None) -> Record:
    """Put a document under another one, or at the top, in one write.

    Refuses a move into the document's own subtree — the one move that would
    make a tree stop being a tree, and silently orphan everything below it.
    """
    document = store.documents.get(document_id)
    was = document.get("parent_id") or None
    if parent:
        store.documents.get(parent)
        if parent == document_id or parent in _descendants(store, document_id):
            raise BadRequest("A document cannot be moved inside itself.")

    document["parent_id"] = parent
    document["updated_at"] = now()
    store.documents.put(document)

    order = [str(one["id"]) for one in _siblings(store, parent) if str(one["id"]) != document_id]
    at = order.index(before) if before and before in order else len(order)
    order.insert(at, document_id)
    _renumber(store, parent, order)
    if was != parent:
        _renumber(store, was)
    return store.documents.get(document_id)


def reorder(store: Store, parent: str | None, order: list[str]) -> list[Record]:
    """Set the order of one parent's children, and answer with it."""
    _renumber(store, parent, [str(one) for one in order])
    return _siblings(store, parent)


def remove(store: Store, document_id: str) -> None:
    """Delete a document without taking its children with it.

    They move up to where it was, in its place — vibedoc's rule, and the only
    one that cannot lose a page nobody meant to delete.
    """
    document = store.documents.get(document_id)
    parent = document.get("parent_id") or None
    children = _siblings(store, document_id)
    for child in children:
        child["parent_id"] = parent
        child["updated_at"] = now()
        store.documents.put(child)
    store.documents.delete(document_id)
    _renumber(store, parent)


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


def renumber_versions(store: Store) -> int:
    """Number every document's versions 1…n, once.

    Rows kept before 2026-08-19 were filed under the document's edit counter
    of the day they were written, so a real history read v1, v48, v56 — under
    a note promising nothing is thrown away. The number is the only handle a
    person has on a version; it has to count the way it reads. Returns how
    many rows moved, so the Host can say so at startup.
    """
    settings = store.settings()
    if settings.get("doc_versions_renumbered"):
        return 0
    by_doc: dict[str, list[Record]] = {}
    for row in store.doc_revisions.all():
        by_doc.setdefault(str(row.get("doc_id") or ""), []).append(row)
    changed = 0
    for rows in by_doc.values():
        rows.sort(key=lambda r: (int(r.get("revision") or 0), str(r.get("created_at") or "")))
        for at, row in enumerate(rows, start=1):
            if int(row.get("revision") or 0) != at:
                row["revision"] = at
                store.doc_revisions.put(row)
                changed += 1
    store.save_settings({**store.settings(), "doc_versions_renumbered": True})
    return changed


# -- versions -------------------------------------------------------------
#
# His design of 2026-08-19, in his own terms. Each document is one **working
# copy** — always there, always editable — over a set of immutable
# **versions**. The newest version is the **base**: the state the working
# copy grew out of, and the state a save is measured against.
#
#  * Editing writes the working copy and nothing else.
#  * Saving with nothing changed does nothing; a difference becomes one new
#    version, which is the new base. Only meaningful saves make history.
#  * A version records who saved it — the person, or an agent — because the
#    two must stay tellable apart in the history.
#
# An agent is asynchronous and must never cost the person their words, so its
# writes follow three more of his rules: it works from a fixed version
# (`agent_begin` saves any unsaved edits as a user version first, and hands
# that base back); its result lands atomically (`agent_commit` applies the
# whole change and its version together, or nothing — an agent that fails or
# is cancelled simply never commits); and the person wins a race — a working
# copy that moved while the agent worked is left alone, the result kept
# beside the document as a pending change to apply or discard.

#: Who a version was saved by. Rows from before 2026-08-19 carried a `kind`
#: (autosave/manual) instead; they read as the person's, like everything else
#: no agent wrote, and stay restorable the same way.
USER = "user"
AGENT = "agent"


def content_hash(content: str) -> str:
    return hashlib.sha256(str(content or "").encode("utf-8")).hexdigest()


def _base(rows: list[Record]) -> Record | None:
    """The version the working copy is based on: the newest one."""
    return rows[-1] if rows else None


def unsaved(document: Record, base: Record | None) -> bool:
    """Whether the working copy holds anything no version does."""
    content = str(document.get("content") or "")
    if base is None:
        return bool(content.strip())
    return str(base.get("content_hash") or "") != content_hash(content)


def save(store: Store, document_id: str, *, author: str = USER, label: str | None = None) -> Record | None:
    """The working copy as a new version — if it differs from the base.

    A save that changed nothing is ignored rather than recorded: only
    meaningful saves make history. The row returned is immutable from here
    on; nothing writes into a version again.
    """
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    base = _base(rows)
    if not unsaved(document, base):
        return None
    content = str(document.get("content") or "")
    row: Record = {
        "id": new_id("revision"),
        "doc_id": document_id,
        "revision": (int(base.get("revision") or 0) + 1) if base else 1,
        "content": content,
        "content_hash": content_hash(content),
        "author": AGENT if author == AGENT else USER,
        "created_at": now(),
        # The line saying what this changed is written afterwards, by a
        # model, so the save itself stays instant.
        "summary_state": "pending",
    }
    if label:
        row["label"] = str(label)[:120]
    return store.doc_revisions.put(row)


def agent_begin(store: Store, document_id: str, *, expected_revision: int | None = None) -> dict[str, Any]:
    """Fix the version an agent will work from, keeping the person's words first.

    Unsaved edits become a user version before anything else — the agent must
    never be what cost the person theirs. What returns is the base: the exact
    text the agent's result is measured against at commit. A stale
    `expected_revision` is refused, so an agent that read an old working copy
    reads again instead of building on air.
    """
    document = store.documents.get(document_id)
    current = int(document.get("revision") or 1)
    if expected_revision is not None and expected_revision != current:
        raise Conflict(
            f"This document has moved on to revision {current}; you read revision {expected_revision}. Read it again."
        )
    save(store, document_id, author=USER)
    base = _base(_kept(store, document_id))
    return {
        "document": store.documents.get(document_id),
        "base_version": {
            "id": str(base["id"]) if base else "",
            "revision": int(base.get("revision") or 0) if base else 0,
            "content": str(base.get("content") or "") if base else "",
        },
    }


def agent_commit(
    store: Store, document_id: str, *, base_version_id: str, content: str, label: str = ""
) -> dict[str, Any]:
    """An agent's finished change: applied whole, held for review, or dropped.

    Measured against the base `agent_begin` handed out, never against a
    working copy that moves. Output matching the base leaves no version.
    A working copy the person edited while the agent worked is not touched:
    the result waits beside the document as a pending change instead of
    silently winning.
    """
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    base = next((r for r in rows if str(r["id"]) == str(base_version_id or "")), None)
    if base_version_id and base is None:
        raise BadRequest("That base version does not belong to this document. Begin again.")
    base_content = str(base.get("content") or "") if base else ""
    content = str(content or "")
    if content == base_content:
        return {"result": "unchanged", "document": document}

    if str(document.get("content") or "") != base_content:
        held: Record = {"content": content, "base_version_id": str(base_version_id or ""), "created_at": now()}
        if label:
            held["label"] = str(label)[:120]
        # Not an edit: `updated_at` stays, so a proposal does not reorder the
        # person's list. The write still moves the change counter, which is
        # how an open editor learns there is something to review.
        document["pending_agent"] = held
        store.documents.put(document)
        return {"result": "pending", "document": document}

    updated = update(store, document_id, {"content": content}, expected_revision=int(document.get("revision") or 1))
    # An applied commit is the newest result. An older one still waiting must
    # not outlive it: its Apply would roll the document back.
    if updated.pop("pending_agent", None) is not None:
        store.documents.put(updated)
    version = save(store, document_id, author=AGENT, label=label or None)
    return {"result": "applied", "document": updated, "version": version}


def pending_change(store: Store, document_id: str) -> dict[str, Any]:
    """The agent result waiting for a decision, and what applying it would change."""
    document = store.documents.get(document_id)
    held = document.get("pending_agent")
    if not held:
        return {"pending": None, "lines": []}
    return {
        "pending": held,
        "lines": history.compare(
            _lines(str(document.get("content") or "")), _lines(str(held.get("content") or ""))
        ),
    }


def pending_apply(store: Store, document_id: str) -> dict[str, Any]:
    """Take the waiting agent change, keeping the person's words first.

    Applying replaces the working copy, and nothing that replaces the working
    copy may lose it: unsaved edits are saved as a user version before the
    agent's content lands as an agent version.
    """
    document = store.documents.get(document_id)
    held = document.get("pending_agent")
    if not held:
        raise NotFound("There is no agent change waiting on this document.")
    save(store, document_id, author=USER)
    document = store.documents.get(document_id)
    updated = update(
        store,
        document_id,
        {"content": str(held.get("content") or "")},
        expected_revision=int(document.get("revision") or 1),
    )
    updated.pop("pending_agent", None)
    store.documents.put(updated)
    version = save(store, document_id, author=AGENT, label=str(held.get("label") or "") or None)
    return {"document": updated, "version": version}


def pending_discard(store: Store, document_id: str) -> Record:
    """Drop the waiting agent change, touching nothing else."""
    document = store.documents.get(document_id)
    if document.pop("pending_agent", None) is not None:
        store.documents.put(document)
    return document


# -- history --------------------------------------------------------------


def _kept(store: Store, document_id: str) -> list[Record]:
    """Every version of one document, oldest first.

    A row holds the working copy as it read when somebody saved it. (Rows from
    before 2026-08-19 hold the state a sitting started from instead — still a
    state to go back to, read the same way.) The working copy is not in here:
    it is the document itself.
    """
    rows = [r for r in store.doc_revisions.list() if r.get("doc_id") == document_id]
    return sorted(rows, key=lambda r: int(r.get("revision") or 0))


def _lines(content: str) -> list[str]:
    """A document's paragraphs, which are the units a change is counted in.

    The blank line between two paragraphs is punctuation, not content: leaving
    it in reported every added paragraph as two added lines, one of them empty.
    """
    return [line for line in as_text(content).splitlines() if line.strip()]


def _timeline(store: Store, document_id: str) -> list[Record]:
    """The versions and then the working copy, oldest first.

    The working copy sits one past the newest version, so the history's top
    entry is addressable the same way a version is — without ever colliding
    with a number a version already holds.
    """
    document = store.documents.get(document_id)
    rows = _kept(store, document_id)
    base = _base(rows)
    return [
        *rows,
        {
            "revision": (int(base.get("revision") or 0) + 1) if base else 1,
            "content": document.get("content"),
            "created_at": document.get("updated_at"),
            "current": True,
            "unsaved": unsaved(document, base),
        },
    ]


def versions(store: Store, document_id: str) -> list[Record]:
    """The document's history, newest first, each saying what it changed.

    The working copy is the top entry — flagged `current`, and `unsaved` when
    it differs from the base version — so the list says where the saved states
    end and now begins.
    """
    entries: list[Record] = []
    for r in _timeline(store, document_id):
        if r.get("current"):
            entries.append(
                {
                    "id": "",
                    "revision": int(r.get("revision") or 0),
                    "text": str(r.get("content") or ""),
                    "created_at": r.get("created_at"),
                    "current": True,
                    "unsaved": bool(r.get("unsaved")),
                }
            )
            continue
        entries.append(
            {
                "id": r["id"],
                "revision": int(r.get("revision") or 0),
                "text": str(r.get("content") or ""),
                "created_at": r.get("created_at"),
                "summary": r.get("summary"),
                "summary_state": r.get("summary_state"),
                # Who saved this state. Rows from before authorship all came
                # from the person's own editing.
                "author": AGENT if r.get("author") == AGENT else USER,
                "label": r.get("label"),
            }
        )
    return history.stack(entries, _lines)


def diff(store: Store, document_id: str, revision: int) -> list[Record]:
    """What one version changed, line by line, against the one before it."""
    timeline = _timeline(store, document_id)
    at = next((i for i, r in enumerate(timeline) if int(r.get("revision") or 0) == revision), None)
    if at is None:
        raise NotFound(f"This document has no version {revision}.")
    return history.compare(
        _lines(str(timeline[at - 1].get("content") or "")) if at else [],
        _lines(str(timeline[at].get("content") or "")),
    )


def unwritten(store: Store, document_id: str) -> list[str]:
    """The versions still waiting for their line, oldest first.

    Plural because one act can save two: an agent's begin keeps the person's
    unsaved edits and its commit keeps its own — and a line that never arrives
    reads as a broken row.
    """
    return [str(r["id"]) for r in _kept(store, document_id) if r.get("summary_state") == "pending"]


def restore(store: Store, document_id: str, revision: int, *, discard: bool = False) -> Record:
    """Bring a version's text back into the working copy.

    Nothing after it is deleted: saving again writes a new version rather than
    rewriting history. Restoring replaces the working copy, and nothing that
    replaces the working copy may lose it — unsaved edits are saved as a user
    version first, unless the person explicitly chose to discard them.
    """
    rows = _kept(store, document_id)
    found = next((r for r in rows if int(r.get("revision") or 0) == revision), None)
    if found is None:
        raise NotFound(f"This document has no version {revision} to go back to.")
    if not discard:
        save(store, document_id, author=USER)
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
