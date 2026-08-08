"""Skills: reusable prompts.

Ask and Draft ship built in so a fresh install can generate immediately. They
are ordinary editable Skills — editing one bumps its revision, and Runs record
which revision they used, so a Run stays explainable after the prompt changes.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..store import Record, Store

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
    """Create any missing built-in Skill; never overwrite an edited one."""
    existing = {record.get("built_in_key") for record in store.skills.all()}
    for template in BUILT_INS:
        if template["key"] in existing:
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


def create(store: Store, payload: dict[str, Any]) -> Record:
    name = str(payload.get("name") or "").strip()
    instructions = str(payload.get("instructions") or "").strip()
    if not name:
        raise BadRequest("name is required")
    if not instructions:
        raise BadRequest("instructions is required")
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
