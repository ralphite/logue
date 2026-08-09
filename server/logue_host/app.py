"""The route table: every endpoint, one line of logic each.

Anything longer than glue belongs in `domain/`. Reading this file should tell
you the whole API surface without scrolling past business rules.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from .build import installed_extension_build
from .domain import (
    backup,
    capture,
    corrections,
    defaults,
    documents,
    generation,
    materials,
    organize,
    projects,
    skills,
    summaries,
    topics,
)
from .errors import BadRequest, NotFound
from .http import Request, Response, Router
from .ids import new_id, now
from .providers import DEFAULT_MODEL, Provider
from .store import Record, Store


class App:
    def __init__(self, data_dir: Path, *, file_new_materials: bool = True) -> None:
        self.store = Store(data_dir)
        # Off in tests: a model call outliving a case would write into a
        # workspace that has already been deleted.
        self.file_new_materials = file_new_materials
        skills.ensure_built_ins(self.store)
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
            }

        # -- materials ------------------------------------------------------

        @route("GET", "/v1/materials")
        def list_materials(request: Request) -> dict[str, Any]:
            found = materials.search(
                store,
                query=request.query.get("q", ""),
                project=request.query.get("project", ""),
                kind=request.query.get("kind", ""),
            )
            return {"materials": found}

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
                context=body.get("context"),
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

        @route("POST", "/v1/documents/{id}/name")
        def name_document(request: Request) -> dict[str, Any]:
            return {"document": documents.suggest_title(store, self.provider(), request.params["id"])}

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
            if not instruction:
                raise BadRequest("instruction is required")

            # The question is itself worth keeping: it is what the user said.
            activity = materials.create(
                store,
                kind="text",
                content=instruction,
                projects=[str(body.get("project"))] if body.get("project") else [],
                actor="user",
                extra={"purpose": "activity"},
            )
            run = generation.run_skill(
                store,
                self.provider(),
                skill_id=str(body.get("skill_id") or ""),
                instruction=instruction,
                project=str(body.get("project") or ""),
                source_ids=body.get("source_ids"),
                activity_source_id=activity["id"],
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
                media_type=str(body.get("media_type") or "audio/webm"),
                project=str(body.get("project") or ""),
                context=body.get("context"),
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
                    )
                )
            }

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
            return Response(raw=path.read_bytes(), media_type=media)

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
                "skills": [
                    s for s in store.skills.list(sort_key="name", reverse=False) if s.get("enabled")
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
            settings.update(request.json())
            return {"settings": store.save_settings(settings)}

        @route("GET", "/v1/model")
        def get_model(_: Request) -> dict[str, Any]:
            provider = self.provider()
            return {
                "configured": bool(provider.api_key),
                "model": provider.model,
                "transcription_model": provider.transcription_model,
                "base_url": provider.base_url,
                "generation": provider.status_of("generation"),
                "voice": provider.status_of("voice"),
                "generation_error": provider.error_of("generation"),
                "voice_error": provider.error_of("voice"),
            }

        @route("POST", "/v1/model/test")
        def test_model(request: Request) -> dict[str, Any]:
            body = request.json()
            current = self.provider()
            candidate = Provider(
                api_key=str(body.get("api_key") or current.api_key),
                model=str(body.get("model") or current.model or DEFAULT_MODEL),
                transcription_model=str(body.get("transcription_model") or body.get("model") or current.transcription_model),
                base_url=str(body.get("base_url") or current.base_url),
            )
            generation_ok, generation_error = candidate.check("generation")
            voice_ok, voice_error = candidate.check("voice")
            return {
                "generation": {"ok": generation_ok, "error": generation_error},
                "voice": {"ok": voice_ok, "error": voice_error},
                "health": candidate.health,
            }

        @route("PATCH", "/v1/model")
        def patch_model(request: Request) -> dict[str, Any]:
            body = request.json()
            provider = self.provider()
            if "api_key" in body:
                provider.api_key = str(body["api_key"])
            if "model" in body:
                provider.model = str(body["model"]) or DEFAULT_MODEL
            if "transcription_model" in body:
                provider.transcription_model = str(body["transcription_model"]) or provider.model
            if "base_url" in body:
                provider.base_url = str(body["base_url"]).rstrip("/")
            # Any config change invalidates the old verdict; re-probe now so the
            # UI never shows a green light left over from a previous key.
            provider.health = None
            provider.check("generation")
            provider.check("voice")
            self.save_provider(provider)
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
