"""The route table: every endpoint, one line of logic each.

Anything longer than glue belongs in `domain/`. Reading this file should tell
you the whole API surface without scrolling past business rules.
"""

from __future__ import annotations

import base64
import re
from pathlib import Path
from typing import Any

from . import trace
from .build import installed_extension_build
from .domain import (
    agent,
    backup,
    capture,
    corrections,
    defaults,
    documents,
    finding,
    generation,
    materials,
    organize,
    projects,
    skills,
    summaries,
    topics,
    vocabulary,
)
from .errors import BadRequest, NotFound
from .http import Request, Response, Router
from .ids import new_id, now
from .providers import DEFAULT_MODEL, Provider
from .store import Record, Store


#: Everything `/v1/settings` is allowed to hold, and nothing else.
#:
#: This endpoint used to take any key at all and store it. A "model" written
#: here was accepted, saved, and read back — while nothing anywhere read it,
#: because the model lives behind /v1/model. The setting looked kept and
#: changed nothing, which is the worst of both: a client with a typo in a field
#: name is never told, and the bug shows up much later as behaviour that
#: ignores a setting someone made.
#:
#: `materials.update` has worked this way all along. This is the same rule.
SETTINGS_KEYS = frozenset(
    {
        "personal_context",
        "voice_profile",
        "default_transcription_skill",
        "default_organization_skill",
        "default_extension_skill",
        "default_qa_skill",
        "default_document_skill",
        # Read by the app rather than the Host — a setting is still a setting
        # when the client is the one who cares about it.
        "pins",
        # Where to send what the model was asked and what it said. The Host is
        # a background service, so an environment variable means editing
        # launchd to turn on a debugging aid — which nobody will do twice.
        "trace_endpoint",
    }
)


def _only_real_settings(changes: dict[str, Any]) -> dict[str, Any]:
    unknown = set(changes) - SETTINGS_KEYS
    if unknown:
        raise BadRequest(f"no such setting: {', '.join(sorted(unknown))}")
    return changes


class App:
    def __init__(self, data_dir: Path, *, file_new_materials: bool = True) -> None:
        self.store = Store(data_dir)
        # Off in tests: a model call outliving a case would write into a
        # workspace that has already been deleted.
        self.file_new_materials = file_new_materials
        skills.ensure_built_ins(self.store)
        trace.configure(self.store.settings())
        self.router = Router()
        self._register()

    # -- provider access ----------------------------------------------------

    def provider(self) -> Provider:
        """Read from disk each time so Settings changes take effect at once."""
        return Provider.load(self.store.provider())

    def save_provider(self, provider: Provider) -> None:
        self.store.save_provider(provider.dump())

    # -- filing -------------------------------------------------------------

    def file_later(self, material: Record) -> Record:
        """Hand a new Source to automatic organisation, without waiting for it.

        Capture has to feel instant — the product is "say it and carry on" — so
        the Source is marked as waiting and returned, and the model call happens
        after it is already safe on disk.
        """
        provider = self.provider()
        if not self.file_new_materials or not provider.ready_for("generation"):
            return material
        marked = organize.mark_pending(self.store, material)
        organize.in_background(self.store, provider, str(marked["id"]))
        return marked

    # -- registration -------------------------------------------------------

    def _register(self) -> None:  # noqa: PLR0915 - a route table is meant to be flat
        route = self.router.route
        store = self.store

        @route("GET", "/v1/changes")
        def changes(_: Request) -> dict[str, Any]:
            """Has anything moved, and what kind of thing.

            Asked by every open surface on a short timer, so it touches no
            files and reads nothing: two surfaces on one workspace is the
            point, and a person should never have to know a reload exists.
            """
            return store.changes.snapshot()

        @route("GET", "/v1/status")
        def status(_: Request) -> dict[str, Any]:
            provider = self.provider()
            return {
                "ok": True,
                "build": installed_extension_build(),
                "data_dir": str(store.root),
                "bytes": store.usage_bytes(),
                "model": {
                    "configured": bool(provider.api_key),
                    "model": provider.model,
                    "generation": provider.status_of("generation"),
                    "voice": provider.status_of("voice"),
                    "generation_error": provider.error_of("generation"),
                    "voice_error": provider.error_of("voice"),
                    "generation_ready": provider.ready_for("generation"),
                    "voice_ready": provider.ready_for("voice"),
                },
                # Whether anything is watching. Said out loud because
                # "tracing is on" is otherwise unfalsifiable from outside,
                # and a refused endpoint has to name itself or it looks like
                # a typo that worked.
                "trace": {"to": trace.endpoint(store.settings()), "refused": trace.refused(store.settings())},
            }

        # -- materials ------------------------------------------------------

        @route("GET", "/v1/materials")
        def list_materials(request: Request) -> dict[str, Any]:
            query = request.query.get("q", "")
            project = request.query.get("project", "")
            kind = request.query.get("kind", "")
            # Widening asks a model, so it is never on the typing path — the
            # caller asks for it once the person has stopped and committed to
            # the words. `also` says which other wordings were searched, so a
            # result containing none of what was typed can be accounted for.
            if query and request.query.get("wider"):
                return finding.widened(store, self.provider(), query, project, kind)
            return {"materials": materials.search(store, query=query, project=project, kind=kind)}

        @route("POST", "/v1/materials")
        def create_material(request: Request) -> dict[str, Any]:
            body = request.json()
            material = materials.create(
                store,
                kind=str(body.get("kind") or "text"),
                content=str(body.get("content") or ""),
                source=body.get("source"),
                projects=body.get("projects"),
                parent_ids=body.get("parent_ids"),
                capture_id=body.get("capture_id"),
                capture_seconds=body.get("seconds"),
                context=body.get("context"),
                anchor=body.get("anchor"),
                actor=str(body.get("actor") or "user"),
            )
            return {"material": self.file_later(material)}

        # -- automatic organisation -----------------------------------------

        @route("GET", "/v1/review")
        def review_queue(_: Request) -> dict[str, Any]:
            return {"materials": organize.queue(store)}

        @route("POST", "/v1/materials/{id}/organize")
        def organize_material(request: Request) -> dict[str, Any]:
            return {"material": organize.classify(store, self.provider(), request.params["id"])}

        @route("POST", "/v1/materials/{id}/organization/undo")
        def undo_organization(request: Request) -> dict[str, Any]:
            return {"material": organize.undo(store, request.params["id"])}

        @route("POST", "/v1/materials/{id}/organization")
        def resolve_organization(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "material": organize.resolve(
                    store,
                    request.params["id"],
                    accept=bool(body.get("accept")),
                    projects=body.get("projects"),
                    tags=body.get("tags"),
                    # Answered separately from the filing: someone may well
                    # want the tags without agreeing an old Source is now wrong.
                    supersede=body.get("supersede"),
                )
            }

        @route("GET", "/v1/materials/{id}")
        def get_material(request: Request) -> dict[str, Any]:
            return {"material": store.materials.get(request.params["id"])}

        @route("PATCH", "/v1/materials/{id}")
        def patch_material(request: Request) -> dict[str, Any]:
            return {"material": materials.update(store, request.params["id"], request.json())}

        @route("DELETE", "/v1/materials/{id}")
        def delete_material(request: Request) -> dict[str, Any]:
            materials.delete(store, request.params["id"])
            return {"ok": True}

        @route("GET", "/v1/materials/{id}/dependencies")
        def material_dependencies(request: Request) -> dict[str, Any]:
            """What breaks if this Source goes away."""
            material_id = request.params["id"]
            store.materials.get(material_id)
            runs = [run for run in store.runs.list() if material_id in (run.get("sources") or [])]
            documents = [doc for doc in store.documents.list() if material_id in (doc.get("source_ids") or [])]
            children = [m for m in store.materials.all() if material_id in (m.get("parent_ids") or [])]
            return {
                "runs": [{"id": r["id"], "instruction": r.get("instruction"), "created_at": r.get("created_at")} for r in runs],
                "documents": [{"id": d["id"], "title": d.get("title")} for d in documents],
                "derived": [{"id": c["id"], "content": str(c.get("content") or "")[:120]} for c in children],
            }

        @route("GET", "/v1/materials/{id}/lineage")
        def material_lineage(request: Request) -> dict[str, Any]:
            material = store.materials.get(request.params["id"])
            parents = [store.materials.find(pid) for pid in material.get("parent_ids") or []]
            children = [m for m in store.materials.all() if request.params["id"] in (m.get("parent_ids") or [])]
            return {
                "material": material,
                "parents": [p for p in parents if p],
                "children": children,
            }

        # -- projects -------------------------------------------------------

        @route("GET", "/v1/projects")
        def list_projects(_: Request) -> dict[str, Any]:
            found = store.projects.list(sort_key="name", reverse=False)
            for project in found:
                project["count"] = len(materials.search(store, project=str(project.get("name"))))
            return {"projects": found}

        @route("POST", "/v1/projects")
        def create_project(request: Request) -> dict[str, Any]:
            body = request.json()
            return {"project": projects.create(store, name=str(body.get("name") or ""), overview=str(body.get("overview") or ""))}

        @route("GET", "/v1/projects/{id}")
        def get_project(request: Request) -> dict[str, Any]:
            project = store.projects.get(request.params["id"])
            return {
                "project": project,
                "materials": materials.search(store, project=str(project.get("name"))),
            }

        @route("PATCH", "/v1/projects/{id}")
        def patch_project(request: Request) -> dict[str, Any]:
            return {"project": projects.update(store, request.params["id"], request.json())}

        @route("GET", "/v1/projects/{id}/deletion-preview")
        def project_deletion_preview(request: Request) -> dict[str, Any]:
            return projects.deletion_preview(store, request.params["id"])

        @route("DELETE", "/v1/projects/{id}")
        def delete_project(request: Request) -> dict[str, Any]:
            projects.delete(store, request.params["id"])
            return {"ok": True}

        @route("POST", "/v1/project-membership")
        def set_membership(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "material": projects.set_membership(
                    store,
                    str(body.get("material_id") or ""),
                    str(body.get("project") or ""),
                    bool(body.get("member", True)),
                )
            }

        # -- documents ------------------------------------------------------

        @route("GET", "/v1/documents")
        def list_documents(_: Request) -> dict[str, Any]:
            return {"documents": store.documents.list(sort_key="updated_at")}

        @route("POST", "/v1/documents")
        def create_document(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "document": documents.create(
                    store,
                    title=str(body.get("title") or ""),
                    content=str(body.get("content") or ""),
                    source_ids=body.get("source_ids"),
                )
            }

        @route("GET", "/v1/documents/{id}")
        def get_document(request: Request) -> dict[str, Any]:
            return {
                "document": store.documents.get(request.params["id"]),
                "sources": documents.sources_of(store, request.params["id"]),
            }

        def _describe_new_version(document_id: str) -> None:
            """Ask a model what the version just written changed.

            After the save has already been answered, never before it: the
            editor autosaves on a pause and a model call in that path would be
            a pause someone can feel.
            """
            waiting = documents.newest_unwritten(store, document_id)
            if waiting:
                summaries.in_background(store, self.provider(), waiting)

        @route("PATCH", "/v1/documents/{id}")
        def patch_document(request: Request) -> dict[str, Any]:
            changes = dict(request.json())
            # Not a field on the document — it is what the caller last saw.
            expected = changes.pop("expected_revision", None)
            document = documents.update(
                store, request.params["id"], changes, expected_revision=None if expected is None else int(expected)
            )
            _describe_new_version(request.params["id"])
            return {"document": document}

        @route("POST", "/v1/documents/{id}/append")
        def append_to_document(request: Request) -> dict[str, Any]:
            body = request.json()
            document = documents.append(
                store, request.params["id"], str(body.get("text") or ""), body.get("source_ids")
            )
            _describe_new_version(request.params["id"])
            return {"document": document}

        @route("DELETE", "/v1/documents/{id}")
        def delete_document(request: Request) -> dict[str, Any]:
            store.documents.get(request.params["id"])
            store.documents.delete(request.params["id"])
            return {"ok": True}

        @route("POST", "/v1/documents/{id}/rewrite")
        def rewrite_selection(request: Request) -> dict[str, Any]:
            body = request.json()
            return documents.rewrite(
                store,
                self.provider(),
                request.params["id"],
                selection=str(body.get("selection") or ""),
                instruction=str(body.get("instruction") or ""),
            )

        @route("GET", "/v1/documents/{id}/versions")
        def document_versions(request: Request) -> dict[str, Any]:
            return {"versions": documents.versions(store, request.params["id"])}

        @route("GET", "/v1/documents/{id}/versions/{revision}/diff")
        def document_diff(request: Request) -> dict[str, Any]:
            return {"lines": documents.diff(store, request.params["id"], int(request.params["revision"]))}

        @route("POST", "/v1/documents/{id}/versions/{revision}/restore")
        def restore_document(request: Request) -> dict[str, Any]:
            return {"document": documents.restore(store, request.params["id"], int(request.params["revision"]))}

        @route("GET", "/v1/documents/{id}/markdown")
        def export_document(request: Request) -> Response:
            text = documents.to_markdown(store, request.params["id"])
            return Response(raw=text.encode("utf-8"), media_type="text/markdown; charset=utf-8")

        # -- skills ---------------------------------------------------------

        @route("GET", "/v1/skills")
        def list_skills(_: Request) -> dict[str, Any]:
            return {"skills": store.skills.list(sort_key="name", reverse=False)}

        @route("POST", "/v1/skills")
        def create_skill(request: Request) -> dict[str, Any]:
            return {"skill": skills.create(store, request.json())}

        @route("PATCH", "/v1/skills/{id}")
        def patch_skill(request: Request) -> dict[str, Any]:
            return {"skill": skills.update(store, request.params["id"], request.json())}

        @route("GET", "/v1/skills/{id}/versions")
        def skill_versions(request: Request) -> dict[str, Any]:
            return {"versions": skills.versions(store, request.params["id"])}

        @route("GET", "/v1/skills/{id}/versions/{revision}/diff")
        def skill_diff(request: Request) -> dict[str, Any]:
            return {"lines": skills.diff(store, request.params["id"], int(request.params["revision"]))}

        @route("POST", "/v1/skills/{id}/versions/{revision}/restore")
        def restore_skill(request: Request) -> dict[str, Any]:
            return {"skill": skills.restore(store, request.params["id"], int(request.params["revision"]))}

        @route("GET", "/v1/skills/{id}/archive-impact")
        def skill_archive_impact(request: Request) -> dict[str, Any]:
            return skills.archive_impact(store, request.params["id"])

        @route("DELETE", "/v1/skills/{id}")
        def delete_skill(request: Request) -> dict[str, Any]:
            skills.delete(store, request.params["id"])
            return {"ok": True}

        # -- generation -----------------------------------------------------

        @route("GET", "/v1/runs")
        def list_runs(request: Request) -> dict[str, Any]:
            found = store.runs.list()
            project = request.query.get("project")
            if project:
                found = [run for run in found if run.get("project") == project]
            return {"runs": found}

        @route("POST", "/v1/runs")
        def create_run(request: Request) -> dict[str, Any]:
            body = request.json()
            instruction = str(body.get("instruction") or "").strip()
            # What to work on, as opposed to what is being asked for. A rewrite
            # has the first and none of the second.
            text = str(body.get("input") or "").strip()
            if not instruction and not text:
                raise BadRequest("instruction is required")

            # Where the request came from.
            #
            # Normally the question is itself worth keeping — it is what the
            # user said, and nothing else has it. But a Skill run over a
            # transcript is given the transcript as its instruction, and that
            # is already a Source; storing it again would leave a copy of every
            # recording in the workspace for every rewrite of it. `origin_id`
            # says "the instruction is that Material", and the Run points at it.
            origin_id = str(body.get("origin_id") or "")
            if origin_id:
                activity_id = str(store.materials.get(origin_id)["id"])
            else:
                activity_id = str(
                    materials.create(
                        store,
                        kind="text",
                        content=instruction or text,
                        projects=[str(body.get("project"))] if body.get("project") else [],
                        actor="user",
                        extra={"purpose": "activity"},
                    )["id"]
                )
            run = generation.run_skill(
                store,
                self.provider(),
                skill_id=str(body.get("skill_id") or ""),
                instruction=instruction,
                project=str(body.get("project") or ""),
                source_ids=body.get("source_ids"),
                activity_source_id=activity_id,
                text=text,
            )
            return {"run": run, "sources": generation.dependencies(store, run["id"])["sources"]}

        @route("GET", "/v1/runs/{id}")
        def get_run(request: Request) -> dict[str, Any]:
            return generation.dependencies(store, request.params["id"])

        @route("POST", "/v1/runs/{id}/adopt")
        def adopt_run(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "run": generation.adopt(
                    store,
                    request.params["id"],
                    str(body.get("text") or ""),
                    action=str(body.get("action") or "keep"),
                    target=str(body.get("target") or ""),
                )
            }

        @route("POST", "/v1/runs/{id}/undo")
        def undo_run(request: Request) -> dict[str, Any]:
            return {"run": generation.undo_adoption(store, request.params["id"])}

        @route("POST", "/v1/runs/{id}/document")
        def run_to_document(request: Request) -> dict[str, Any]:
            return {
                "document": generation.to_document(store, request.params["id"], str(request.json().get("title") or ""))
            }

        # -- capture --------------------------------------------------------

        @route("POST", "/v1/transcribe")
        def transcribe(request: Request) -> dict[str, Any]:
            body = request.json()
            audio_b64 = str(body.get("audio") or "")
            if not audio_b64:
                raise BadRequest("audio is required")
            try:
                audio = base64.b64decode(audio_b64)
            except Exception:
                raise BadRequest("audio must be base64") from None
            return capture.transcribe(
                store,
                self.provider(),
                audio=audio,
                seconds=float(body.get("seconds") or 0),
                media_type=str(body.get("media_type") or "audio/webm"),
                project=str(body.get("project") or ""),
                context=body.get("context"),
                overrides=body.get("overrides"),
                nearby=str(body.get("nearby") or ""),
            )

        @route("POST", "/v1/captures/{id}/transcribe")
        def transcribe_kept(request: Request) -> dict[str, Any]:
            body = request.json()
            return capture.transcribe_kept(
                store,
                self.provider(),
                capture_id=request.params["id"],
                project=str(body.get("project") or ""),
                overrides=body.get("overrides"),
                nearby=str(body.get("nearby") or ""),
            )

        @route("POST", "/v1/voice-materials")
        def save_voice(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "material": self.file_later(
                    capture.save_voice(
                        store,
                        capture_id=str(body.get("capture_id") or ""),
                        text=str(body.get("text") or ""),
                        source=body.get("source"),
                        project=str(body.get("project") or ""),
                        parent_ids=body.get("parent_ids"),
                        applied_context=body.get("applied_context"),
                        context=str(body.get("context") or ""),
                    )
                )
            }

        @route("GET", "/v1/captures")
        def waiting_captures(_: Request) -> dict[str, Any]:
            """Every recording here that never became words, so it can be tried again."""
            return {"captures": capture.unclaimed(store)}

        @route("GET", "/v1/captures/{id}/context")
        def capture_context(request: Request) -> dict[str, Any]:
            """What shaped a transcription, including one that produced nothing."""
            return {"applied_context": store.capture_context(request.params["id"])}

        @route("POST", "/v1/materials/{id}/retranscribe")
        def retranscribe(request: Request) -> dict[str, Any]:
            body = request.json()
            return {
                "material": capture.retranscribe(
                    store,
                    self.provider(),
                    material_id=request.params["id"],
                    correction=body.get("correction"),
                    overrides=body.get("overrides"),
                    remember=bool(body.get("remember", True)),
                )
            }

        @route("POST", "/v1/materials/{id}/use-revision")
        def use_transcript_revision(request: Request) -> dict[str, Any]:
            revision_id = str(request.json().get("revision_id") or "")
            return {"material": capture.use_revision(store, request.params["id"], revision_id)}

        @route("GET", "/v1/corrections")
        def list_corrections(_: Request) -> dict[str, Any]:
            return {"corrections": corrections.all_of(store)}

        @route("DELETE", "/v1/corrections/{spoken}")
        def forget_correction(request: Request) -> dict[str, Any]:
            return {"corrections": corrections.forget(store, request.params["spoken"])}

        # -- the panel's conversation ----------------------------------------

        @route("POST", "/v1/agent/message")
        def agent_message(request: Request) -> dict[str, Any]:
            body = request.json()
            page = body.get("page") if isinstance(body.get("page"), dict) else {}
            history = body.get("history") if isinstance(body.get("history"), list) else []
            turn = agent.converse(
                store,
                self.provider(),
                message=str(body.get("message") or ""),
                page=page,
                project=str(body.get("project") or ""),
                history=[h for h in history if isinstance(h, dict)],
            )
            return turn

        @route("POST", "/v1/agent/accept")
        def agent_accept(request: Request) -> dict[str, Any]:
            body = request.json()
            proposal = body.get("proposal")
            if not isinstance(proposal, dict):
                raise BadRequest("a proposal is required")
            page = body.get("page") if isinstance(body.get("page"), dict) else {}
            # Only a person's click reaches this. The agent has no route to it.
            return agent.accept(store, proposal, page=page)

        @route("GET", "/v1/vocabulary")
        def list_vocabulary(_: Request) -> dict[str, Any]:
            # Suggestions are worked out on the spot rather than kept: the
            # material they are read from changes every day, and a stored list
            # would go stale the moment someone typed the name once more.
            return {"learned": vocabulary.learned(store), "candidates": vocabulary.candidates(store)}

        @route("POST", "/v1/vocabulary")
        def learn_term(request: Request) -> dict[str, Any]:
            body = request.json()
            term = str(body.get("term") or "")
            reason = str(body.get("reason") or "") or "You approved this from your own writing."
            return {"learned": vocabulary.learn(store, term, reason)}

        @route("POST", "/v1/vocabulary/dismiss")
        def dismiss_term(request: Request) -> dict[str, Any]:
            term = str(request.json().get("term") or "")
            vocabulary.dismiss(store, term)
            return {"candidates": vocabulary.candidates(store)}

        @route("DELETE", "/v1/vocabulary/{term}")
        def forget_term(request: Request) -> dict[str, Any]:
            return {"learned": vocabulary.forget(store, request.params["term"])}

        @route("GET", "/v1/materials/{id}/transcript-revisions")
        def transcript_revisions(request: Request) -> dict[str, Any]:
            material = store.materials.get(request.params["id"])
            kept = [r for r in store.transcript_revisions.list() if r.get("material_id") == material["id"]]
            return {"current": material, "revisions": kept}

        @route("GET", "/v1/captures/{id}/audio")
        def get_audio(request: Request) -> Response:
            path = store.audio_path(request.params["id"])
            if not path:
                raise NotFound("That recording is no longer available.")
            media = {".webm": "audio/webm", ".mp4": "audio/mp4", ".wav": "audio/wav"}.get(path.suffix, "application/octet-stream")
            data = path.read_bytes()
            size = len(data)
            # Ranges, because ten minutes of audio is a file someone drags a
            # scrubber through. Without them a player can only take the whole
            # thing from the start, so seeking does nothing — and a browser
            # has no other way to look for a length the file never carried.
            asked = request.headers.get("range") or request.headers.get("Range") or ""
            match = re.match(r"bytes=(\d*)-(\d*)$", asked.strip())
            if match and size:
                first, last = match.group(1), match.group(2)
                start = int(first) if first else max(0, size - int(last or 0))
                end = int(last) if first and last else size - 1
                start, end = max(0, start), min(end, size - 1)
                if start > end:
                    return Response(
                        raw=b"",
                        status=416,
                        media_type=media,
                        headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
                    )
                return Response(
                    raw=data[start : end + 1],
                    status=206,
                    media_type=media,
                    headers={
                        "Content-Range": f"bytes {start}-{end}/{size}",
                        "Accept-Ranges": "bytes",
                        "Content-Length": str(end - start + 1),
                    },
                )
            return Response(raw=data, media_type=media, headers={"Accept-Ranges": "bytes"})

        # -- topics ---------------------------------------------------------

        @route("GET", "/v1/topics")
        def list_topics(request: Request) -> dict[str, Any]:
            found = store.topics.list(sort_key="updated_at")
            if request.query.get("hidden") != "1":
                found = [topic for topic in found if not topic.get("hidden")]
            return {"topics": found}

        @route("POST", "/v1/topics/regroup")
        def regroup_topics(_: Request) -> dict[str, Any]:
            return {"topics": topics.regroup(store)}

        @route("PATCH", "/v1/topics/{id}")
        def change_topic(request: Request) -> dict[str, Any]:
            body = request.json()
            topic_id = request.params["id"]
            if "hidden" in body:
                return {"topic": topics.hide(store, topic_id, bool(body["hidden"]))}
            return {"topic": topics.rename(store, topic_id, str(body.get("name") or ""))}

        @route("POST", "/v1/topics/{id}/add-to-project")
        def topic_to_project(request: Request) -> dict[str, Any]:
            return topics.add_to_project(store, request.params["id"], str(request.json().get("project") or ""))

        @route("POST", "/v1/topics/{id}/vocabulary")
        def topic_vocabulary(request: Request) -> dict[str, Any]:
            terms = request.json().get("terms") or []
            return {"vocabulary": topics.save_vocabulary(store, request.params["id"], [str(t) for t in terms])}

        @route("GET", "/v1/vocabularies")
        def list_vocabularies(_: Request) -> dict[str, Any]:
            return {"vocabularies": store.vocabularies.list(sort_key="name", reverse=False)}

        # -- context for the Extension --------------------------------------

        @route("GET", "/v1/context")
        def context(request: Request) -> dict[str, Any]:
            project = request.query.get("project", "")
            settings = store.settings()
            project_record = projects.by_name(store, project) if project else None
            profile = dict(settings.get("voice_profile") or {})
            label = "Default voice"
            if project_record and (project_record.get("transcription_profile") or {}).get("mode") == "customized":
                label = str(project_record.get("name"))
                profile = project_record["transcription_profile"]
            return {
                "voice_profile": {
                    "label": label,
                    "project_name": project_record.get("name") if project_record else "",
                    "primary_language": profile.get("primary_language") or "",
                },
                "projects": [
                    {"name": p.get("name"), "id": p.get("id")}
                    for p in store.projects.list(sort_key="name", reverse=False)
                ],
                "vocabularies": [
                    {"id": v.get("id"), "name": v.get("name")} for v in store.vocabularies.all()
                ],
                # Only the ones that can actually run. A Skill is named first
                # and written afterwards, and one with nothing to say would
                # otherwise sit in every picker, sending an empty prompt.
                "skills": [
                    s for s in store.skills.list(sort_key="name", reverse=False) if skills.usable(s)
                ],
                "defaults": defaults.chosen(store),
            }

        # -- settings and model ---------------------------------------------

        @route("GET", "/v1/settings")
        def get_settings(_: Request) -> dict[str, Any]:
            return {"settings": store.settings()}

        @route("PATCH", "/v1/settings")
        def patch_settings(request: Request) -> dict[str, Any]:
            settings = store.settings()
            settings.update(_only_real_settings(request.json()))
            saved = store.save_settings(settings)
            # Takes effect on the next model call, not the next restart: a
            # setting that needs a service restarted is a setting nobody uses.
            trace.configure(saved)
            return {"settings": saved}

        @route("GET", "/v1/model")
        def get_model(_: Request) -> dict[str, Any]:
            provider = self.provider()
            return {
                "configured": bool(provider.api_key),
                "provider": provider.kind,
                "model": provider.model,
                "transcription_model": provider.transcription_model,
                "base_url": provider.base_url,
                "generation": provider.status_of("generation"),
                "voice": provider.status_of("voice"),
                "generation_error": provider.error_of("generation"),
                "voice_error": provider.error_of("voice"),
            }

        MODEL_FIELDS = ("provider", "api_key", "model", "transcription_model", "base_url")

        def merged_model_record(body: dict[str, Any]) -> dict[str, Any]:
            """The stored record with the request's changes on top.

            Merged as a record rather than mutated as an instance: an instance
            round-trip writes its own kind back, so saving while the mock key
            was in would have forgotten which provider the person had chosen.
            Switching provider resets the endpoint-shaped fields — a Gemini
            base_url pointed at an OpenAI path answers nothing but 404s.
            """
            record = dict(store.provider())
            if "provider" in body and str(body["provider"]) != str(record.get("provider") or "gemini"):
                for stale in ("model", "transcription_model", "base_url"):
                    record.pop(stale, None)
            for key in MODEL_FIELDS:
                if key in body:
                    value = str(body[key]).rstrip("/") if key == "base_url" else str(body[key])
                    if value:
                        record[key] = value
                    else:
                        record.pop(key, None)
            return record

        @route("POST", "/v1/model/test")
        def test_model(request: Request) -> dict[str, Any]:
            record = merged_model_record(request.json())
            record.pop("health", None)
            candidate = Provider.load(record)
            generation_ok, generation_error = candidate.check("generation")
            voice_ok, voice_error = candidate.check("voice")
            return {
                "generation": {"ok": generation_ok, "error": generation_error},
                "voice": {"ok": voice_ok, "error": voice_error},
                "health": candidate.health,
            }

        @route("PATCH", "/v1/model")
        def patch_model(request: Request) -> dict[str, Any]:
            record = merged_model_record(request.json())
            # Any config change invalidates the old verdict; re-probe now so the
            # UI never shows a green light left over from a previous key.
            record.pop("health", None)
            probe = Provider.load(record)
            probe.check("generation")
            probe.check("voice")
            record["health"] = probe.health or {}
            store.save_provider(record)
            return get_model(request)

        # -- backup ---------------------------------------------------------

        @route("GET", "/v1/backup/preview")
        def backup_preview(_: Request) -> dict[str, Any]:
            return backup.preview(store)

        @route("GET", "/v1/backup/export")
        def backup_export(_: Request) -> Response:
            data = backup.export_bundle(store)
            return Response(
                raw=data,
                media_type="application/zip",
                headers={"Content-Disposition": 'attachment; filename="logue-backup.zip"'},
            )

        @route("GET", "/v1/backups")
        def backup_list(_: Request) -> dict[str, Any]:
            return {"backups": backup.list_backups(store)}

        @route("POST", "/v1/backups")
        def backup_create(_: Request) -> dict[str, Any]:
            return {"backup": backup.save_backup(store)}

        @route("POST", "/v1/backups/restore")
        def backup_restore(request: Request) -> dict[str, Any]:
            body = request.json()
            if body.get("backup_id"):
                data = backup.read_backup(store, str(body["backup_id"]))
            elif body.get("bundle"):
                data = base64.b64decode(str(body["bundle"]))
            else:
                raise BadRequest("backup_id or bundle is required")
            return backup.restore(store, data)

        # -- pairing --------------------------------------------------------

        @route("GET", "/v1/clients")
        def list_clients(_: Request) -> dict[str, Any]:
            return {"clients": store.clients.list()}

        @route("POST", "/v1/clients")
        def pair_client(request: Request) -> dict[str, Any]:
            body = request.json()
            timestamp = now()
            return {
                "client": store.clients.put(
                    {
                        "id": new_id("client"),
                        "name": str(body.get("name") or "Unnamed device"),
                        "kind": str(body.get("kind") or "extension"),
                        "created_at": timestamp,
                        "last_seen_at": timestamp,
                    }
                )
            }

        @route("DELETE", "/v1/clients/{id}")
        def unpair_client(request: Request) -> dict[str, Any]:
            store.clients.get(request.params["id"])
            store.clients.delete(request.params["id"])
            return {"ok": True}
