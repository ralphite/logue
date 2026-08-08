"""Running a Skill over Sources.

A Run freezes what it read: the exact Materials, and the exact revision of the
Skill. Re-reading a Run later shows what the answer was actually based on, even
after the Sources or the Skill have moved on. Citations are `[Source n]`, where
n indexes the frozen list.
"""

from __future__ import annotations

import re
from typing import Any

from ..errors import BadRequest
from ..ids import new_id, now
from ..providers import Provider
from ..store import Record, Store
from . import materials

#: Models write citations both ways — `[Source 3, 7]` and `[Source 3, Source 7]`
#: — so match the bracket and pull every number out of it.
CITATION = re.compile(r"\[Source[^\]]*\]")


def _numbered(sources: list[Record]) -> str:
    lines = []
    for index, source in enumerate(sources, start=1):
        origin = (source.get("source") or {}).get("title") or (source.get("source") or {}).get("url") or "This Mac"
        body = str(source.get("content") or "").strip()
        lines.append(f"[Source {index}] ({origin})\n{body}")
    return "\n\n".join(lines)


def cited_indexes(text: str, count: int) -> list[int]:
    """Every Source cited in the output, in order, dropping out-of-range ones."""
    found: list[int] = []
    for match in CITATION.finditer(text):
        for number in re.findall(r"\d+", match.group(0)):
            index = int(number)
            if 1 <= index <= count and index not in found:
                found.append(index)
    return found


def run_skill(
    store: Store,
    provider: Provider,
    *,
    skill_id: str,
    instruction: str,
    project: str = "",
    source_ids: list[str] | None = None,
    activity_source_id: str = "",
) -> Record:
    skill = store.skills.get(skill_id)
    if source_ids is None:
        sources = materials.context_for(store, project) if project else []
    else:
        sources = [store.materials.get(source_id) for source_id in source_ids]

    settings = store.settings()
    project_record = next((p for p in store.projects.all() if p.get("name") == project), None)

    system = "\n\n".join(
        part
        for part in [
            str(skill.get("instructions") or ""),
            f"Personal context: {settings['personal_context']}" if settings.get("personal_context") else "",
            f"Project context: {project_record['overview']}" if project_record and project_record.get("overview") else "",
            "Cite every claim as [Source n] using the numbered Sources below. "
            "Never state anything the Sources do not support." if sources else "",
        ]
        if part
    )
    prompt = "\n\n".join(part for part in [_numbered(sources), f"Request: {instruction}"] if part)

    run: Record = {
        "id": new_id("run"),
        "skill_id": skill_id,
        "skill_name": skill.get("name"),
        "skill_revision": skill.get("revision", 1),
        "skill_instructions": skill.get("instructions"),
        "instruction": instruction,
        "project": project,
        "task": skill.get("task", "generate"),
        "output_type": skill.get("output", "insert"),
        "sources": [source["id"] for source in sources],
        "activity_source_id": activity_source_id,
        "status": "running",
        "created_at": now(),
        "updated_at": now(),
    }
    store.runs.put(run)

    try:
        output = provider.generate(system, prompt)
    except Exception as error:  # noqa: BLE001 - recorded on the Run, then re-raised
        run.update({"status": "failed", "error": str(error), "updated_at": now()})
        store.runs.put(run)
        raise

    run.update(
        {
            "status": "complete",
            "original_output": output,
            "citations": cited_indexes(output, len(sources)),
            "updated_at": now(),
        }
    )
    return store.runs.put(run)


def adopt(store: Store, run_id: str, text: str) -> Record:
    """Record what the user actually used, which may differ from the output."""
    run = store.runs.get(run_id)
    if run.get("status") != "complete":
        raise BadRequest("Only a complete Run can be adopted.")
    run["adopted_output"] = text
    run["updated_at"] = now()
    return store.runs.put(run)


def to_document(store: Store, run_id: str, title: str = "") -> Record:
    run = store.runs.get(run_id)
    body = str(run.get("adopted_output") or run.get("original_output") or "")
    if not body:
        raise BadRequest("This Run has no output yet.")
    timestamp = now()
    document: Record = {
        "id": new_id("document"),
        "title": title.strip() or "Untitled",
        "content": body,
        "source_ids": list(run.get("sources") or []),
        "run_id": run_id,
        "revision": 1,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    return store.documents.put(document)


def dependencies(store: Store, run_id: str) -> dict[str, Any]:
    """What this Run read, resolved for display."""
    run = store.runs.get(run_id)
    sources = [store.materials.find(source_id) for source_id in run.get("sources") or []]
    return {
        "run": run,
        "sources": [source for source in sources if source],
        "missing": [
            source_id
            for source_id, source in zip(run.get("sources") or [], sources, strict=True)
            if source is None
        ],
    }
