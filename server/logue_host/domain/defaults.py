"""Which Skill each surface reaches for first.

Choosing a Skill is a decision someone makes once. Making them make it again on
every recording, every question, every selection is the product failing to
remember — and these five choices were already in this workspace's settings,
being ignored.

A slot that names a Skill which has since been deleted or turned off resolves
to nothing, and the surface falls back to whatever it did before. A stale id is
not worth an error message.
"""

from __future__ import annotations

from ..store import Record, Store

#: Slot name as the UI knows it → the settings key it has always been stored under.
SLOTS: dict[str, str] = {
    "transcription": "default_transcription_skill",
    "qa": "default_qa_skill",
    "document": "default_document_skill",
    "extension": "default_extension_skill",
    "organization": "default_organization_skill",
}


def chosen(store: Store) -> dict[str, str]:
    """Every slot that currently names a Skill this workspace still has."""
    settings = store.settings()
    live = {str(skill["id"]) for skill in store.skills.all() if skill.get("enabled")}
    picked = {}
    for slot, key in SLOTS.items():
        skill_id = str(settings.get(key) or "")
        if skill_id in live:
            picked[slot] = skill_id
    return picked


def skill_for(store: Store, slot: str) -> Record | None:
    skill_id = chosen(store).get(slot)
    return store.skills.find(skill_id) if skill_id else None
