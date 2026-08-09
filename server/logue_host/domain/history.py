"""What changed between two versions of a piece of writing.

Documents and Skills keep their history the same way — a row per edit, holding
the text as it was before that edit — so they compare it the same way too. What
differs is only the field names and where the rows live, which is the caller's
business; the arithmetic below is not worth having two of.
"""

from __future__ import annotations

import difflib
from typing import Callable

from ..store import Record

#: Cuts a text into the lines a change is counted in. What counts as a line is
#: the caller's: a document is HTML, and a Skill's prompt is plain text.
Splitter = Callable[[str], list[str]]


def counts(before: list[str], after: list[str]) -> tuple[int, int]:
    """How many lines one edit added and removed."""
    added = removed = 0
    for line in difflib.ndiff(before, after):
        if line.startswith("+ "):
            added += 1
        elif line.startswith("- "):
            removed += 1
    return added, removed


def compare(before: list[str], after: list[str]) -> list[Record]:
    """One edit line by line, numbered on both sides.

    Two identical lines in one text are still two different lines, so each one
    carries where it sits — that is what makes it addressable at all.
    """
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


def stack(entries: list[Record], split: Splitter) -> list[Record]:
    """Oldest-first versions in; newest-first history out, each saying what it changed.

    Every entry carries a `text`, which is dropped on the way out: a history
    list is read to choose a version, and shipping every version's full body to
    draw it is a page of writing per row.
    """
    out: list[Record] = []
    for index, entry in enumerate(entries):
        before = split(str(entries[index - 1].get("text") or "")) if index else []
        added, removed = counts(before, split(str(entry.get("text") or "")))
        out.append({**{k: v for k, v in entry.items() if k != "text"}, "added": added, "removed": removed})
    out.reverse()
    return out
