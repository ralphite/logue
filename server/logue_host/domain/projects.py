"""Projects: a named context, not a tag.

A Project carries the background and vocabulary that make transcription and
generation sound like this person's work. Materials belong to many Projects.
"""

from __future__ import annotations

from typing import Any

from ..errors import BadRequest, Conflict
from ..ids import new_id, now
from ..store import Record, Store

EMPTY_PROFILE: dict[str, Any] = {
    "primary_language": "",
    "mixed_languages": [],
    "custom_instructions": "",
    "vocabulary": {
        "people": [],
        "companies": [],
        "products": [],
        "places": [],
        "acronyms": [],
        "preferred_spellings": [],
    },
    "mode": "inherit",
}


def by_name(store: Store, name: str) -> Record | None:
    return next((project for project in store.projects.all() if project.get("name") == name), None)


def create(store: Store, *, name: str, overview: str = "") -> Record:
    name = name.strip()
    if not name:
        raise BadRequest("name is required")
    if by_name(store, name):
        raise Conflict(f"A Project named {name} already exists.")
    timestamp = now()
    return store.projects.put(
        {
            "id": new_id("project"),
            "name": name,
            "overview": overview.strip(),
            "transcription_profile": dict(EMPTY_PROFILE),
            "skill_bindings": {},
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )


def update(store: Store, project_id: str, changes: dict[str, Any]) -> Record:
    project = store.projects.get(project_id)
    allowed = {"name", "overview", "transcription_profile", "skill_bindings"}
    unknown = set(changes) - allowed
    if unknown:
        raise BadRequest(f"cannot change {', '.join(sorted(unknown))}")

    if "name" in changes:
        new_name = str(changes["name"]).strip()
        if not new_name:
            raise BadRequest("name is required")
        clash = by_name(store, new_name)
        if clash and clash["id"] != project_id:
            raise Conflict(f"A Project named {new_name} already exists.")
        # Membership is stored by name, so a rename has to travel.
        old_name = project.get("name")
        if new_name != old_name:
            for material in store.materials.all():
                names = material.get("projects") or []
                if old_name in names:
                    material["projects"] = [new_name if n == old_name else n for n in names]
                    store.materials.put(material)
        changes["name"] = new_name

    project.update(changes)
    project["updated_at"] = now()
    return store.projects.put(project)


def deletion_preview(store: Store, project_id: str) -> dict[str, Any]:
    """Deleting a Project must never look like deleting its Sources."""
    project = store.projects.get(project_id)
    name = project.get("name")
    members = [m for m in store.materials.all() if name in (m.get("projects") or [])]
    return {"project": project, "materials_kept": len(members)}


def delete(store: Store, project_id: str) -> None:
    project = store.projects.get(project_id)
    name = project.get("name")
    for material in store.materials.all():
        names = material.get("projects") or []
        if name in names:
            material["projects"] = [n for n in names if n != name]
            store.materials.put(material)
    store.projects.delete(project_id)


def set_membership(store: Store, material_id: str, project_name: str, member: bool) -> Record:
    material = store.materials.get(material_id)
    names = list(material.get("projects") or [])
    if member and project_name not in names:
        names.append(project_name)
    if not member:
        names = [name for name in names if name != project_name]
    material["projects"] = names
    material["updated_at"] = now()
    return store.materials.put(material)
