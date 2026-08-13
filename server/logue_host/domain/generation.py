"""Running a Skill over Sources.

A Run freezes what it read: the exact Materials, and the exact revision of the
Skill. Re-reading a Run later shows what the answer was actually based on, even
after the Sources or the Skill have moved on. Citations are `[Source n]`, where
n indexes the frozen list.
"""

from __future__ import annotations

import re
from typing import Any

from .. import trace
from ..errors import BadRequest
from ..ids import new_id, now
from ..providers import Provider
from ..store import Record, Store
from . import materials

#: Models write citations both ways — `[Source 3, 7]` and `[Source 3, Source 7]`
#: — so match the bracket and pull every number out of it.
CITATION = re.compile(r"\[Source[^\]]*\]")


def numbered(sources: list[Record]) -> str:
    lines = []
    for index, source in enumerate(sources, start=1):
        origin = (source.get("source") or {}).get("title") or (source.get("source") or {}).get("url") or "This Mac"
        body = str(source.get("content") or "").strip()
        # A quote read without its paragraph is easy to misread; give the model
        # the surrounding passage when the capture kept one.
        context = str(source.get("context") or "").strip()
        if context and context != body:
            body = f"{body}\n(in context: {context})"
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
    text: str = "",
) -> Record:
    """Run a Skill. `instruction` is what was asked; `text` is what to work on.

    They are not the same thing and must not be sent as if they were. A Skill
    that rewrites — into another language, into Markdown — is given a piece of
    writing and no request at all, and passing that writing as the request made
    a real model answer "Request: Test voice input\nWe should settle…", with
    the label it had been handed carried into its own output. Run it twice and
    the answer began "# Request: Request:".
    """
    skill = store.skills.get(skill_id)
    if not str(skill.get("instructions") or "").strip():
        # Named but not written yet. Sending an empty prompt would produce
        # something, and that something would look like an answer.
        raise BadRequest(f"{skill.get('name') or 'That Skill'} has no prompt yet. Write one on its page.")
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
    prompt = "\n\n".join(
        part
        for part in [
            numbered(sources),
            f"<text>\n{text}\n</text>" if text else "",
            f"Request: {instruction}" if instruction else "",
        ]
        if part
    )

    run: Record = {
        "id": new_id("run"),
        "skill_id": skill_id,
        "skill_name": skill.get("name"),
        "skill_revision": skill.get("revision", 1),
        "skill_instructions": skill.get("instructions"),
        "instruction": instruction or text,
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
        with trace.span(
            f"skill:{skill.get('name')}",
            **{
                "skill.name": str(skill.get("name") or ""),
                "skill.revision": skill.get("revision", 1),
                "run.id": run["id"],
                "project": project,
                "sources": len(sources),
                "input.value": text or instruction,
            },
        ) as recorded:
            output = provider.generate(system, prompt)
            recorded["output.value"] = output
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


#: How a generated answer was actually used. The words this workspace already uses.
ADOPTIONS = {"keep", "insert", "copy", "document"}


def adopt(store: Store, run_id: str, text: str, *, action: str = "keep", target: str = "") -> Record:
    """Record what the person actually used, and what they did with it.

    "Used" and "read and closed" are different verdicts on a Skill, and only
    one of them means it earned its place. Storing the text alone could not
    tell them apart — nor could it tell a kept answer from one that was pasted
    into a document and then taken straight back out.
    """
    run = store.runs.get(run_id)
    if run.get("status") != "complete":
        raise BadRequest("Only a complete Run can be adopted.")
    if action not in ADOPTIONS:
        raise BadRequest(f"action must be one of {', '.join(sorted(ADOPTIONS))}")
    run["adopted_output"] = text
    run["adoption"] = action
    run["adoption_undone"] = False
    if target:
        run["adoption_target"] = target
    run["updated_at"] = now()
    return store.runs.put(run)


def undo_adoption(store: Store, run_id: str) -> Record:
    """Take it back, without pretending it never happened.

    The adopted text stays: that this answer was used and then withdrawn says
    more about the Skill than a Run with no record at all.
    """
    run = store.runs.get(run_id)
    if not run.get("adoption") and not run.get("adopted_output"):
        raise BadRequest("This Run was never adopted.")
    run["adoption_undone"] = True
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


def _source_id(entry: Any) -> str:
    """The id of a Source a Run read, however that Run wrote it down.

    Runs from an earlier format stored the whole Material record here instead
    of its id. Handed one, `materials.find` built a filename out of the entire
    record and the read failed with "File name too long" — a 500 on the only
    request the Answer dialog makes, so twenty finished answers on the owner's
    machine opened as a Python traceback with a Close button. The answers were
    never damaged; they were unreachable.
    """
    if isinstance(entry, dict):
        return str(entry.get("id") or "")
    return str(entry or "")


def dependencies(store: Store, run_id: str) -> dict[str, Any]:
    """What this Run read, resolved for display."""
    run = store.runs.get(run_id)
    wanted = [_source_id(entry) for entry in run.get("sources") or []]
    sources = [store.materials.find(source_id) if source_id else None for source_id in wanted]
    return {
        "run": run,
        "sources": [source for source in sources if source],
        "missing": [
            source_id
            for source_id, source in zip(wanted, sources, strict=True)
            if source is None
        ],
    }
