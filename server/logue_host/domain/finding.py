"""Searching a workspace that is written in two languages.

This person speaks and writes English and Chinese in the same sentence, and
the search matched substrings. Measured on his workspace: `progressive
disclosure` found nothing, `渐进式` found five, and they are the same
discussion; `dentist` found three, `牙医` found one. A capture you cannot find
again has the same value as one that was never made.

The fix is on the question, not on the corpus. Asking a model once what else
this query could be called costs one small call per distinct query and works
on everything already captured — the alternative, an index written at capture
time, would have to be backfilled across every Source before it helped with
anything he said before today.

Kept honest about what it did: the widened search reports which words it also
looked for, so a result nobody typed a word of can still be accounted for.
"""

from __future__ import annotations

from typing import Any

from ..ids import now
from ..providers import Provider
from ..store import Record, Store
from . import materials

#: How many other wordings to ask for. Enough for the other language and a
#: synonym or two; not a thesaurus, which would match everything.
VARIANTS = 4

INSTRUCTIONS = (
    "Someone is searching their own notes, which are written in a mix of English and Chinese. "
    f"Give at most {VARIANTS} other search terms that would appear word for word in such a note — "
    "the other language first, then close synonyms.\n\n"
    "Short terms only: two or three words in English, two to four characters in Chinese. A long "
    "phrase never appears verbatim in someone's speech, so it finds nothing. For 'progressive "
    "disclosure', answer 渐进式 and 逐步显示, not 渐进式信息披露设计.\n\n"
    "Reply with one term per line, nothing else. No numbering, no explanation. If the query is a "
    "name, a number, or already unambiguous, reply with nothing."
)


def other_wordings(store: Store, provider: Provider | None, query: str) -> list[str]:
    """What else this query might have been called, remembered once.

    Cached on the query, because the same searches are made over and over and
    a model call inside a search box is a pause the person feels.
    """
    wanted = query.strip()
    if not wanted or provider is None or not provider.ready_for("generation"):
        return []

    remembered = store.search_wordings.find(_key(wanted))
    if remembered is not None:
        return [str(word) for word in remembered.get("wordings") or []]

    try:
        written = provider.generate(INSTRUCTIONS, wanted)
    except Exception:  # noqa: BLE001 - a search must still answer without a model
        return []

    wordings = [
        line.strip().strip("-•*\"'")
        for line in written.splitlines()
        if line.strip() and line.strip().casefold() != wanted.casefold()
    ][:VARIANTS]
    store.search_wordings.put({"id": _key(wanted), "query": wanted, "wordings": wordings, "created_at": now()})
    return wordings


def _key(query: str) -> str:
    """A filename-safe id for one query."""
    return "w_" + "".join(character if character.isalnum() else "-" for character in query.casefold())[:60]


def widened(
    store: Store, provider: Provider | None, query: str, project: str = "", kind: str = ""
) -> dict[str, Any]:
    """Everything matching this query, and everything matching what it is also called."""
    found: list[Record] = materials.search(store, query=query, project=project, kind=kind)
    seen = {record["id"] for record in found}
    also: list[str] = []

    for wording in other_wordings(store, provider, query):
        more = _matching(store, wording, project, kind, seen)
        if more:
            also.append(wording)
            seen.update(record["id"] for record in more)
            found.extend(more)

    return {"materials": found, "also": also}


def _matching(store: Store, wording: str, project: str, kind: str, seen: set[str]) -> list[Record]:
    """What one other wording finds — as a phrase, or failing that by its words.

    A model asked for another wording answers in phrases, and a phrase is no
    likelier to appear verbatim than the original was: the first version of
    this returned "渐进式披露" for "progressive disclosure", found nothing with
    it, and reported that it had searched nothing.
    """
    whole = [r for r in materials.search(store, query=wording, project=project, kind=kind) if r["id"] not in seen]
    if whole or " " not in wording.strip():
        return whole
    words = [word for word in wording.split() if len(word) > 2 and word.casefold() not in materials.STOP]
    hit: list[Record] = []
    for word in words:
        hit.extend(
            r
            for r in materials.search(store, query=word, project=project, kind=kind)
            if r["id"] not in seen and all(r["id"] != found["id"] for found in hit)
        )
    return hit
