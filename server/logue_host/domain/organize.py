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
        "",
        "Reply with JSON only, no prose and no code fence:",
        '{"projects": ["exact Project name"], "tags": ["short", "lowercase"], '
        '"confidence": 0.0, "reason": "one sentence"}',
        "Use only Project names from the list; use [] if none fit. Never invent a Project.",
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
    return {
        "suggested_projects": projects[:3],
        "suggested_tags": tags[:5],
        "confidence": confidence,
        "reason": str(parsed.get("reason") or "").strip()[:280],
    }


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
        result = _clean(store, _read(provider.generate(system, prompt)), material)
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

    has_suggestion = bool(result["suggested_projects"] or result["suggested_tags"] or twin)
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
            tags: list[str] | None = None) -> Record:
    """Take the suggestion, or set it aside. Either way it leaves the queue.

    What was applied is kept next to what was suggested: a Project that gained
    a Source should always be able to say who put it there.
    """
    material = store.materials.get(material_id)
    organization = dict(material.get("organization") or {})
    if not organization:
        raise BadRequest("this Source has no suggestion to resolve")

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
