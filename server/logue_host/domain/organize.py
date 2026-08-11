"""Automatic organisation: a suggestion, never a decision.

Something captured mid-task is filed by nobody, so the Stream fills with things
that belong to a Project and are not in it. This proposes where each new Source
belongs and why — and stops there. Every suggestion waits for a person, because
a Project that quietly grew a Source nobody put there is worse than an
unorganised Stream: it makes the next answer cite something the person never
chose.

Two things are deliberately *not* the model's job. Duplicates are found by
comparing text and URLs, which is exact and free. And nothing is ever applied
automatically, however confident the model claims to be — confidence sorts the
queue, it does not empty it.
"""

from __future__ import annotations

import json
import re
import threading
from typing import Any

from .. import trace
from ..errors import BadRequest, Unavailable
from ..ids import now
from ..providers import Provider
from ..store import Record, Store
from . import defaults

# The vocabulary this workspace already uses, kept exactly: 95 Sources carry
# these words, and a sixth status would make the older ones ambiguous.
#: Waiting to be looked at by the model.
PENDING = "pending"
#: Looked at, nothing to propose — already where it belongs.
ORGANIZED = "organized"
#: There is a suggestion and nobody has seen it yet.
NEEDS_REVIEW = "needs_review"
#: A person decided.
CONFIRMED = "confirmed"

#: Above this a suggestion leads the queue. It never applies anything by itself.
CONFIDENT = 0.75

#: How many earlier Sources are shown to the model when asking about a contradiction.
NEIGHBOURS = 8

#: Words too common to mean two Sources are about the same thing.
_NOISE = frozenset(
    "the a an and or but if then than that this these those is are was were be been being to of in on at "
    "for with from by as it its we you i he she they them our your their not no do does did can could "
    "will would should may might just about into over under more most some any all one two".split()
)

FALLBACK_INSTRUCTIONS = (
    "Decide which of this person's Projects a new Source belongs to, and suggest a few short tags "
    "describing what it is about."
)


def _shape(text: str) -> str:
    """Content reduced to what makes two captures the same thing."""
    return " ".join(str(text or "").casefold().split())


def duplicate_of(store: Store, material: Record) -> str | None:
    """An earlier Source that says the same thing, or came from the same page.

    Exact rather than clever: saving the same quote twice is the common case,
    and asking a model about it would be slower, cost money, and be less sure.
    """
    shape = _shape(material.get("content"))
    url = str((material.get("source") or {}).get("url") or "").strip()
    if not shape:
        return None
    for candidate in store.materials.list():
        if candidate["id"] == material["id"]:
            continue
        if _shape(candidate.get("content")) != shape:
            continue
        other = str((candidate.get("source") or {}).get("url") or "").strip()
        if not url or not other or url == other:
            return str(candidate["id"])
    return None


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[\w']+", str(text or "").casefold()) if len(w) > 2 and w not in _NOISE}


def neighbours(store: Store, material: Record, limit: int = NEIGHBOURS) -> list[Record]:
    """The earlier Sources this one might be talking about.

    Chosen by shared words rather than by asking a model, for the same reason
    duplicates are: it is exact, free, and the model's job is the judgement, not
    the shortlist. Only earlier Sources — a Source cannot be replaced by one
    that already existed when it was written — and never one already replaced.
    """
    mine = _words(material.get("content"))
    if len(mine) < 4:
        return []
    scored: list[tuple[int, Record]] = []
    for candidate in store.materials.list():
        if candidate["id"] == material["id"] or candidate.get("superseded_by"):
            continue
        if str(candidate.get("created_at") or "") >= str(material.get("created_at") or ""):
            continue
        shared = mine & _words(candidate.get("content"))
        if len(shared) >= 3:
            scored.append((len(shared), candidate))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [record for _, record in scored[:limit]]


def mark_pending(store: Store, material: Record) -> Record:
    """Record that this is waiting to be looked at, in the same write as the Source.

    Written before the model is called rather than after, so a Host that stops
    mid-classification leaves something to pick up rather than a Source that
    silently never got looked at.
    """
    material["organization"] = {"status": PENDING, "updated_at": now()}
    return store.materials.put(material)


def _prompt(store: Store, material: Record) -> tuple[str, str]:
    projects = [p for p in store.projects.list(sort_key="name", reverse=False) if not p.get("archived_at")]
    known_tags = sorted({str(tag) for m in store.materials.list() for tag in (m.get("tags") or []) if str(tag).strip()})
    skill = defaults.skill_for(store, "organization")
    system = str((skill or {}).get("instructions") or "").strip() or FALLBACK_INSTRUCTIONS

    lines = ["Projects:"]
    lines += [f"- {p.get('name')}: {p.get('overview') or 'no description'}" for p in projects] or ["- (none yet)"]
    if known_tags:
        lines += ["", "Tags already in use: " + ", ".join(known_tags[:60])]
    lines += [
        "",
        "The Source:",
        f"kind: {material.get('kind')}",
        f"from: {(material.get('source') or {}).get('title') or (material.get('source') or {}).get('url') or 'this Mac'}",
        "---",
        str(material.get("content") or "")[:4000],
        "---",
    ]

    # The time dimension (R13). A Source saying the limit is ten minutes,
    # written after one saying it is five, does not merely differ from it — it
    # replaces it. Nothing here could express that, so both stayed quotable and
    # the older one kept being cited as current.
    #
    # The model is asked because a contradiction is exactly what a person
    # cannot see: nobody remembers what a Source from three months ago said.
    # It only ever proposes; `resolve` is where anything happens.
    earlier = neighbours(store, material)
    if earlier:
        lines += ["", "Earlier Sources that may be about the same thing:"]
        lines += [f"- {record['id']}: {str(record.get('content') or '')[:220]}".replace("\n", " ") for record in earlier]

    lines += [
        "",
        "Reply with JSON only, no prose and no code fence:",
        '{"projects": ["exact Project name"], "tags": ["short", "lowercase"], '
        '"confidence": 0.0, "reason": "one sentence", '
        '"supersedes": {"id": "mat_...", "why": "one sentence"} or null}',
        "Use only Project names from the list; use [] if none fit. Never invent a Project.",
        "Set `supersedes` only when this Source states something that makes one of the earlier ones "
        "wrong or out of date — a changed number, a reversed decision, a replaced rule. Two Sources "
        "about the same subject that simply say different things are not a contradiction. Use null "
        "when in doubt.",
    ]
    return system, "\n".join(lines)


def _read(answer: str) -> dict[str, Any]:
    """The model's JSON, however it chose to wrap it."""
    text = answer.strip()
    fenced = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in the answer")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("the answer was not an object")
    return parsed


def _clean(store: Store, parsed: dict[str, Any], material: Record) -> dict[str, Any]:
    live = {str(p.get("name")) for p in store.projects.list() if not p.get("archived_at")}
    already = set(material.get("projects") or [])
    projects = [str(name) for name in parsed.get("projects") or [] if str(name) in live and str(name) not in already]
    tags = [str(tag).strip().casefold() for tag in parsed.get("tags") or [] if str(tag).strip()]
    tags = [tag for tag in dict.fromkeys(tags) if tag not in {t.casefold() for t in material.get("tags") or []}]
    try:
        confidence = min(1.0, max(0.0, float(parsed.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0.0
    cleaned = {
        "suggested_projects": projects[:3],
        "suggested_tags": tags[:5],
        "confidence": confidence,
        "reason": str(parsed.get("reason") or "").strip()[:280],
    }
    replaced = _supersedes(store, parsed.get("supersedes"), material)
    if replaced:
        cleaned["supersedes"] = replaced
    return cleaned


def _supersedes(store: Store, claim: Any, material: Record) -> dict[str, Any] | None:
    """The model's claim that this Source replaces an earlier one, checked.

    Every part of it is verified against the workspace rather than believed: an
    id that exists, is not this Source, is genuinely older, and has not already
    been replaced. A hallucinated id here would put a "replaced by" banner on
    something at random.
    """
    if not isinstance(claim, dict):
        return None
    target = str(claim.get("id") or "").strip()
    if not target or target == material["id"]:
        return None
    older = store.materials.find(target)
    if not older or older.get("superseded_by"):
        return None
    if str(older.get("created_at") or "") >= str(material.get("created_at") or ""):
        return None
    return {"id": target, "why": str(claim.get("why") or "").strip()[:280]}


def _write(store: Store, material_id: str, organization: dict[str, Any]) -> Record:
    """Write only the organisation, onto the Source as it is *now*.

    The model takes seconds, and in those seconds the person may have filed,
    tagged, or excluded this Source themselves. Putting back the copy we
    started with would silently undo that.
    """
    fresh = store.materials.get(material_id)
    fresh["organization"] = organization
    return store.materials.put(fresh)


def classify(store: Store, provider: Provider, material_id: str) -> Record:
    """Look at one Source and write down where it seems to belong."""
    material = store.materials.get(material_id)
    timestamp = now()
    twin = duplicate_of(store, material)

    try:
        system, prompt = _prompt(store, material)
        with trace.span(
            "file",
            **{
                "material.id": str(material.get("id") or ""),
                "material.kind": str(material.get("kind") or ""),
                "input.value": str(material.get("content") or "")[:400],
            },
        ) as recorded:
            result = _clean(store, _read(provider.generate(system, prompt)), material)
            recorded["output.value"] = json.dumps(result, ensure_ascii=False)
    except (Unavailable, ValueError, json.JSONDecodeError) as cause:
        # A model that is down or rambling must not cost someone the capture,
        # and must not look like "nothing to file here" either.
        return _write(
            store,
            material_id,
            {
                "status": NEEDS_REVIEW,
                "confidence": 0.0,
                "reason": f"Could not be filed automatically: {cause}"[:280],
                "suggested_projects": [],
                "suggested_tags": [],
                **({"duplicate_of": twin} if twin else {}),
                "updated_at": timestamp,
            },
        )

    has_suggestion = bool(result["suggested_projects"] or result["suggested_tags"] or twin or result.get("supersedes"))
    return _write(
        store,
        material_id,
        {
            "status": NEEDS_REVIEW if has_suggestion else ORGANIZED,
            **result,
            **({"duplicate_of": twin} if twin else {}),
            "updated_at": timestamp,
        },
    )


def in_background(store: Store, provider: Provider, material_id: str) -> threading.Thread:
    """Classify without making the person wait for it.

    Capture has to feel instant — the whole product is "say it and carry on" —
    so the model call happens after the Source is already safe on disk. The
    thread is returned so a caller that needs the answer can wait for it.
    """
    thread = threading.Thread(
        target=lambda: _quietly(store, provider, material_id), name=f"organize-{material_id}", daemon=True
    )
    thread.start()
    return thread


def _quietly(store: Store, provider: Provider, material_id: str) -> None:
    try:
        classify(store, provider, material_id)
    except Exception:  # noqa: BLE001 - a background thread must never take the Host down
        pass


def catch_up(store: Store, provider: Provider) -> int:  # noqa: D401 - reads better as a verb
    """Finish anything a previous run started and did not get to.

    Without this, a Host restarted mid-classification leaves Sources marked
    `pending` for good, and the queue quietly stops being the whole truth.
    """
    waiting = [m for m in store.materials.list() if (m.get("organization") or {}).get("status") == PENDING]
    for material in waiting:
        in_background(store, provider, str(material["id"]))
    return len(waiting)


def queue(store: Store) -> list[Record]:
    """Everything with a suggestion nobody has looked at, most confident first."""
    waiting = [
        m for m in store.materials.list() if (m.get("organization") or {}).get("status") in {NEEDS_REVIEW, PENDING}
    ]
    return sorted(waiting, key=lambda m: float((m.get("organization") or {}).get("confidence") or 0), reverse=True)


def resolve(store: Store, material_id: str, *, accept: bool, projects: list[str] | None = None,
            tags: list[str] | None = None, supersede: bool | None = None) -> Record:
    """Take the suggestion, or set it aside. Either way it leaves the queue.

    What was applied is kept next to what was suggested: a Project that gained
    a Source should always be able to say who put it there.

    `supersede` answers the contradiction question separately from the filing
    one, because they are different decisions and someone may well want the
    tags without agreeing that an old Source is now wrong. Left unset, it
    follows `accept`.
    """
    material = store.materials.get(material_id)
    organization = dict(material.get("organization") or {})
    if not organization:
        raise BadRequest("this Source has no suggestion to resolve")

    proposed = organization.get("supersedes")
    if isinstance(proposed, dict) and (accept if supersede is None else supersede):
        older_id = str(proposed.get("id"))
        if _mark_superseded(store, older_id=older_id, by=material, why=str(proposed.get("why") or "")):
            # Written onto the copy this function is about to save, not in a
            # write of its own. Two writers to one record is how a field
            # disappears: the second one puts back a copy taken before the
            # first, and nothing anywhere reports a problem.
            material["supersedes"] = list(dict.fromkeys([*(material.get("supersedes") or []), older_id]))
            organization["accepted_supersedes"] = older_id

    if accept:
        live = {str(p.get("name")) for p in store.projects.list() if not p.get("archived_at")}
        taking = [name for name in (projects if projects is not None else organization.get("suggested_projects") or [])
                  if name in live]
        tagging = [str(tag) for tag in (tags if tags is not None else organization.get("suggested_tags") or [])
                   if str(tag).strip()]
        material["projects"] = list(dict.fromkeys([*(material.get("projects") or []), *taking]))
        material["tags"] = list(dict.fromkeys([*(material.get("tags") or []), *tagging]))
        organization["accepted_projects"] = taking
        organization["accepted_tags"] = tagging

    organization["status"] = CONFIRMED
    organization["decided"] = "accepted" if accept else "dismissed"
    organization["updated_at"] = now()
    material["organization"] = organization
    material["updated_at"] = now()
    return store.materials.put(material)


def _mark_superseded(store: Store, *, older_id: str, by: Record, why: str) -> bool:
    """Write the replacement onto both ends, and only on a person's word.

    This end only — the caller writes the other, in the same save it was
    already making. Both ends are needed, because both questions get asked:
    reading the old one, "is this still true?"; reading the new one, "what did
    this change?". One pointer would answer only the first.

    The old Source is not touched otherwise. It is not deleted, not edited, not
    unfiled — it was true when it was written, and a record of what was
    believed then is worth keeping. It is only marked as no longer current.
    """
    older = store.materials.find(older_id)
    if not older or older.get("superseded_by"):
        return False
    stamp = now()
    older["superseded_by"] = {"id": by["id"], "at": stamp, "why": why}
    older["updated_at"] = stamp
    store.materials.put(older)
    return True
