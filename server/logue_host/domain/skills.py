"""Skills: reusable prompts.

Ask and Draft ship built in so a fresh install can generate immediately. They
are ordinary editable Skills — editing one bumps its revision, and Runs record
which revision they used, so a Run stays explainable after the prompt changes.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest, NotFound
from ..ids import new_id, now
from ..store import Record, Store
from . import history

BUILT_INS: list[dict[str, Any]] = [
    {
        "key": "ask",
        "name": "Answer questions",
        "purpose": "Answer from the Project's Sources, with citations.",
        "instructions": (
            "Answer the question using only the numbered Sources. Cite every claim as [Source n]. "
            "If the Sources do not answer it, say so plainly instead of guessing. Be brief."
        ),
        "task": "answer",
        "output": "insert",
        "surfaces": ["web", "extension"],
        "contexts": ["project", "page", "selection"],
    },
    {
        "key": "transcription",
        "name": "Transcription",
        "purpose": "Take the ums out, and nothing else.",
        "instructions": (
            "Write out what was said, then take out only what nobody meant to say.\n"
            "\n"
            "Remove filler words and verbal tics. Remove repetitions and the half-sentences left "
            "behind when the speaker corrected themselves mid-thought — keep the version they "
            "settled on. Where a sentence can be shortened without changing it, shorten it, so it "
            "reads the way it was meant to sound.\n"
            "\n"
            "Everything else stays as it was: the meaning, the tone, and the speaker's own words. "
            "This is not a rewrite.\n"
            "\n"
            "Only remove; never add. Do not add anything that was not said. Do not swap a word for "
            "a more formal one. Do not finish a thought the speaker left unfinished. If you are "
            "unsure whether something was meant, leave it in.\n"
            "\n"
            "Return the transcript alone, with no commentary."
        ),
        "task": "transcribe",
        "output": "insert",
        "surfaces": ["web", "extension"],
        # Not a context any picker offers: this one is reached through the
        # transcription slot, not by someone choosing it beside a selection.
        "contexts": ["transcription"],
    },
    {
        "key": "into_english",
        "name": "Into English",
        "purpose": "The same thing, in English.",
        "instructions": (
            "Translate the text into natural English.\n"
            "\n"
            "Keep the meaning, the tone and the register of the original. Do not summarise, do not "
            "expand, do not add anything that was not there. Names, numbers, quotations and technical "
            "terms stay as they are unless English has a settled form for them.\n"
            "\n"
            "If the text is already English, return it unchanged.\n"
            "\n"
            "Return the translation alone, with no commentary."
        ),
        "task": "generate",
        "output": "insert",
        "surfaces": ["web", "extension"],
        # Offered on any piece of dictated text — the transcript, or anything
        # another Skill has already made from it.
        "contexts": ["dictation"],
    },
    {
        "key": "as_markdown",
        "name": "As Markdown",
        "purpose": "The same words, given structure.",
        "instructions": (
            "Rewrite the text as Markdown, keeping the words as close to the original as the "
            "structure allows.\n"
            "\n"
            "Give it the shape it already has: headings where the speaker changed subject, a list "
            "where they listed things, paragraphs everywhere else. Use the original's own language.\n"
            "\n"
            "Do not summarise and do not add anything that was not said. Structure is the only thing "
            "being added.\n"
            "\n"
            "Return the Markdown alone, with no commentary and no code fence around it."
        ),
        "task": "generate",
        "output": "insert",
        "surfaces": ["web", "extension"],
        "contexts": ["dictation"],
    },
    {
        "key": "draft",
        "name": "Draft document",
        "purpose": "Write a document grounded in the Project's Sources.",
        "instructions": (
            "Write a clear, well-structured document that answers the request using only the numbered "
            "Sources. Cite every claim as [Source n]. Prefer short paragraphs over lists of adjectives."
        ),
        "task": "generate",
        "output": "document",
        "surfaces": ["web", "extension"],
        "contexts": ["project"],
    },
]


def ensure_built_ins(store: Store) -> None:
    """Create any missing built-in Skill; never overwrite an edited one.

    A workspace may already carry a Skill by the same name from before built-ins
    were keyed. Adopt it instead of creating a twin — two "Answer questions" in
    the picker is worse than either one.
    """
    records = list(store.skills.all())
    existing = {record.get("built_in_key") for record in records}
    for template in BUILT_INS:
        if template["key"] in existing:
            continue
        same_name = next(
            (r for r in records if r.get("name") == template["name"] and not r.get("built_in_key")), None
        )
        if same_name:
            same_name["built_in_key"] = template["key"]
            same_name["system"] = True
            store.skills.put(same_name)
            continue
        timestamp = now()
        store.skills.put(
            {
                "id": new_id("skill"),
                "built_in_key": template["key"],
                "name": template["name"],
                "purpose": template["purpose"],
                "instructions": template["instructions"],
                "task": template["task"],
                "output": template["output"],
                "surfaces": template["surfaces"],
                "contexts": template["contexts"],
                "enabled": True,
                "system": True,
                "revision": 1,
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )


def usable(skill: Record) -> bool:
    """Whether this Skill can actually be run.

    A Skill is named first and written afterwards, so one can exist for a
    while with nothing to say. Offering it anyway would send an empty prompt
    to a model and hand back whatever came of that.
    """
    return bool(skill.get("enabled")) and bool(str(skill.get("instructions") or "").strip())


def create(store: Store, payload: dict[str, Any]) -> Record:
    """A Skill starts as a name. The prompt is written on its own page.

    Demanding the prompt here was a dead end: the form asks for a name, the
    only field it shows, and the refusal named `instructions` — something the
    person had no way to give and could not see. Nobody could create a Skill
    at all.
    """
    name = str(payload.get("name") or "").strip()
    instructions = str(payload.get("instructions") or "").strip()
    if not name:
        raise BadRequest("name is required")
    timestamp = now()
    return store.skills.put(
        {
            "id": new_id("skill"),
            "name": name,
            "purpose": str(payload.get("purpose") or "").strip(),
            "instructions": instructions,
            "task": payload.get("task") or "generate",
            "output": payload.get("output") or "insert",
            "surfaces": payload.get("surfaces") or ["web", "extension"],
            "contexts": payload.get("contexts") or ["selection"],
            "enabled": True,
            "system": False,
            "revision": 1,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )


def update(store: Store, skill_id: str, changes: dict[str, Any]) -> Record:
    skill = store.skills.get(skill_id)
    allowed = {"name", "purpose", "instructions", "task", "output", "surfaces", "contexts", "enabled"}
    unknown = set(changes) - allowed
    if unknown:
        raise BadRequest(f"cannot change {', '.join(sorted(unknown))}")

    # A prompt change makes past Runs unexplainable unless the old text is kept.
    if "instructions" in changes and changes["instructions"] != skill.get("instructions"):
        store.skill_revisions.put(
            {
                "id": new_id("revision"),
                "skill_id": skill_id,
                "revision": skill.get("revision", 1),
                "instructions": skill.get("instructions"),
                "created_at": now(),
            }
        )
        skill["revision"] = skill.get("revision", 1) + 1

    skill.update(changes)
    skill["updated_at"] = now()
    return store.skills.put(skill)


# -- history --------------------------------------------------------------
#
# Every prompt edit has been written down since Skills existed, because a Run
# has to stay explainable after its prompt changes. Nothing read them back, so
# the cost was paid and the safety was not: a prompt you had tuned for weeks
# could be wrecked by one careless edit with no way to see what it used to say.


def _kept(store: Store, skill_id: str) -> list[Record]:
    """Every stored revision of one Skill, oldest first.

    A row holds the prompt as it was *before* the edit that replaced it. The
    newest prompt is not in here — it is the Skill itself.
    """
    rows = [r for r in store.skill_revisions.list() if r.get("skill_id") == skill_id]
    return sorted(rows, key=lambda r: int(r.get("revision") or 0))


def _lines(instructions: str) -> list[str]:
    """A prompt's lines. Blank ones are spacing, not instructions."""
    return [line for line in (instructions or "").splitlines() if line.strip()]


def versions(store: Store, skill_id: str) -> list[Record]:
    """The Skill's prompt history, newest first, each saying what it changed.

    No model writes a line about a prompt edit the way it does for a document.
    A person edits a prompt by hand and knows what they typed; the diff is right
    there, and a sentence generated about two changed words is noise.
    """
    skill = store.skills.get(skill_id)
    return history.stack(
        [
            *[
                {
                    "id": r["id"],
                    "revision": int(r.get("revision") or 0),
                    "text": str(r.get("instructions") or ""),
                    "created_at": r.get("created_at"),
                }
                for r in _kept(store, skill_id)
            ],
            {
                "id": "",
                "revision": int(skill.get("revision") or 1),
                "text": str(skill.get("instructions") or ""),
                "created_at": skill.get("updated_at"),
                "current": True,
            },
        ],
        _lines,
    )


def diff(store: Store, skill_id: str, revision: int) -> list[Record]:
    """What one prompt version changed, line by line, against the one before it."""
    skill = store.skills.get(skill_id)
    timeline = [
        *_kept(store, skill_id),
        {"revision": int(skill.get("revision") or 1), "instructions": skill.get("instructions")},
    ]
    at = next((i for i, r in enumerate(timeline) if int(r.get("revision") or 0) == revision), None)
    if at is None:
        raise NotFound(f"This Skill has no version {revision}.")
    return history.compare(
        _lines(str(timeline[at - 1].get("instructions") or "")) if at else [],
        _lines(str(timeline[at].get("instructions") or "")),
    )


def restore(store: Store, skill_id: str, revision: int) -> Record:
    """Bring an old prompt back as a new edit.

    Written forward, like a document's: the versions in between stay, and Runs
    that used them still point at a prompt that exists.
    """
    found = next((r for r in _kept(store, skill_id) if int(r.get("revision") or 0) == revision), None)
    if found is None:
        raise NotFound(f"This Skill has no version {revision} to go back to.")
    return update(store, skill_id, {"instructions": str(found.get("instructions") or "")})


def archive_impact(store: Store, skill_id: str) -> dict[str, Any]:
    """What stops working if this Skill goes away."""
    store.skills.get(skill_id)
    runs = [run for run in store.runs.all() if run.get("skill_id") == skill_id]
    projects = [
        project for project in store.projects.all() if skill_id in (project.get("skill_bindings") or {}).values()
    ]
    return {"runs": len(runs), "projects": [project["name"] for project in projects]}


def delete(store: Store, skill_id: str) -> None:
    skill = store.skills.get(skill_id)
    if skill.get("system"):
        raise BadRequest("Built-in Skills can be edited but not deleted.")
    store.skills.delete(skill_id)
